import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useBagiAI, MappedTransaction } from '../hooks/useBagiAI';
import { voiceService } from '../../services/VoiceService';
import BagiActionModal from '../components/BagiActionModal';
import TransactionConfirmForm from '../components/TransactionConfirmForm';
import GeminiKeyModal from '../components/GeminiKeyModal';
import BagiIARing from '../components/BagiIARing';
import {
  Sparkles,
  AlertCircle,
  Globe,
  Key,
  Info,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  ArrowLeftRight,
  Mic,
  MessageSquare,
  Send,
  Camera,
  Bot,
  User,
  Paperclip,
  X,
  Loader2,
} from 'lucide-react';

export default function Intelligence() {
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'voice' | 'chat'>('voice');
  const [chatInput, setChatInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const {
    isSupported,
    apiKey,
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
    parseTextDirectly,
    sendChatMessage,
    processReceiptImage,
    confirmAndSave,
    saveApiKey,
    clearParsedTx,
  } = useBagiAI(() => setIsKeyModalOpen(true));

  // ─── Estado del modal de confirmación ───
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [editedTx, setEditedTx] = useState<MappedTransaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);
  const [isConfirmSpeaking, setIsConfirmSpeaking] = useState(false);

  // Auto-scroll en el chat cuando hay nuevos mensajes
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab, isProcessing]);

  // Abre el modal en cuanto Gemini retorna una transacción parseada
  useEffect(() => {
    if (parsedTx) {
      setEditedTx(parsedTx);
      setIsSaveSuccess(false);
      setIsConfirmModalOpen(true);
    }
  }, [parsedTx]);

  // Cierre limpio del modal (X manual o auto-cierre tras éxito).
  // No corta la voz: el modal (2.8s) suele cerrarse antes que termine la
  // confirmación hablada ("Listo. Registré..."), y cortarla ahí sonaba como si
  // la voz "se fuera" junto con el modal. Se deja terminar en segundo plano.
  const handleModalClose = useCallback(() => {
    setIsConfirmModalOpen(false);
    setIsSaveSuccess(false);
    setEditedTx(null);
    clearParsedTx();
  }, [clearParsedTx]);

  // Confirmación y guardado con feedback por voz
  const handleConfirmSave = async () => {
    if (!editedTx) return;
    setIsSaving(true);
    try {
      await confirmAndSave(editedTx);
      setIsSaveSuccess(true);

      // Confirmación por voz (TTS) solo si el origen es por voz y no por chat
      if (editedTx.source !== 'chat') {
        const speechText = lang.startsWith('en')
          ? `Done. I registered: ${editedTx.description}.`
          : `Listo. Registré: ${editedTx.description}.`;

        setIsConfirmSpeaking(true);
        voiceService.speak(speechText, lang, () => setIsConfirmSpeaking(false));
      }

      // El modal se auto-cierra solo (via BagiActionModal.successAutoCloseMs)
      // y llama a handleModalClose para limpiar el estado.
    } catch (e) {
      console.error('[Intelligence] Error saving transaction:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuggestionClick = (phrase: string) => {
    if (isRecording || isProcessing) return;
    if (activeTab === 'chat') {
      setChatInput(phrase);
    } else {
      parseTextDirectly(phrase);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const [header, base64] = dataUrl.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || file.type || 'image/jpeg';
        setSelectedImage({
          base64,
          mimeType,
          previewUrl: dataUrl,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!chatInput.trim() && !selectedImage) || isProcessing) return;

    const msgText = chatInput.trim();
    const imgPayload = selectedImage
      ? { base64: selectedImage.base64, mimeType: selectedImage.mimeType }
      : undefined;

    setChatInput('');
    setSelectedImage(null);

    await sendChatMessage(msgText, imgPayload);
  };

  const handleDirectReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const [header, base64] = dataUrl.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || file.type || 'image/jpeg';
        await processReceiptImage(base64, mimeType);
      }
    };
    reader.readAsDataURL(file);
  };

  const suggestions = [
    { label: 'Gasto de Mercado', text: 'Gasté 45 mil en mercado con Visa' },
    { label: 'Salario Recibido', text: 'Ingreso de salario por 2 millones en Bancolombia' },
    { label: 'Consulta Presupuesto', text: '¿Cómo van mis presupuestos este mes y cuánto me queda por gastar?' },
    { label: 'Gasto de Gasolina', text: 'Tanqueé el carro con gasolina por 80 mil con efectivo' },
  ];

  // Contenido del header del modal: resumen visual de la transacción detectada
  const transactionHeaderContent = editedTx ? (
    <div className="flex items-center justify-between mt-2 bg-white/10 rounded-xl p-3">
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-black tabular-nums leading-none">
          {editedTx.type === 'EXPENSE' ? '−' : editedTx.type === 'INCOME' ? '+' : ''}
          {new Intl.NumberFormat(lang.startsWith('en') ? 'en-US' : 'es-CO').format(editedTx.amount)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-1.5 rounded-lg flex-shrink-0 ml-3">
        {editedTx.type === 'INCOME' && <><TrendingUp className="w-3.5 h-3.5 text-emerald-300" /> Ingreso</>}
        {editedTx.type === 'EXPENSE' && <><TrendingDown className="w-3.5 h-3.5 text-rose-300" /> Gasto</>}
        {editedTx.type === 'TRANSFER' && <><ArrowLeftRight className="w-3.5 h-3.5 text-blue-300" /> Traspaso</>}
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">

      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 sm:gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-800 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500 animate-pulse" />
            Bagi IA
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1 font-medium">Controla tus finanzas hablando con inteligencia artificial.</p>
        </div>

        {apiKey && (
          <button
            type="button"
            onClick={() => setIsKeyModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 hover:border-indigo-100 hover:bg-indigo-50/50 rounded-2xl text-xs font-bold text-gray-500 hover:text-indigo-600 transition-all cursor-pointer min-h-[44px]"
          >
            <Key className="w-3.5 h-3.5" />
            Cambiar API Key
          </button>
        )}
      </div>

      {/* ─── Banner de navegador incompatible ─── */}
      {!isSupported && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-4 text-amber-900 animate-in slide-in-from-top-4 duration-300">
          <AlertCircle className="w-12 h-12 text-amber-500 flex-shrink-0" />
          <div className="space-y-1 text-center md:text-left">
            <h4 className="font-extrabold text-base">Navegador no soportado para captura de voz</h4>
            <p className="text-sm text-amber-800/90 leading-relaxed">
              Safari, Firefox y algunos navegadores móviles no implementan la Web Speech API nativa.
              Para registrar mediante voz te recomendamos ingresar desde <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ─── Selector de Modo (Tabs) ─── */}
      <div className="flex items-center justify-between bg-gray-100/80 p-1.5 rounded-2xl max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('voice')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'voice'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Mic className="w-4 h-4" />
          Comando por Voz
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Chat Asesor Financiero
        </button>
      </div>

      {/* ─── Área principal ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-start">

        {/* ─ Columna izquierda: Modo Voz o Modo Chat ─ */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6 flex flex-col justify-between min-h-[480px]">

          {/* Header de controles e indicador de estado */}
          <div className="w-full flex justify-between items-center px-2 border-b border-gray-50 pb-3">
            <div className="flex items-center gap-2" title={apiKey ? "API Key configurada" : "API Key no configurada"}>
              <span className={`w-2.5 h-2.5 rounded-full ${apiKey ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                {apiKey ? 'API Lista' : 'Sin API Key'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Opción de subir foto de recibo directamente */}
              <label className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-600 rounded-xl text-[11px] font-bold cursor-pointer transition-colors">
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Escanear Recibo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleDirectReceiptUpload}
                  disabled={isProcessing}
                />
              </label>

              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-gray-400" />
                <select
                  className="bg-transparent text-xs font-bold text-gray-600 outline-none cursor-pointer hover:text-indigo-600 transition-colors"
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  disabled={isRecording || isProcessing}
                >
                  <option value="es-ES">Español</option>
                </select>
              </div>
            </div>
          </div>

          {/* VISTA 1: COMANDO POR VOZ */}
          {activeTab === 'voice' && (
            <div className="flex flex-col items-center justify-center space-y-6 py-6 flex-1">
              <BagiIARing
                state={(isSpeaking || isConfirmSpeaking) ? 'speaking' : isProcessing ? 'processing' : (isRecording || isPreparing) ? 'listening' : 'idle'}
                onClick={(isRecording || isPreparing) ? stopListening : startListening}
                disabled={isProcessing || !isSupported || isSpeaking || isConfirmSpeaking}
                audioLevel={audioLevel}
              />

              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-800">
                  {(isSpeaking || isConfirmSpeaking)
                    ? 'Respondiendo...'
                    : isPreparing
                    ? 'Preparando micrófono...'
                    : isRecording
                    ? '¡Estoy listo! Escuchando tu voz...'
                    : isProcessing
                    ? 'Bagi IA procesando...'
                    : 'Hablar con Bagi IA'}
                </h3>
                <p className="text-xs text-gray-400 mt-1 max-w-[280px]">
                  {(isSpeaking || isConfirmSpeaking)
                    ? 'Escucha la respuesta de Bagi IA.'
                    : isPreparing
                    ? 'Iniciando captura de audio del navegador...'
                    : isRecording
                    ? 'Habla ahora. Di los detalles y presiona el botón para finalizar.'
                    : isProcessing
                    ? 'Extrayendo datos de la transacción.'
                    : isSupported
                    ? 'Presiona el botón para iniciar grabación por voz.'
                    : 'Esta feature requiere micrófono en Chrome/Edge.'}
                </p>
              </div>

              {/* Preview de transcripción */}
              {transcript && (
                <div className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-center max-w-[480px]">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Transcripción</p>
                  <p className="text-sm font-medium text-gray-600 italic">"{transcript}"</p>
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: CHAT CON ASESOR FINANCIERO */}
          {activeTab === 'chat' && (
            <div className="flex flex-col flex-1 justify-between space-y-4">
              {/* Mensajes del chat */}
              <div className="flex-1 overflow-y-auto max-h-[360px] space-y-3 pr-1">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-10 space-y-2 text-gray-400">
                    <Bot className="w-10 h-10 text-indigo-400 animate-bounce" />
                    <p className="text-xs font-semibold text-gray-600">¡Hola! Soy tu Asesor Financiero Bagi IA</p>
                    <p className="text-[11px] max-w-xs text-gray-400 leading-relaxed">
                      Pregúntame sobre tus presupuestos, tus gastos recientes o sube una foto de tu recibo para analizarlo.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 ${
                        msg.sender === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {msg.sender === 'assistant' && (
                        <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}
                      <div
                        className={`max-w-[82%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-gray-100 text-gray-800 rounded-bl-none'
                        }`}
                      >
                        {msg.imageUrl && (
                          <img
                            src={msg.imageUrl}
                            alt="Adjunto"
                            className="max-h-40 rounded-xl mb-2 object-cover border border-white/20"
                          />
                        )}
                        {msg.sender === 'assistant' ? (
                          <div className="space-y-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:underline [&_a]:text-indigo-600">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        )}
                      </div>
                      {msg.sender === 'user' && (
                        <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                {isProcessing && (
                  <div className="flex items-center gap-2 text-gray-400 text-xs italic p-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    Bagi IA está analizando e ingresando tu consulta...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Formulario de envío del chat */}
              <form onSubmit={handleSendChat} className="space-y-2 pt-2 border-t border-gray-100">
                {selectedImage && (
                  <div className="relative inline-block">
                    <img
                      src={selectedImage.previewUrl}
                      alt="Vista previa"
                      className="h-16 w-16 object-cover rounded-xl border border-indigo-200"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedImage(null)}
                      className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 hover:bg-rose-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer min-h-[44px] flex items-center justify-center"
                    title="Adjuntar foto de recibo o imagen"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Haz una pregunta o pide registrar un gasto..."
                    disabled={isProcessing}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all min-h-[44px]"
                  />

                  <button
                    type="submit"
                    disabled={(!chatInput.trim() && !selectedImage) || isProcessing}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white rounded-xl transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Banner: API Key no configurada */}
          {!apiKey && (
            <div className="w-full bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 max-w-[480px] flex items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-semibold text-indigo-950">Se requiere API Key para procesar</span>
              </div>
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Configurar
              </button>
            </div>
          )}

          {/* Alertas de error */}
          {error && (
            <div className="w-full max-w-[480px] p-4 bg-rose-50 border border-rose-100 text-rose-800 text-xs font-semibold rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                {error === 'QUOTA_EXHAUSTED' && (
                  <>
                    <h5 className="font-extrabold">Cuota diaria agotada</h5>
                    <p className="text-rose-700/90 mt-0.5">Has alcanzado el límite gratuito de consultas para hoy en Google AI Studio.</p>
                  </>
                )}
                {error === 'INVALID_API_KEY' && (
                  <>
                    <h5 className="font-extrabold">API Key Inválida</h5>
                    <p className="text-rose-700/90 mt-0.5">La clave ingresada no es válida. Por favor, re-configúrala.</p>
                  </>
                )}
                {error === 'OFF_TOPIC' && (
                  <>
                    <h5 className="font-extrabold">Consulta fuera de tema</h5>
                    <p className="text-rose-700/90 mt-0.5">Bagi IA solo procesa registros de transacciones financieras.</p>
                  </>
                )}
                {error === 'NO_SPEECH_DETECTED' && (
                  <>
                    <h5 className="font-extrabold">No te escuchamos</h5>
                    <p className="text-rose-700/90 mt-0.5">No se detectó audio del micrófono. Por favor, vuelve a intentar.</p>
                  </>
                )}
                {error === 'MIC_PERMISSION_DENIED' && (
                  <>
                    <h5 className="font-extrabold">Permiso de micrófono denegado</h5>
                    <p className="text-rose-700/90 mt-0.5">Habilita el acceso al micrófono en los permisos del navegador e intenta de nuevo.</p>
                  </>
                )}
                {error === 'NO_MICROPHONE' && (
                  <>
                    <h5 className="font-extrabold">No se detectó un micrófono</h5>
                    <p className="text-rose-700/90 mt-0.5">Conecta o habilita un micrófono para usar el registro por voz.</p>
                  </>
                )}
                {error === 'TIMEOUT_ERROR' && (
                  <>
                    <h5 className="font-extrabold">La IA tardó demasiado en responder</h5>
                    <p className="text-rose-700/90 mt-0.5">Revisa tu conexión a internet e intenta de nuevo.</p>
                  </>
                )}
                {error === 'GENERIC_ERROR' && (
                  <>
                    <h5 className="font-extrabold">Error inesperado</h5>
                    <p className="text-rose-700/90 mt-0.5">Ocurrió un error al conectar con Gemini. Revisa tu conexión a internet.</p>
                  </>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ─ Columna derecha: Sugerencias (siempre visible) ─ */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-xs sm:text-sm font-black uppercase text-gray-400 tracking-widest flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-500 shrink-0" /> Ejemplos de uso
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Presiona cualquier sugerencia para simular el registro de forma instantánea:
            </p>
            <div className="flex flex-col gap-3">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSuggestionClick(s.text)}
                  disabled={isRecording || isProcessing}
                  className="p-3 text-left border border-gray-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-indigo-500 group-hover:text-indigo-600">{s.label}</span>
                    <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <p className="text-xs font-medium text-gray-600 mt-1 italic">"{s.text}"</p>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ─── Modal de confirmación de transacción ─── */}
      {editedTx && (
        <BagiActionModal
          isOpen={isConfirmModalOpen}
          onClose={handleModalClose}
          title="¿Registrar movimiento?"
          subtitle="Revisión de Bagi IA"
          headerContent={transactionHeaderContent}
          isSuccess={isSaveSuccess}
          successMessage="¡Transacción registrada!"
          successDetail={`${editedTx?.description ?? ''} guardada exitosamente en tu historial.`}
          successAutoCloseMs={2800}
        >
          <TransactionConfirmForm
            tx={editedTx}
            onChange={setEditedTx}
            onConfirm={handleConfirmSave}
            onCancel={handleModalClose}
            isSaving={isSaving}
            categories={categories}
            accounts={accounts}
            cards={cards}
          />
        </BagiActionModal>
      )}

      {/* ─── Modal de configuración de API Key ─── */}
      <GeminiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onSave={(key) => {
          saveApiKey(key);
          setIsKeyModalOpen(false);
        }}
      />

    </div>
  );
}
