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
    <div className="bg-white border border-indigo-100 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-100/20 animate-in fade-in slide-in-from-top-4 duration-1000">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-xl font-black text-indigo-950 tracking-tight">Guía de Inicio Rápido</h3>
          <p className="text-gray-500 text-sm mt-1">Sigue estos pasos para configurar tu presupuesto perfecto.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-indigo-600 leading-none">{Math.round(progress)}%</div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Progreso</div>
        </div>
      </div>

      <div className="w-full bg-gray-100 h-2 rounded-full mb-10 overflow-hidden">
        <div 
          className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-out" 
          style={{ width: `${progress}%` }} 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {steps.map((step, idx) => (
          <div 
            key={step.id}
            className={`relative p-6 rounded-3xl border transition-all duration-500 ${
              step.completed 
                ? 'bg-emerald-50/50 border-emerald-100 scale-[0.98]' 
                : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 transform hover:-translate-y-1'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
              step.completed ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <step.icon className="w-6 h-6" />
            </div>

            <div className="space-y-1 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Paso {idx + 1}</span>
                {step.completed && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
              <h4 className={`font-bold text-sm ${step.completed ? 'text-emerald-900' : 'text-gray-900'}`}>{step.title}</h4>
              <p className="text-[11px] text-gray-500 leading-snug">{step.description}</p>
            </div>

            {!step.completed ? (
              <button 
                onClick={step.action}
                className="w-full py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                {step.actionLabel}
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <div className="text-center py-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                ¡Completado!
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
