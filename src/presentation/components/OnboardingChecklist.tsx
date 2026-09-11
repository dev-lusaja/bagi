import React from 'react';
import { Check, ArrowRight } from 'lucide-react';

interface OnboardingChecklistProps {
  steps: {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    icon: any;
    action: () => void;
    actionLabel: string;
  }[];
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ steps }) => {
  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl sm:rounded-3xl shadow-lg shadow-gray-200/40 overflow-hidden animate-in fade-in duration-500">
      {/* Header */}
      <div className="p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
            Guía de Inicio Rápido
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Completa los pasos para activar y estructurar tu presupuesto.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
          <div className="text-left sm:text-right">
            <span className="text-xs font-bold text-gray-700">{completedCount} de {totalCount} completados</span>
            <div className="w-28 bg-gray-100 h-1.5 rounded-full mt-1 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 shrink-0">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* List items */}
      <div className="divide-y divide-gray-100">
        {steps.map((step) => (
          <div
            key={step.id}
            onClick={!step.completed ? step.action : undefined}
            className={`p-3.5 sm:p-4.5 flex items-center justify-between gap-3 transition-colors ${
              step.completed
                ? 'bg-emerald-50/20'
                : 'hover:bg-indigo-50/30 cursor-pointer group'
            }`}
          >
            {/* Left: Circle check + text */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                  step.completed
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'border-2 border-gray-300 text-transparent bg-white group-hover:border-indigo-400'
                }`}
              >
                <Check className={`w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3] ${step.completed ? 'block' : 'hidden'}`} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4
                    className={`font-bold text-xs sm:text-sm leading-snug ${
                      step.completed ? 'text-gray-600 line-through opacity-80' : 'text-gray-900'
                    }`}
                  >
                    {step.title}
                  </h4>
                </div>
                <p className="text-[11px] sm:text-xs text-gray-400 font-medium truncate mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>

            {/* Right: Badge or Action button */}
            <div className="shrink-0">
              {step.completed ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100/80 text-emerald-700 border border-emerald-200/60">
                  Completado
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    step.action();
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all group-hover:shadow-md active:scale-95 min-h-[36px]"
                >
                  <span>{step.actionLabel}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer bar */}
      <div className="p-3 sm:p-4 bg-gray-50/60 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 font-medium">
        <span>{totalCount - completedCount > 0 ? `${totalCount - completedCount} pasos pendientes` : '¡Paso a paso configurado!'}</span>
        <span className="text-[10px] uppercase font-black tracking-widest text-indigo-500">Bagi Guía</span>
      </div>
    </div>
  );
};
