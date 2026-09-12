import { BarChart3, Settings, ChevronRight } from 'lucide-react';

interface MoreViewProps {
  onNavigate: (tab: string) => void;
}

export default function MoreView({ onNavigate }: MoreViewProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-500 tracking-tight">
          Más Opciones
        </h2>
        <p className="text-gray-500 text-xs sm:text-sm mt-1 font-medium">
          Hub central de herramientas avanzadas, análisis y ajustes del sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Analytics Card */}
        <button
          onClick={() => onNavigate('analytics')}
          className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all text-left flex items-start justify-between group active:scale-[0.99]"
        >
          <div className="space-y-4 pr-4">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">
                Analítica Comparativa
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-medium leading-relaxed">
                Analiza tendencias históricas y compara el rendimiento y tus gastos entre diferentes meses (Mes A vs. Mes B).
              </p>
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 text-gray-400 transition-all shrink-0">
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>

        {/* Settings Card */}
        <button
          onClick={() => onNavigate('settings')}
          className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all text-left flex items-start justify-between group active:scale-[0.99]"
        >
          <div className="space-y-4 pr-4">
            <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all shadow-sm">
              <Settings className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-purple-600 transition-colors">
                Configuración
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-medium leading-relaxed">
                Gestiona tus cuentas bancarias, tarjetas de crédito, categorías de gastos/ingresos y recurrencias.
              </p>
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-purple-50 group-hover:text-purple-600 text-gray-400 transition-all shrink-0">
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>
      </div>
    </div>
  );
}
