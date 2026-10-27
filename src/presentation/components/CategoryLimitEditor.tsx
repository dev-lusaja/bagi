import { useLayoutEffect, useRef } from 'react';
import type { BudgetService } from '../../application/use-cases/BudgetService';
import { formatCurrency, formatAmountInput, parseAmountInput } from '../utils/format';

type LimitEdit = ReturnType<BudgetService['getCategoryLimitEdit']>;

interface CategoryLimitEditorProps {
  categoryName: string;
  isNew: boolean;
  currentLimit: number;
  spent: number;
  value: string;
  edit: LimitEdit;
  currency?: string;
  onChange: (value: string) => void;
  onSlide: (raw: number) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
}

// Edit mode of a consumption card: the progress bar becomes a slider whose floor is what's already spent
export default function CategoryLimitEditor({
  categoryName, isNew, currentLimit, spent, value, edit, currency, onChange, onSlide, onSave, onCancel
}: CategoryLimitEditorProps) {
  const fmt = (n: number) => formatCurrency(n, currency);
  const amount = parseFloat(value);
  const sliderValue = isNaN(amount) ? edit.min : Math.min(edit.max, Math.max(edit.min, amount));
  const pct = (n: number) => (edit.max > 0 ? Math.min(100, (n / edit.max) * 100) : 0);

  // Re-grouping digits shifts the caret, so restore it after the same count of digits it had before
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (pendingCaret.current === null || !input) return;
    let seen = 0, pos = 0;
    while (pos < input.value.length && seen < pendingCaret.current) {
      if (/[\d.]/.test(input.value[pos])) seen++;
      pos++;
    }
    input.setSelectionRange(pos, pos);
    pendingCaret.current = null;
  });

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const caret = e.target.selectionStart ?? e.target.value.length;
    pendingCaret.current = e.target.value.slice(0, caret).replace(/[^\d.]/g, '').length;
    onChange(parseAmountInput(e.target.value));
  };

  let hint: { text: string; tone: 'error' | 'warning' } | null = null;
  if (edit.error === 'INVALID') hint = { text: 'Ingresa un monto mayor a cero.', tone: 'error' };
  else if (edit.error === 'BELOW_SPENT') hint = { text: `No puede ser menor a lo ya gastado (${fmt(spent)}).`, tone: 'error' };
  else if (edit.error === 'ABOVE_FREE') hint = { text: `Supera tu disponible por ${fmt(amount - edit.max)}.`, tone: 'error' };
  else if (edit.isLocked) hint = { text: 'No tienes presupuesto libre. Reduce otra categoría para subir este límite.', tone: 'warning' };
  else if (!isNew && spent > currentLimit) hint = { text: `Ya gastaste ${fmt(spent)}, el límite no puede ser menor.`, tone: 'warning' };

  return (
    <form onSubmit={onSave} className="flex flex-col gap-4 animate-in fade-in duration-200">
      <div className="flex justify-between items-start gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-gray-800 text-lg leading-tight truncate">{categoryName}</span>
          <span className="text-[10px] font-black text-indigo-500">
            {isNew ? 'Asignar límite' : 'Editar límite'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar"
            title="Cancelar"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <button
            type="submit"
            disabled={!!edit.error}
            aria-label="Guardar límite"
            title="Guardar"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-200 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={formatAmountInput(value)}
        onChange={handleAmountChange}
        onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
        autoFocus
        aria-label="Nuevo límite"
        aria-invalid={!!edit.error}
        className={`w-full rounded-xl border p-3 text-lg font-semibold text-gray-800 outline-none focus:ring-2 transition-all ${edit.error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-gray-200 focus:border-indigo-400 focus:ring-indigo-100'}`}
      />

      <div>
        <div className="relative h-6">
          {/* Track inset by half the thumb width so fills line up with the thumb center */}
          <div className="absolute inset-y-0 left-2.5 right-2.5 flex items-center pointer-events-none">
            <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
              <div className="absolute inset-y-0 left-0 bg-indigo-400" style={{ width: `${pct(sliderValue)}%` }} />
              <div className="absolute inset-y-0 left-0 bg-gray-400" style={{ width: `${pct(spent)}%` }} />
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={edit.max || 1}
            step={edit.step}
            value={sliderValue}
            onChange={e => onSlide(parseFloat(e.target.value))}
            disabled={edit.isLocked}
            aria-label="Ajustar límite"
            aria-valuetext={fmt(sliderValue)}
            className="limit-slider absolute inset-0 w-full"
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] font-semibold text-gray-400">
          <span>Gastado <span className="text-gray-600">{fmt(spent)}</span></span>
          <span>Máx. <span className="text-gray-600">{fmt(edit.max)}</span></span>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-xs leading-snug">
        {hint && (
          <p className={hint.tone === 'error' ? 'text-rose-600 font-semibold' : 'text-amber-600 font-medium'}>{hint.text}</p>
        )}
        {!edit.error && (
          edit.remainingFree >= 0
            ? <p className="text-gray-500">Te quedan <span className="font-bold text-indigo-600">{fmt(edit.remainingFree)}</span> por asignar</p>
            : <p className="text-rose-600">Asignaste de más por <span className="font-bold">{fmt(-edit.remainingFree)}</span></p>
        )}
      </div>
    </form>
  );
}
