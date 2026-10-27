import { BarChart3, Settings, ChevronRight } from 'lucide-react';

interface MoreViewProps {
  onNavigate: (tab: string) => void;
}

const ITEMS = [
  { tab: 'analytics', label: 'Analítica', Icon: BarChart3, iconClass: 'bg-indigo-50 text-indigo-600' },
  { tab: 'settings', label: 'Configuración', Icon: Settings, iconClass: 'bg-gray-100 text-gray-600' },
];

export default function MoreView({ onNavigate }: MoreViewProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Más opciones
        </h2>
      </div>

      <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden max-w-xl">
        {ITEMS.map(({ tab, label, Icon, iconClass }) => (
          <li key={tab}>
            <button
              onClick={() => onNavigate(tab)}
              className="w-full flex items-center gap-4 px-4 py-3 min-h-[56px] text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
                <Icon className="w-5 h-5" />
              </span>
              <span className="flex-1 text-sm font-semibold text-gray-800">{label}</span>
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
