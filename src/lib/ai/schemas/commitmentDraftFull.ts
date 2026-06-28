import { z } from "zod";
import { commitmentDraftSchema } from "./commitmentDraft";

/**
 * Zod schema representing a single complete parsed commitment (17+ fields).
 */
export const commitmentDraftFullSchema = commitmentDraftSchema;

/**
 * Zod schema representing an array of complete parsed commitments.
 */
export const commitmentDraftFullArraySchema = z.array(commitmentDraftFullSchema);
