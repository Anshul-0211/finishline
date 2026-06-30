import { callGemini, callGroqFallback } from "./gemini";
import { assembleCoreContext, assembleExtendedContext } from "./context";
import { ensureFreshContext } from "./freshness";
import { applyConfidenceAwareness, deriveConfidenceLabel } from "./confidence";
import { buildExtractionPrompt } from "./prompts/extraction";
import { buildFileExtractionPrompt } from "./prompts/fileExtraction";
import { buildActionPlanPrompt } from "./prompts/actionPlan";
import { buildRenegotiationPrompt } from "./prompts/renegotiation";
import { buildRiskExplanationPrompt } from "./prompts/riskExplanation";
import { buildWeeklyPlanningPrompt } from "./prompts/weeklyPlanning";
import { buildWeeklyReflectionPrompt } from "./prompts/weeklyReflection";

console.log("✓ All AI lib functions imported cleanly!");
