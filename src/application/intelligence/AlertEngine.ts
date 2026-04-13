/**
 * AlertEngine.ts
 * Motor de alertas inteligentes de Bagi.
 * Integrado con Embeddings locales y Scoring adaptativo.
 */

import { Database } from 'sql.js';
import { getCategoryStats } from '../../services/FeatureExtractor';
import { AlertScorer, buildAlertFeatures } from '../../services/AlertScorer';
import { embeddingService } from '../../services/EmbeddingService';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertType = 'ANOMALY' | 'TREND' | 'DUPLICATE' | 'OPPORTUNITY' | 'PATTERN' | 'OVERDUE';

export interface SmartAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  categoryName?: string;
  amount?: number;
  currency?: string;
}

export interface AlertEngineInput {
  currentMonthTx: any[];
  prevMonthTx: any[];
  categories: any[];
  categoryBudgets: any[];
  budgetObligations: any[];
  currentDay: number;
  daysInMonth: number;
  currency: string;
  accountId: string;
  db?: Database;
}

function expenseOnly(txs: any[], categories: any[]): any[] {
  return txs.filter(t => categories.find((c: any) => c.id === t.category_id)?.type === 'EXPENSE');
}

function getDayFromDate(dateStr: string): number {
  return new Date(dateStr).getDate();
}

// --- Detectores ---

async function* detectDuplicates(txs: any[], currency: string, scope: string): AsyncGenerator<SmartAlert> {
  const WINDOW_MS = 72 * 60 * 60 * 1000;
  
  if (!embeddingService.isAvailable()) {
    console.warn("[AlertEngine] Omitiendo detección de duplicados: El modelo de Embeddings no está disponible.");
    return;
  }

  const vectors = await embeddingService.embedBatch(txs.map(t => t.description || ''));

  const checked = new Set<string>();
  for (let i = 0; i < txs.length; i++) {
    for (let j = i + 1; j < txs.length; j++) {
      const a = txs[i], b = txs[j];
      const pairKey = [a.id, b.id].sort().join('-');
      if (checked.has(pairKey)) continue;
      checked.add(pairKey);

      if (Math.abs(a.amount - b.amount) >= 0.01) continue;
      const dt = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime());
      if (dt > WINDOW_MS) continue;

      const sim = embeddingService.similarity(vectors[i], vectors[j]);
      if (sim < 0.88) continue;

      const daysDiff = Math.round(dt / (1000 * 60 * 60 * 24));
      const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(a.amount);

      yield {
        id: `${scope}-dup-${pairKey}`,
        type: 'DUPLICATE',
        severity: 'CRITICAL',
        title: '¿Cobro duplicado?',
        message: `Detectamos 2 cobros de ${fmt} con descripción similar "${a.description || '—'}" separados por ${daysDiff === 0 ? 'el mismo día' : `${daysDiff} día(s)`}. ¿Es correcto?`,
        amount: a.amount,
        currency,
      };
      await new Promise(r => setTimeout(r, 0));
    }
  }
}

async function* detectTrendVsLastMonth(
  currentTx: any[], prevTx: any[], categories: any[], currentDay: number, currency: string, scope: string, db?: Database
): AsyncGenerator<SmartAlert> {
  if (currentDay < 5) return;

  const currentByCat = expenseOnly(currentTx, categories).reduce((acc: any, t: any) => { acc[t.category_id] = (acc[t.category_id] || 0) + t.amount; return acc; }, {});
  const prevByCat = expenseOnly(prevTx, categories).filter(t => getDayFromDate(t.date) <= currentDay).reduce((acc: any, t: any) => { acc[t.category_id] = (acc[t.category_id] || 0) + t.amount; return acc; }, {});

  for (const catId of Object.keys(currentByCat)) {
    const catIdNum = parseInt(catId);
    const currentTotal = currentByCat[catIdNum] || 0;
    const prevTotal = prevByCat[catIdNum] || 0;
    if (!prevTotal || currentTotal < 500) continue;

    const ratio = currentTotal / prevTotal;
    
    let warnThreshold = 1.3;
    let critThreshold = 1.6;
    let stats: any = null;

    if (db) {
      stats = getCategoryStats(db, scope, catIdNum);
      warnThreshold = stats.sampleSize >= 3 ? stats.trendP85 : 1.4;
      critThreshold = warnThreshold * 1.25;
    }

    if (ratio < warnThreshold) continue;

    const cat = categories.find((c: any) => c.id === catIdNum);
    if (!cat) continue;
    const pct = Math.round((ratio - 1) * 100);
    const fmt = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

    yield {
      id: `${scope}-trend-${catId}`,
      type: 'TREND',
      severity: ratio > critThreshold ? 'CRITICAL' : 'WARNING',
      title: `Gasto elevado en ${cat.name}`,
      message: `Este mes llevas ${fmt(currentTotal)} en ${cat.name} al día ${currentDay}, un ${pct}% más que al mismo punto del mes pasado (${fmt(prevTotal)}).`,
      categoryName: cat.name,
      amount: currentTotal,
      currency,
    };
    await new Promise(r => setTimeout(r, 0));
  }
}

async function* detectSpike(
  currentTx: any[], categories: any[], currency: string, scope: string, db?: Database
): AsyncGenerator<SmartAlert> {
  const recentCutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const recentTx = expenseOnly(currentTx, categories).filter(t => new Date(t.date).getTime() > recentCutoff);

  for (const t of recentTx) {
    if (!db) continue;
    const stats = getCategoryStats(db, scope, t.category_id);
    if (stats.sampleSize < 2) continue;
    if (t.amount <= stats.upperFence) continue;

    const excess = t.amount / stats.upperFence;
    const cat = categories.find((c: any) => c.id === t.category_id);
    if (!cat) continue;
    const fmt = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

    yield {
      id: `${scope}-spike-${t.id}`,
      type: 'ANOMALY',
      severity: excess > 2.0 ? 'CRITICAL' : 'WARNING',
      title: `Gasto inusual en ${cat.name}`,
      message: `"${t.description || 'Sin descripción'}" (${fmt(t.amount)}) es inusualmente alto para ${cat.name}. Tu promedio histórico en esta categoría es ${fmt(stats.mean)}.`,
      categoryName: cat.name,
      amount: t.amount,
      currency,
    };
    await new Promise(r => setTimeout(r, 0));
  }
}

async function* detectOverdueObligations(
  obligations: any[], currentDay: number, currency: string, scope: string
): AsyncGenerator<SmartAlert> {
  for (const item of obligations) {
    if (!item.due_day || item.due_day >= currentDay || item.isPaid) continue;
    const daysPast = currentDay - item.due_day;
    const fmt = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

    yield {
      id: `${scope}-overdue-${item.id}`,
      type: 'OVERDUE',
      severity: daysPast > 7 ? 'CRITICAL' : daysPast > 2 ? 'WARNING' : 'INFO',
      title: `Obligación pendiente: ${item.name}`,
      message: `"${item.name}" (${fmt(item.amount)}) venció el día ${item.due_day}. Han pasado ${daysPast} día(s) sin registrar el pago.`,
      amount: item.amount,
      currency,
    };
    await new Promise(r => setTimeout(r, 0));
  }
}

async function* detectSavingOpportunity(
  currentTx: any[], categoryBudgets: any[], categories: any[], currentDay: number, daysInMonth: number, currency: string, scope: string, db?: Database
): AsyncGenerator<SmartAlert> {
  if (daysInMonth - currentDay > 7) return;

  const byCat = expenseOnly(currentTx, categories).reduce((acc: any, t: any) => { acc[t.category_id] = (acc[t.category_id] || 0) + t.amount; return acc; }, {});

  for (const b of categoryBudgets) {
    const spent = byCat[b.category_id] || 0;
    const remaining = b.amount - spent;
    const remainingPct = remaining / b.amount;
    
    if (remainingPct < 0.35) continue;

    if (db) {
      const stats = getCategoryStats(db, scope, b.category_id);
      const historicalAvgRemaining = b.amount > 0 ? Math.max(0, b.amount - stats.mean) / b.amount : 0;
      if (remainingPct <= historicalAvgRemaining + 0.05) continue;
    }

    const cat = categories.find((c: any) => c.id === b.category_id);
    if (!cat) continue;
    const fmt = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

    yield {
      id: `${scope}-opportunity-${b.category_id}`,
      type: 'OPPORTUNITY',
      severity: 'INFO',
      title: `¡Cerrando ${cat.name} en verde!`,
      message: `Terminarás el mes con ${fmt(remaining)} sin usar en ${cat.name} (${Math.round(remainingPct * 100)}% de tu presupuesto). Puedes trasladarlo a Ahorros.`,
      categoryName: cat.name,
      amount: remaining,
      currency,
    };
    await new Promise(r => setTimeout(r, 0));
  }
}

async function* detectWeekendSpending(
  currentTx: any[], categories: any[], currentDay: number, currency: string, scope: string, db?: Database
): AsyncGenerator<SmartAlert> {
  if (currentDay < 10) return;
  const expenses = expenseOnly(currentTx, categories);
  if (expenses.length < 5) return;

  let weekendTotal = 0, weekdayTotal = 0;
  expenses.forEach(t => {
    const day = new Date(t.date).getDay();
    if (day === 0 || day === 5 || day === 6) weekendTotal += t.amount;
    else weekdayTotal += t.amount;
  });

  const total = weekendTotal + weekdayTotal;
  if (total === 0) return;
  const weekendPct = weekendTotal / total;

  let baseline = 0.45;
  if (db) {
    try {
      const stmt = db.prepare(`SELECT weekend_pct FROM monthly_category_summary WHERE account_id = ? AND weekend_pct IS NOT NULL ORDER BY year_month DESC LIMIT 3`);
      stmt.bind([scope]);
      let count = 0, sum = 0;
      while (stmt.step()) {
        sum += stmt.get()[0] as number;
        count++;
      }
      stmt.free();
      if (count > 0) baseline = sum / count;
    } catch(e) {}
  }

  if (weekendPct < baseline + 0.15) return;
  const fmt = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

  yield {
    id: `${scope}-pattern-weekend`,
    type: 'PATTERN',
    severity: 'INFO',
    title: 'Patrón: Gastos concentrados en fin de semana',
    message: `El ${Math.round(weekendPct * 100)}% de tus gastos este mes ocurren en fin de semana (${fmt(weekendTotal)} de ${fmt(total)}). Tu patrón habitual es ${Math.round(baseline * 100)}%.`,
    currency,
  };
  await new Promise(r => setTimeout(r, 0));
}

// --- Generador central ---

export async function* runAlertEngine(input: AlertEngineInput): AsyncGenerator<SmartAlert> {
  const { currentMonthTx, prevMonthTx, categories, categoryBudgets, budgetObligations, currentDay, daysInMonth, currency, accountId, db } = input;
  const scope = accountId;

  await embeddingService.init();

  if (embeddingService.isAvailable() && db) {
    await embeddingService.loadFromDB(db, scope, currentMonthTx);
  }

  const allAlerts: SmartAlert[] = [];
  for await (const a of detectDuplicates(currentMonthTx, currency, scope)) allAlerts.push(a);
  for await (const a of detectTrendVsLastMonth(currentMonthTx, prevMonthTx, categories, currentDay, currency, scope, db)) allAlerts.push(a);
  for await (const a of detectSpike(currentMonthTx, categories, currency, scope, db)) allAlerts.push(a);
  for await (const a of detectOverdueObligations(budgetObligations, currentDay, currency, scope)) allAlerts.push(a);
  for await (const a of detectSavingOpportunity(currentMonthTx, categoryBudgets, categories, currentDay, daysInMonth, currency, scope, db)) allAlerts.push(a);
  for await (const a of detectWeekendSpending(currentMonthTx, categories, currentDay, currency, scope, db)) allAlerts.push(a);

  if (embeddingService.isAvailable() && db) {
    embeddingService.saveToDB(db, currentMonthTx, scope);
  }

  if (db && allAlerts.length > 0) {
    const scorer = new AlertScorer();
    scorer.loadWeights(db);
    const scored = allAlerts.map(alert => ({
      alert,
      score: scorer.score(alert, buildAlertFeatures(alert, input)),
    }));
    scored.sort((a, b) => b.score - a.score);
    for (const { alert } of scored) yield alert;
  } else {
    for (const alert of allAlerts) yield alert;
  }
}
