import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { adminDb } from "../src/lib/firebaseAdmin";
import { processBurnout } from "../src/lib/services/agent/burnout";
import { User, Commitment } from "../src/lib/types";

async function main() {
  console.log("==========================================");
  console.log("RUNNING BURNOUT DETECTION SERVICE TEST...");
  console.log("==========================================");

  // 1. Get or create a test user
  const email = "testuser@finishline.com";
  console.log(`Searching for test user with email: ${email}...`);
  const usersSnap = await adminDb.collection("users").where("email", "==", email).get();

  let userId: string;
  let user: User;

  if (usersSnap.empty) {
    console.log("Test user not found, seeding a new test user...");
    // Create mock user
    const userRef = await adminDb.collection("users").add({
      email,
      displayName: "Test User Priya",
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
        currentStreak: 0,
        longestStreak: 0,
        totalCommitmentsCreated: 0,
        totalCompleted: 0,
        totalMissed: 0,
        burnoutDetected: false,
        burnoutLastEvaluatedAt: null
      },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    });
    userId = userRef.id;
    console.log(`Created new test user doc with ID: ${userId}`);
    const userDoc = await userRef.get();
    user = { uid: userId, ...userDoc.data() } as User;
  } else {
    const userDoc = usersSnap.docs[0];
    userId = userDoc.id;
    user = { uid: userId, ...userDoc.data() } as User;
    console.log(`Found existing test user with UID: ${userId}`);
  }

  // 2. Clean up commitments for this user first
  console.log("Cleaning up commitments for test user...");
  const commsSnap = await adminDb.collection("users").doc(userId).collection("commitments").get();
  const batch = adminDb.batch();
  commsSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
  await batch.commit();
  console.log("Cleaned up existing commitments.");

  // Test Case 1: Low stress, no renegotiations -> Burnout should be false
  console.log("\n------------------------------------------");
  console.log("TEST CASE 1: Low stress (60), no recent renegotiations");
  console.log("------------------------------------------");
  user.stats = {
    ...user.stats,
    stressScore: 60,
    burnoutDetected: false,
    burnoutLastEvaluatedAt: null
  };
  await adminDb.collection("users").doc(userId).update({
    "stats.stressScore": 60,
    "stats.burnoutDetected": false,
    "stats.burnoutLastEvaluatedAt": null
  });

  const commitments1: Commitment[] = [
    {
      id: "c1",
      title: "Active Task 1",
      description: "Active task without renegotiations",
      domain: "work",
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      isLongTermGoal: false,
      effortEstimateHours: 2,
      status: "active",
      completionPercentage: 0,
      createdAt: new Date().toISOString(),
      adjustedEffortHours: 2,
      completedEffortHours: 0,
      lastCheckInAt: null,
      lastResurfacedAt: null,
      updatedAt: new Date().toISOString(),
      tags: [],
      extractedByAI: false,
      extractionConfidence: 1.0,
      source: "manual",
      sourceFileUrl: null,
      gmailMessageId: null,
      actionPlan: null,
      renegotiationHistory: []
    }
  ];

  let result1 = await processBurnout(user, commitments1);
  console.log(`Result 1 (burnoutDetected): ${result1}`);
  if (result1 !== false) {
    throw new Error(`Expected burnout to be false, but got ${result1}`);
  }

  // Verify DB updated
  let dbUserDoc = await adminDb.collection("users").doc(userId).get();
  let dbUser = dbUserDoc.data();
  console.log(`DB stats.burnoutDetected: ${dbUser?.stats?.burnoutDetected}`);
  console.log(`DB stats.burnoutLastEvaluatedAt: ${dbUser?.stats?.burnoutLastEvaluatedAt}`);
  if (dbUser?.stats?.burnoutDetected !== false) {
    throw new Error("Firestore stats.burnoutDetected not updated to false in DB");
  }

  // Test Case 2: High stress (> 75) -> Burnout should be true
  console.log("\n------------------------------------------");
  console.log("TEST CASE 2: High stress (80), no renegotiations");
  console.log("------------------------------------------");
  user.stats.stressScore = 80;
  await adminDb.collection("users").doc(userId).update({
    "stats.stressScore": 80
  });

  let result2 = await processBurnout(user, commitments1);
  console.log(`Result 2 (burnoutDetected): ${result2}`);
  if (result2 !== true) {
    throw new Error(`Expected burnout to be true (stress score 80 > 75), but got ${result2}`);
  }

  // Verify DB updated
  dbUserDoc = await adminDb.collection("users").doc(userId).get();
  dbUser = dbUserDoc.data();
  console.log(`DB stats.burnoutDetected: ${dbUser?.stats?.burnoutDetected}`);
  if (dbUser?.stats?.burnoutDetected !== true) {
    throw new Error("Firestore stats.burnoutDetected not updated to true in DB");
  }

  // Test Case 3: Low stress (50), but > 2 renegotiation history entries in the past 7 days -> Burnout should be true
  console.log("\n------------------------------------------");
  console.log("TEST CASE 3: Low stress (50), > 2 renegotiations in past 7 days");
  console.log("------------------------------------------");
  user.stats.stressScore = 50;
  await adminDb.collection("users").doc(userId).update({
    "stats.stressScore": 50
  });

  const commitments2: Commitment[] = [
    {
      id: "c2",
      title: "Renegotiated Task",
      description: "Task with 3 recent renegotiations",
      domain: "academic",
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      isLongTermGoal: false,
      effortEstimateHours: 4,
      status: "active",
      completionPercentage: 10,
      createdAt: new Date().toISOString(),
      adjustedEffortHours: 4,
      completedEffortHours: 0,
      lastCheckInAt: null,
      lastResurfacedAt: null,
      updatedAt: new Date().toISOString(),
      tags: [],
      extractedByAI: false,
      extractionConfidence: 1.0,
      source: "manual",
      sourceFileUrl: null,
      gmailMessageId: null,
      actionPlan: null,
      renegotiationHistory: [
        {
          at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          failureReason: "Got busy",
          outcome: "accepted",
          oldDeadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          newDeadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          failureReason: "Underestimated effort",
          outcome: "accepted",
          oldDeadline: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          newDeadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
          failureReason: "Got busy again",
          outcome: "accepted",
          oldDeadline: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          newDeadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    }
  ];

  let result3 = await processBurnout(user, commitments2);
  console.log(`Result 3 (burnoutDetected): ${result3}`);
  if (result3 !== true) {
    throw new Error(`Expected burnout to be true (> 2 recent renegotiations), but got ${result3}`);
  }

  // Verify DB updated
  dbUserDoc = await adminDb.collection("users").doc(userId).get();
  dbUser = dbUserDoc.data();
  console.log(`DB stats.burnoutDetected: ${dbUser?.stats?.burnoutDetected}`);
  if (dbUser?.stats?.burnoutDetected !== true) {
    throw new Error("Firestore stats.burnoutDetected not updated to true in DB");
  }

  console.log("\n==========================================");
  console.log("ALL BURNOUT DETECTION UNIT TESTS PASSED!");
  console.log("==========================================");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
