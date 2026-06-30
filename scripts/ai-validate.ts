import { loadEnvConfig } from "@next/env";

// Load Next.js environment configuration
loadEnvConfig(process.cwd());

// Set mock mode for Firestore and Auth
process.env.FINISHLINE_VALIDATION_MOCK = "true";

console.log("========================================================================");
console.log("          FinishLine AI Infrastructure Validation Suite Entry           ");
console.log("========================================================================\n");

// Dynamically import and run the main validation runner
import("./ai-validate-runner")
  .then(async (m) => {
    await m.run();
  })
  .catch((err) => {
    console.error("Fatal error during validation runner setup:", err);
    process.exit(1);
  });
