# Prompt Review — Phase 2
**FinishLine Weekly Alignment Hub & Personalization Calculations**

---

## 1. Overall Prompt Quality

* **What worked well:**
  * **Explicit Clamping Constraints:** Providing concrete boundaries (e.g., domain multiplier safety caps of `[0.5, 2.0]`) prevented ambiguity in the math.
  * **Strict Owner Division:** Explicitly separating deterministic calculations (handled by the backend in `risk.ts`) from reasoning explanations (Gemini) kept the code clean and followed [Rule 5] flawlessly.
  * **Structured JSON Schema Mapping:** Mapping exact keys for Weekly Reflection and Planning schemas ensured route handler endpoints parsed JSON structures without formatting mismatches.

---

## 2. Missing Information

Future prompts should include the following context:

* **Double-Declared Interfaces / Duplicate Types:**
  * *Context:* `CoreLifeContext` and `ExtendedLifeContext` are defined in *both* `src/lib/types/lifeContext.ts` and `src/lib/ai/types.ts`.
  * *Problem:* The prompt only specified modifying the first file, resulting in compilation failures until both signatures were synced.
* **JSON Serialization & Date Helpers:**
  * *Context:* Cached Firestore fields (like `lastWeeklyPlan` or `lastWeeklyReflection`) are JSON objects, not timestamps.
  * *Problem:* Using date format mappers like `toISONullable(data.lastWeeklyPlan)` inside `firestore.ts` and `useUserStore.ts` resulted in empty values. The prompt should have explicitly warned to map them directly as raw JSON objects.
* **Global vs. Local State Subscriptions:**
  * *Context:* Zustand stores hook into Firebase `onSnapshot` dynamically.
  * *Problem:* Subscriptions for `userProfile` (i.e., `subscribeToUserProfile`) must be mounted locally on page refresh. Not specifying this resulted in the page cache loading as empty on reload.

---

## 3. Redundant Information

* **Zod Fields Duplication:** Prompts spent substantial token length reiterating type shapes that were already defined in TypeScript type files. If the types are already locked in `src/lib/types/`, referencing the existing file is sufficient.
* **Unnecessary Temp Maps:** Detailed listings of temperatures are already governed by `AGENTS.md` rules. Pointing to the central rule file is cleaner than pasting tables into every task prompt.

---

## 4. Ambiguities

* **"Merge views into a unified tabbed page flow":**
  * *Issue:* The prompt did not specify text-wrapping guidelines for daily focus log notes. This led to long sentences causing elements to expand horizontally ("goes out of the box" horizontal stretch bug).
  * *Improvement:* Future prompts should specify mobile-first text layout limits (e.g., *"Render notes on a secondary line to support natural wrapping"*).

---

## 5. Roadmap vs Implementation

* **Adapting to Code State:** The prompts correctly identified that `learningCoefficients` were already established in Phase 1, avoiding redundant setup.
* **Reconciliation Improvement:** Future prompts should contain a **"Pre-requisite State Audit"** checklist to confirm if dependent properties (like user profile stats) are seeded and initialized with non-zero mock values, preventing `NaN` or default `100%` calculations on initial run.

---

## 6. Prompt Template Improvements

We recommend adding the following two sections to the standard prompt template for future tasks:

1. **State & Sync Listeners Checklist:**
   * Lists any Zustand/Redux stores or `onSnapshot` listeners that must be mounted/subscribed to ensure real-time updates function on page reload.
2. **UI Responsive & Text Wrapping Constraints:**
   * Specifies wrapping behaviors for dynamically generated AI text fields (e.g., *"All descriptive notes must wrap naturally under titles to avoid flex-shrink layout clipping"*).

---

## 7. Lessons Learned

* **State Synchronization is Key:** Real-time listeners require local page-level triggers. Do not assume context state is automatically synced globally without checking hooks.
* **Audit Default Mock Statistics:** Ensure mock database seed values don't hit divide-by-zero or zero-value fallbacks (e.g., empty total tasks statistics returning a default 100% completion rate).
