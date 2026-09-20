import { Mic, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

export type BagiIARingState = 'idle' | 'listening' | 'processing' | 'speaking';

interface BagiIARingProps {
  state: BagiIARingState;
  onClick: () => void;
  disabled?: boolean;
  /** Nivel de volumen de voz (0-1), solo se usa mientras state === 'listening'. */
  audioLevel?: number;
}

export default function BagiIARing({ state, onClick, disabled, audioLevel = 0 }: BagiIARingProps) {
  // Destello tipo ecualizador: el aro crece con el volumen de la voz mientras escucha.
  const listeningScale = state === 'listening' ? 1 + audioLevel * 0.25 : 1;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300",
        "focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
        // Glowing box-shadow based on state
        state === 'idle' && "bg-gray-100/50 shadow-none hover:bg-gray-100",
        state === 'listening' && "bg-cyan-50 shadow-[0_0_40px_rgba(6,182,212,0.4)]",
        state === 'processing' && "bg-amber-50 shadow-[0_0_40px_rgba(245,158,11,0.4)]",
        state === 'speaking' && "bg-violet-50 shadow-[0_0_40px_rgba(124,58,237,0.4)]"
      )}
      style={{
        transform: `scale(${listeningScale})`,
        transition: 'transform 75ms ease-out',
      }}
    >
      {/* El aro de color (borde animado) */}
      <div
        className={clsx(
          "absolute inset-0 rounded-full border-[6px]",
          state === 'idle' && "border-transparent transition-colors duration-500",
          state === 'listening' && "border-cyan-400 border-t-cyan-200 border-r-cyan-200 animate-spin",
          state === 'processing' && "border-amber-400 border-t-amber-200 border-l-amber-200 animate-[spin_0.5s_linear_infinite] transition-colors duration-500",
          state === 'speaking' && "border-violet-500 border-opacity-80 animate-pulse transition-colors duration-500"
        )}
      />
      
      {/* Icono central */}
      <div className={clsx(
        "relative z-10 transition-colors duration-300",
        state === 'idle' && "text-gray-400",
        state === 'listening' && "text-cyan-500",
        state === 'processing' && "text-amber-500",
        state === 'speaking' && "text-violet-500"
      )}>
        {state === 'processing' ? (
          <RefreshCw className="w-10 h-10 animate-spin" />
        ) : (
          <Mic className="w-10 h-10" />
        )}
      </div>
    </button>
  );
}
