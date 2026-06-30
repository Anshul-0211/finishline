# FinishLine AI Infrastructure Validation Suite

The AI Infrastructure Validation Suite is the canonical developer utility for checking the health and configuration of the FinishLine AI platform. 

It provides validation across 8 distinct layers of the AI gateway, capability routing, schema serialization, endpoint handlers, and end-to-end user journeys.

---

## Quick Start

Run the validation suite with a single command from the project root:

```bash
npm run ai:validate
```

This command runs `tsx scripts/ai-validate.ts`, which sets up a sandboxed, mock-enabled environment to securely execute the tests without modifying production data or hitting external database/auth requirements.

---

## Validation Layers

The suite runs checks sequentially across the following layers:

### Layer 1: Environment Checks
Verifies that all required and optional environment variables exist in your `.env.local` file. 
* **Required keys**: `GEMINI_API_KEY` (Primary LLM provider).
* **Optional keys**: `GROQ_API_KEY` (Fallback provider), `FIREBASE_PROJECT_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

### Layer 2: Provider Connectivity
Executes direct, lightweight ping checks against the raw configured client APIs (`getGoogleClient()` and `getGroqClient()`) to verify network access and API credentials. It measures response latency in milliseconds.

### Layer 3: AI Gateway Validation
Verifies the custom `callGateway` provider-agnostic wrapper. It tests standard parameter formatting, Zod serialization, and client instantiation logic.

### Layer 4: Capability Routing
Verifies that the static capability routing maps each task to the correct primary and fallback providers, checking temperatures and model configurations for:
* `extraction` (temp: 0.1)
* `explanation` (temp: 0.2)
* `action-plan` (temp: 0.4)
* `renegotiation` (temp: 0.6)
* `weekly-planning` (temp: 0.5)
* `weekly-reflection` (temp: 0.6)

### Layer 5: Fallback Validation
Simulates a primary provider failure (by temporarily clearing `GEMINI_API_KEY`) and verifies that requests automatically failover to the Groq fallback provider seamlessly without throwing client errors.

### Layer 6: Schema Validation
Tests the structured response schemas (via Zod double-validation) on every capability endpoint using minimal real queries to ensure the AI responses conform exactly to Zod definitions.

### Layer 7: Next.js API Route Handlers
Validates Next.js App Router API route handlers by importing their `POST` methods and calling them directly with mock `NextRequest` objects.
For each endpoint, it verifies:
* **Response Status**: 200 on success, 400 on invalid payload.
* **Authentication Gating**: returns 401/403 when the `Authorization` header is missing.
* **Payload Conformity**: returns objects that match Zod schemas.
* **Provider Metadata**: includes confidence scores (`aiMeta.confidence`), confidence labels (`aiMeta.confidenceLabel`), and reasoning explanations.

### Layer 8: End-to-End Demo Flow (The Priya Scenario)
Simulates a sequential user story:
1. **Extract**: Extracts commitments from a text description of Priya's schedule (academic assignment, birthday party, and a new Amazon OA).
2. **Generate Plan**: Generates an Action Plan breakdown with steps for the Amazon OA.
3. **Risk Analysis**: Explains the scheduling risk of the Amazon OA (detecting a collision with the academic OS assignment).
4. **Renegotiation**: Simulates a check-in response ("Got busy") and confirms the AI proposes a realistic rescheduled timeline.
5. **Reflection**: Computes a weekly reflection based on the context.

---

## How It Works: Safe Mocking (Bypassing Firebase/Google Network)

To verify the entire vertical stack (including prompt builders, gateway routing, Zod parsing, metadata enrichment, and database triggers) without writing to your live databases or requiring active Google account authorization, the suite activates a mock environment when running.

When `process.env.FINISHLINE_VALIDATION_MOCK === "true"`:

1. **Firebase Admin SDK (`src/lib/firebaseAdmin.ts`)**:
   Instead of initializing real Firebase credentials, it loads a local in-memory database mock. All `adminDb.collection().doc().get()`, `update()`, and `set()` operations are routed to local mocks that serve up pre-seeded user and commitment data and log update writes to the terminal.
   
2. **Auth Verification (`src/lib/auth/authVerification.ts`)**:
   It still checks if the `Authorization` header starts with `"Bearer "` (to verify route protection), but bypasses the real Firebase `verifyIdToken` call, returning a mock user profile.

3. **Google Calendar Services (`src/lib/services/calendar.ts`)**:
   Bypasses Google OAuth refresh token exchanges and freebusy queries, returning mock free/busy ranges.

4. **Gmail Services (`src/lib/services/gmail.ts`)**:
   Bypasses OAuth credential checking and fetches, returning a mock Amazon OA recruiter email.

---

## Interpreting Results

### Health Statuses
* `PASS`: The layer successfully executed all checks, complied with schemas, and verified functionality.
* `FAIL`: A check failed. Review the detailed error logs above the summary report to identify the problem (e.g. rate limits, schema errors, or missing keys).

### Overall Health
* **HEALTHY**: All checks succeeded. The app is ready for demo or deployment.
* **UNHEALTHY**: One or more checks failed. The script will exit with exit code `1`.

> [!NOTE]
> If your primary provider (`Gemini`) is out of credits (RESOURCE_EXHAUSTED / 429), **Layer 2 (Connectivity) will fail**, but **Layers 3-8 will still succeed** by gracefully routing all AI calls through the Groq fallback provider. This confirms the robustness of the fallback system!
