import { useState, useEffect, useRef } from 'react';
import { useBudget } from '../context/BudgetContext';
import { voiceService } from '../../services/VoiceService';
import { ParsedTransaction } from '../../services/AIProviderTypes';
import {
  AIProviderId,
  getActiveAIProvider,
  getProviderService,
  getActiveApiKey,
  getActiveModelIds,
  getProviderApiKeyStorageKey,
} from '../../services/AIProviderFactory';

export type BagiAIErrorType =
  | 'SPEECH_NOT_SUPPORTED'
  | 'NO_AI_PROVIDER'
  | 'NO_API_KEY'
  | 'QUOTA_EXHAUSTED'
  | 'INVALID_API_KEY'
  | 'NO_SPEECH_DETECTED'
  | 'MIC_PERMISSION_DENIED'
  | 'NO_MICROPHONE'
  | 'TIMEOUT_ERROR'
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
  /** true si el request a Gemini falló para este mensaje: se excluye del historial de turnos futuros. */
  failed?: boolean;
}

// Cantidad máxima de mensajes previos que se reenvían como historial en cada llamada a Gemini.
const CHAT_HISTORY_LIMIT = 10;

export function useBagiAI(onApiKeyMissing: () => void, onProviderMissing?: () => void) {
  const { service } = useBudget();
  const [apiKey, setApiKey] = useState<string>('');
  const [activeProvider, setActiveProvider] = useState<AIProviderId | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<BagiAIErrorType>(null);
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const stopLevelMeterRef = useRef<(() => void) | null>(null);
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

  // Si está activo, las respuestas del asistente se leen en voz alta después de escribirse en el chat
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState<boolean>(() => {
    return localStorage.getItem('bagi_voice_reply_enabled') === 'true';
  });

  const toggleVoiceReply = () => {
    setVoiceReplyEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('bagi_voice_reply_enabled', String(next));
      return next;
    });
  };

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

    // Proveedor de IA activo (null si el usuario nunca configuró uno) + su API Key
    const provider = getActiveAIProvider();
    setActiveProvider(provider);
    if (provider) {
      const savedKey = getActiveApiKey(provider);
      if (savedKey) {
        setApiKey(savedKey);
      }
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

  // Watchdog para evitar que la UI quede colgada si SpeechRecognition nunca dispara
  // onstart/onresult/onerror/onend (permiso de mic atascado, tab en background, etc.)
  useEffect(() => {
    if (!isPreparing && !isRecording) return;

    const timeoutId = setTimeout(() => {
      console.warn('[useBagiAI] isPreparing/isRecording watchdog triggered - resetting state');
      voiceService.stop();
      stopLevelMeter();
      setIsPreparing(false);
      setIsRecording(false);
      setError('GENERIC_ERROR');
    }, 15000);

    return () => clearTimeout(timeoutId);
  }, [isPreparing, isRecording]);

  const saveApiKey = (key: string) => {
    if (!activeProvider) return;
    localStorage.setItem(getProviderApiKeyStorageKey(activeProvider), key);
    setApiKey(key);
    setError(null);
  };

  const deleteApiKey = () => {
    if (!activeProvider) return;
    localStorage.removeItem(getProviderApiKeyStorageKey(activeProvider));
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

  // Elimina marcado Markdown básico antes de pasar un texto al TTS (que lee símbolos literalmente).
  const stripMarkdown = (text: string): string => {
    return text
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[*_#`~]/g, '')
      .trim();
  };

  const stopLevelMeter = () => {
    stopLevelMeterRef.current?.();
    stopLevelMeterRef.current = null;
  };

  const startListening = () => {
    if (!activeProvider) {
      setError('NO_AI_PROVIDER');
      (onProviderMissing || onApiKeyMissing)();
      return;
    }

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

    // iOS Safari fix: desbloquea el audio context en el mismo gesto del usuario
    // para que la síntesis de voz posterior no falle en silencio.
    voiceService.unlockAudio();

    stopLevelMeterRef.current = voiceService.startLevelMeter(setAudioLevel);

    voiceService.start(
      lang,
      (text) => {
        stopLevelMeter();
        setIsPreparing(false);
        setIsRecording(false);
        setTranscript(text);
        sendChatMessage(text);
      },
      (err) => {
        stopLevelMeter();
        setIsPreparing(false);
        setIsRecording(false);
        if (err.error === 'no-speech') {
          setError('NO_SPEECH_DETECTED');
        } else if (err.error === 'not-allowed') {
          setError('MIC_PERMISSION_DENIED');
        } else if (err.error === 'audio-capture') {
          setError('NO_MICROPHONE');
        } else {
          console.warn('[useBagiAI] Speech recognition error callback', err);
          setError('GENERIC_ERROR');
        }
      },
      () => {
        stopLevelMeter();
        setIsPreparing(false);
        setIsRecording(false);
      },
      () => {
        // onstart dispara antes de que el engine empiece a capturar audio de verdad
        // (arranque interno del stream, ~300-500ms). Sin este margen se pierden las
        // primeras palabras si el usuario habla apenas ve "Escuchando...".
        setTimeout(() => {
          setIsPreparing((wasPreparing) => {
            if (!wasPreparing) return wasPreparing; // ya se canceló (stopListening corrió antes)
            setIsRecording(true);
            return false;
          });
        }, 500);
      }
    );
  };

  const stopListening = () => {
    voiceService.stop();
    stopLevelMeter();
    setIsPreparing(false);
    setIsRecording(false);
  };

  /**
   * Processes a financial advisor chat message (text and optional image).
   */
  const sendChatMessage = async (text: string, image?: { base64: string; mimeType: string }) => {
    if (!activeProvider) {
      setError('NO_AI_PROVIDER');
      (onProviderMissing || onApiKeyMissing)();
      return;
    }

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
      // Build history payload for Gemini chat.
      // Se excluyen los mensajes marcados como 'failed': quedaron sin respuesta del modelo,
      // así que incluirlos rompería la alternancia user/model que espera la API de Gemini
      // y haría que intentara responder ese turno fallido junto con el mensaje actual.
      // Se limita a los últimos CHAT_HISTORY_LIMIT mensajes para acotar el costo/latencia
      // en conversaciones largas (se pierde memoria de lo dicho hace rato, no del uso normal).
      const history = chatMessages
        .filter((msg) => !msg.failed)
        .slice(-CHAT_HISTORY_LIMIT)
        .map((msg) => ({
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

      const { primary, fallback } = getActiveModelIds(activeProvider);
      const response = await getProviderService(activeProvider).chatWithAdvisor(
        text,
        history,
        apiKey,
        primary,
        fallback,
        contextPayload,
        image
      );

      let mapped: MappedTransaction | undefined = undefined;
      // Solo confiar en extractedTransaction cuando el intent es explícitamente TRANSACTION:
      // Gemini puede rellenar ese campo con datos de ejemplos mencionados en el reply
      // (p.ej. en la respuesta de CAPABILITIES_QUERY) aunque el usuario no pidió registrar nada.
      if (
        response.intent === 'TRANSACTION' &&
        response.extractedTransaction &&
        response.extractedTransaction.amount > 0
      ) {
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

      if (voiceReplyEnabled) {
        setIsSpeaking(true);
        voiceService.speak(stripMarkdown(response.reply), lang, () => setIsSpeaking(false));
      }
    } catch (e: any) {
      console.error('[useBagiAI] Error in sendChatMessage:', e);
      setChatMessages((prev) =>
        prev.map((m) => (m.id === userMessageId ? { ...m, failed: true } : m))
      );
      if (e.message === 'QUOTA_EXHAUSTED') {
        setError('QUOTA_EXHAUSTED');
      } else if (e.message === 'INVALID_API_KEY') {
        setError('INVALID_API_KEY');
      } else if (e.message === 'TIMEOUT') {
        setError('TIMEOUT_ERROR');
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
    if (!activeProvider) {
      setError('NO_AI_PROVIDER');
      (onProviderMissing || onApiKeyMissing)();
      return;
    }

    if (!apiKey) {
      setError('NO_API_KEY');
      onApiKeyMissing();
      return;
    }

    setIsProcessing(true);
    setError(null);
    setParsedTx(null);

    try {
      const { primary, fallback } = getActiveModelIds(activeProvider);
      const parsed = await getProviderService(activeProvider).parseImageReceipt(
        base64,
        mimeType,
        apiKey,
        primary,
        fallback,
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
      } else if (e.message === 'TIMEOUT') {
        setError('TIMEOUT_ERROR');
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

    const confirmText = `Transacción registrada: ${customTx.description}`;
    const confirmMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'assistant',
      text: confirmText,
      timestamp: new Date()
    };
    setChatMessages((prev) => [...prev, confirmMsg]);

    if (voiceReplyEnabled) {
      setIsSpeaking(true);
      voiceService.speak(confirmText, lang, () => setIsSpeaking(false));
    }

    // Refresh transactions list
    const updatedTxs = await service.getTransactions();
    setRecentTransactions(updatedTxs as any);

    // Reset state after saving
    setParsedTx(null);
    setTranscript('');
  };

  return {
    isSupported: voiceService.isSupported(),
    apiKey,
    activeProvider,
    isPreparing,
    isRecording,
    isProcessing,
    isSpeaking,
    error,
    transcript,
    audioLevel,
    parsedTx,
    chatMessages,
    lang,
    setLang,
    categories,
    accounts,
    cards,
    startListening,
    stopListening,
    sendChatMessage,
    processReceiptImage,
    confirmAndSave,
    saveApiKey,
    deleteApiKey,
    clearParsedTx: () => setParsedTx(null),
    voiceReplyEnabled,
    toggleVoiceReply
  };
}
