import React from 'react';
import { Wallet, Tag, Repeat, Landmark, CreditCard, ArrowRight, CheckCircle2 } from 'lucide-react';

export const BudgetExplainer: React.FC = () => {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-24 py-12">
      {/* Pillar 1: Global Budget */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6 order-2 md:order-1">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
            <Wallet className="w-3 h-3" />
            Presupuesto
          </div>
          <h3 className="text-4xl font-black text-gray-900 tracking-tighter leading-tight">
            Todo empieza con un <span className="text-indigo-600">plan maestro</span>
          </h3>
          <p className="text-gray-500 font-medium text-lg leading-relaxed">
            A diferencia de otras apps, Bagi te obliga a definir tus ingresos reales antes de gastar. Este es tu <b>presupuesto mensual</b>: el techo que protege tus finanzas.
          </p>
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-[2rem] shadow-2xl shadow-indigo-200/50 space-y-4 text-white relative overflow-hidden group max-w-sm">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-2xl rounded-full -mr-12 -mt-12 group-hover:bg-white/20 transition-all duration-700" />
            <div className="flex justify-between items-start">
              <h4 className="text-base font-medium opacity-90">Presupuesto mensual</h4>
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-3xl font-black tracking-tighter">$3,500.00</div>
            
            <div className="space-y-3 pt-4 border-t border-white/20">
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-70">Gasto Total</span>
                <span className="text-lg font-black">$2,150.00</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-white/10">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-70">Disponible</span>
                <span className="text-lg font-black text-emerald-300">$1,350.00</span>
              </div>
            </div>
          </div>
        </div>
        <div className="relative order-1 md:order-2 flex justify-center">
          <div className="w-64 h-64 bg-indigo-600/5 rounded-full absolute blur-3xl" />
          <div className="relative bg-white p-8 rounded-[3rem] shadow-2xl border border-gray-50 transform rotate-3 hover:rotate-0 transition-transform duration-500">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg mb-6">
              <Wallet className="w-8 h-8" />
            </div>
            <div className="space-y-4">
              <div className="h-4 w-32 bg-gray-100 rounded-full" />
              <div className="h-4 w-48 bg-gray-100 rounded-full" />
              <div className="h-4 w-24 bg-gray-50 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Pillar 2: Categories (Envelopes) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="relative flex justify-center">
          <div className="w-64 h-64 bg-emerald-600/5 rounded-full absolute blur-3xl" />
          <div className="grid grid-cols-2 gap-4 relative">
             <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-50 -rotate-6 w-40">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Tag className="w-3.5 h-3.5" /></div>
                  <span className="font-bold text-[10px]">Mercado</span>
                </div>
                <div className="space-y-1.5">
                  <div className="h-1 w-full bg-emerald-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[70%]" />
                  </div>
                  <p className="text-[8px] font-bold text-gray-400">$350 / $500</p>
                </div>
             </div>
             <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-50 rotate-6 mt-10 w-40">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><Tag className="w-3.5 h-3.5" /></div>
                  <span className="font-bold text-[10px]">Ocio</span>
                </div>
                <div className="space-y-1.5">
                  <div className="h-1 w-full bg-rose-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 w-[95%]" />
                  </div>
                  <p className="text-[8px] font-bold text-rose-500">¡Casi al límite!</p>
                </div>
             </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
            <Tag className="w-3 h-3" />
            Categorías
          </div>
          <h3 className="text-4xl font-black text-gray-900 tracking-tighter leading-tight">
            Distribuye con <span className="text-emerald-600">precisión</span>
          </h3>
          <p className="text-gray-500 font-medium text-lg leading-relaxed">
            Divide tu presupuesto en categorías. Bagi actúa como un sistema de sobres: cuando gastas, el dinero se resta de su respectivo límite, dándote visibilidad real de cuánto te queda para el resto del mes.
          </p>
        </div>
      </div>

      {/* Pillar 3: Snapshots (Obligations) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6 order-2 md:order-1">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-purple-100">
            <Repeat className="w-3 h-3" />
            Obligaciones mensuales
          </div>
          <h3 className="text-4xl font-black text-gray-900 tracking-tighter leading-tight">
            Tus facturas, <span className="text-purple-600">versionadas</span>
          </h3>
          <p className="text-gray-500 font-medium text-lg leading-relaxed">
            En Bagi, tus gastos fijos (Netflix, Alquiler, Luz) no son solo plantillas. Cada mes se crea una <b>"fotografía"</b> independiente. Si la luz sube este mes, cámbiala solo para hoy sin afectar tus estadísticas históricas.
          </p>
          <div className="flex items-center gap-4 p-4 bg-purple-50/50 rounded-2xl border border-purple-100 border-dashed">
            <div className="p-3 bg-purple-600 text-white rounded-xl shadow-lg shadow-purple-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm">Netflix (Junio)</p>
              <p className="text-[10px] font-bold text-purple-600 uppercase">Pagado • $15.99</p>
            </div>
            <div className="ml-auto flex -space-x-2">
               <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[8px] font-bold">MAY</div>
               <div className="w-8 h-8 rounded-full border-2 border-white bg-purple-600 text-white flex items-center justify-center text-[8px] font-bold shadow-lg">JUN</div>
            </div>
          </div>
        </div>
        <div className="relative order-1 md:order-2 flex justify-center">
          <div className="w-64 h-64 bg-purple-600/5 rounded-full absolute blur-3xl" />
          <div className="relative bg-white p-6 rounded-[2rem] shadow-2xl border border-gray-50 flex flex-col gap-4 max-w-sm">
            <div className="h-2.5 w-32 bg-gray-100 rounded-full" />
            <div className="h-2.5 w-40 bg-gray-100 rounded-full opacity-60" />
            <div className="h-2.5 w-28 bg-gray-100 rounded-full opacity-30" />
            <div className="mt-2 p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-purple-600">
                <Repeat className="w-4 h-4" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-purple-300" />
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-sm text-white">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pillar 4: Accounts & Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="relative flex justify-center">
          <div className="w-64 h-64 bg-amber-600/5 rounded-full absolute blur-3xl" />
          <div className="space-y-4 relative scale-90 md:scale-100">
             <div className="bg-gradient-to-br from-gray-800 to-black p-5 rounded-xl shadow-2xl text-white w-48 transform -rotate-12">
                <CreditCard className="w-6 h-6 mb-3 opacity-50" />
                <p className="text-[8px] font-bold tracking-[0.3em] opacity-40 uppercase">Credit Card</p>
                <p className="text-base font-black mt-1">•••• 4242</p>
             </div>
             <div className="bg-white p-5 rounded-xl shadow-xl border border-gray-100 w-48 translate-x-10 -translate-y-6">
                <div className="flex items-center gap-3">
                   <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><Landmark className="w-4 h-4" /></div>
                   <div>
                      <p className="text-[8px] font-black text-gray-400 uppercase">Cuenta Sueldo</p>
                      <p className="font-bold text-xs">$2,450.00</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100">
            <Landmark className="w-3 h-3" />
            Flujo Unificado
          </div>
          <h3 className="text-4xl font-black text-gray-900 tracking-tighter leading-tight">
            Control <span className="text-amber-600">Multi-cuenta</span>
          </h3>
          <p className="text-gray-500 font-medium text-lg leading-relaxed">
            Vincula tus tarjetas de crédito a tus cuentas bancarias. Cuando gastas con la tarjeta, Bagi descuenta automáticamente del presupuesto de tu cuenta de pago, dándote una visión consolidada de tu salud financiera real.
          </p>
        </div>
      </div>
    </div>
  );
};
