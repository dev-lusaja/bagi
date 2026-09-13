export interface ParsedTransaction {
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  category_hint: string;
  source_hint: string;
  date_hint: string | null;
  intent?: 'TRANSACTION' | 'FINANCE_CHAT' | 'CAPABILITIES_QUERY' | 'OFF_TOPIC';
  error?: 'OFF_TOPIC' | null;
}

export interface FinancialContext {
  categories: { name: string; type: string }[];
  accounts: { name: string; currency: string; balance?: number }[];
  cards: { name: string; currency: string; credit_limit?: number }[];
  recentTransactions?: { description: string; amount: number; type: string; date: string; category?: string }[];
  budgets?: { category: string; limit: number; spent: number }[];
}

export interface ChatResponse {
  reply: string;
  intent?: 'TRANSACTION' | 'FINANCE_CHAT' | 'CAPABILITIES_QUERY' | 'OFF_TOPIC';
  extractedTransaction?: ParsedTransaction;
}

const BASE_SYSTEM_INSTRUCTION = `
You are Bagi AI, an intelligent personal finance assistant for the Bagi web application.
Your core principles:
1. Always map category names and payment sources (accounts or cards) strictly to the exact names provided in the user context.
2. Convert amounts written as words into exact numbers (e.g. "forty thousand" -> 40000).
3. Classify user input into one of four explicit intents:
   - "TRANSACTION": User explicitly commands to log an income, expense, or transfer.
   - "FINANCE_CHAT": User asks questions about personal budgets, spending habits, balances, or financial advice.
   - "CAPABILITIES_QUERY": User asks what Bagi AI can do or how to use its features (e.g. "What can you do?", "¿En qué puedes ayudarme?", "How do I use this?").
   - "OFF_TOPIC": User input is completely unrelated to finance, budgeting, or Bagi capabilities.
`;

export class GeminiParserService {
  private VOICE_PRIMARY_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash-lite:generateContent';
  private VOICE_FALLBACK_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

  private FLASH_PRIMARY_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';
  private FLASH_FALLBACK_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';

  /**
   * Helper function to execute Gemini fetch with automatic fallback on HTTP 503 or 429
   */
  private async fetchWithFallback(
    primaryUrl: string,
    fallbackUrl: string,
    apiKey: string,
    bodyPayload: any
  ): Promise<{ data: any; modelUsed: string }> {
    const extractModelName = (url: string) => {
      const match = url.match(/models\/(.*?):/);
      return match ? match[1] : url;
    };

    const makeRequest = async (url: string) => {
      return await fetch(`${url}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });
    };

    let modelUsed = extractModelName(primaryUrl);
    let response = await makeRequest(primaryUrl);

    // If 503 Service Unavailable or 429 Rate Limit / Too Many Requests, try fallback model
    if (response.status === 503 || response.status === 429) {
      console.warn(`[Bagi IA Debug] Primary model (${modelUsed}) returned HTTP ${response.status}. Retrying with fallback model...`);
      modelUsed = extractModelName(fallbackUrl);
      const fallbackResponse = await makeRequest(fallbackUrl);
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        return { data, modelUsed };
      }
      response = fallbackResponse; // Use fallback response error status
    }

    if (!response.ok) {
      if (response.status === 429) throw new Error('QUOTA_EXHAUSTED');
      if (response.status === 400) throw new Error('INVALID_API_KEY');
      throw new Error(`API_ERROR_STATUS_${response.status}`);
    }

    const data = await response.json();
    return { data, modelUsed };
  }

  async parse(
    transcript: string,
    apiKey: string,
    context: {
      categories: { name: string; type: string }[];
      accounts: { name: string; currency: string }[];
      cards: { name: string; currency: string }[];
    }
  ): Promise<ParsedTransaction> {
    const categoriesList = context.categories.map(c => `- ${c.name} (${c.type})`).join('\n');
    const accountsList = context.accounts.map(a => `- ${a.name} (Account, ${a.currency})`).join('\n');
    const cardsList = context.cards.map(c => `- ${c.name} (Card, ${c.currency})`).join('\n');

    const prompt = `
Analyze the spoken transcript below and extract transaction fields or detect query intent.

AVAILABLE CATEGORIES:
${categoriesList}

AVAILABLE ORIGINS (ACCOUNTS AND CARDS):
${accountsList}
${cardsList}

User spoken text: "${transcript}"
`;

    const voiceSystemInstruction = `
${BASE_SYSTEM_INSTRUCTION}

[MODE: VOICE PARSER SPECIALIZATION]
Your job is to parse spoken voice inputs quickly and accurately.
- If the user asks what you can do, set "intent" to "CAPABILITIES_QUERY".
- If the user asks a question about their budgets or finances, set "intent" to "FINANCE_CHAT".
- If the input is unrelated, set "error" and "intent" to "OFF_TOPIC".
- If it is a financial movement, set "intent" to "TRANSACTION", map category_hint and source_hint to exact list names, and parse relative dates into date_hint.
`;

    const bodyPayload = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: voiceSystemInstruction }],
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            description: {
              type: 'STRING',
              description: 'Short description of transaction (e.g. Groceries, Gas, Salary).',
            },
            amount: {
              type: 'NUMBER',
              description: 'Total numerical amount of transaction.',
            },
            type: {
              type: 'STRING',
              enum: ['INCOME', 'EXPENSE', 'TRANSFER'],
              description: 'Transaction type.',
            },
            category_hint: {
              type: 'STRING',
              description: 'Exact matching category name from provided list.',
            },
            source_hint: {
              type: 'STRING',
              description: 'Exact matching account or card name from provided list.',
            },
            date_hint: {
              type: 'STRING',
              description: 'Temporal mention or null if omitted (e.g. "yesterday", "today").',
            },
            error: {
              type: 'STRING',
              description: 'Set to "OFF_TOPIC" if user input is unrelated to finance or capabilities.',
            },
            intent: {
              type: 'STRING',
              enum: ['TRANSACTION', 'FINANCE_CHAT', 'CAPABILITIES_QUERY', 'OFF_TOPIC'],
              description: 'Inferred intent of the user.',
            },
          },
          required: ['description', 'amount', 'type', 'category_hint', 'source_hint'],
        },
      },
    };

    try {
      const { data, modelUsed } = await this.fetchWithFallback(
        this.VOICE_PRIMARY_URL,
        this.VOICE_FALLBACK_URL,
        apiKey,
        bodyPayload
      );

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('NO_RESPONSE_FROM_GEMINI');

      const parsed: ParsedTransaction = JSON.parse(text);
      console.log('[Bagi IA Debug] Voice Mode:', { modelUsed, intent: parsed.intent, parsed });
      return parsed;
    } catch (e: any) {
      console.error('[GeminiParserService] Error parsing transcript:', e);
      throw e;
    }
  }

  /**
   * Analyzes an image (e.g. receipt / invoice photo) to extract transaction details.
   */
  async parseImageReceipt(
    imageBase64: string,
    mimeType: string,
    apiKey: string,
    context: FinancialContext
  ): Promise<ParsedTransaction> {
    const categoriesList = context.categories.map(c => `- ${c.name} (${c.type})`).join('\n');
    const accountsList = context.accounts.map(a => `- ${a.name} (Account, ${a.currency})`).join('\n');
    const cardsList = context.cards.map(c => `- ${c.name} (Card, ${c.currency})`).join('\n');

    const prompt = `
Analyze the attached receipt/invoice image and extract transaction details.

AVAILABLE CATEGORIES:
${categoriesList}

AVAILABLE ORIGINS (ACCOUNTS AND CARDS):
${accountsList}
${cardsList}
`;

    const receiptSystemInstruction = `
${BASE_SYSTEM_INSTRUCTION}

[MODE: RECEIPT VISION SCANNER SPECIALIZATION]
You are an expert OCR vision scanner for purchase receipts and invoices.
- Extract merchant name as "description".
- Extract final paid total as "amount".
- Set "type" to "EXPENSE" (or "INCOME" for deposit slips).
- Match category_hint and source_hint to exact names from provided lists.
- Always set "intent" to "TRANSACTION".
`;

    const bodyPayload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBase64,
              },
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [{ text: receiptSystemInstruction }],
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            description: { type: 'STRING' },
            amount: { type: 'NUMBER' },
            type: { type: 'STRING', enum: ['INCOME', 'EXPENSE', 'TRANSFER'] },
            category_hint: { type: 'STRING' },
            source_hint: { type: 'STRING' },
            date_hint: { type: 'STRING' },
            intent: {
              type: 'STRING',
              enum: ['TRANSACTION', 'FINANCE_CHAT', 'CAPABILITIES_QUERY', 'OFF_TOPIC'],
            },
          },
          required: ['description', 'amount', 'type', 'category_hint', 'source_hint'],
        },
      },
    };

    try {
      const { data, modelUsed } = await this.fetchWithFallback(
        this.FLASH_PRIMARY_URL,
        this.FLASH_FALLBACK_URL,
        apiKey,
        bodyPayload
      );

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('NO_RESPONSE_FROM_GEMINI');

      const parsed: ParsedTransaction = JSON.parse(text);
      console.log('[Bagi IA Debug] Image Receipt Mode:', { modelUsed, intent: parsed.intent, parsed });
      return parsed;
    } catch (e: any) {
      console.error('[GeminiParserService] Error parsing image receipt:', e);
      throw e;
    }
  }

  /**
   * Acts as a financial advisor answering questions based on user's financial context and optional images.
   */
  async chatWithAdvisor(
    message: string,
    history: { role: 'user' | 'model'; parts: { text: string }[] }[],
    apiKey: string,
    context: FinancialContext,
    image?: { base64: string; mimeType: string }
  ): Promise<ChatResponse> {
    const categoriesList = context.categories.map(c => `- ${c.name} (${c.type})`).join('\n');
    const accountsList = context.accounts.map(a => `- ${a.name} (${a.currency})`).join('\n');
    const cardsList = context.cards.map(c => `- ${c.name} (${c.currency})`).join('\n');
    const txList = (context.recentTransactions || [])
      .slice(0, 15)
      .map(t => `- [${t.date}] ${t.type}: ${t.description} - $${t.amount} (Cat: ${t.category || 'N/A'})`)
      .join('\n');
    const budgetList = (context.budgets || [])
      .map(b => `- ${b.category}: Budget $${b.limit}, Spent $${b.spent}`)
      .join('\n');

    const chatSystemInstruction = `
${BASE_SYSTEM_INSTRUCTION}

[MODE: FINANCIAL CHAT ADVISOR SPECIALIZATION]
You are a friendly, analytical, personal financial advisor speaking directly to the user.

USER FINANCIAL CONTEXT:
Accounts:
${accountsList || 'None'}

Cards:
${cardsList || 'None'}

Categories:
${categoriesList || 'None'}

Current Budgets & Spending:
${budgetList || 'No active budgets'}

Recent Transactions:
${txList || 'No recent transactions'}

RESPONSE RULES:
1. Provide a clear, friendly, and helpful response in Spanish in the "reply" property, formatted in Markdown.
2. Detect user intent ("TRANSACTION", "FINANCE_CHAT", "CAPABILITIES_QUERY", or "OFF_TOPIC").
   - If the user is asking what you can do (e.g. "¿En qué puedes ayudarme?", "What can you do?"), set intent to "CAPABILITIES_QUERY" and set "extractedTransaction" to null.
   - If the user asks a question about budgets, balance, or advice, set intent to "FINANCE_CHAT" and set "extractedTransaction" to null.
   - ONLY if the user explicitly asks to register/log a new expense, income, or transfer movement (or uploads a receipt photo), set intent to "TRANSACTION" and set "extractedTransaction" with structured details (description, amount, type, category_hint, source_hint, date_hint).
`;

    const userParts: any[] = [{ text: message || 'Please analyze this input.' }];
    if (image) {
      userParts.push({
        inlineData: {
          mimeType: image.mimeType || 'image/jpeg',
          data: image.base64,
        },
      });
    }

    const contents = [
      ...history,
      {
        role: 'user',
        parts: userParts,
      },
    ];

    const bodyPayload = {
      contents,
      systemInstruction: {
        parts: [{ text: chatSystemInstruction }],
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            reply: {
              type: 'STRING',
              description: 'Friendly conversational Markdown response in Spanish from the financial advisor.',
            },
            intent: {
              type: 'STRING',
              enum: ['TRANSACTION', 'FINANCE_CHAT', 'CAPABILITIES_QUERY', 'OFF_TOPIC'],
              description: 'Inferred intent of the user message.',
            },
            extractedTransaction: {
              type: 'OBJECT',
              description: 'Extracted transaction details ONLY if user explicitly commanded logging a transaction or uploaded a receipt.',
              properties: {
                description: { type: 'STRING' },
                amount: { type: 'NUMBER' },
                type: { type: 'STRING', enum: ['INCOME', 'EXPENSE', 'TRANSFER'] },
                category_hint: { type: 'STRING' },
                source_hint: { type: 'STRING' },
                date_hint: { type: 'STRING' },
              },
              required: ['description', 'amount', 'type', 'category_hint', 'source_hint'],
            },
          },
          required: ['reply'],
        },
      },
    };

    try {
      const { data, modelUsed } = await this.fetchWithFallback(
        this.FLASH_PRIMARY_URL,
        this.FLASH_FALLBACK_URL,
        apiKey,
        bodyPayload
      );

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('NO_RESPONSE_FROM_GEMINI');

      const response: ChatResponse = JSON.parse(text);
      console.log('[Bagi IA Debug] Chat Advisor Mode:', { modelUsed, intent: response.intent, response });
      return response;
    } catch (e: any) {
      console.error('[GeminiParserService] Error in chatWithAdvisor:', e);
      throw e;
    }
  }
}

export const geminiParserService = new GeminiParserService();
