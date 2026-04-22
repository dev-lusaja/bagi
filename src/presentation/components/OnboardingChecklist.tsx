import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

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
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="bg-white border border-indigo-100 rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-indigo-100/20 animate-in fade-in slide-in-from-top-4 duration-1000">
      <div className="flex justify-between items-start mb-6 md:mb-8">
        <div>
          <h3 className="text-xl font-black text-indigo-950 tracking-tight">Guía de inicio rápido</h3>
          <p className="text-gray-500 text-xs md:text-sm mt-1">Configura tu ecosistema financiero paso a paso.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-indigo-600 leading-none">{Math.round(progress)}%</div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Progreso</div>
        </div>
      </div>

      <div className="w-full bg-gray-100 h-2 rounded-full mb-8 md:mb-10 overflow-hidden">
        <div 
          className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-out" 
          style={{ width: `${progress}%` }} 
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {steps.map((step, idx) => (
          <div 
            key={step.id}
            className={`relative p-5 md:p-6 rounded-[2rem] border transition-all duration-500 flex flex-col h-full ${
              step.completed 
                ? 'bg-emerald-50/30 border-emerald-100 scale-[0.98]' 
                : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 transform hover:-translate-y-1'
            }`}
          >
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center mb-4 shrink-0 ${
              step.completed ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <step.icon className="w-5 h-5 md:w-6 md:h-6" />
            </div>

            <div className="space-y-1 mb-4 md:mb-6 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Paso {idx + 1}</span>
                {step.completed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              </div>
              <h4 className={`font-bold text-xs md:text-sm leading-tight ${step.completed ? 'text-emerald-900' : 'text-gray-900'}`}>{step.title}</h4>
              <p className="text-[10px] text-gray-400 leading-snug line-clamp-2 md:line-clamp-none">{step.description}</p>
            </div>

            <div className="mt-auto pt-2">
              {!step.completed ? (
                <button 
                  onClick={step.action}
                  className="w-full py-2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {step.actionLabel}
                  <ArrowRight className="w-2.5 h-2.5" />
                </button>
              ) : (
                <div className="text-center py-2 text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-100/20 rounded-xl border border-emerald-100/30">
                  ¡Listo!
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
