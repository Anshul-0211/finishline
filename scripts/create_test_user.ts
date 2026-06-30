import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { adminAuth, adminDb } from "../src/lib/firebaseAdmin";

async function main() {
  const email = "testuser@finishline.com";
  const password = "TestPassword123!";
  const displayName = "Test User Priya";

  console.log(`[Test User Creator] Checking if user ${email} already exists...`);
  
  let userRecord;
  try {
    userRecord = await adminAuth.getUserByEmail(email);
    console.log(`[Test User Creator] User already exists with UID: ${userRecord.uid}. Re-initializing profile...`);
  } catch (err: any) {
    if (err.code === "auth/user-not-found") {
      console.log(`[Test User Creator] User not found. Creating user in Firebase Auth...`);
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName,
        emailVerified: true
      });
      console.log(`[Test User Creator] Created user with UID: ${userRecord.uid}`);
    } else {
      throw err;
    }
  }

  const userId = userRecord.uid;

  // Initialize Firestore User Document
  console.log(`[Test User Creator] Setting Firestore document for user: ${userId}...`);
  await adminDb.collection("users").doc(userId).set({
    uid: userId,
    email,
    displayName,
    photoURL: "",
    preferences: {
      timezone: "UTC",
      defaultCalendarId: "primary",
      workingHours: { start: 9, end: 17 },
      defaultDomain: "work",
      notificationsEnabled: false,
      fcmToken: "",
      theme: "system"
    },
    learningCoefficients: {
      underestimationFactor: 1.0,
      preferredWorkHours: [9, 10, 14, 15, 20, 21],
      lastUpdated: null,
      averageAttentionSpanMinutes: 25,
      domainEffortMultipliers: {
        work: 1.0,
        academic: 1.0,
        personal: 1.0,
        health: 1.0
      }
    },
    stats: {
      stressScore: 15,
      stressScoreComputedAt: new Date().toISOString(),
      currentStreak: 0,
      longestStreak: 0,
      totalCommitmentsCreated: 0,
      totalCompleted: 0,
      totalMissed: 0
    },
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString()
  });

  // Clear existing suggestions under this user
  console.log(`[Test User Creator] Cleaning up existing suggestions...`);
  const suggestionsSnap = await adminDb.collection("users").doc(userId).collection("suggestions").get();
  const batch = adminDb.batch();
  suggestionsSnap.docs.forEach((doc: any) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Add fresh mock suggestions
  console.log(`[Test User Creator] Inserting fresh suggestions...`);
  const sugRef1 = await adminDb.collection("users").doc(userId).collection("suggestions").add({
    type: "domain_multiplier",
    description: "You routinely underestimate Work tasks by 25%. Suggest adjusting Work multiplier to 1.25x.",
    proposedValue: { domain: "work", multiplier: 1.25 },
    confidence: 0.85,
    status: "pending",
    createdAt: new Date().toISOString()
  });

  const sugRef2 = await adminDb.collection("users").doc(userId).collection("suggestions").add({
    type: "attention_span",
    description: "Your focus sessions show high burnout indicators after 35 minutes. Suggest adjusting attention span to 35 minutes.",
    proposedValue: 35,
    confidence: 0.92,
    status: "pending",
    createdAt: new Date().toISOString()
  });

  console.log(`[Test User Creator] Success! Created suggestions:`);
  console.log(` - Domain multiplier: ${sugRef1.id}`);
  console.log(` - Attention span: ${sugRef2.id}`);
  console.log(`\n======================================`);
  console.log(`TEST USER CREDENTIALS FOR SIGN IN:`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`======================================\n`);
}

main().catch(console.error);
