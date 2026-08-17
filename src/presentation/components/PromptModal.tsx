import React, { useState, useEffect, useRef } from 'react';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  inputType?: 'text' | 'number';
  showCashToggle?: boolean;
  cashToggleLabel?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string, isCashToggleOn?: boolean) => void;
  onCancel: () => void;
}

export default function PromptModal({
  isOpen,
  title,
  message,
  placeholder = '',
  defaultValue = '',
  inputType = 'text',
  showCashToggle = false,
  cashToggleLabel = 'Pagado con efectivo',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const [isCash, setIsCash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setIsCash(false);
      setTimeout(() => inputRef.current?.focus(), 50); // slight delay to allow render
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() !== '') {
      onConfirm(value.trim(), isCash);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h3>
              {message && <p className="text-sm text-gray-500 mt-1.5">{message}</p>}
            </div>
            
            <div className="relative">
              <input
                ref={inputRef}
                type={inputType}
                step={inputType === 'number' ? '0.01' : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className={`w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder-gray-400 ${isCash ? 'opacity-50 pointer-events-none' : ''}`}
                required={!isCash}
              />
            </div>
            
            {showCashToggle && (
              <label className="flex items-center gap-3 p-3 mt-4 rounded-xl border border-gray-100 bg-gray-50/50 cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isCash}
                    onChange={(e) => setIsCash(e.target.checked)}
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${isCash ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out ${isCash ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700">{cashToggleLabel}</span>
              </label>
            )}
          </div>
          
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 transition-all active:scale-95"
            >
              {cancelText}
            </button>
            <button
              type="submit"
              disabled={(!isCash && value.trim() === '')}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
