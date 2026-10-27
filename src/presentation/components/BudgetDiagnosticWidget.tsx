import { AlertTriangle, CheckCircle2, AlertOctagon, HelpCircle, AlertCircle, BarChart3, Home, CreditCard } from 'lucide-react';
import { formatCurrency } from '../utils/format';

interface Props {
  globalBudget: { total_amount: number } | null;
  totalSpentGlobal: number;
  totalPlannedCommitment: number;
  currency: string;
  categories: any[];
  budgets: any[];
  actualsByCategory: Record<number, number>;
  filteredRecurring: any[];
  // Nuevos pilares
  variablePlan: number;
  variableSpent: number;
  obligationsPlan: number;
  obligationsActualPaid: number;
  paidObligationsCount: number;
  totalObligationsCount: number;
  cardsPlan: number;
  cardsSpent: number;
  onAdjustLimits?: () => void;
}

export default function BudgetDiagnosticWidget({
  globalBudget,
  totalSpentGlobal,
  totalPlannedCommitment,
  currency,
  categories,
  budgets,
  actualsByCategory,
  filteredRecurring,
  variablePlan,
  variableSpent,
  obligationsPlan,
  obligationsActualPaid,
  paidObligationsCount,
  totalObligationsCount,
  cardsPlan,
  cardsSpent,
  onAdjustLimits,
}: Props) {
  if (!globalBudget) {
    return (
      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
          <HelpCircle className="w-8 h-8" />
        </div>
        <div>
          <h4 className="text-lg font-bold text-gray-800 leading-tight">Presupuesto mensual sin definir</h4>
          <p className="text-sm text-gray-500 mt-1">
            Para iniciar tu diagnóstico financiero, define tu presupuesto mensual en el panel de la derecha registrando un ingreso real.
          </p>
        </div>
      </div>
    );
  }

  const budgetLimit = globalBudget.total_amount;
  const isOverBudget = totalSpentGlobal > budgetLimit;
  const isPillarOverrun = cardsSpent > cardsPlan || variableSpent > variablePlan || obligationsActualPaid > obligationsPlan;
  const isOverPlanned = totalPlannedCommitment > budgetLimit;

  // Porcentajes de barras de los tres pilares
  const variablePct = variablePlan > 0 ? Math.round((variableSpent / variablePlan) * 100) : 0;
  const obligationsPct = obligationsPlan > 0 ? Math.round((obligationsActualPaid / obligationsPlan) * 100) : 0;
  const cardsPct = cardsPlan > 0 ? Math.round((cardsSpent / cardsPlan) * 100) : 0;

  // Lógica del diagnóstico de sobregasto real (Prioridad de ejecución)
  const getDiagnosticMessage = () => {
    if (isOverBudget) {
      // Buscar las categorías de gasto que superaron su presupuesto
      const overspentDetails = categories
        .filter((cat) => cat.type === 'EXPENSE')
        .map((cat) => {
          const isSpecialRecurring = cat.name === 'Servicios Recurrentes' || cat.name === 'Deudas Recurrentes';
          let catLimit = 0;

          if (isSpecialRecurring) {
            catLimit = filteredRecurring
              .filter((o) => o.category_id === cat.id)
              .reduce((sum, o) => sum + o.amount, 0);
          } else {
            const b = budgets.find((b) => b.category_id === cat.id);
            catLimit = b ? b.amount : 0;
          }

          const actual = actualsByCategory[cat.id] || 0;
          const diff = actual - catLimit;
          return {
            name: cat.name,
            limit: catLimit,
            actual,
            diff,
          };
        })
        .filter((d) => d.diff > 0)
        .sort((a, b) => b.diff - a.diff); // De mayor a menor sobregasto

      const excessAmount = totalSpentGlobal - budgetLimit;

      if (overspentDetails.length > 0) {
        const topCategoriesText = overspentDetails
          .slice(0, 2)
          .map((cat) => cat.name)
          .join(' y ');

        return (
          <span>
            Te pasaste <strong className="font-extrabold">{formatCurrency(excessAmount, currency)}</strong>, sobre todo en{' '}
            <strong className="font-extrabold">{topCategoriesText}</strong>.
          </span>
        );
      }

      // Overspend comes from categories without an explicit limit
      return (
        <span>
          Te pasaste <strong className="font-extrabold">{formatCurrency(excessAmount, currency)}</strong> en categorías sin límite.
        </span>
      );
    }

    if (isPillarOverrun) {
      const overruns: { name: string; diff: number }[] = [];
      if (variableSpent > variablePlan) overruns.push({ name: 'categorías', diff: variableSpent - variablePlan });
      if (obligationsActualPaid > obligationsPlan) overruns.push({ name: 'obligaciones', diff: obligationsActualPaid - obligationsPlan });
      if (cardsSpent > cardsPlan) overruns.push({ name: 'tarjetas', diff: cardsSpent - cardsPlan });

      const totalOverrun = overruns.reduce((sum, o) => sum + o.diff, 0);
      const namesText = overruns.map((o) => o.name).join(' y ');

      return (
        <span>
          Te pasaste <strong className="font-extrabold">{formatCurrency(totalOverrun, currency)}</strong> en {namesText}.
        </span>
      );
    }

    if (isOverPlanned) {
      // Planificación inviable pero gasto real aún bajo control
      // Encontrar la categoría con el límite planificado más alto para sugerir recortarla
      const highestLimitCat = categories
        .filter((cat) => cat.type === 'EXPENSE')
        .map((cat) => {
          const isSpecialRecurring = cat.name === 'Servicios Recurrentes' || cat.name === 'Deudas Recurrentes';
          let limitAmt = 0;

          if (isSpecialRecurring) {
            limitAmt = filteredRecurring
              .filter((o) => o.category_id === cat.id)
              .reduce((sum, o) => sum + o.amount, 0);
          } else {
            const b = budgets.find((b) => b.category_id === cat.id);
            limitAmt = b ? b.amount : 0;
          }
          return { name: cat.name, limit: limitAmt };
        })
        .sort((a, b) => b.limit - a.limit)[0];

      const plannedDiff = totalPlannedCommitment - budgetLimit;

      return (
        <span>
          Tu plan supera el presupuesto en <strong className="font-extrabold">{formatCurrency(plannedDiff, currency)}</strong>
          {highestLimitCat && highestLimitCat.limit > 0 && (
            <>; prueba bajar <strong className="font-extrabold">{highestLimitCat.name}</strong></>
          )}.
        </span>
      );
    }

    // Caso Saludable
    const remainingToPlan = budgetLimit - totalPlannedCommitment;
    const remainingToSpend = budgetLimit - totalSpentGlobal;

    return (
      <span>
        Te quedan <strong className="font-extrabold">{formatCurrency(remainingToSpend, currency)}</strong> disponibles
        {remainingToPlan > 0 && (
          <> y <strong className="font-extrabold">{formatCurrency(remainingToPlan, currency)}</strong> sin asignar</>
        )}.
      </span>
    );
  };

  // Determinar estilos visuales basados en la salud del presupuesto
  let statusColor = 'border-emerald-100 bg-emerald-50/20 text-emerald-800';
  let statusIcon = <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />;
  let statusLabel = 'Resumen del mes';

  const isHealthy = !isOverBudget && !isPillarOverrun && !isOverPlanned;

  if (isOverBudget) {
    statusColor = 'border-rose-100 bg-rose-50/30 text-rose-800';
    statusIcon = <AlertOctagon className="w-6 h-6 text-rose-600 shrink-0 animate-pulse" />;
    statusLabel = 'Presupuesto excedido';
  } else if (isPillarOverrun) {
    statusColor = 'border-orange-100 bg-orange-50/30 text-orange-800';
    statusIcon = <AlertCircle className="w-6 h-6 text-orange-600 shrink-0" />;
    statusLabel = 'Plan excedido';
  } else if (isOverPlanned) {
    statusColor = 'border-amber-100 bg-amber-50/35 text-amber-800';
    statusIcon = <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />;
    statusLabel = 'Plan mayor al presupuesto';
  }

  return (
    <div className={`p-6 rounded-[2rem] border shadow-sm transition-all duration-300 ${statusColor}`}>
      <div className="flex items-center gap-2.5 mb-5">
        {statusIcon}
        <span className="text-[10px] font-black">{statusLabel}</span>
      </div>

      <div className="space-y-5">
        {/* Desglose por Pilares (Límites, Obligaciones, Tarjetas) */}
        <div className="space-y-5 bg-white/70 p-5 rounded-[1.5rem] border border-gray-100/30 shadow-inner">
          {/* Pilar 1: Límites Variables */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap justify-between items-baseline gap-x-2 gap-y-0.5">
              <span className="text-gray-500 flex items-center gap-1 text-xs font-semibold"><BarChart3 className="w-3.5 h-3.5 shrink-0" /> Categorías</span>
              <span className={`text-xs font-black ${variableSpent > variablePlan ? 'text-rose-600' : 'text-gray-700'}`}>
                {formatCurrency(variableSpent, currency)}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-bold">de {formatCurrency(variablePlan, currency)} ({variablePct}%)</p>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden shadow-inner border border-gray-200/50">
              <div
                className={`h-full rounded-full transition-all duration-700 ${variableSpent > variablePlan
                  ? 'bg-gradient-to-r from-rose-400 to-red-500'
                  : 'bg-gradient-to-r from-indigo-400 to-purple-500'
                  }`}
                style={{ width: `${Math.min(100, variablePct)}%` }}
              ></div>
            </div>
          </div>

          {/* Pilar 2: Obligaciones Fijas (Servicios y Deudas) */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap justify-between items-baseline gap-x-2 gap-y-0.5">
              <span className="text-gray-500 flex items-center gap-1 text-xs font-semibold"><Home className="w-3.5 h-3.5 shrink-0" /> Obligaciones</span>
              <span className={`text-xs font-black ${obligationsActualPaid > obligationsPlan ? 'text-rose-600' : 'text-gray-700'}`}>
                {formatCurrency(obligationsActualPaid, currency)}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-bold">de {formatCurrency(obligationsPlan, currency)} ({paidObligationsCount} de {totalObligationsCount} pagadas)</p>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden shadow-inner border border-gray-200/50">
              <div
                className={`h-full rounded-full transition-all duration-700 ${obligationsActualPaid > obligationsPlan
                  ? 'bg-gradient-to-r from-rose-400 to-red-500'
                  : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                  }`}
                style={{ width: `${Math.min(100, obligationsPct)}%` }}
              ></div>
            </div>
          </div>

          {/* Pilar 3: Tarjetas de Crédito */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap justify-between items-baseline gap-x-2 gap-y-0.5">
              <span className="text-gray-500 flex items-center gap-1 text-xs font-semibold"><CreditCard className="w-3.5 h-3.5 shrink-0" /> Tarjetas</span>
              <span className={`text-xs font-black ${cardsSpent > cardsPlan ? 'text-rose-600' : 'text-gray-700'}`}>
                {formatCurrency(cardsSpent, currency)}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-bold">de {formatCurrency(cardsPlan, currency)} ({cardsPct}%)</p>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden shadow-inner border border-gray-200/50">
              <div
                className={`h-full rounded-full transition-all duration-700 ${cardsSpent > cardsPlan
                  ? 'bg-gradient-to-r from-pink-500 to-rose-600 animate-pulse'
                  : 'bg-gradient-to-r from-pink-400 to-purple-500'
                  }`}
                style={{ width: `${Math.min(100, cardsPct)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Diagnosis: one sentence + one action */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white/40 backdrop-blur-sm p-5 rounded-[1.5rem] border border-white/20 shadow-sm">
          <p className="flex-1 text-sm font-medium leading-relaxed">{getDiagnosticMessage()}</p>
          {!isHealthy && onAdjustLimits && (
            <button
              type="button"
              onClick={onAdjustLimits}
              className="shrink-0 self-start sm:self-auto px-4 py-2 rounded-xl bg-white text-indigo-600 text-xs font-bold border border-indigo-100 hover:bg-indigo-50 transition-colors active:scale-95"
            >
              Ajustar límites
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
