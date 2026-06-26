import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { decrypt, encrypt } from "@/lib/auth/tokenEncryption";
import { callGemini } from "@/lib/ai/gemini";
import { buildGmailClassifierPrompt } from "@/lib/ai/prompts/gmailClassifier";
import { gmailSuggestionResponseSchema } from "@/lib/ai/schemas/gmailSuggestion";
import { Timestamp } from "firebase-admin/firestore";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

async function getValidAccessToken(userId: string): Promise<string> {
  const userRef = adminDb.collection("users").doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new Error("USER_NOT_FOUND");
  }

  const userData = userDoc.data();
  if (!userData) {
    throw new Error("USER_DATA_EMPTY");
  }

  const { googleAccessToken, googleRefreshToken, tokenExpiry } = userData;

  if (!googleAccessToken) {
    throw new Error("GMAIL_PERMISSION_DENIED");
  }

  const decryptedAccessToken = decrypt(googleAccessToken);
  const decryptedRefreshToken = googleRefreshToken ? decrypt(googleRefreshToken) : "";

  let isExpired = true;
  if (tokenExpiry) {
    const expiryMs = (tokenExpiry instanceof Timestamp ? tokenExpiry.toDate() : new Date(tokenExpiry)).getTime();
    isExpired = expiryMs - 5 * 60 * 1000 <= Date.now();
  }

  if (!isExpired) {
    return decryptedAccessToken;
  }

  if (!decryptedRefreshToken) {
    throw new Error("GMAIL_PERMISSION_DENIED");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: decryptedRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("GMAIL_PERMISSION_DENIED");
  }

  const data = await response.json();
  const newAccessToken = data.access_token;
  const expiresIn = data.expires_in || 3600;

  const encryptedAccessToken = encrypt(newAccessToken);
  const newExpiry = Timestamp.fromMillis(Date.now() + expiresIn * 1000);

  const updateData: any = {
    googleAccessToken: encryptedAccessToken,
    tokenExpiry: newExpiry,
    updatedAt: Timestamp.now(),
  };

  if (data.refresh_token) {
    updateData.googleRefreshToken = encrypt(data.refresh_token);
  }

  await userRef.update(updateData);
  return newAccessToken;
}

function extractBodyText(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = Buffer.from(payload.body.data, "base64").toString("utf8");
    return html.replace(/<[^>]*>/g, " ");
  }
  if (payload.parts) {
    let body = "";
    for (const part of payload.parts) {
      body += extractBodyText(part);
    }
    return body;
  }
  return "";
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = await params;
    const cookieUserId = req.cookies.get("session")?.value;

    if (!cookieUserId || cookieUserId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let accessToken = "";
    try {
      accessToken = await getValidAccessToken(userId);
    } catch (err: any) {
      if (err.message === "GMAIL_PERMISSION_DENIED") {
        return NextResponse.json(
          { error: "GMAIL_PERMISSION_DENIED", message: "Grant Gmail access in Settings to enable email scanning." },
          { status: 403 }
        );
      }
      throw err;
    }

    // 1. Fetch unread email message list
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread newer_than:7d",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!listRes.ok) {
      if (listRes.status === 403) {
        return NextResponse.json(
          { error: "GMAIL_PERMISSION_DENIED", message: "Grant Gmail access in Settings to enable email scanning." },
          { status: 403 }
        );
      }
      throw new Error(`Gmail API returned error: ${listRes.status}`);
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];
    const suggestions: any[] = [];

    // Limit to scanning up to 20 emails
    const emailsToProcess = messages.slice(0, 20);

    const todayStr = new Date().toISOString().split("T")[0];

    for (const msg of emailsToProcess) {
      // Check if suggestion already exists to avoid duplicate scanning
      const existing = await adminDb
        .collection("gmailSuggestions")
        .where("userId", "==", userId)
        .where("emailId", "==", msg.id)
        .get();

      if (!existing.empty) {
        // Skip scanning if already processed
        continue;
      }

      // Fetch message body
      const getRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!getRes.ok) continue;
      const emailData = await getRes.json();
      const payload = emailData.payload || {};
      const headers = payload.headers || [];

      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === "subject");
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from");

      const subject = subjectHeader ? subjectHeader.value : "No Subject";
      const sender = fromHeader ? fromHeader.value : "Unknown Sender";

      const emailText = extractBodyText(payload).substring(0, 2500);

      // Invoke Gemini classifier
      try {
        const systemInstruction =
          "You are FinishLine's Gmail Classifier. Analyze the email and structured task details.";
        const prompt = buildGmailClassifierPrompt(emailText, sender, subject, todayStr);

        const aiResult = await callGemini({
          systemInstruction,
          prompt,
          schema: gmailSuggestionResponseSchema,
          endpointType: "extraction",
        });

        // If confidence is high, consider it a commitment
        if (aiResult.confidence >= 0.75) {
          const suggestionDoc = {
            userId,
            emailId: msg.id,
            subject,
            sender,
            title: aiResult.extractedTitle,
            deadline: aiResult.extractedDeadline ? Timestamp.fromDate(new Date(aiResult.extractedDeadline)) : null,
            effort: aiResult.extractedEffort,
            domain: aiResult.extractedDomain,
            confidence: aiResult.confidence,
            status: "pending",
            createdAt: Timestamp.now(),
          };

          const docRef = await adminDb.collection("gmailSuggestions").add(suggestionDoc);

          suggestions.push({
            id: docRef.id,
            emailId: msg.id,
            subject,
            sender,
            title: aiResult.extractedTitle,
            deadline: aiResult.extractedDeadline,
            effort: aiResult.extractedEffort,
            domain: aiResult.extractedDomain,
            confidence: aiResult.confidence,
            status: "pending",
          });
        }
      } catch (geminiErr) {
        console.error(`Gemini classification failed for email ${msg.id}:`, geminiErr);
      }
    }

    return NextResponse.json(suggestions);
  } catch (error: any) {
    console.error("GET /api/gmail/scan/[userId] error:", error);
    return NextResponse.json(
      { error: "SCAN_FAILED", message: error.message || "Failed to scan Gmail inbox" },
      { status: 500 }
    );
  }
}
