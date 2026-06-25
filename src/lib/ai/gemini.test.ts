import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { callGemini } from "./gemini";
import { z } from "zod";

const testSchema = z.object({
  reply: z.string(),
});

async function runTests() {
  console.log("=== RUNNING GEMINI WRAPPER TESTS ===");

  // Test 1: Standard Gemini Call
  try {
    console.log("\n[Test 1] Testing standard Gemini call...");
    const result = await callGemini({
      systemInstruction: "You are a test assistant. Always return JSON matching the schema.",
      prompt: "Say 'Hello from Gemini!'",
      schema: testSchema,
      endpointType: "explanation",
    });
    console.log("Gemini Response:", result);
    if (result.reply) {
      console.log("✓ Test 1 Passed!");
    } else {
      throw new Error("Invalid response format");
    }
  } catch (err) {
    console.error("✗ Test 1 Failed:", err);
  }

  // Test 2: Groq Fallback Gating
  const originalKey = process.env.GEMINI_API_KEY;
  try {
    console.log("\n[Test 2] Testing Groq Fallback (sabotaging GEMINI_API_KEY)...");
    process.env.GEMINI_API_KEY = "invalid-key-to-force-fallback";

    if (!process.env.GROQ_API_KEY) {
      console.warn("Skipping Test 2: GROQ_API_KEY is not configured in .env.local");
      return;
    }

    const result = await callGemini({
      systemInstruction: "You are a test assistant. Always return JSON matching the schema.",
      prompt: "Say 'Hello from Groq!'",
      schema: testSchema,
      endpointType: "explanation",
    });
    console.log("Fallback Response:", result);
    if (result.reply) {
      console.log("✓ Test 2 Passed!");
    } else {
      throw new Error("Invalid response format from fallback");
    }
  } catch (err) {
    console.error("✗ Test 2 Failed:", err);
  } finally {
    process.env.GEMINI_API_KEY = originalKey;
  }
}

runTests().catch(console.error);
