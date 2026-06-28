import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { commitmentDraftFullSchema, commitmentDraftFullArraySchema } from "@/lib/ai/schemas/commitmentDraftFull";
import { buildFileExtractionPrompt, FILE_EXTRACTION_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/fileExtraction";
import { callGroqFallback } from "@/lib/ai/gemini";

function getGeminiClient() {
  const useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (useVertex) {
    const config: any = {
      vertexai: true,
    };
    if (apiKey) {
      config.apiKey = apiKey;
    } else {
      config.project = process.env.GOOGLE_CLOUD_PROJECT;
      config.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    }
    return new GoogleGenAI(config);
  }

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenAI({ apiKey });
}

function toOpenApiSchema(schema: any): any {
  if (Array.isArray(schema)) return schema;
  if (!schema || typeof schema !== "object") return schema;

  const result: any = {};
  for (const key of Object.keys(schema)) {
    if (key === "$schema" || key === "additionalProperties" || key === "definitions" || key === "$ref") {
      continue;
    }

    let val = schema[key];
    if (key === "type" && typeof val === "string") {
      val = val.toUpperCase();
    } else if (typeof val === "object") {
      val = toOpenApiSchema(val);
    }
    result[key] = val;
  }
  return result;
}

function sanitizeExtractedCommitments(parsed: unknown): any[] {
  if (!parsed) return [];
  
  let list: any[] = [];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (typeof parsed === "object") {
    list = [parsed];
  } else {
    return [];
  }

  return list.map((item) => {
    if (!item || typeof item !== "object") return item;

    // Ensure extractedEntities is an object with required arrays (not null/undefined)
    if (!item.extractedEntities || typeof item.extractedEntities !== "object") {
      item.extractedEntities = { people: [], locations: [], tools: [] };
    } else {
      if (!Array.isArray(item.extractedEntities.people)) item.extractedEntities.people = [];
      if (!Array.isArray(item.extractedEntities.locations)) item.extractedEntities.locations = [];
      if (!Array.isArray(item.extractedEntities.tools)) item.extractedEntities.tools = [];
    }

    // Ensure prerequisiteKnowledge is an array
    if (!Array.isArray(item.prerequisiteKnowledge)) {
      item.prerequisiteKnowledge = [];
    }

    // Ensure practicalVsTheoretical is null if not provided
    if (item.practicalVsTheoretical === undefined) {
      item.practicalVsTheoretical = null;
    }

    // Ensure questionCount is null if not provided
    if (item.questionCount === undefined) {
      item.questionCount = null;
    }

    // Ensure recommendedSessions is a non-negative number
    if (typeof item.recommendedSessions !== "number") {
      item.recommendedSessions = Number(item.recommendedSessions) || 0;
    }

    // Ensure effortEstimateHours is a non-negative number
    if (typeof item.effortEstimateHours !== "number") {
      item.effortEstimateHours = Number(item.effortEstimateHours) || 0.5;
    }

    // Ensure confidence is a number between 0 and 1
    if (typeof item.confidence !== "number") {
      item.confidence = Number(item.confidence) || 0.8;
    }

    return item;
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { fileUrl, mimeType } = body;

    if (!fileUrl || !mimeType) {
      return NextResponse.json({ error: "Missing fileUrl or mimeType" }, { status: 400 });
    }

    // 1. Download the file from Firebase Storage / HTTP URL
    console.log(`[extract-file] Downloading file from URL: ${fileUrl}...`);
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      throw new Error(`Failed to download file from storage URL: ${fileRes.statusText}`);
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    console.log(`[extract-file] Downloaded ${fileBuffer.length} bytes.`);

    // 2. Build the prompt and schema instructions
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const prompt = buildFileExtractionPrompt(today);

    const rawSchema = zodToJsonSchema(commitmentDraftFullArraySchema as any);
    const jsonSchema = { ...rawSchema };
    if (jsonSchema && typeof jsonSchema === 'object') {
      delete (jsonSchema as any).$schema;
    }

    const useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
    let finalResponseSchema: any;
    if (useVertex) {
      finalResponseSchema = toOpenApiSchema(rawSchema);
    } else {
      finalResponseSchema = jsonSchema;
    }

    const schemaInstruction = `\n\n[CRITICAL] You must return a JSON array of objects that strictly adheres to the following JSON schema:
${JSON.stringify(jsonSchema)}

Ensure that your JSON objects have EXACTLY the keys defined in the schema. Do not add markdown codeblocks.`;

    const systemInstruction = FILE_EXTRACTION_SYSTEM_INSTRUCTION + schemaInstruction;

    // 3. Make the Gemini Multimodal Call
    try {
      const ai = getGeminiClient();
      console.log("[extract-file] Sending multimodal request to Gemini...");
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: fileBuffer.toString("base64"),
                  mimeType: mimeType
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: finalResponseSchema,
          temperature: 0.1
        }
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("No response content returned from Gemini");
      }

      console.log("[extract-file] Raw response from Gemini:", text);
      const parsed = JSON.parse(text);
      const sanitized = sanitizeExtractedCommitments(parsed);
      const result = commitmentDraftFullArraySchema.parse(sanitized);

      return NextResponse.json(result, { status: 200 });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[extract-file] Gemini failed. Falling back to Groq. Error: ${msg}`);

      // Groq fallback call (fails back to text prompt analysis for a single commitment draft)
      const fallbackResult = await callGroqFallback({
        systemInstruction: FILE_EXTRACTION_SYSTEM_INSTRUCTION,
        prompt: `${prompt}\n\n(Fallback analysis request. Gemini failed to parse the document directly.)`,
        schema: commitmentDraftFullSchema as any
      });

      const sanitizedFallback = sanitizeExtractedCommitments(fallbackResult);
      const result = commitmentDraftFullArraySchema.parse(sanitizedFallback);

      return NextResponse.json(result, { status: 200 });
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[extract-file] File extraction failed with critical error:", msg);
    return NextResponse.json({ error: "File extraction failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
