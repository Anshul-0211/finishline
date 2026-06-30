import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getActiveCommitmentsForUser } from "../src/lib/services/agent/scan";

async function main() {
  const userId = "mbSXeuywDtSrkpO1vIakCPbYjxG2";
  console.log(`Running getActiveCommitmentsForUser for user: ${userId}...`);
  try {
    const list = await getActiveCommitmentsForUser(userId);
    console.log(`Successfully fetched ${list.length} commitments!`);
  } catch (err: any) {
    console.error("Query failed:", err.message);
  }
}

main().catch(console.error);
