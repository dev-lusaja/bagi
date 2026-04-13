import { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Sparkles, ChevronDown, ChevronUp, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { SmartAlert, runAlertEngine } from '../../application/intelligence/AlertEngine';
import { getDb } from '../../infrastructure/adapters/SqliteAdapter';
import { AlertScorer, buildAlertFeatures } from '../../services/AlertScorer';

const DISMISSED_KEY = 'bagi_dismissed_alerts';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

interface Props {
  currentMonthTx: any[];
  prevMonthTx: any[];
  categories: any[];
  categoryBudgets: any[];
  budgetObligations: any[];
  currency: string;
  dataReady: boolean; // true solo cuando el Dashboard terminó de cargar todos los datos
  accountId: string;  // ID de la cuenta/tarjeta para separar alertas descartadas
}

const severityConfig = {
  CRITICAL: {
    border: 'border-l-rose-500',
    bg: 'bg-rose-50',
    icon: <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />,
    badge: 'bg-rose-100 text-rose-700',
    label: 'Crítico',
  },
  WARNING: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-50',
    icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
    badge: 'bg-amber-100 text-amber-700',
    label: 'Atención',
  },
  INFO: {
    border: 'border-l-indigo-400',
    bg: 'bg-indigo-50/60',
    icon: <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />,
    badge: 'bg-indigo-100 text-indigo-700',
    label: 'Info',
  },
};

export default function SmartAlertPanel({ currentMonthTx, prevMonthTx, categories, categoryBudgets, budgetObligations, currency, dataReady, accountId }: Props) {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);
  const [isRunning, setIsRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // runId para cancelar runs obsoletos si dataReady cambia mientras el motor está corriendo
  const runIdRef = useRef(0);

  useEffect(() => {
    // Si el Dashboard indica que está cargando, limpiar alertas previas
    if (!dataReady) {
      setAlerts([]);
      return;
    }

    const myRunId = ++runIdRef.current;
    
    // Si estamos en un render donde la data ya está lista, iniciamos carga:
    setAlerts([]);
    setIsRunning(true);

    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    let db: any = undefined;
    try { db = getDb(); } catch(e) {}

    const inputData = {
      currentMonthTx,
      prevMonthTx,
      categories,
      categoryBudgets,
      budgetObligations,
      currentDay,
      daysInMonth,
      currency,
      accountId,
      db
    };

    const engine = runAlertEngine(inputData);

    // Consumimos el generador de forma asíncrona
    (async () => {
      // Delay artificial de 1.5s para mostrar el estado de "analizando"
      // y dar una sensación de IA trabajando.
      await new Promise(r => setTimeout(r, 1500));

      // Si el componente se desmontó o se inició otro análisis mientras esperábamos
      if (runIdRef.current !== myRunId) return;

      for await (const alert of engine) {
        // Si un reload más nuevo ha comenzado (ej: el usuario cambió de cuenta), abortar
        if (runIdRef.current !== myRunId) return;
        setAlerts(prev => {
          if (prev.some(a => a.id === alert.id)) return prev;
          return [...prev, alert];
        });
      }
      if (runIdRef.current === myRunId) {
        setIsRunning(false);
      }
    })();
  }, [dataReady, accountId, currentMonthTx]);

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    saveDismissed(next);
  };

  const undoDismissAll = () => {
    setDismissed(new Set());
    saveDismissed(new Set());
  };

  const handleFeedback = (alert: SmartAlert, isUseful: boolean) => {
    try {
      const db = getDb();
      const today = new Date();
      const input = {
          currentMonthTx, prevMonthTx, categories, categoryBudgets, budgetObligations,
          currentDay: today.getDate(),
          daysInMonth: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
          currency, accountId, db
      };
      const features = buildAlertFeatures(alert, input);
      const scorer = new AlertScorer();
      scorer.loadWeights(db);
      scorer.updateWeights(db, alert.id, alert.type, features, isUseful);
    } catch(e) {
      console.warn("Error enviando feedback:", e);
    }
    // Ocultar alerta después de dar feedback
    dismiss(alert.id);
  };

  const activeAlerts = alerts.filter(a => !dismissed.has(a.id));
  const criticalCount = activeAlerts.filter(a => a.severity === 'CRITICAL').length;
  const warningCount = activeAlerts.filter(a => a.severity === 'WARNING').length;
  const dismissedCount = alerts.filter(a => dismissed.has(a.id)).length;

  // Estado: datos aún cargando (antes de que el Dashboard diga que está listo)
  if (!dataReady && !isRunning && activeAlerts.length === 0) {
    return (
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse shrink-0" />
          <span className="text-sm font-semibold text-gray-400">Bagi está analizando tus datos…</span>
          <div className="flex gap-0.5 ml-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-indigo-300 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Estado: todo procesado pero sin alertas (y nada descartado)
  if (!isRunning && activeAlerts.length === 0) {
    return dismissedCount > 0 ? (
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={undoDismissAll}
          className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-indigo-500 transition-colors uppercase tracking-widest"
        >
          <RotateCcw className="w-3 h-3" />
          Restaurar {dismissedCount} alerta(s) descartada(s)
        </button>
      </div>
    ) : null;
  }

  return (
    <div className="mb-6 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header del panel */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Sparkles className={`w-4 h-4 ${isRunning ? 'text-indigo-400 animate-pulse' : 'text-indigo-500'}`} />
          <span className="text-sm font-semibold text-gray-700">
            {isRunning ? 'Bagi está analizando tus datos…' : `Bagi detectó ${activeAlerts.length} alerta${activeAlerts.length !== 1 ? 's' : ''}`}
          </span>
          {!isRunning && (
            <div className="flex items-center gap-1.5">
              {criticalCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 uppercase tracking-wider">
                  {criticalCount} crítica{criticalCount !== 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 uppercase tracking-wider">
                  {warningCount} aviso{warningCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
          {isRunning && (
            <div className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dismissedCount > 0 && (
            <button
              onClick={e => { e.stopPropagation(); undoDismissAll(); }}
              className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-indigo-500 transition-colors uppercase tracking-widest"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Restaurar ({dismissedCount})</span>
            </button>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Lista de alertas (colapsable) */}
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {/* Skeletons mientras el motor procesa */}
          {isRunning && activeAlerts.length === 0 && (
            <div className="px-5 py-4 space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse flex gap-3 items-start">
                  <div className="w-4 h-4 rounded bg-gray-200 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                    <div className="h-2.5 bg-gray-100 rounded w-full" />
                    <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Alertas activas */}
          {activeAlerts.map(alert => {
            const cfg = severityConfig[alert.severity];
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 px-4 sm:px-5 py-4 border-l-4 ${cfg.border} ${cfg.bg}`}
              >
                {cfg.icon}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-xs font-semibold text-gray-800">{alert.title}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{alert.message}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => dismiss(alert.id)}
                    className="p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-all"
                    title="Descartar alerta sin enviar feedback"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex gap-0.5 mt-2">
                    <button
                      onClick={() => handleFeedback(alert, true)}
                      className="p-1 rounded text-emerald-400 hover:bg-emerald-50 transition-colors"
                      title="Esta alerta es útil"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleFeedback(alert, false)}
                      className="p-1 rounded text-rose-400 hover:bg-rose-50 transition-colors"
                      title="Esta alerta no es útil"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Estado vacío al terminar sin alertas */}
          {!isRunning && activeAlerts.length === 0 && (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-gray-400">No hay alertas activas en este momento.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
