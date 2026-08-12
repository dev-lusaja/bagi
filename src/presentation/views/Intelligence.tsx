import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';

export default function Intelligence() {
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const {
    isSupported,
    apiKey,
    isRecording,
    isProcessing,
    isSpeaking,
    error,
    transcript,
    parsedTx,
    lang,
    setLang,
    categories,
    accounts,
    cards,
    startListening,
    stopListening,
    parseTextDirectly,
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

  // Abre el modal en cuanto Gemini retorna una transacción parseada
  useEffect(() => {
    if (parsedTx) {
      setEditedTx(parsedTx);
      setIsSaveSuccess(false);
      setIsConfirmModalOpen(true);
    }
  }, [parsedTx]);

  // Cierre limpio del modal (X manual o auto-cierre tras éxito)
  const handleModalClose = useCallback(() => {
    setIsConfirmModalOpen(false);
    setIsSaveSuccess(false);
    setEditedTx(null);
    clearParsedTx();
    voiceService.stopSpeaking();
  }, [clearParsedTx]);

  // Confirmación y guardado con feedback por voz
  const handleConfirmSave = async () => {
    if (!editedTx) return;
    setIsSaving(true);
    try {
      await confirmAndSave(editedTx);
      setIsSaveSuccess(true);

      // Confirmación por voz (TTS)
      const speechText = lang.startsWith('en')
        ? `Done. I registered: ${editedTx.description}.`
        : `Listo. Registré: ${editedTx.description}.`;
      
      setIsConfirmSpeaking(true);
      voiceService.speak(speechText, lang, () => setIsConfirmSpeaking(false));

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
    parseTextDirectly(phrase);
  };

  const suggestions = [
    { label: 'Gasto de Mercado', text: 'Gasté 45 mil en mercado con Visa' },
    { label: 'Salario Recibido', text: 'Ingreso de salario por 2 millones en Bancolombia' },
    { label: 'Pago de Servicios', text: 'Pagué servicios 120 mil con efectivo' },
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-800 tracking-tight flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
            Bagi IA
          </h2>
          <p className="text-gray-500 mt-1 font-medium">Controla tus finanzas hablando con inteligencia artificial.</p>
        </div>

        {apiKey && (
          <button
            type="button"
            onClick={() => setIsKeyModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 hover:border-indigo-100 hover:bg-indigo-50/50 rounded-2xl text-xs font-bold text-gray-500 hover:text-indigo-600 transition-all cursor-pointer"
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

      {/* ─── Área principal ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ─ Columna izquierda: Botón de voz ─ */}
        <div className="lg:col-span-7 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8 flex flex-col items-center justify-center min-h-[480px]">

          {/* Controles de idioma */}
          {isSupported && (
            <div className="w-full flex justify-between items-center px-4 border-b border-gray-50 pb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Bagi IA Online</span>
              </div>
              <div className="flex items-center gap-2">
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
          )}

          {/* Botón de micrófono principal / Aro */}
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <BagiIARing 
              state={(isSpeaking || isConfirmSpeaking) ? 'speaking' : isProcessing ? 'processing' : isRecording ? 'listening' : 'idle'}
              onClick={isRecording ? stopListening : startListening}
              disabled={isProcessing || !isSupported || isSpeaking || isConfirmSpeaking}
            />

            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800">
                {(isSpeaking || isConfirmSpeaking)
                  ? 'Respondiendo...'
                  : isRecording
                  ? 'Escuchando tu voz...'
                  : isProcessing
                  ? 'Bagi IA procesando...'
                  : 'Hablar con Bagi IA'}
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-[280px]">
                {(isSpeaking || isConfirmSpeaking)
                  ? 'Escucha la respuesta de Bagi IA.'
                  : isRecording
                  ? 'Di los detalles y presiona el botón para finalizar.'
                  : isProcessing
                  ? 'Extrayendo datos de la transacción.'
                  : isSupported
                  ? 'Presiona el botón para iniciar grabación.'
                  : 'Esta feature requiere micrófono en Chrome/Edge.'}
              </p>
            </div>
          </div>

          {/* Preview de transcripción */}
          {transcript && (
            <div className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-center max-w-[480px]">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Transcripción</p>
              <p className="text-sm font-medium text-gray-600 italic">"{transcript}"</p>
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
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-500" /> Ejemplos de uso
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
                  className="p-3 text-left border border-gray-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
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
