import { z } from 'zod';
import { EndpointType } from './types';
import { callGateway, callGroqFallback as gatewayGroqFallback } from './gateway';

export { gatewayGroqFallback as callGroqFallback };

export async function callGemini<T>(params: {
  systemInstruction: string;
  prompt: string;
  schema: z.ZodSchema<T>;
  endpointType: EndpointType;
  model?: string;
}): Promise<T> {
  return callGateway({
    systemInstruction: params.systemInstruction,
    prompt: params.prompt,
    schema: params.schema,
    endpointType: params.endpointType,
  });
}
