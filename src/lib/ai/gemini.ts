import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import Groq from 'groq-sdk';
import { EndpointType } from './types';

const TEMPERATURE_MAP: Record<EndpointType, number> = {
  'extraction': 0.1,
  'explanation': 0.2,
  'action-plan': 0.4,
  'weekly-planning': 0.5,
  'renegotiation': 0.6,
  'weekly-reflection': 0.6,
};

const getGeminiClient = () => {
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

  const tempProject = process.env.GOOGLE_CLOUD_PROJECT;
  try {
    // Temporarily delete to prevent auto-routing to Vertex AI
    delete process.env.GOOGLE_CLOUD_PROJECT;
    return new GoogleGenAI({ apiKey });
  } finally {
    if (tempProject !== undefined) {
      process.env.GOOGLE_CLOUD_PROJECT = tempProject;
    }
  }
};

function toOpenApiSchema(schema: any): any {
  if (Array.isArray(schema)) return schema;
  if (!schema || typeof schema !== "object") return schema;

  const result: any = {};
  for (const key of Object.keys(schema)) {
    // Strip draft-07/draft-2020-12 properties that Vertex AI OpenAPI generator rejects
    if (key === "$schema" || key === "additionalProperties" || key === "definitions" || key === "$ref") {
      continue;
    }

    let val = schema[key];
    if (key === "type" && typeof val === "string") {
      // Vertex AI expects uppercase type strings
      val = val.toUpperCase();
    } else if (typeof val === "object") {
      val = toOpenApiSchema(val);
    }
    result[key] = val;
  }
  return result;
}

export async function callGroqFallback<T>(params: {
  systemInstruction: string;
  prompt: string;
  schema: z.ZodSchema<T>;
}): Promise<T> {
  console.log("[Groq fallback] Triggered fallback execution");
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }
  
  const rawSchema = typeof (params.schema as any).toJSONSchema === 'function'
    ? (params.schema as any).toJSONSchema()
    : zodToJsonSchema(params.schema as any);

  const jsonSchema = { ...rawSchema };
  if (jsonSchema && typeof jsonSchema === 'object') {
    delete (jsonSchema as any).$schema;
  }

  const isArraySchema = params.schema instanceof z.ZodArray || (params.schema as any)._def?.typeName === 'ZodArray';
  const jsonType = isArraySchema ? 'JSON array' : 'JSON object';

  const schemaInstruction = `\n\n[CRITICAL] You must return a ${jsonType} that strictly adheres to the following JSON schema:
${JSON.stringify(jsonSchema)}

Ensure that your ${jsonType} has EXACTLY the structure defined in the schema above.
${isArraySchema ? 'Return a JSON array of objects.' : 'Ensure that your JSON object has EXACTLY the keys defined in the schema above.\nFor example, if the schema lists "reply" as a property/key, your output JSON must have a key named "reply" (NOT "message" or "text").'} Do not add any markdown blocks or outside text.`;

  const groq = new Groq({ apiKey });
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: params.systemInstruction + schemaInstruction },
      { role: "user", content: params.prompt },
    ],
    temperature: 0.1,
    response_format: isArraySchema ? { type: "text" } : { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content || "";
  if (!text) {
    throw new Error("Empty response returned from Groq");
  }

  console.log("[Groq fallback] Raw response text:", text);

  const parsed = JSON.parse(text);
  return params.schema.parse(parsed);
}

function isRateLimitError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode;
  if (status === 429) return true;
  
  const msg = err.message || '';
  if (typeof msg === 'string') {
    const lowercaseMsg = msg.toLowerCase();
    return lowercaseMsg.includes('429') || 
           lowercaseMsg.includes('resource_exhausted') || 
           lowercaseMsg.includes('quota exceeded') ||
           lowercaseMsg.includes('rate limit');
  }
  return false;
}

export async function callGemini<T>(params: {
  systemInstruction: string;
  prompt: string;
  schema: z.ZodSchema<T>;
  endpointType: EndpointType;
  model?: string;
}): Promise<T> {
  const {
    systemInstruction,
    prompt,
    schema,
    endpointType,
    model = 'gemini-2.5-flash',
  } = params;

  const temperature = TEMPERATURE_MAP[endpointType];

  const rawSchema = typeof (schema as any).toJSONSchema === 'function'
    ? (schema as any).toJSONSchema()
    : zodToJsonSchema(schema as any);

  const jsonSchema = { ...rawSchema };
  if (jsonSchema && typeof jsonSchema === 'object') {
    delete (jsonSchema as any).$schema;
  }

  const isArraySchema = schema instanceof z.ZodArray || (schema as any)._def?.typeName === 'ZodArray';
  const jsonType = isArraySchema ? 'JSON array' : 'JSON object';

  const schemaInstruction = `\n\n[CRITICAL] You must return a ${jsonType} that strictly adheres to the following JSON schema:
${JSON.stringify(jsonSchema)}

Ensure that your ${jsonType} has EXACTLY the structure defined in the schema above.
${isArraySchema ? 'Return a JSON array of objects.' : 'Ensure that your JSON object has EXACTLY the keys defined in the schema above.\nFor example, if the schema lists "reply" as a property/key, your output JSON must have a key named "reply" (NOT "message" or "text").'} Do not add any markdown blocks or outside text.`;

  const maxRetries = 3;
  const initialDelayMs = 1000;
  const backoffFactor = 2;

  try {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
        const ai = getGeminiClient();
        const config: any = {
          systemInstruction: systemInstruction + schemaInstruction,
          responseMimeType: 'application/json',
          temperature,
        };
        if (useVertex) {
          config.responseSchema = toOpenApiSchema(rawSchema);
        } else {
          config.responseSchema = jsonSchema as any;
        }

        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config,
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error("No response candidates returned from Gemini");
        }

        console.log("[Gemini] Raw response text:", text);

        const parsed = JSON.parse(text);
        return schema.parse(parsed);
      } catch (err) {
        const isRateLimit = isRateLimitError(err);
        
        if (isRateLimit && attempt <= maxRetries) {
          const backoff = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
          const jitter = Math.floor(Math.random() * 200) + 100;
          const delay = backoff + jitter;
          
          console.warn(`[Gemini] Rate limited (429). Retrying in ${delay}ms... (Attempt ${attempt} of ${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        
        throw err;
      }
    }
    throw new Error("Failed to get response after maximum retries");
  } catch (err) {
    console.error(`[Gemini] ${endpointType} failed. Falling back to Groq. Error:`, err);
    return callGroqFallback({ systemInstruction, prompt, schema });
  }
}
