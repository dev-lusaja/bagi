import { FinancialContext } from './AIProviderTypes';

export const BASE_SYSTEM_INSTRUCTION = `
You are Bagi AI, an intelligent personal finance assistant for the Bagi web application.
Your core principles:
1. Always map category names and payment sources (accounts or cards) strictly to the exact names provided in the user context.
2. Convert amounts written as words into exact numbers (e.g. "forty thousand" -> 40000).
3. Always format "date_hint" as DD/MM/YYYY or YYYY-MM-DD or relative keyword ("ayer", "antier", "hoy").
4. Classify user input into one of four explicit intents:
   - "TRANSACTION": User explicitly commands to log an income, expense, or transfer.
   - "FINANCE_CHAT": User asks questions about personal budgets, spending habits, balances, or financial advice.
   - "CAPABILITIES_QUERY": User asks what Bagi AI can do or how to use its features (e.g. "What can you do?", "¿En qué puedes ayudarme?", "How do I use this?").
   - "OFF_TOPIC": User input is completely unrelated to finance, budgeting, or Bagi capabilities.
`;

export function buildCategoriesList(categories: { name: string; type: string }[]): string {
  return categories.map(c => `- ${c.name} (${c.type})`).join('\n');
}

export function buildAccountsList(accounts: { name: string; currency: string }[]): string {
  return accounts.map(a => `- ${a.name} (Account, ${a.currency})`).join('\n');
}

export function buildCardsList(cards: { name: string; currency: string }[]): string {
  return cards.map(c => `- ${c.name} (Card, ${c.currency})`).join('\n');
}

export function buildVoiceParsePrompt(
  transcript: string,
  context: { categories: { name: string; type: string }[]; accounts: { name: string; currency: string }[]; cards: { name: string; currency: string }[] }
): string {
  return `
Analyze the spoken transcript below and extract transaction fields or detect query intent.

AVAILABLE CATEGORIES:
${buildCategoriesList(context.categories)}

AVAILABLE ORIGINS (ACCOUNTS AND CARDS):
${buildAccountsList(context.accounts)}
${buildCardsList(context.cards)}

User spoken text: "${transcript}"
`;
}

export const VOICE_PARSER_INSTRUCTION = `
${BASE_SYSTEM_INSTRUCTION}

[MODE: VOICE PARSER SPECIALIZATION]
Your job is to parse spoken voice inputs quickly and accurately.
- If the user asks what you can do, set "intent" to "CAPABILITIES_QUERY".
- If the user asks a question about their budgets or finances, set "intent" to "FINANCE_CHAT".
- If the input is unrelated, set "intent" to "OFF_TOPIC".
- If it is a financial movement, set "intent" to "TRANSACTION", map category_hint and source_hint to exact list names, and parse relative dates into date_hint.
`;

export function buildReceiptPrompt(context: {
  categories: { name: string; type: string }[];
  accounts: { name: string; currency: string }[];
  cards: { name: string; currency: string }[];
}): string {
  return `
Analyze the attached receipt/invoice image and extract transaction details.

AVAILABLE CATEGORIES:
${buildCategoriesList(context.categories)}

AVAILABLE ORIGINS (ACCOUNTS AND CARDS):
${buildAccountsList(context.accounts)}
${buildCardsList(context.cards)}
`;
}

export const RECEIPT_SCANNER_INSTRUCTION = `
${BASE_SYSTEM_INSTRUCTION}

[MODE: RECEIPT VISION SCANNER SPECIALIZATION]
You are an expert OCR vision scanner for purchase receipts and invoices.
- Extract merchant name as "description".
- Extract final paid total as "amount".
- Set "type" to "EXPENSE" (or "INCOME" for deposit slips).
- Match category_hint and source_hint to exact names from provided lists.
- Always set "intent" to "TRANSACTION".
`;

export function buildChatAdvisorInstruction(context: FinancialContext): string {
  const categoriesList = buildCategoriesList(context.categories);
  const accountsList = context.accounts.map(a => `- ${a.name} (${a.currency})`).join('\n');
  const cardsList = context.cards.map(c => `- ${c.name} (${c.currency})`).join('\n');
  const txList = (context.recentTransactions || [])
    .slice(0, 15)
    .map(t => `- [${t.date}] ${t.type}: ${t.description} - $${t.amount} (Cat: ${t.category || 'N/A'})`)
    .join('\n');
  const budgetList = (context.budgets || [])
    .map(b => `- ${b.category}: Budget $${b.limit}, Spent $${b.spent}`)
    .join('\n');

  return `
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
   - If the user is asking what you can do (e.g. "¿En qué puedes ayudarme?", "What can you do?"), set intent to "CAPABILITIES_QUERY" and set "extractedTransaction" to null. In "reply", after the explanation, include a short Markdown bullet list with 3-4 concrete example phrases the user could type or say, such as: "Gasté 45 mil en mercado con Visa", "Ingreso de salario por 2 millones en Bancolombia", "¿Cómo van mis presupuestos este mes?", "Tanqueé el carro con gasolina por 80 mil con efectivo".
   - If the user asks a question about budgets, balance, or advice, set intent to "FINANCE_CHAT" and set "extractedTransaction" to null.
   - If the user input is off-topic, greeting, or unclear, set intent to "OFF_TOPIC", set "extractedTransaction" to null, and in "reply" explain kindly in Spanish that you didn't understand or can only assist with personal finances and transaction tracking.
   - If the user explicitly commands to register/log a new expense, income, or transfer movement (e.g. "Anota un gasto de 20 mil en café", "Gasté 45 mil") or uploads a receipt photo, set intent to "TRANSACTION" AND set "extractedTransaction" with structured details (description, amount, type, category_hint, source_hint, date_hint). In "reply", inform the user in Spanish that the transaction details have been prepared for their review and confirmation in the popup modal. Never state that it has already been saved to the database.
`;
}

// ---- JSON Schemas: definición neutral (lowercase, forma nativa de OpenAI/OpenRouter) ----
// Fuente única de verdad — cada proveedor la adapta a su forma con los conversores de abajo.

export const PARSED_TRANSACTION_SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string', description: 'Short description of transaction (e.g. Groceries, Gas, Salary).' },
    amount: { type: 'number', description: 'Total numerical amount of transaction.' },
    type: { type: 'string', enum: ['INCOME', 'EXPENSE', 'TRANSFER'], description: 'Transaction type.' },
    category_hint: { type: 'string', description: 'Exact matching category name from provided list.' },
    source_hint: { type: 'string', description: 'Exact matching account or card name from provided list.' },
    date_hint: { type: 'string', description: 'Temporal mention or null if omitted (e.g. "yesterday", "today").' },
    intent: { type: 'string', enum: ['TRANSACTION', 'FINANCE_CHAT', 'CAPABILITIES_QUERY', 'OFF_TOPIC'], description: 'Inferred intent of the user.' },
  },
  required: ['description', 'amount', 'type', 'category_hint', 'source_hint'],
};

export const CHAT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Friendly conversational Markdown response in Spanish from the financial advisor.' },
    intent: { type: 'string', enum: ['TRANSACTION', 'FINANCE_CHAT', 'CAPABILITIES_QUERY', 'OFF_TOPIC'], description: 'Inferred intent of the user message.' },
    extractedTransaction: {
      type: 'object',
      description: 'Extracted transaction details ONLY if user explicitly commanded logging a transaction or uploaded a receipt.',
      properties: {
        description: { type: 'string' },
        amount: { type: 'number' },
        type: { type: 'string', enum: ['INCOME', 'EXPENSE', 'TRANSFER'] },
        category_hint: { type: 'string' },
        source_hint: { type: 'string' },
        date_hint: { type: 'string' },
      },
      required: ['description', 'amount', 'type', 'category_hint', 'source_hint'],
    },
  },
  required: ['reply'],
};

/** Convierte el schema neutral (lowercase) al formato uppercase que exige responseSchema de Gemini. */
export function toGeminiSchema(schema: any): any {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === 'object') {
    const out: any = {};
    for (const [key, value] of Object.entries(schema)) {
      out[key] = key === 'type' && typeof value === 'string' ? value.toUpperCase() : toGeminiSchema(value);
    }
    return out;
  }
  return schema;
}

/** Agrega additionalProperties:false recursivamente para reforzar el modo strict de json_schema en OpenRouter. */
export function withAdditionalPropertiesFalse(schema: any): any {
  if (Array.isArray(schema)) return schema.map(withAdditionalPropertiesFalse);
  if (schema && typeof schema === 'object') {
    const out: any = {};
    for (const [key, value] of Object.entries(schema)) {
      out[key] = withAdditionalPropertiesFalse(value);
    }
    if (out.type === 'object') out.additionalProperties = false;
    return out;
  }
  return schema;
}
