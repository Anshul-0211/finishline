import { adminDb } from "@/lib/firebase/admin";
import { decrypt, encrypt } from "@/lib/auth/tokenEncryption";
import { User } from "@/lib/types";
import { Timestamp } from "firebase-admin/firestore";
import { google } from "googleapis";

/**
 * Helper to recursively extract plain text or HTML body from a message payload.
 */
function getEmailBody(payload: any): string {
  if (!payload) return "";
  
  if (payload.body && payload.body.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }

  if (payload.parts) {
    // 1. Search for plain text part
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body && part.body.data) {
        return Buffer.from(part.body.data, "base64").toString("utf8");
      }
      if (part.parts) {
        const nested = getEmailBody(part);
        if (nested) return nested;
      }
    }
    // 2. Fallback to html text part (strip basic tags)
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body && part.body.data) {
        const html = Buffer.from(part.body.data, "base64").toString("utf8");
        return html.replace(/<[^>]*>/g, " ").trim();
      }
    }
  }

  return "";
}

/**
 * Retrieves the googleapis Gmail client for a given user.
 * Automatically handles token refresh.
 */
export async function getGmailClient(userId: string) {
  const userDoc = await adminDb.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found in database.`);
  }
  const user = userDoc.data() as User;
  
  const encryptedRefreshToken = (user as any).googleCalendarRefreshToken || user.googleRefreshToken;
  if (!encryptedRefreshToken) {
    throw new Error("Missing Google refresh token. Please connect Google account.");
  }
  const refreshToken = decrypt(encryptedRefreshToken);
  if (!refreshToken) {
    throw new Error("Failed to decrypt Google refresh token.");
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth Client ID or Client Secret is not set in environment.");
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://localhost:3000"
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  // Handle token refresh
  oauth2Client.on("tokens", async (tokens) => {
    const updates: Record<string, unknown> = {};
    if (tokens.access_token) {
      updates.googleAccessToken = encrypt(tokens.access_token);
      if (tokens.expiry_date) {
        updates.tokenExpiry = Timestamp.fromMillis(tokens.expiry_date);
      }
    }
    if (tokens.refresh_token) {
      updates.googleRefreshToken = encrypt(tokens.refresh_token);
    }
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = Timestamp.now();
      await adminDb.collection("users").doc(userId).update(updates);
      console.log(`[Gmail] Auto-refreshed and updated Google tokens in Firestore for user: ${userId}`);
    }
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Fetches recent emails for classification.
 */
export async function fetchRecentEmails(userId: string, maxResults = 20) {
  const gmail = await getGmailClient(userId);

  console.log(`[Gmail] Listing recent messages (max: ${maxResults}) for user ${userId}...`);
  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: "category:primary" // Scan only Primary category emails to filter out newsletters/promotions
  });

  const messages = listRes.data.messages || [];
  const emailList: Array<{ id: string; subject: string; from: string; body: string }> = [];

  for (const msg of messages) {
    if (!msg.id) continue;
    try {
      const emailDetail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full"
      });

      const headers = emailDetail.data.payload?.headers || [];
      const subject = headers.find(h => h.name?.toLowerCase() === "subject")?.value || "(No Subject)";
      const from = headers.find(h => h.name?.toLowerCase() === "from")?.value || "(Unknown)";
      const body = getEmailBody(emailDetail.data.payload);

      // Truncate email body to 2500 characters
      const truncatedBody = body.substring(0, 2500);

      emailList.push({
        id: msg.id,
        subject,
        from,
        body: truncatedBody
      });
    } catch (err: any) {
      console.error(`[Gmail] Failed to fetch email details for message ID: ${msg.id}. Error:`, err.message);
    }
  }

  return emailList;
}
