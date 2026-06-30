import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { adminDb } from "../src/lib/firebaseAdmin";

async function main() {
  const usersSnap = await adminDb.collection("users").limit(1).get();
  if (usersSnap.empty) {
    console.log("No users found in Firestore!");
    return;
  }
  const userDoc = usersSnap.docs[0];
  const userId = userDoc.id;
  console.log(`Found user: ${userId} (${userDoc.data().email})`);

  // Add a pending domain multiplier suggestion
  const sugRef1 = await adminDb.collection("users").doc(userId).collection("suggestions").add({
    type: "domain_multiplier",
    description: "You routinely underestimate Work tasks by 25%. Suggest adjusting Work multiplier to 1.25x.",
    proposedValue: { domain: "work", multiplier: 1.25 },
    confidence: 0.85,
    status: "pending",
    createdAt: new Date().toISOString()
  });
  console.log(`Created domain suggestion: ${sugRef1.id}`);

  // Add a pending attention span suggestion
  const sugRef2 = await adminDb.collection("users").doc(userId).collection("suggestions").add({
    type: "attention_span",
    description: "Your focus sessions show high burnout indicators after 35 minutes. Suggest adjusting attention span to 35 minutes.",
    proposedValue: 35,
    confidence: 0.92,
    status: "pending",
    createdAt: new Date().toISOString()
  });
  console.log(`Created attention span suggestion: ${sugRef2.id}`);
}

main().catch(console.error);
