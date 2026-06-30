import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { adminDb } from "../src/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

async function main() {
  const userId = "mbSXeuywDtSrkpO1vIakCPbYjxG2"; // testuser@finishline.com UID
  console.log(`[Test Data Populator] Populating commitments for test user: ${userId}...`);

  // 1. Clear existing commitments
  const commitmentsSnap = await adminDb.collection("users").doc(userId).collection("commitments").get();
  const batch = adminDb.batch();
  commitmentsSnap.docs.forEach((doc: any) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`[Test Data Populator] Cleared ${commitmentsSnap.size} existing commitments.`);

  // Define realistic past week commitments (half completed, half missed/partially done)
  const pastWeekDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString();
  };

  const upcomingWeekDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString();
  };

  const mockCommitments = [
    // --- PAST WEEK: COMPLETED TASKS ---
    {
      title: "Draft OS Shell Assignment",
      description: "Implement basic command loop and fork/exec commands.",
      domain: "academic",
      status: "completed",
      effortEstimateHours: 4,
      completedEffortHours: 6, // Underestimated!
      completionPercentage: 100,
      createdAt: pastWeekDate(6),
      deadline: pastWeekDate(2),
      isLongTermGoal: false,
      isDirty: true,
      lastEvaluatedAt: null,
      tags: ["CS", "OS"],
      source: "manual",
      extractedByAI: false,
      extractionConfidence: 1.0,
      completedAt: pastWeekDate(2)
    },
    {
      title: "Work: Refactor API Gateways",
      description: "Standardize client wrappers and fallback paths.",
      domain: "work",
      status: "completed",
      effortEstimateHours: 5,
      completedEffortHours: 8, // Underestimated!
      completionPercentage: 100,
      createdAt: pastWeekDate(5),
      deadline: pastWeekDate(1),
      isLongTermGoal: false,
      isDirty: true,
      lastEvaluatedAt: null,
      tags: ["work", "refactor"],
      source: "manual",
      extractedByAI: false,
      extractionConfidence: 1.0,
      completedAt: pastWeekDate(1)
    },
    {
      title: "Gym Workout - Leg Day",
      description: "Squats, lunges, and calf raises.",
      domain: "health",
      status: "completed",
      effortEstimateHours: 1.5,
      completedEffortHours: 1.5, // Exactly on time
      completionPercentage: 100,
      createdAt: pastWeekDate(4),
      deadline: pastWeekDate(4),
      isLongTermGoal: false,
      isDirty: true,
      lastEvaluatedAt: null,
      tags: ["health", "workout"],
      source: "manual",
      extractedByAI: false,
      extractionConfidence: 1.0,
      completedAt: pastWeekDate(4)
    },

    // --- PAST WEEK: MISSED/PARTIAL TASKS ---
    {
      title: "Read CS Research Paper",
      description: "Read paper on memory virtualization and draft a 1-page summary.",
      domain: "academic",
      status: "missed",
      effortEstimateHours: 3,
      completedEffortHours: 1.0, // Partially attempted but missed
      completionPercentage: 30,
      createdAt: pastWeekDate(4),
      deadline: pastWeekDate(2),
      failureReason: "Got overwhelmed by the OS Shell assignment which ran over time.",
      isLongTermGoal: false,
      isDirty: true,
      lastEvaluatedAt: null,
      tags: ["research"],
      source: "manual",
      extractedByAI: false,
      extractionConfidence: 1.0
    },
    {
      title: "Personal: Organize Study Desk",
      description: "Clean up desk, organize notebooks, and mount pegboard.",
      domain: "personal",
      status: "missed",
      effortEstimateHours: 2,
      completedEffortHours: 0, // Unattempted
      completionPercentage: 0,
      createdAt: pastWeekDate(3),
      deadline: pastWeekDate(1),
      failureReason: "Lost motivation and procrastinated during the weekend.",
      isLongTermGoal: false,
      isDirty: true,
      lastEvaluatedAt: null,
      tags: ["cleanup"],
      source: "manual",
      extractedByAI: false,
      extractionConfidence: 1.0
    },
    {
      title: "Health: Meal Prep for Week",
      description: "Cook brown rice, chicken, and roasted veggies for week lunches.",
      domain: "health",
      status: "missed",
      effortEstimateHours: 3,
      completedEffortHours: 0,
      completionPercentage: 0,
      createdAt: pastWeekDate(2),
      deadline: pastWeekDate(1),
      failureReason: "Spent Sunday evening resting and hanging out with family.",
      isLongTermGoal: false,
      isDirty: true,
      lastEvaluatedAt: null,
      tags: ["mealprep"],
      source: "manual",
      extractedByAI: false,
      extractionConfidence: 1.0
    },

    // --- CURRENT/UPCOMING ACTIVE TASKS ---
    {
      title: "Prepare OS Presentation",
      description: "Build slides demonstrating the OS Shell design and run demo.",
      domain: "academic",
      status: "active",
      effortEstimateHours: 4,
      completedEffortHours: 0,
      completionPercentage: 0,
      createdAt: pastWeekDate(1),
      deadline: upcomingWeekDate(3),
      isLongTermGoal: false,
      isDirty: true,
      lastEvaluatedAt: null,
      tags: ["presentation"],
      source: "manual",
      extractedByAI: false,
      extractionConfidence: 1.0,
      scheduledBlocks: [
        { start: upcomingWeekDate(1) + "T10:00:00Z", end: upcomingWeekDate(1) + "T12:00:00Z" }
      ]
    },
    {
      title: "Work: Write API Tests",
      description: "Write integration tests using jest/supertest for user routes.",
      domain: "work",
      status: "active",
      effortEstimateHours: 6,
      completedEffortHours: 0,
      completionPercentage: 0,
      createdAt: pastWeekDate(1),
      deadline: upcomingWeekDate(5),
      isLongTermGoal: false,
      isDirty: true,
      lastEvaluatedAt: null,
      tags: ["work", "testing"],
      source: "manual",
      extractedByAI: false,
      extractionConfidence: 1.0,
      scheduledBlocks: [
        { start: upcomingWeekDate(2) + "T14:00:00Z", end: upcomingWeekDate(2) + "T17:00:00Z" }
      ]
    }
  ];

  // Insert mock commitments into Firestore
  console.log(`[Test Data Populator] Inserting ${mockCommitments.length} mock commitments...`);
  const insertBatch = adminDb.batch();
  const commitmentsCol = adminDb.collection("users").doc(userId).collection("commitments");

  for (const c of mockCommitments) {
    const docRef = commitmentsCol.doc();
    insertBatch.set(docRef, c);
  }
  await insertBatch.commit();

  // Reset the user's weekly reflection and plan cache, and update stats to reflect a 50% completion rate
  console.log("[Test Data Populator] Clearing user cached reflection & plan and updating stats...");
  await adminDb.collection("users").doc(userId).update({
    lastWeeklyReflection: null,
    lastWeeklyReflectionGeneratedAt: null,
    lastWeeklyPlan: null,
    lastWeeklyPlanGeneratedAt: null,
    "stats.totalCommitmentsCreated": 6,
    "stats.totalCompleted": 3,
    "stats.totalMissed": 3,
    "stats.stressScore": 15
  });

  console.log("[Test Data Populator] SUCCESS! Test user mbSXeuywDtSrkpO1vIakCPbYjxG2 profile populated successfully.");
}

main().catch(console.error);
