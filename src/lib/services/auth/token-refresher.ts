import { adminDb } from "@/lib/firebaseAdmin";
import { decrypt, encrypt } from "@/lib/auth/tokenEncryption";
import { google } from "googleapis";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Interface defining the TokenRefresherService getFreshAccessToken signature.
 */
export async function getFreshAccessToken(
  userId: string,
  tokenType: 'calendar' | 'gmail'
): Promise<string> {
  const userDoc = await adminDb.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found in database.`);
  }
  const user = userDoc.data();
  if (!user) {
    throw new Error(`User data for ${userId} is empty.`);
  }

  // 1. Retrieve the stored refresh token based on tokenType
  let encryptedRefreshToken = "";
  if (tokenType === "calendar") {
    encryptedRefreshToken = user.googleCalendarRefreshToken || user.googleRefreshToken;
  } else {
    encryptedRefreshToken = user.googleGmailRefreshToken || user.googleCalendarRefreshToken || user.googleRefreshToken;
  }

  if (!encryptedRefreshToken) {
    throw new Error(`Missing Google refresh token for ${tokenType}. Please connect Google account.`);
  }

  const refreshToken = decrypt(encryptedRefreshToken);
  if (!refreshToken) {
    throw new Error(`Failed to decrypt Google refresh token for ${tokenType}.`);
  }

  // Edge Case: If the stored token is actually a Google access token (starts with "ya29."),
  // we are in the client-side popup fallback / demo hack mode. Return it directly.
  if (refreshToken.startsWith("ya29.")) {
    console.log(`[TokenRefresher] Stored token is an access token (demo fallback). Returning directly for ${tokenType}.`);
    return refreshToken;
  }

  // 2. Check if we already have a cached access token that is still valid
  const encryptedAccessToken = user.googleAccessToken;
  const expiry = user.tokenExpiry;

  if (encryptedAccessToken && expiry) {
    let expiryMillis = 0;
    if (typeof expiry.toMillis === "function") {
      expiryMillis = expiry.toMillis();
    } else if (expiry.seconds) {
      expiryMillis = expiry.seconds * 1000;
    } else {
      expiryMillis = new Date(expiry).getTime();
    }

    // Give a 5-minute safety buffer before token expiration
    if (expiryMillis > Date.now() + 5 * 60 * 1000) {
      const cachedToken = decrypt(encryptedAccessToken);
      if (cachedToken) {
        console.log(`[TokenRefresher] Using cached valid access token from Firestore for ${tokenType}.`);
        return cachedToken;
      }
    }
  }

  // 3. Dispatch an HTTP POST request to Google's OAuth token endpoint to refresh
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

  const response = await oauth2Client.getAccessToken();
  const freshAccessToken = response.token;
  if (!freshAccessToken) {
    throw new Error(`Failed to refresh access token for type ${tokenType}`);
  }

  // 4. Write the fresh access token and calculated expiration timestamp back to Firestore
  const updates: Record<string, any> = {
    googleAccessToken: encrypt(freshAccessToken),
    updatedAt: Timestamp.now()
  };

  const expiryDate = response.res?.data?.expiry_date;
  if (expiryDate) {
    updates.tokenExpiry = Timestamp.fromMillis(expiryDate);
  } else {
    // Default fallback to 1 hour (3550 seconds from now)
    updates.tokenExpiry = Timestamp.fromMillis(Date.now() + 3550 * 1000);
  }

  await adminDb.collection("users").doc(userId).update(updates);
  console.log(`[TokenRefresher] Successfully refreshed Google access token for user: ${userId}`);

  return freshAccessToken;
}
