export interface ParsedTransaction {
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  category_hint: string;
  source_hint: string;
  date_hint: string | null;
  intent?: 'TRANSACTION' | 'FINANCE_CHAT' | 'CAPABILITIES_QUERY' | 'OFF_TOPIC';
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

/** Un modelo seleccionable en Settings, de cualquier proveedor. */
export interface AIModelOption {
  id: string;
  label: string;
  supportsImage: boolean;
}

/**
 * Contrato compartido entre proveedores de IA (Gemini, OpenRouter, futuros).
 * Solo cubre los métodos que useBagiAI.ts usa hoy en producción.
 */
export interface IAIProviderService {
  chatWithAdvisor(
    message: string,
    history: { role: 'user' | 'model'; parts: { text: string }[] }[],
    apiKey: string,
    primaryModelId: string,
    fallbackModelId: string,
    context: FinancialContext,
    image?: { base64: string; mimeType: string }
  ): Promise<ChatResponse>;

  parseImageReceipt(
    imageBase64: string,
    mimeType: string,
    apiKey: string,
    primaryModelId: string,
    fallbackModelId: string,
    context: FinancialContext
  ): Promise<ParsedTransaction>;
}
