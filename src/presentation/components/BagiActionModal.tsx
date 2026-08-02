import React, { useEffect } from 'react';
import { X, Check } from 'lucide-react';

/**
 * BagiActionModal – Componente genérico y reutilizable para acciones del asistente de voz Bagi IA.
 *
 * Soporta cualquier contenido a través de `children` y un slot `headerContent` para resúmenes
 * visuales en la cabecera. Cuando `isSuccess` es true, muestra una pantalla de éxito animada
 * y se cierra automáticamente después de `successAutoCloseMs` milisegundos.
 *
 * Uso:
 *   <BagiActionModal isOpen={open} onClose={close} title="Registrar Transacción" ...>
 *     <TransactionConfirmForm ... />
 *   </BagiActionModal>
 */
interface BagiActionModalProps {
  /** Controla si el modal está visible */
  isOpen: boolean;

  /** Callback al hacer clic en la X. También se llama tras el auto-cierre por éxito. */
  onClose: () => void;

  /** Título principal del modal (en la cabecera) */
  title: string;

  /** Subtítulo/etiqueta pequeña sobre el título */
  subtitle?: string;

  /**
   * Contenido visual del resumen en la cabecera (ej: monto + descripción de la transacción).
   * Se renderiza debajo del título en la franja de gradiente.
   */
  headerContent?: React.ReactNode;

  /** Cuando es true, oculta los `children` y muestra la pantalla de éxito */
  isSuccess?: boolean;

  /** Mensaje principal en la pantalla de éxito */
  successMessage?: string;

  /** Detalle secundario en la pantalla de éxito */
  successDetail?: string;

  /** Milisegundos tras los cuales el modal se auto-cierra al entrar en estado de éxito. Default: 2800 */
  successAutoCloseMs?: number;
}

export default function BagiActionModal({
  isOpen,
  onClose,
  title,
  subtitle,
  headerContent,
  isSuccess = false,
  successMessage = '¡Operación completada!',
  successDetail,
  successAutoCloseMs = 2800,
  children,
}: BagiActionModalProps & { children: React.ReactNode }) {

  // Auto-cierre tras éxito
  useEffect(() => {
    if (isSuccess && isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, successAutoCloseMs);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, isOpen, successAutoCloseMs, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 max-h-[85dvh] flex flex-col">

        {/* ─── Cabecera con gradiente ─── */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-6 text-white flex-shrink-0">
          {/* Botón X – explícito, único punto de cierre manual */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-all active:scale-90 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <X className="w-4 h-4" />
          </button>

          {subtitle && (
            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1.5">
              {subtitle}
            </p>
          )}

          <h3 className="text-xl font-extrabold tracking-tight pr-10">{title}</h3>

          {/* Slot de resumen visual (ej: monto + tipo de transacción) */}
          {headerContent && (
            <div className="mt-4">{headerContent}</div>
          )}
        </div>

        {/* ─── Cuerpo del modal ─── */}
        <div className="overflow-y-auto flex-1">
          {isSuccess ? (
            // Pantalla de éxito
            <div className="p-10 flex flex-col items-center justify-center gap-5 text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-40" />
                <div className="relative w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check className="w-10 h-10 text-emerald-600" strokeWidth={2.5} />
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-extrabold text-gray-900">{successMessage}</h4>
                {successDetail && (
                  <p className="text-sm text-gray-400 font-medium leading-relaxed">{successDetail}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6">
              {children}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
