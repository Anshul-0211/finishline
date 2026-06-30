import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { EndpointType } from './types';

export type ProviderType = 'gemini' | 'groq';

export interface ProviderConfig {
  provider: ProviderType;
  model: string;
  temperature: number;
}

export interface MultimodalData {
  data: string; // base64 string
  mimeType: string;
}

export interface GatewayParams<T> {
  systemInstruction: string;
  prompt: string;
  schema: z.ZodSchema<T>;
  endpointType: EndpointType;
  multimodalData?: MultimodalData;
}

const CAPABILITY_CONFIG: Record<EndpointType, { primary: ProviderConfig; fallback: ProviderConfig }> = {
  'extraction': {
    primary: { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0.1 },
    fallback: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.1 }
  },
  'explanation': {
    primary: { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0.2 },
    fallback: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.1 }
  },
  'action-plan': {
    primary: { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0.4 },
    fallback: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.1 }
  },
  'weekly-planning': {
    primary: { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0.5 },
    fallback: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.1 }
  },
  'renegotiation': {
    primary: { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0.6 },
    fallback: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.1 }
  },
  'weekly-reflection': {
    primary: { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0.6 },
    fallback: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.1 }
  },
  'replan-cascade': {
    primary: { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0.4 },
    fallback: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.1 }
  }
};

export function getGoogleClient(): GoogleGenAI {
  if (process.env.FINISHLINE_VALIDATION_MOCK === "true") {
    (globalThis as any).lastClientType = "gemini";
  }
  const apiKey = process.env.VERTEX_API_KEY;

  if (!apiKey) {
    throw new Error("VERTEX_API_KEY is not configured.");
  }

  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION,
  });
}

export function getGroqClient(): Groq {
  if (process.env.FINISHLINE_VALIDATION_MOCK === "true") {
    (globalThis as any).lastClientType = "groq";
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }
  return new Groq({ apiKey });
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

function isRateLimitError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode;
  if (status === 429 || status === 503) return true;
  
  const msg = err.message || '';
  if (typeof msg === 'string') {
    const lowercaseMsg = msg.toLowerCase();
    return lowercaseMsg.includes('429') || 
           lowercaseMsg.includes('503') ||
           lowercaseMsg.includes('resource_exhausted') || 
           lowercaseMsg.includes('quota exceeded') ||
           lowercaseMsg.includes('rate limit') ||
           lowercaseMsg.includes('service unavailable');
  }
  return false;
}

async function executeGemini<T>(
  config: ProviderConfig,
  systemInstruction: string,
  prompt: string,
  schema: z.ZodSchema<T>,
  multimodalData?: MultimodalData
): Promise<T> {
  const ai = getGoogleClient();

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

  const configObj: any = {
    systemInstruction: systemInstruction + schemaInstruction,
    responseMimeType: 'application/json',
    temperature: config.temperature,
  };

  configObj.responseSchema = toOpenApiSchema(rawSchema);

  let contents: any[];
  if (multimodalData) {
    contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: multimodalData.data,
              mimeType: multimodalData.mimeType,
            }
          },
          {
            text: prompt
          }
        ]
      }
    ];
  } else {
    contents = [{ role: 'user', parts: [{ text: prompt }] }];
  }

  const response = await ai.models.generateContent({
    model: config.model,
    contents,
    config: configObj,
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No response candidates returned from Gemini");
  }

  console.log("[Gateway Gemini] Raw response text:", text);
  const parsed = JSON.parse(text);
  return schema.parse(parsed);
}

async function executeGroq<T>(
  config: ProviderConfig,
  systemInstruction: string,
  prompt: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

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

  const groq = getGroqClient();
  const response = await groq.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: systemInstruction + schemaInstruction },
      { role: "user", content: prompt },
    ],
    temperature: config.temperature,
    response_format: isArraySchema ? { type: "text" } : { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content || "";
  if (!text) {
    throw new Error("Empty response returned from Groq");
  }

  console.log("[Gateway Groq] Raw response text:", text);
  const parsed = JSON.parse(text);
  return schema.parse(parsed);
}

export async function callGroqFallback<T>(params: {
  systemInstruction: string;
  prompt: string;
  schema: z.ZodSchema<T>;
}): Promise<T> {
  return executeGroq({
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.1
  }, params.systemInstruction, params.prompt, params.schema);
}

export async function callGateway<T>(params: GatewayParams<T>): Promise<T> {
  const config = CAPABILITY_CONFIG[params.endpointType];
  if (!config) {
    throw new Error(`Capability configuration for endpoint: ${params.endpointType} not found.`);
  }

  const maxRetries = 3;
  const initialDelayMs = 1000;
  const backoffFactor = 2;

  // Verify key presence
  const hasVertexKey = !!process.env.VERTEX_API_KEY;
  const hasGroqKey = !!process.env.GROQ_API_KEY;

  let useBackup = false;

  if (config.primary.provider === 'gemini') {
    if (!hasVertexKey) {
      console.warn("[Gateway] VERTEX_API_KEY is not set. Falling back immediately.");
      useBackup = true;
    } else {
      try {
        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
          try {
            return await executeGemini(config.primary, params.systemInstruction, params.prompt, params.schema, params.multimodalData);
          } catch (err: any) {
            const isRateLimit = isRateLimitError(err);
            if (isRateLimit && attempt <= maxRetries) {
              const backoff = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
              const jitter = Math.floor(Math.random() * 200) + 100;
              const delay = backoff + jitter;
              
              console.warn(`[Gateway Gemini] Rate limited/unavailable (${err.status || err.statusCode || 429}). Retrying in ${delay}ms... (Attempt ${attempt} of ${maxRetries})`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
            throw err;
          }
        }
      } catch (err: any) {
        console.error("[Gateway Gemini] Primary execution failed. Falling back to backup. Error:", err.message || err);
        useBackup = true;
      }
    }
  } else if (config.primary.provider === 'groq') {
    if (!hasGroqKey) {
      console.warn("[Gateway] GROQ_API_KEY is not set. Falling back immediately.");
      useBackup = true;
    } else {
      try {
        return await executeGroq(config.primary, params.systemInstruction, params.prompt, params.schema);
      } catch (err: any) {
        console.error("[Gateway Groq] Primary execution failed. Falling back to backup. Error:", err.message || err);
        useBackup = true;
      }
    }
  }

  if (useBackup) {
    console.log(`[Gateway] Routing to fallback provider: ${config.fallback.provider}`);
    if (config.fallback.provider === 'groq') {
      return await executeGroq(config.fallback, params.systemInstruction, params.prompt, params.schema);
    } else if (config.fallback.provider === 'gemini') {
      return await executeGemini(config.fallback, params.systemInstruction, params.prompt, params.schema, params.multimodalData);
    }
  }

  throw new Error("AI Gateway routing failed: no provider executed successfully.");
}
