import { AlertTriangle, CheckCircle2, AlertOctagon, HelpCircle, AlertCircle, BarChart3, Home, CreditCard } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatCurrency } from '../utils/format';
import { CONCEPT_COLORS } from '../utils/conceptColors';
import type { BudgetDiagnosis, BudgetDiagnosisStatus, BudgetPillar } from '../../application/use-cases/BudgetService';

interface Props {
  // Health of the month's plan; null when the month has no budget
  diagnosis: BudgetDiagnosis | null;
  currency: string;
  // Pillar breakdown
  variablePlan: number;
  variableSpent: number;
  obligationsPlan: number;
  obligationsActualPaid: number;
  paidObligationsCount: number;
  totalObligationsCount: number;
  cardsPlan: number;
  cardsSpent: number;
  // Actions; a button only shows when the diagnosis asks for it and its handler is provided
  onAdjustLimits?: () => void;
  onAddIncome?: () => void;
  onAddExtra?: () => void;
}

const STATUS_STYLES: Record<BudgetDiagnosisStatus, { label: string; color: string; icon: ReactNode }> = {
  OVER_BUDGET: { label: 'Presupuesto excedido', color: 'border-rose-100 bg-rose-50/30 text-rose-800', icon: <AlertOctagon className="w-6 h-6 text-rose-600 shrink-0" /> },
  SPENT_ABOVE_INCOME: { label: 'Gasto sin ingresos', color: 'border-amber-200 bg-amber-50/50 text-amber-900', icon: <AlertCircle className="w-6 h-6 text-amber-700 shrink-0" /> },
  PILLAR_OVERRUN: { label: 'Plan excedido', color: 'border-amber-200 bg-amber-50/50 text-amber-900', icon: <AlertCircle className="w-6 h-6 text-amber-700 shrink-0" /> },
  OVER_PLANNED: { label: 'Plan mayor al presupuesto', color: 'border-amber-100 bg-amber-50/35 text-amber-800', icon: <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" /> },
  PLAN_NOT_COVERED: { label: 'Plan no cubierto', color: 'border-amber-100 bg-amber-50/35 text-amber-800', icon: <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" /> },
  HEALTHY: { label: 'Plan sano', color: 'border-emerald-100 bg-emerald-50/20 text-emerald-800', icon: <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" /> },
};

const FIGURE_LABELS: Record<BudgetDiagnosis['figures'][number]['key'], string> = {
  INCOME: 'Ingresos',
  SPENT: 'Gastado',
  BUDGET: 'Presupuesto',
  PLANNED: 'Asignado',
};

const PILLAR_LABELS: Record<BudgetPillar, string> = {
  CATEGORIES: 'categorías',
  OBLIGATIONS: 'obligaciones',
  CARDS: 'tarjetas',
};

const ACTION_LABELS: Record<NonNullable<BudgetDiagnosis['action']>, string> = {
  ADJUST_LIMITS: 'Ajustar límites',
  ADD_INCOME: 'Registrar ingreso',
  ADD_EXTRA: 'Sumar al plan',
};

// Joins names as "a", "a y b", "a, b y c"
const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;

export default function BudgetDiagnosticWidget({
  diagnosis,
  currency,
  variablePlan,
  variableSpent,
  obligationsPlan,
  obligationsActualPaid,
  paidObligationsCount,
  totalObligationsCount,
  cardsPlan,
  cardsSpent,
  onAdjustLimits,
  onAddIncome,
  onAddExtra,
}: Props) {
  if (!diagnosis) {
    return (
      <div className="bg-white p-6 rounded-card border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-control shrink-0">
          <HelpCircle className="w-8 h-8" />
        </div>
        <div>
          <h4 className="text-lg font-bold text-gray-800 leading-tight">Presupuesto mensual sin definir</h4>
          <p className="text-sm text-gray-500 mt-1">
            Define tu presupuesto mensual para ver tu resumen.
          </p>
        </div>
      </div>
    );
  }

  const money = (amount: number) => <strong className="font-extrabold">{formatCurrency(amount, currency)}</strong>;

  // Porcentajes de barras de los tres pilares
  const variablePct = variablePlan > 0 ? Math.round((variableSpent / variablePlan) * 100) : 0;
  const obligationsPct = obligationsPlan > 0 ? Math.round((obligationsActualPaid / obligationsPlan) * 100) : 0;
  const cardsPct = cardsPlan > 0 ? Math.round((cardsSpent / cardsPlan) * 100) : 0;

  const getMessage = () => {
    const { status, amount, categoryNames, pillars, unassigned, extra } = diagnosis;
    switch (status) {
      case 'OVER_BUDGET':
        return categoryNames.length > 0
          ? <>Te pasaste {money(amount)}, sobre todo en <strong className="font-extrabold">{joinNames(categoryNames)}</strong>.</>
          : <>Te pasaste {money(amount)} en categorías sin límite.</>;
      case 'SPENT_ABOVE_INCOME':
        return <>Gastaste {money(amount)} más de lo que recibiste.</>;
      case 'PILLAR_OVERRUN':
        return <>Te pasaste {money(amount)} en {joinNames(pillars.map(p => PILLAR_LABELS[p]))}.</>;
      case 'OVER_PLANNED':
        return (
          <>
            Tu plan supera el presupuesto en {money(amount)}
            {categoryNames.length > 0 && <>; prueba bajar <strong className="font-extrabold">{categoryNames[0]}</strong></>}.
          </>
        );
      case 'PLAN_NOT_COVERED':
        return <>Recibiste {money(amount)} menos que tu plan.</>;
      case 'HEALTHY':
        return (
          <>
            Te quedan {money(amount)} disponibles
            {unassigned > 0 && <>{extra > 0 ? ', ' : ' y '}{money(unassigned)} sin asignar</>}
            {extra > 0 && <> y recibiste {money(extra)} extra</>}.
          </>
        );
    }
  };

  const actionHandler = diagnosis.action === 'ADJUST_LIMITS' ? onAdjustLimits
    : diagnosis.action === 'ADD_INCOME' ? onAddIncome
    : diagnosis.action === 'ADD_EXTRA' ? onAddExtra
    : undefined;

  const { label: statusLabel, color: statusColor, icon: statusIcon } = STATUS_STYLES[diagnosis.status];

  return (
    <div className={`p-6 rounded-card border shadow-sm transition-all duration-300 ${statusColor}`}>
      {/* Salud del presupuesto: estado, una frase, los datos que la sustentan y una acción */}
      <div className="flex items-center gap-2.5 mb-3">
        {statusIcon}
        <h4 className="text-sm font-black">{statusLabel}</h4>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-5">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium leading-relaxed">{getMessage()}</p>
          <p className="text-xs opacity-80 tabular-nums">
            {diagnosis.figures.map((figure, i) => (
              <span key={figure.key}>
                {i > 0 && ' · '}
                {FIGURE_LABELS[figure.key]} <span className="font-bold">{formatCurrency(figure.amount, currency)}</span>
              </span>
            ))}
          </p>
        </div>
        {diagnosis.action && actionHandler && (
          <button
            type="button"
            onClick={actionHandler}
            className="shrink-0 self-start sm:self-auto px-4 py-2 rounded-control bg-white text-indigo-600 text-xs font-bold border border-indigo-100 hover:bg-indigo-50 transition-colors active:scale-95"
          >
            {ACTION_LABELS[diagnosis.action]}
          </button>
        )}
      </div>

      {/* Desglose por Pilares (Límites, Obligaciones, Tarjetas) */}
      <div className="space-y-5 bg-white/70 p-5 rounded-control border border-gray-100/30 shadow-inner">
        {/* Pilar 1: Límites Variables */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap justify-between items-baseline gap-x-2 gap-y-0.5">
            <span className="text-gray-500 flex items-center gap-1 text-xs font-semibold"><BarChart3 className="w-3.5 h-3.5 shrink-0" /> Categorías</span>
            <span className={`text-xs font-black ${variableSpent > variablePlan ? 'text-rose-600' : 'text-gray-700'}`}>
              {formatCurrency(variableSpent, currency)}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 font-bold">de {formatCurrency(variablePlan, currency)} ({variablePct}%)</p>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden shadow-inner border border-gray-200/50">
            <div
              className={`h-full rounded-full transition-all duration-700 ${variableSpent > variablePlan
                ? 'bg-rose-500'
                : CONCEPT_COLORS.categories.bar
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
          <p className="text-[11px] text-gray-500 font-bold">de {formatCurrency(obligationsPlan, currency)} ({paidObligationsCount} de {totalObligationsCount} pagadas)</p>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden shadow-inner border border-gray-200/50">
            <div
              className={`h-full rounded-full transition-all duration-700 ${obligationsActualPaid > obligationsPlan
                ? 'bg-rose-500'
                : CONCEPT_COLORS.obligations.bar
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
          <p className="text-[11px] text-gray-500 font-bold">de {formatCurrency(cardsPlan, currency)} ({cardsPct}%)</p>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden shadow-inner border border-gray-200/50">
            <div
              className={`h-full rounded-full transition-all duration-700 ${cardsSpent > cardsPlan
                ? 'bg-rose-500'
                : CONCEPT_COLORS.cards.bar
                }`}
              style={{ width: `${Math.min(100, cardsPct)}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
