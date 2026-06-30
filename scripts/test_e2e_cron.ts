import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { adminDb } from "../src/lib/firebaseAdmin";
import { getActiveCommitmentsForUser } from "../src/lib/services/agent/scan";
import { FieldValue } from "firebase-admin/firestore";

async function main() {
  const userId = "mbSXeuywDtSrkpO1vIakCPbYjxG2";
  console.log("1. Cleaning up existing commitments...");
  const commitmentsSnap = await adminDb.collection("users").doc(userId).collection("commitments").get();
  const batch = adminDb.batch();
  commitmentsSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
  await batch.commit();

  console.log("2. Adding a new dirty commitment...");
  const newCommitmentRef = await adminDb.collection("users").doc(userId).collection("commitments").add({
    title: "Test Cron Optimization Task",
    description: "Verify that isDirty and lastEvaluatedAt flags work E2E",
    domain: "work",
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    isLongTermGoal: false,
    effortEstimateHours: 3,
    status: "active",
    completionPercentage: 0,
    isDirty: true,
    lastEvaluatedAt: null,
    createdAt: new Date().toISOString()
  });
  console.log(`Created commitment: ${newCommitmentRef.id}`);

  console.log("3. Fetching active commitments (should fetch 1)...");
  let list = await getActiveCommitmentsForUser(userId);
  console.log(`Fetched commitments count: ${list.length}`);
  if (list.length !== 1) {
    throw new Error(`Expected 1 commitment, got ${list.length}`);
  }
  console.log(`Fetched commitment: "${list[0].title}" (isDirty: ${list[0].isDirty}, lastEvaluatedAt: ${list[0].lastEvaluatedAt})`);

  console.log("4. Simulating agent run (updating isDirty and lastEvaluatedAt)...");
  const batchUpdate = adminDb.batch();
  batchUpdate.update(newCommitmentRef, {
    isDirty: false,
    lastEvaluatedAt: FieldValue.serverTimestamp()
  });
  await batchUpdate.commit();
  console.log("Reset isDirty to false and updated lastEvaluatedAt.");

  console.log("5. Fetching active commitments again (should fetch 0 since it is not dirty or stale)...");
  list = await getActiveCommitmentsForUser(userId);
  console.log(`Fetched commitments count: ${list.length}`);
  if (list.length !== 0) {
    throw new Error(`Expected 0 commitments, got ${list.length}`);
  }

  console.log("6. Simulating passage of 5 hours (updating lastEvaluatedAt to 5 hours ago)...");
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
  await newCommitmentRef.update({
    lastEvaluatedAt: fiveHoursAgo
  });
  console.log(`Updated lastEvaluatedAt to: ${fiveHoursAgo.toISOString()}`);

  console.log("7. Fetching active commitments again (should fetch 1 since it is now stale)...");
  list = await getActiveCommitmentsForUser(userId);
  console.log(`Fetched commitments count: ${list.length}`);
  if (list.length !== 1) {
    throw new Error(`Expected 1 commitment, got ${list.length}`);
  }
  console.log(`Successfully verified stale retrieval! Title: "${list[0].title}"`);
  console.log("E2E CRON QUERY OPTIMIZATION VALIDATION PASSED!");
}

main().catch(console.error);
