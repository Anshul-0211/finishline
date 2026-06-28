import { adminMessaging } from "@/lib/firebase/admin";

/**
 * Sends a push notification for a commitment check-in to a device token via FCM.
 */
export async function sendCheckInNotification(
  fcmToken: string | null | undefined,
  commitmentId: string,
  title: string
): Promise<boolean> {
  if (!fcmToken) {
    console.warn(`[FCM] No FCM token found for commitment check-in: ${commitmentId}`);
    return false;
  }

  // Handle mock tokens for testing/scaffolding
  if (fcmToken === "mock-fcm-token" || fcmToken.startsWith("mock-")) {
    console.log(`[FCM] Mock FCM dispatch succeeded for token: ${fcmToken}`);
    return true;
  }

  try {
    console.log(`[FCM] Sending push notification to token for commitment: ${commitmentId}...`);
    await adminMessaging.send({
      token: fcmToken,
      notification: {
        title: "FinishLine Check-in",
        body: `How is "${title}" going?`,
      },
      data: {
        commitmentId,
        action: "checkin",
      },
    });
    console.log(`[FCM] Push notification successfully sent for commitment: ${commitmentId}.`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[FCM] Failed to send push notification: ${msg}`);
    return false;
  }
}
