import { adminDb, adminMessaging } from "../firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Registers the user's FCM token in their Firestore document.
 */
export async function registerFCMToken(userId: string, token: string): Promise<void> {
  try {
    const userRef = adminDb.collection("users").doc(userId);
    await userRef.update({
      fcmToken: token,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error(`Failed to register FCM token for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Sends a Check-in push notification and writes an in-app notification doc to Firestore.
 */
export async function sendCheckInNotification(
  userId: string,
  commitment: { id: string; title: string; riskScore: number }
): Promise<void> {
  const now = Timestamp.now();

  try {
    // 1. Write to in-app notifications subcollection
    const notificationsRef = adminDb.collection("users").doc(userId).collection("notifications");
    await notificationsRef.add({
      type: "checkin",
      commitmentId: commitment.id,
      title: commitment.title,
      riskScore: commitment.riskScore,
      read: false,
      createdAt: now,
    });

    // 2. Fetch user's FCM token from Firestore
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const token = userData?.fcmToken;

    if (token) {
      try {
        await adminMessaging.send({
          token,
          notification: {
            title: `Check-in: ${commitment.title}`,
            body: `Risk score is ${commitment.riskScore}. Tap to update your progress.`,
          },
          data: {
            type: "checkin",
            commitmentId: commitment.id,
          },
        });
      } catch (fcmError: any) {
        console.error(`FCM send failed for user ${userId}:`, fcmError);
        // Handle invalid token / unregistered token by removing it
        if (fcmError.code === "messaging/invalid-argument" || fcmError.code === "messaging/registration-token-not-registered") {
          await adminDb.collection("users").doc(userId).update({ fcmToken: "" });
        }
      }
    }
  } catch (error) {
    console.error(`Failed to send check-in notification for user ${userId}:`, error);
  }
}

/**
 * Sends a Collision push notification and writes an in-app notification doc to Firestore.
 */
export async function sendCollisionNotification(
  userId: string,
  collision: {
    commitmentA: { id: string; title: string };
    commitmentB: { id: string; title: string };
  }
): Promise<void> {
  const now = Timestamp.now();

  try {
    // 1. Write to in-app notifications subcollection
    const notificationsRef = adminDb.collection("users").doc(userId).collection("notifications");
    await notificationsRef.add({
      type: "collision",
      commitmentAId: collision.commitmentA.id,
      commitmentATitle: collision.commitmentA.title,
      commitmentBId: collision.commitmentB.id,
      commitmentBTitle: collision.commitmentB.title,
      read: false,
      createdAt: now,
    });

    // 2. Fetch user's FCM token
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const token = userData?.fcmToken;

    if (token) {
      try {
        await adminMessaging.send({
          token,
          notification: {
            title: "Scheduling collision detected",
            body: `${collision.commitmentA.title} and ${collision.commitmentB.title} share overlapping work blocks.`,
          },
          data: {
            type: "collision",
            commitmentAId: collision.commitmentA.id,
            commitmentBId: collision.commitmentB.id,
          },
        });
      } catch (fcmError: any) {
        console.error(`FCM send failed for user ${userId}:`, fcmError);
        if (fcmError.code === "messaging/invalid-argument" || fcmError.code === "messaging/registration-token-not-registered") {
          await adminDb.collection("users").doc(userId).update({ fcmToken: "" });
        }
      }
    }
  } catch (error) {
    console.error(`Failed to send collision notification for user ${userId}:`, error);
  }
}
