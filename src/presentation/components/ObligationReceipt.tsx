import { useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Clock, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency, formatDayMonth } from '../utils/format';

export interface ObligationReceiptItem {
  name: string;
  amount: number;
  due_day: number;
  notes?: string | null;
  isPaid: boolean;
  isPastDue: boolean;
  paidAmount: number;
  paidDate?: string | null;
  itemCurrencyCode?: string;
  categoryName?: string;
  sourceName?: string;
}

interface ObligationReceiptProps {
  item: ObligationReceiptItem;
  isPastMonth: boolean;
  onPay: () => void;
  onEditAmount: () => void;
  onDelete: () => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between items-center gap-3 text-sm">
    <span className="text-gray-500 shrink-0">{label}</span>
    <span className="font-semibold text-gray-800 text-right min-w-0 break-words">{children}</span>
  </div>
);

// Payment-receipt style card for a fixed payment (Pagos fijos tab): status, amount, details, notes and actions in one place.
// Same skeleton for every state (actions on top, fixed-height footer at the bottom) so receipts in a row line up.
const ObligationReceipt: React.FC<ObligationReceiptProps> = ({ item, isPastMonth, onPay, onEditAmount, onDelete }) => {
  const currency = item.itemCurrencyCode;
  const canPay = !item.isPaid && !isPastMonth;
  const isOverdue = canPay && item.isPastDue;

  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notesClamped, setNotesClamped] = useState(false);
  const notesRef = useRef<HTMLParagraphElement>(null);

  // Only offer "Ver más" when the 2-line clamp actually hides text
  useLayoutEffect(() => {
    const el = notesRef.current;
    if (el && !notesExpanded) setNotesClamped(el.scrollHeight > el.clientHeight + 1);
  }, [item.notes, notesExpanded]);

  const status = item.isPaid
    ? { Icon: Check, ring: 'bg-emerald-50', dot: 'bg-emerald-500' }
    : isPastMonth
      ? { Icon: Clock, ring: 'bg-gray-100', dot: 'bg-gray-400' }
      : isOverdue
        ? { Icon: AlertTriangle, ring: 'bg-amber-50', dot: 'bg-amber-500' }
        : { Icon: Clock, ring: 'bg-teal-50', dot: 'bg-teal-500' };

  return (
    // drop-shadow (not box-shadow) so the shadow follows the cut bottom edge
    <div className="drop-shadow-sm w-4/5 mx-auto h-full flex flex-col">
      <div className="receipt-edge flex-1 bg-white rounded-t-card px-5 pt-4 pb-8 flex flex-col gap-4">
        {!isPastMonth && (
          <div className="flex justify-end gap-2">
            {canPay && (
              <button
                type="button"
                onClick={onEditAmount}
                className="w-10 h-10 flex items-center justify-center rounded-control bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors active:scale-95"
                title="Editar monto de este mes"
                aria-label={`Editar monto de ${item.name} este mes`}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="w-10 h-10 flex items-center justify-center rounded-control bg-gray-100 text-gray-500 hover:bg-rose-50 hover:text-rose-600 transition-colors active:scale-95"
              title="Eliminar"
              aria-label={`Eliminar ${item.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className={`flex flex-col items-center text-center gap-1 ${isPastMonth ? 'pt-2' : '-mt-2'}`}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 ${status.ring}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${status.dot}`}>
              <status.Icon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 break-words max-w-full">{item.name}</p>
          <p className="text-[28px] font-black text-gray-900 tracking-tight leading-tight">
            {formatCurrency(item.isPaid ? item.paidAmount : item.amount, currency)}
          </p>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-2.5">
          {item.categoryName && <Row label="Categoría">{item.categoryName}</Row>}
          {item.sourceName && <Row label="Desde">{item.sourceName}</Row>}
          <Row label={isOverdue ? 'Venció' : 'Vence'}>
            <span className={isOverdue ? 'text-amber-600' : ''}>Día {item.due_day}</span>
          </Row>
        </div>

        <div className="border-t border-dashed border-gray-200 pt-4 space-y-2.5">
          <Row label="Presupuestado">{formatCurrency(item.amount, currency)}</Row>
          {item.isPaid && <Row label="Pagado">{formatCurrency(item.paidAmount, currency)}</Row>}
        </div>

        {item.notes && (
          <div className="bg-gray-50 rounded-control p-3">
            <p className="text-xs text-gray-500 mb-1">Nota</p>
            <p ref={notesRef} className={`text-sm text-gray-700 whitespace-pre-wrap break-words ${notesExpanded ? '' : 'line-clamp-2'}`}>{item.notes}</p>
            {(notesClamped || notesExpanded) && (
              <button
                type="button"
                onClick={() => setNotesExpanded(!notesExpanded)}
                className="mt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                aria-expanded={notesExpanded}
              >
                {notesExpanded ? 'Ver menos' : 'Ver más'}
              </button>
            )}
          </div>
        )}

        {/* Fixed-height footer: the action when there is one, otherwise the final state */}
        <div className="mt-auto">
          {canPay ? (
            <button
              type="button"
              onClick={onPay}
              className="w-full h-12 bg-gray-900 text-white rounded-control font-semibold hover:bg-gray-800 transition-colors active:scale-95"
            >
              Pagar
            </button>
          ) : item.isPaid ? (
            <div className="w-full h-12 flex items-center justify-center gap-2 rounded-control bg-emerald-50 text-emerald-700 text-sm font-semibold">
              <Check className="w-4 h-4" />
              {item.paidDate ? `Pagado el ${formatDayMonth(item.paidDate)}` : 'Pagado'}
            </div>
          ) : (
            <div className="w-full h-12 flex items-center justify-center rounded-control bg-gray-100 text-gray-500 text-sm font-semibold">
              No se pagó
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ObligationReceipt;
