import { AlertTriangle, CheckCircle2, AlertOctagon, TrendingUp, HelpCircle, AlertCircle } from 'lucide-react';
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
          .map((cat) => `${cat.name} (+${formatCurrency(cat.diff, currency)})`)
          .join(' y ');

        return (
          <span>
            Tu gasto real supera tu presupuesto mensual por{' '}
            <strong className="font-extrabold">{formatCurrency(excessAmount, currency)}</strong>. El desvío se originó
            principalmente por sobregasto en:{' '}
            <strong className="font-extrabold text-rose-700">{topCategoriesText}</strong>. Sugerimos recortar consumos
            no esenciales en estos rubros.
          </span>
        );
      } else {
        // Sobregasto debido a consumos en categorías sin límite definido
        return (
          <span>
            Tu gasto real excede tu presupuesto mensual por{' '}
            <strong className="font-extrabold">{formatCurrency(excessAmount, currency)}</strong>. Esto se debe a
            gastos acumulados en categorías sin límites explícitos configurados. Revisa el listado de consumo más
            abajo para identificar oportunidades de ahorro.
          </span>
        );
      }
    }

    if (isPillarOverrun) {
      const overruns = [];
      if (variableSpent > variablePlan) {
        overruns.push({
          name: 'Consumo Variable (Límites)',
          diff: variableSpent - variablePlan,
          pct: variablePct,
          icon: '📊',
        });
      }
      if (obligationsActualPaid > obligationsPlan) {
        overruns.push({
          name: 'Obligaciones (Servicios y Deudas)',
          diff: obligationsActualPaid - obligationsPlan,
          pct: obligationsPct,
          icon: '🏠',
        });
      }
      if (cardsSpent > cardsPlan) {
        overruns.push({
          name: 'Tarjetas de Crédito (Reservas)',
          diff: cardsSpent - cardsPlan,
          pct: cardsPct,
          icon: '💳',
        });
      }

      if (overruns.length === 1) {
        const item = overruns[0];
        if (item.name === 'Consumo Variable (Límites)') {
          return (
            <span>
              📊 Tu <strong className="font-extrabold text-orange-700">Consumo Variable</strong> se excedió en{' '}
              <strong className="font-extrabold">{formatCurrency(item.diff, currency)}</strong> ({item.pct}%).{' '}
              Sugerimos recortar tus límites de consumos variables no esenciales este mes para amortiguar el impacto.
            </span>
          );
        } else if (item.name === 'Obligaciones (Servicios y Deudas)') {
          return (
            <span>
              🏠 Tus <strong className="font-extrabold text-orange-700">Obligaciones</strong> se excedieron en{' '}
              <strong className="font-extrabold">{formatCurrency(item.diff, currency)}</strong> ({item.pct}%).{' '}
              Al ser gastos fijos, te sugerimos recortar tus límites de consumos variables o ajustar tus reservas de tarjetas para absorber esta diferencia sin salirte de tu presupuesto.
            </span>
          );
        } else {
          return (
            <span>
              💳 Tu reserva de <strong className="font-extrabold text-orange-700">Tarjetas</strong> se excedió en{' '}
              <strong className="font-extrabold">{formatCurrency(item.diff, currency)}</strong> ({item.pct}%).{' '}
              Te sugerimos suspender nuevas compras con tarjeta y recortar tus límites de consumos variables para destinar esos fondos a cubrir esta reserva.
            </span>
          );
        }
      } else {
        const listText = overruns
          .map((o) => {
            const shortName = o.name === 'Consumo Variable (Límites)'
              ? 'Consumo Variable'
              : o.name === 'Tarjetas de Crédito (Reservas)'
              ? 'Tarjetas'
              : 'Obligaciones';
            return `${shortName} (+${formatCurrency(o.diff, currency)} [${o.pct}%])`;
          })
          .join(' y ');
        return (
          <span>
            ⚠️ Se detectaron desvíos en tus pilares: <strong className="font-extrabold text-orange-700">{listText}</strong>.{' '}
            Para no salirte del presupuesto global, sugerimos recortar inmediatamente tus límites de consumos variables y suspender consumos adicionales con tus tarjetas de crédito.
          </span>
        );
      }
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
          Tu planificación mensual (Límites + Servicios + Tarjetas) excede tu presupuesto en{' '}
          <strong className="font-extrabold">{formatCurrency(plannedDiff, currency)}</strong>. Estás comprometiendo
          más ingresos de los disponibles. Te sugerimos reducir el límite de{' '}
          <strong className="font-extrabold text-amber-700">
            {highestLimitCat ? highestLimitCat.name : 'tus categorías principales'}
          </strong>{' '}
          para equilibrar tu plan.
        </span>
      );
    }

    // Caso Saludable
    const remainingToPlan = budgetLimit - totalPlannedCommitment;
    const remainingToSpend = budgetLimit - totalSpentGlobal;

    return (
      <span>
        ¡Excelente trabajo! Tu presupuesto está equilibrado. Tienes{' '}
        <strong className="font-extrabold text-emerald-700">{formatCurrency(remainingToSpend, currency)}</strong> de
        saldo real disponible y{' '}
        <strong className="font-extrabold">
          {remainingToPlan > 0 ? formatCurrency(remainingToPlan, currency) : formatCurrency(0, currency)}
        </strong>{' '}
        libre para asignar en nuevos límites si lo deseas.
      </span>
    );
  };

  // Determinar estilos visuales basados en la salud del presupuesto
  let statusColor = 'border-emerald-100 bg-emerald-50/20 text-emerald-800';
  let statusIcon = <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />;
  let statusLabel = 'Resumen del Mes';

  if (isOverBudget) {
    statusColor = 'border-rose-100 bg-rose-50/30 text-rose-800';
    statusIcon = <AlertOctagon className="w-6 h-6 text-rose-600 shrink-0 animate-pulse" />;
    statusLabel = 'Déficit / Gasto Excedido';
  } else if (isPillarOverrun) {
    statusColor = 'border-orange-100 bg-orange-50/30 text-orange-800';
    statusIcon = <AlertCircle className="w-6 h-6 text-orange-600 shrink-0" />;
    statusLabel = 'Desvío en Pilar(es)';
  } else if (isOverPlanned) {
    statusColor = 'border-amber-100 bg-amber-50/35 text-amber-800';
    statusIcon = <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />;
    statusLabel = 'Planificación Excesiva';
  }

  return (
    <div className={`p-6 rounded-[2rem] border shadow-sm transition-all duration-300 ${statusColor}`}>
      <div className="flex items-center gap-2.5 mb-5">
        {statusIcon}
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{statusLabel}</span>
      </div>

      <div className="space-y-5">
        {/* Desglose por Pilares (Límites, Obligaciones, Tarjetas) */}
        <div className="space-y-5 bg-white/70 p-5 rounded-[1.5rem] border border-gray-100/30 shadow-inner">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400">
            <span className="uppercase tracking-wider">Plan vs Realidad</span>
          </div>

          {/* Pilar 1: Límites Variables */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-500">📊 Consumo Variable (Límites)</span>
              <span className="text-gray-400 font-bold flex items-center gap-1.5">
                <span className={variableSpent > variablePlan ? 'text-rose-600 font-black' : 'text-gray-700 font-black'}>
                  {formatCurrency(variableSpent, currency)}
                </span>{' '}
                | {formatCurrency(variablePlan, currency)} ({variablePct}%)
                {variableSpent > variablePlan && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-600 rounded-md border border-rose-100 shrink-0">
                    +{formatCurrency(variableSpent - variablePlan, currency)} excedido
                  </span>
                )}
              </span>
            </div>
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
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-500">🏠 Obligaciones (Servicios y Deudas)</span>
              <span className="text-gray-400 font-bold flex items-center gap-1.5">
                <span className={obligationsActualPaid > obligationsPlan ? 'text-rose-600 font-black' : 'text-gray-700 font-black'}>
                  {formatCurrency(obligationsActualPaid, currency)}
                </span>{' '}
                | {formatCurrency(obligationsPlan, currency)} ({paidObligationsCount} de {totalObligationsCount} pagadas)
                {obligationsActualPaid > obligationsPlan && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-600 rounded-md border border-rose-100 shrink-0">
                    +{formatCurrency(obligationsActualPaid - obligationsPlan, currency)} excedido
                  </span>
                )}
              </span>
            </div>
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
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-500">💳 Tarjetas de Crédito (Reservas)</span>
              <span className="text-gray-400 font-bold flex items-center gap-1.5">
                <span className={cardsSpent > cardsPlan ? 'text-rose-600 font-black' : 'text-gray-700 font-black'}>
                  {formatCurrency(cardsSpent, currency)}
                </span>{' '}
                | {formatCurrency(cardsPlan, currency)} ({cardsPct}%)
                {cardsSpent > cardsPlan && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-600 rounded-md border border-rose-100 shrink-0">
                    +{formatCurrency(cardsSpent - cardsPlan, currency)} excedido
                  </span>
                )}
              </span>
            </div>
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

        {/* Explicación y Diagnóstico de la IA */}
        <div className="flex flex-col bg-white/40 backdrop-blur-sm p-5 rounded-[1.5rem] border border-white/20 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider mb-2 opacity-80">
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>Análisis del Desvío</span>
          </div>
          <p className="text-sm font-medium leading-relaxed opacity-90">{getDiagnosticMessage()}</p>
        </div>
      </div>
    </div>
  );
}
