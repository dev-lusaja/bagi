import { fetchWithFallback, isTimeoutError } from './AIHttpRetry';
import {
  buildReceiptPrompt,
  RECEIPT_SCANNER_INSTRUCTION,
  buildChatAdvisorInstruction,
  PARSED_TRANSACTION_SCHEMA,
  CHAT_RESPONSE_SCHEMA,
  withAdditionalPropertiesFalse,
} from './AIPromptBuilder';
import { IAIProviderService, ParsedTransaction, FinancialContext, ChatResponse } from './AIProviderTypes';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterParserService implements IAIProviderService {
  private async callModel(modelId: string, apiKey: string, bodyPayload: any): Promise<Response> {
    return fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...bodyPayload, model: modelId }),
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
      if (response.status === 401) throw new Error('INVALID_API_KEY');
      throw new Error(`API_ERROR_STATUS_${response.status}`);
    }

    const data = await response.json();
    return { data, modelUsed: usedFallback ? fallbackModelId : primaryModelId };
  }

  private buildResponseFormat(schemaName: string, schema: any) {
    return {
      type: 'json_schema' as const,
      json_schema: {
        name: schemaName,
        strict: true,
        schema: withAdditionalPropertiesFalse(schema),
      },
    };
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
      messages: [
        { role: 'system', content: RECEIPT_SCANNER_INSTRUCTION },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildReceiptPrompt(context) },
            { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } },
          ],
        },
      ],
      response_format: this.buildResponseFormat('parsed_transaction', PARSED_TRANSACTION_SCHEMA),
    };

    try {
      const { data, modelUsed } = await this.request(primaryModelId, fallbackModelId, apiKey, bodyPayload);
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('NO_RESPONSE_FROM_MODEL');
      const parsed: ParsedTransaction = JSON.parse(text);
      console.log('[Bagi IA Debug] (OpenRouter) Image Receipt Mode:', { modelUsed, intent: parsed.intent, parsed });
      return parsed;
    } catch (e: any) {
      console.error('[OpenRouterParserService] Error parsing image receipt:', e);
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
    const historyMessages = history.map(h => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.parts.map(p => p.text).join('\n'),
    }));

    const userContent: any = image
      ? [
          { type: 'text', text: message || 'Please analyze this input.' },
          { type: 'image_url', image_url: { url: `data:${image.mimeType || 'image/jpeg'};base64,${image.base64}` } },
        ]
      : (message || 'Please analyze this input.');

    const bodyPayload = {
      messages: [
        { role: 'system', content: buildChatAdvisorInstruction(context) },
        ...historyMessages,
        { role: 'user', content: userContent },
      ],
      response_format: this.buildResponseFormat('chat_response', CHAT_RESPONSE_SCHEMA),
    };

    try {
      const { data, modelUsed } = await this.request(primaryModelId, fallbackModelId, apiKey, bodyPayload);
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('NO_RESPONSE_FROM_MODEL');
      const response: ChatResponse = JSON.parse(text);
      console.log('[Bagi IA Debug] (OpenRouter) Chat Advisor Mode:', { modelUsed, intent: response.intent, response });
      return response;
    } catch (e: any) {
      console.error('[OpenRouterParserService] Error in chatWithAdvisor:', e);
      throw isTimeoutError(e) ? new Error('TIMEOUT') : e;
    }
  }
}

export const openRouterParserService = new OpenRouterParserService();
