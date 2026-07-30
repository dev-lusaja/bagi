import { Check, RefreshCw, X } from 'lucide-react';
import { MappedTransaction } from '../hooks/useBagiAI';

interface TransactionConfirmFormProps {
  tx: MappedTransaction;
  onChange: (tx: MappedTransaction) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
  categories: any[];
  accounts: any[];
  cards: any[];
}

/**
 * TransactionConfirmForm – Formulario de confirmación/edición de transacción
 * detectada por Bagi IA. Desacoplado de la vista para poder reutilizarse dentro
 * de cualquier contenedor (modal, panel lateral, etc.).
 */
export default function TransactionConfirmForm({
  tx,
  onChange,
  onConfirm,
  onCancel,
  isSaving,
  categories,
  accounts,
  cards,
}: TransactionConfirmFormProps) {
  const canConfirm = !isSaving && !!tx.category_id && (!!tx.account_id || !!tx.card_id);

  return (
    <div className="space-y-4">

      {/* Descripción */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Descripción</label>
        <input
          type="text"
          value={tx.description}
          onChange={(e) => onChange({ ...tx, description: e.target.value })}
          className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
          required
        />
      </div>

      {/* Monto */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Monto</label>
        <input
          type="number"
          step="0.01"
          value={tx.amount}
          onChange={(e) => onChange({ ...tx, amount: parseFloat(e.target.value) || 0 })}
          className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-bold tabular-nums"
          required
        />
      </div>

      {/* Categoría */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Categoría</label>
        <select
          className={`rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all ${
            !tx.category_id ? 'border-rose-200 bg-rose-50/40 text-rose-600' : 'border-gray-100 bg-gray-50/50'
          }`}
          value={tx.category_id || ''}
          onChange={(e) => onChange({ ...tx, category_id: parseInt(e.target.value) || null })}
          required
        >
          <option value="" disabled>Seleccionar categoría...</option>
          <optgroup label="Ingresos">
            {categories.filter((c: any) => c.type === 'INCOME').map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
          <optgroup label="Transferencias">
            {categories.filter((c: any) => c.type === 'TRANSFER').map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
          <optgroup label="Gastos">
            {categories
              .filter((c: any) => c.type === 'EXPENSE' && c.name !== 'Servicios Recurrentes' && c.name !== 'Deudas Recurrentes')
              .map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </optgroup>
        </select>
        {!tx.category_id && (
          <p className="text-[10px] text-rose-400 font-semibold ml-1">Selecciona una categoría para continuar.</p>
        )}
      </div>

      {/* Origen (Cuenta / Tarjeta) */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Origen</label>
        <select
          className={`rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all ${
            !tx.account_id && !tx.card_id ? 'border-rose-200 bg-rose-50/40 text-rose-600' : 'border-gray-100 bg-gray-50/50'
          }`}
          value={tx.card_id ? `c-${tx.card_id}` : tx.account_id || ''}
          onChange={(e) => {
            const val = e.target.value;
            if (val.startsWith('c-')) {
              onChange({ ...tx, card_id: parseInt(val.replace('c-', '')) || null, account_id: null });
            } else {
              onChange({ ...tx, account_id: parseInt(val) || null, card_id: null });
            }
          }}
          required
        >
          <option value="" disabled>Seleccionar origen...</option>
          <optgroup label="Cuentas">
            {accounts.map((a: any) => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </optgroup>
          <optgroup label="Tarjetas">
            {cards.map((c: any) => (
              <option key={`c-${c.id}`} value={`c-${c.id}`}>{c.name} ({c.currency})</option>
            ))}
          </optgroup>
        </select>
        {!tx.account_id && !tx.card_id && (
          <p className="text-[10px] text-rose-400 font-semibold ml-1">Selecciona la cuenta o tarjeta de origen.</p>
        )}
      </div>

      {/* Fecha */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Fecha</label>
        <input
          type="date"
          value={tx.date.split('T')[0]}
          onChange={(e) => {
            const raw = e.target.value;
            if (!raw) return;
            const [year, month, day] = raw.split('-');
            const finalDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0).toISOString();
            onChange({ ...tx, date: finalDate });
          }}
          className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
        />
      </div>

      {/* Acciones */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 rounded-2xl text-xs font-bold text-gray-500 transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-100 active:scale-95"
        >
          {isSaving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Confirmar y Guardar
        </button>
      </div>

    </div>
  );
}
