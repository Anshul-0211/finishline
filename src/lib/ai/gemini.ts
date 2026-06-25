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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenAI({ apiKey });
};

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
  
  const groq = new Groq({ apiKey });
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: params.systemInstruction },
      { role: "user", content: params.prompt },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content || "";
  if (!text) {
    throw new Error("Empty response returned from Groq");
  }

  const parsed = JSON.parse(text);
  return params.schema.parse(parsed);
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

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: zodToJsonSchema(schema as any) as any,
        temperature,
      },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("No response candidates returned from Gemini");
    }

    const parsed = JSON.parse(text);
    return schema.parse(parsed);
  } catch (err) {
    console.error(`[Gemini] ${endpointType} failed. Falling back to Groq. Error:`, err);
    return callGroqFallback({ systemInstruction, prompt, schema });
  }
}
