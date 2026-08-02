import React, { useState, useEffect, useRef } from 'react';
import { Key, ExternalLink, Sparkles } from 'lucide-react';

interface GeminiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
}

export default function GeminiKeyModal({
  isOpen,
  onClose,
  onSave,
}: GeminiKeyModalProps) {
  const [key, setKey] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const savedKey = localStorage.getItem('bagi_gemini_api_key') || '';
      setKey(savedKey);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim() !== '') {
      onSave(key.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 text-indigo-600">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-1.5">
                  Configurar Bagi IA
                </h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                  Para registrar transacciones con tu voz, necesitamos conectar con el modelo <strong>Gemini 3.6 Flash</strong> usando tu propia API Key. Es 100% gratuito.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-50/50 to-violet-50/30 p-4 rounded-2xl border border-indigo-50/60 text-xs text-indigo-950/80 leading-relaxed flex flex-col gap-2">
              <p className="font-bold flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" /> ¿Cómo conseguirla gratis?
              </p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Ve a <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 font-extrabold underline inline-flex items-center gap-0.5">Google AI Studio <ExternalLink className="w-2.5 h-2.5 inline" /></a>.</li>
                <li>Haz clic en <strong>"Create API Key"</strong>.</li>
                <li>Copia la clave generada y pégala aquí abajo.</li>
              </ol>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block">Tú Gemini API Key</label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full pl-11 pr-4 bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl py-3.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm placeholder-gray-400"
                  required
                />
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={key.trim() === ''}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-100"
            >
              Guardar Clave
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
