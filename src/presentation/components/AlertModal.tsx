import { AlertTriangle, Check, Info } from 'lucide-react';


interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'info' | 'error' | 'success' | 'warning';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onClose: () => void;
}

export default function AlertModal({
  isOpen,
  title,
  message,
  type = 'info',
  confirmText = 'Entendido',
  cancelText = 'Cancelar',
  onConfirm,
  onClose
}: AlertModalProps) {
  if (!isOpen) return null;

  const isConfirm = !!onConfirm;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-modal shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
        <div className="p-8 text-center space-y-6">
          <div className={`w-20 h-20 rounded-control mx-auto flex items-center justify-center rotate-3 shadow-inner ${
            type === 'error' ? 'bg-rose-50 text-rose-500' : 
            type === 'success' ? 'bg-emerald-50 text-emerald-500' : 
            type === 'warning' ? 'bg-amber-50 text-amber-500' :
            'bg-indigo-50 text-indigo-500'
          }`}>
            {type === 'error' && (
              <AlertTriangle className="w-10 h-10 -rotate-3" />
            )}
            {type === 'success' && (
              <Check className="w-10 h-10 -rotate-3" />
            )}
            {type === 'warning' && (
              <AlertTriangle className="w-10 h-10 -rotate-3" />
            )}
            {type === 'info' && (
              <Info className="w-10 h-10 -rotate-3" />
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h3>
            <p className="text-sm font-medium text-gray-500 leading-relaxed px-2">{message}</p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={onConfirm || onClose}
              className={`w-full py-4 rounded-card text-sm font-black text-white transition-all active:scale-95 shadow-xl shadow-gray-200 ${
                type === 'error' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-gray-900 hover:bg-indigo-600'
              }`}
            >
              {confirmText}
            </button>
            {isConfirm && (
              <button
                onClick={onClose}
                className="w-full py-4 rounded-card text-sm font-black text-gray-500 hover:text-gray-600 transition-all"
              >
                {cancelText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
