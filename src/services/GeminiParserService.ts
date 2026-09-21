import { fetchWithFallback, isTimeoutError } from './AIHttpRetry';
import {
  buildVoiceParsePrompt,
  VOICE_PARSER_INSTRUCTION,
  buildReceiptPrompt,
  RECEIPT_SCANNER_INSTRUCTION,
  buildChatAdvisorInstruction,
  PARSED_TRANSACTION_SCHEMA,
  CHAT_RESPONSE_SCHEMA,
  toGeminiSchema,
} from './AIPromptBuilder';
import { IAIProviderService, ParsedTransaction, FinancialContext, ChatResponse } from './AIProviderTypes';

export type { ParsedTransaction, FinancialContext, ChatResponse };

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiParserService implements IAIProviderService {
  private async callModel(modelId: string, apiKey: string, bodyPayload: any): Promise<Response> {
    return fetch(`${GEMINI_API_BASE}/${modelId}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(20000),
    });
  }

  private async request(primaryModelId: string, fallbackModelId: string, apiKey: string, bodyPayload: any): Promise<{ data: any; modelUsed: string }> {
    const { response, usedFallback } = await fetchWithFallback(
      () => this.callModel(primaryModelId, apiKey, bodyPayload),
      () => this.callModel(fallbackModelId, apiKey, bodyPayload)
    );

    if (!response.ok) {
      if (response.status === 429) throw new Error('QUOTA_EXHAUSTED');
      if (response.status === 400) throw new Error('INVALID_API_KEY');
      throw new Error(`API_ERROR_STATUS_${response.status}`);
    }

    const data = await response.json();
    return { data, modelUsed: usedFallback ? fallbackModelId : primaryModelId };
  }

  /** Sin call sites en useBagiAI.ts hoy (chatWithAdvisor cubre el flujo de voz) — se mantiene por compatibilidad. */
  async parse(
    transcript: string,
    apiKey: string,
    context: { categories: { name: string; type: string }[]; accounts: { name: string; currency: string }[]; cards: { name: string; currency: string }[] },
    primaryModelId: string,
    fallbackModelId: string
  ): Promise<ParsedTransaction> {
    const bodyPayload = {
      contents: [{ parts: [{ text: buildVoiceParsePrompt(transcript, context) }] }],
      systemInstruction: { parts: [{ text: VOICE_PARSER_INSTRUCTION }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(PARSED_TRANSACTION_SCHEMA),
      },
    };

    try {
      const { data, modelUsed } = await this.request(primaryModelId, fallbackModelId, apiKey, bodyPayload);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('NO_RESPONSE_FROM_MODEL');
      const parsed: ParsedTransaction = JSON.parse(text);
      console.log('[Bagi IA Debug] Voice Mode:', { modelUsed, intent: parsed.intent, parsed });
      return parsed;
    } catch (e: any) {
      console.error('[GeminiParserService] Error parsing transcript:', e);
      throw isTimeoutError(e) ? new Error('TIMEOUT') : e;
    }
  }

  async parseImageReceipt(
    imageBase64: string,
    mimeType: string,
    apiKey: string,
    primaryModelId: string,
    fallbackModelId: string,
    context: FinancialContext
  ): Promise<ParsedTransaction> {
    const bodyPayload = {
      contents: [{
        parts: [
          { text: buildReceiptPrompt(context) },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
        ],
      }],
      systemInstruction: { parts: [{ text: RECEIPT_SCANNER_INSTRUCTION }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(PARSED_TRANSACTION_SCHEMA),
      },
    };

    try {
      const { data, modelUsed } = await this.request(primaryModelId, fallbackModelId, apiKey, bodyPayload);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('NO_RESPONSE_FROM_MODEL');
      const parsed: ParsedTransaction = JSON.parse(text);
      console.log('[Bagi IA Debug] Image Receipt Mode:', { modelUsed, intent: parsed.intent, parsed });
      return parsed;
    } catch (e: any) {
      console.error('[GeminiParserService] Error parsing image receipt:', e);
      throw isTimeoutError(e) ? new Error('TIMEOUT') : e;
    }
  }

  async chatWithAdvisor(
    message: string,
    history: { role: 'user' | 'model'; parts: { text: string }[] }[],
    apiKey: string,
    primaryModelId: string,
    fallbackModelId: string,
    context: FinancialContext,
    image?: { base64: string; mimeType: string }
  ): Promise<ChatResponse> {
    const userParts: any[] = [{ text: message || 'Please analyze this input.' }];
    if (image) {
      userParts.push({ inlineData: { mimeType: image.mimeType || 'image/jpeg', data: image.base64 } });
    }

    const contents = [...history, { role: 'user', parts: userParts }];

    const bodyPayload = {
      contents,
      systemInstruction: { parts: [{ text: buildChatAdvisorInstruction(context) }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(CHAT_RESPONSE_SCHEMA),
      },
    };

    try {
      const { data, modelUsed } = await this.request(primaryModelId, fallbackModelId, apiKey, bodyPayload);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('NO_RESPONSE_FROM_MODEL');
      const response: ChatResponse = JSON.parse(text);
      console.log('[Bagi IA Debug] Chat Advisor Mode:', { modelUsed, intent: response.intent, response });
      return response;
    } catch (e: any) {
      console.error('[GeminiParserService] Error in chatWithAdvisor:', e);
      throw isTimeoutError(e) ? new Error('TIMEOUT') : e;
    }
  }
}

export const geminiParserService = new GeminiParserService();
