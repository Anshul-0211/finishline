import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { adminDb } from "../src/lib/firebaseAdmin";

async function main() {
  const email = "testuser@finishline.com";
  const password = "TestPassword123!";
  const userId = "mbSXeuywDtSrkpO1vIakCPbYjxG2";
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey) {
    console.error("Error: NEXT_PUBLIC_FIREBASE_API_KEY is not defined in .env.local");
    process.exit(1);
  }

  console.log(`[Replan Tester] 1. Logging in as ${email} to retrieve Firebase ID Token...`);
  const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const authRes = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  if (!authRes.ok) {
    const errData = await authRes.json();
    console.error("Firebase Login failed:", JSON.stringify(errData, null, 2));
    process.exit(1);
  }

  const authData = await authRes.json();
  const idToken = authData.idToken;
  console.log(`[Replan Tester] Success! ID Token retrieved (first 30 chars): ${idToken.slice(0, 30)}...`);

  // 2. Insert a temporary mock commitment in Firestore for testing
  const tempCommitmentId = "temp-replan-exam-prep";
  console.log(`[Replan Tester] 2. Creating temporary commitment ${tempCommitmentId} in Firestore...`);
  const commitmentRef = adminDb
    .collection("users")
    .doc(userId)
    .collection("commitments")
    .doc(tempCommitmentId);

  await commitmentRef.set({
    title: "OS Presentation Prep (Temp)",
    domain: "academic",
    effortEstimateHours: 2,
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    status: "active",
    createdAt: new Date().toISOString()
  });

  // Colliding blocks on Tuesday 10:30 - 12:30 (Existing work task is scheduled 10:00 - 12:00)
  const proposedBlocks = [
    { start: "2026-06-30T10:30:00.000Z", end: "2026-06-30T12:30:00.000Z" }
  ];

  console.log(`[Replan Tester] 3. Building request payload...`);
  const payload = {
    userId,
    newCommitmentId: tempCommitmentId,
    proposedBlocks
  };

  console.log("\n=== POST REQUEST DETAILS ===");
  console.log("URL: http://localhost:3000/api/ai/replan-on-add");
  console.log("Headers:");
  console.log(`  Authorization: Bearer ${idToken.slice(0, 20)}...[truncated]`);
  console.log("  Content-Type: application/json");
  console.log("Body:", JSON.stringify(payload, null, 2));

  console.log("\n=== EQUIVALENT CURL COMMAND ===");
  console.log(`curl -X POST http://localhost:3000/api/ai/replan-on-add \\
  -H "Authorization: Bearer ${idToken}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload)}'`);

  console.log("\n[Replan Tester] 4. Triggering local API request (trying ports 3001 and 3000)...");
  let apiRes;
  try {
    console.log("[Replan Tester] Trying http://localhost:3001/api/ai/replan-on-add...");
    apiRes = await fetch("http://localhost:3001/api/ai/replan-on-add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    console.log(`[Replan Tester] Port 3001 failed (${err.message}). Trying http://localhost:3000/api/ai/replan-on-add...`);
    try {
      apiRes = await fetch("http://localhost:3000/api/ai/replan-on-add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(payload),
      });
    } catch (err2: any) {
      console.error("\n[Replan Tester] Request failed on both ports 3000 and 3001.");
      console.log("[Replan Tester] Please ensure Next.js dev server is running.");
      process.exit(1);
    }
  }

  try {
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      throw new Error(`API Responded with status ${apiRes.status}: ${errText}`);
    }

    const result = await apiRes.json();
    console.log("\n=== API RESPONSE ===");
    console.log(JSON.stringify(result, null, 2));

  } catch (err: any) {
    console.error("\n[Replan Tester] Parsing failed:", err.message);
  } finally {
    // 5. Clean up the temporary commitment
    console.log(`\n[Replan Tester] 5. Cleaning up temporary commitment ${tempCommitmentId}...`);
    await commitmentRef.delete();
    console.log("[Replan Tester] Cleanup complete.");
  }
}

main().catch(console.error);
