import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { voiceService } from '../../services/VoiceService';
import { geminiParserService, ParsedTransaction } from '../../services/GeminiParserService';

export type BagiAIErrorType = 
  | 'SPEECH_NOT_SUPPORTED' 
  | 'NO_API_KEY' 
  | 'QUOTA_EXHAUSTED' 
  | 'INVALID_API_KEY' 
  | 'OFF_TOPIC' 
  | 'NO_SPEECH_DETECTED' 
  | 'GENERIC_ERROR' 
  | null;

export interface MappedTransaction {
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  category_id: number | null;
  account_id: number | null;
  card_id: number | null;
  date: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  imageUrl?: string;
  extractedTransaction?: MappedTransaction;
}

export function useBagiAI(onApiKeyMissing: () => void) {
  const { service } = useBudget();
  const [apiKey, setApiKey] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<BagiAIErrorType>(null);
  const [transcript, setTranscript] = useState('');
  const [lang, setLang] = useState('es-CO'); // Default
  const [parsedTx, setParsedTx] = useState<MappedTransaction | null>(null);

  // Metadata from DB & financial summary
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);

  // Chat message history
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    // Load metadata and current budget financial context
    const loadMetadata = async () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const [accs, crds, cats, txs, catBudgets] = await Promise.all([
        service.getAccounts(),
        service.getCards(),
        service.getCategories(),
        service.getTransactions(),
        service.getCategoryBudgets(currentYear, currentMonth)
      ]);

      setAccounts(accs as any);
      setCards(crds as any);
      setCategories(cats as any);
      setRecentTransactions(txs as any);

      // Build budget summary
      const formattedBudgets = (catBudgets as any[]).map(b => {
        const cat = (cats as any[]).find(c => c.id === b.category_id);
        const spent = (txs as any[])
          .filter(t => t.category_id === b.category_id && t.type === 'EXPENSE')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        return {
          category: cat?.name || 'Categoría',
          limit: b.amount,
          spent
        };
      });
      setBudgets(formattedBudgets);
    };
    loadMetadata();

    // API Key load
    const savedKey = localStorage.getItem('bagi_gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, [service]);

  // Watchdog para evitar que la UI quede bloqueada si la síntesis de voz falla silenciosamente
  useEffect(() => {
    if (!isSpeaking) return;

    const timeoutId = setTimeout(() => {
      console.warn('[useBagiAI] isSpeaking watchdog triggered - resetting state');
      setIsSpeaking(false);
    }, 30000);

    return () => clearTimeout(timeoutId);
  }, [isSpeaking]);

  const saveApiKey = (key: string) => {
    localStorage.setItem('bagi_gemini_api_key', key);
    setApiKey(key);
    setError(null);
  };

  const deleteApiKey = () => {
    localStorage.removeItem('bagi_gemini_api_key');
    setApiKey('');
    setParsedTx(null);
  };

  // Maps text strings to database records
  const mapGeminiOutput = (parsed: ParsedTransaction): MappedTransaction => {
    // 1. Map Category
    let category_id: number | null = null;
    const catHint = parsed.category_hint.toLowerCase().trim();
    if (catHint) {
      const matchedCat = categories.find(c => c.name.toLowerCase().trim() === catHint) ||
                         categories.find(c => c.name.toLowerCase().trim().includes(catHint)) ||
                         categories.find(c => catHint.includes(c.name.toLowerCase().trim()));
      if (matchedCat) category_id = matchedCat.id;
    }

    // 2. Map Origin (Account or Card)
    let account_id: number | null = null;
    let card_id: number | null = null;
    const sourceHint = parsed.source_hint.toLowerCase().trim();

    if (sourceHint) {
      // Look in cards first
      const matchedCard = cards.find(c => c.name.toLowerCase().trim() === sourceHint) ||
                          cards.find(c => c.name.toLowerCase().trim().includes(sourceHint)) ||
                          cards.find(c => sourceHint.includes(c.name.toLowerCase().trim()));
      if (matchedCard) {
        card_id = matchedCard.id;
      } else {
        // Look in accounts
        const matchedAcc = accounts.find(a => a.name.toLowerCase().trim() === sourceHint) ||
                           accounts.find(a => a.name.toLowerCase().trim().includes(sourceHint)) ||
                           accounts.find(a => sourceHint.includes(a.name.toLowerCase().trim()));
        if (matchedAcc) {
          account_id = matchedAcc.id;
        }
      }
    }

    // Fallback: If nothing matched, set default if there is only 1 account or card
    if (!account_id && !card_id) {
      if (accounts.length === 1) account_id = accounts[0].id;
      else if (cards.length === 1) card_id = cards[0].id;
    }

    // 3. Impute Date
    const now = new Date();
    let finalDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).toISOString();
    const dateHint = parsed.date_hint?.toLowerCase().trim();

    if (dateHint) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
      if (dateHint.includes('ayer')) {
        d.setDate(d.getDate() - 1);
        finalDate = d.toISOString();
      } else if (dateHint.includes('antier') || dateHint.includes('hace 2 dias') || dateHint.includes('hace 2 días')) {
        d.setDate(d.getDate() - 2);
        finalDate = d.toISOString();
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateHint)) {
        // DD/MM/YYYY
        const [day, month, year] = dateHint.split('/').map(Number);
        finalDate = new Date(year, month - 1, day, 12, 0, 0).toISOString();
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateHint)) {
        // YYYY-MM-DD
        const [year, month, day] = dateHint.split('-').map(Number);
        finalDate = new Date(year, month - 1, day, 12, 0, 0).toISOString();
      }
    }

    return {
      description: parsed.description || 'Transacción IA',
      amount: parsed.amount || 0,
      type: parsed.type || 'EXPENSE',
      category_id,
      account_id,
      card_id,
      date: finalDate
    };
  };

  const parseText = async (text: string) => {
    if (!apiKey) {
      setError('NO_API_KEY');
      onApiKeyMissing();
      return;
    }

    setIsProcessing(true);
    setError(null);
    setParsedTx(null);

    try {
      const parsed = await geminiParserService.parse(text, apiKey, {
        categories,
        accounts,
        cards
      });

      if (parsed.error === 'OFF_TOPIC' || parsed.intent === 'OFF_TOPIC') {
        setError('OFF_TOPIC');
        setIsProcessing(false);
        return;
      }

      if (parsed.intent === 'CAPABILITIES_QUERY') {
        setIsProcessing(false);
        setIsSpeaking(true);
        const capabilitiesText = lang.startsWith('en')
          ? "Right now I can help you record your daily expenses, incomes, and transfers. Just tell me what you spent or received."
          : "Actualmente puedo ayudarte a registrar tus gastos, ingresos y transferencias diarios. Solo dime qué gastaste o recibiste, y yo lo anotaré por ti.";
        voiceService.speak(capabilitiesText, lang, () => setIsSpeaking(false));
        return;
      }

      const mapped = mapGeminiOutput(parsed);
      setParsedTx(mapped);
    } catch (e: any) {
      console.error(e);
      if (e.message === 'QUOTA_EXHAUSTED') {
        setError('QUOTA_EXHAUSTED');
      } else if (e.message === 'INVALID_API_KEY') {
        setError('INVALID_API_KEY');
      } else {
        setError('GENERIC_ERROR');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = () => {
    if (!apiKey) {
      setError('NO_API_KEY');
      onApiKeyMissing();
      return;
    }

    if (!voiceService.isSupported()) {
      setError('SPEECH_NOT_SUPPORTED');
      return;
    }

    setError(null);
    setTranscript('');
    setParsedTx(null);
    setIsPreparing(true);

    voiceService.start(
      lang,
      (text) => {
        setIsPreparing(false);
        setIsRecording(false);
        setTranscript(text);
        parseText(text);
      },
      (err) => {
        setIsPreparing(false);
        setIsRecording(false);
        if (err.error === 'no-speech') {
          setError('NO_SPEECH_DETECTED');
        } else {
          console.warn('[useBagiAI] Speech recognition error callback', err);
        }
      },
      () => {
        setIsPreparing(false);
        setIsRecording(false);
      },
      () => {
        // Recognition onstart callback: microphone capture is active and ready
        setIsPreparing(false);
        setIsRecording(true);
      }
    );
  };

  const stopListening = () => {
    voiceService.stop();
    setIsPreparing(false);
    setIsRecording(false);
  };

  /**
   * Processes a financial advisor chat message (text and optional image).
   */
  const sendChatMessage = async (text: string, image?: { base64: string; mimeType: string }) => {
    if (!apiKey) {
      setError('NO_API_KEY');
      onApiKeyMissing();
      return;
    }

    setIsProcessing(true);
    setError(null);

    const userMessageId = Date.now().toString();
    const newUserMsg: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text,
      timestamp: new Date(),
      imageUrl: image ? `data:${image.mimeType};base64,${image.base64}` : undefined,
    };

    setChatMessages((prev) => [...prev, newUserMsg]);

    try {
      // Build history payload for Gemini chat
      const history = chatMessages.map((msg) => ({
        role: msg.sender === 'user' ? ('user' as const) : ('model' as const),
        parts: [{ text: msg.text }],
      }));

      const contextPayload = {
        categories,
        accounts,
        cards,
        recentTransactions,
        budgets,
      };

      const response = await geminiParserService.chatWithAdvisor(
        text,
        history,
        apiKey,
        contextPayload,
        image
      );

      let mapped: MappedTransaction | undefined = undefined;
      // Always map and open confirmation modal whenever extractedTransaction is present
      if (response.extractedTransaction) {
        mapped = mapGeminiOutput(response.extractedTransaction);
        setParsedTx(mapped);
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: response.reply,
        timestamp: new Date(),
        extractedTransaction: mapped,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      console.error('[useBagiAI] Error in sendChatMessage:', e);
      if (e.message === 'QUOTA_EXHAUSTED') {
        setError('QUOTA_EXHAUSTED');
      } else if (e.message === 'INVALID_API_KEY') {
        setError('INVALID_API_KEY');
      } else {
        setError('GENERIC_ERROR');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Processes a receipt photo directly to open transaction confirmation modal.
   */
  const processReceiptImage = async (base64: string, mimeType: string) => {
    if (!apiKey) {
      setError('NO_API_KEY');
      onApiKeyMissing();
      return;
    }

    setIsProcessing(true);
    setError(null);
    setParsedTx(null);

    try {
      const parsed = await geminiParserService.parseImageReceipt(
        base64,
        mimeType,
        apiKey,
        {
          categories,
          accounts,
          cards,
        }
      );

      const mapped = mapGeminiOutput(parsed);
      setParsedTx(mapped);
    } catch (e: any) {
      console.error('[useBagiAI] Error in processReceiptImage:', e);
      if (e.message === 'QUOTA_EXHAUSTED') {
        setError('QUOTA_EXHAUSTED');
      } else if (e.message === 'INVALID_API_KEY') {
        setError('INVALID_API_KEY');
      } else {
        setError('GENERIC_ERROR');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmAndSave = async (customTx: MappedTransaction) => {
    if (!customTx.category_id || (!customTx.account_id && !customTx.card_id)) {
      throw new Error('MISSING_FIELDS');
    }

    const currentPeriod = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const [bYear, bMonth] = currentPeriod.split('-');
    
    // Calculate final dates (matching Transactions.tsx logic)
    const txDate = new Date(customTx.date);
    const tempDate = new Date(parseInt(bYear), parseInt(bMonth) - 1, txDate.getDate(), 12, 0, 0);
    
    let finalImputationDate: string;
    if (tempDate.getMonth() !== parseInt(bMonth) - 1) {
      finalImputationDate = new Date(parseInt(bYear), parseInt(bMonth), 0, 12, 0, 0).toISOString();
    } else {
      finalImputationDate = tempDate.toISOString();
    }

    await service.addTransaction({
      description: customTx.description,
      amount: customTx.amount,
      account_id: customTx.account_id,
      card_id: customTx.card_id,
      category_id: customTx.category_id,
      date: txDate.toISOString(),
      imputation_date: finalImputationDate,
      user_id: 1 // Default
    });

    // Reset state after saving
    setParsedTx(null);
    setTranscript('');
  };

  return {
    isSupported: voiceService.isSupported(),
    apiKey,
    isPreparing,
    isRecording,
    isProcessing,
    isSpeaking,
    error,
    transcript,
    parsedTx,
    chatMessages,
    lang,
    setLang,
    categories,
    accounts,
    cards,
    startListening,
    stopListening,
    parseTextDirectly: parseText,
    sendChatMessage,
    processReceiptImage,
    confirmAndSave,
    saveApiKey,
    deleteApiKey,
    clearParsedTx: () => setParsedTx(null)
  };
}
