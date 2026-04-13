import { Database } from 'sql.js';
import { SmartAlert, AlertType, AlertEngineInput } from '../application/intelligence/AlertEngine';
import { getCategoryStats, DEFAULT_STATS } from './FeatureExtractor';

export interface AlertFeatures {
  ratio_vs_mean: number;
  days_until_month_end: number;
  same_type_dismissed_rate: number;
  category_volatility: number;
  alert_recency_score: number;
}

const DEFAULT_WEIGHTS: Record<string, Record<string, number>> = {
  DUPLICATE: { ratio_vs_mean: 0, days_until_month_end: 0, same_type_dismissed_rate: -2.5, category_volatility: 0, alert_recency_score: 1.5 },
  TREND:     { ratio_vs_mean: 1.2, days_until_month_end: -0.3, same_type_dismissed_rate: -2.0, category_volatility: 0.8, alert_recency_score: 0.5 },
  ANOMALY:   { ratio_vs_mean: 1.5, days_until_month_end: 0, same_type_dismissed_rate: -1.8, category_volatility: -0.5, alert_recency_score: 1.0 },
  OVERDUE:   { ratio_vs_mean: 0, days_until_month_end: -1.0, same_type_dismissed_rate: -1.5, category_volatility: 0, alert_recency_score: 2.0 },
  OPPORTUNITY: { ratio_vs_mean: 0, days_until_month_end: -1.5, same_type_dismissed_rate: -2.0, category_volatility: 0.3, alert_recency_score: 0.3 },
  PATTERN:   { ratio_vs_mean: 0.5, days_until_month_end: -0.5, same_type_dismissed_rate: -2.5, category_volatility: 0.5, alert_recency_score: 0.2 },
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export class AlertScorer {
  private weights = new Map<string, Record<string, number>>();

  loadWeights(db: Database): void {
    try {
      const stmt = db.prepare('SELECT alert_type, feature_name, weight FROM alert_scorer_weights');
      while (stmt.step()) {
        const row = stmt.get();
        const alert_type = row[0] as string;
        const feature_name = row[1] as string;
        const weight = row[2] as number;

        if (!this.weights.has(alert_type)) {
          this.weights.set(alert_type, {});
        }
        this.weights.get(alert_type)![feature_name] = weight;
      }
      stmt.free();
    } catch (e) {
      console.warn("loadWeights error:", e);
    }
  }

  score(alert: SmartAlert, features: AlertFeatures): number {
    const w = this.weights.get(alert.type) ?? DEFAULT_WEIGHTS[alert.type] ?? {};
    const dot = Object.entries(features)
      .reduce((sum, [k, v]) => sum + (w[k] ?? 0) * v, 0);
    return sigmoid(dot);
  }

  updateWeights(
    db: Database,
    alertId: string,
    alertType: AlertType,
    features: AlertFeatures,
    wasUseful: boolean
  ): void {
    const LEARNING_RATE = 0.05;
    const predicted = this.score({ type: alertType } as SmartAlert, features);
    const label = wasUseful ? 1 : 0;
    const error = predicted - label;

    const w = { ...(this.weights.get(alertType) ?? DEFAULT_WEIGHTS[alertType] ?? {}) };
    for (const [feat, val] of Object.entries(features)) {
      w[feat] = (w[feat] ?? 0) - LEARNING_RATE * error * (val as number);
    }
    this.weights.set(alertType, w);

    const now = Date.now();
    try {
      db.exec('BEGIN TRANSACTION;');
      const stmt = db.prepare(`INSERT OR REPLACE INTO alert_scorer_weights (alert_type, feature_name, weight, updated_at) VALUES (?,?,?,?)`);
      
      for (const [feat, weight] of Object.entries(w)) {
        stmt.run([alertType, feat, weight, now]);
      }
      stmt.free();

      const fbStmt = db.prepare(`INSERT INTO alert_feedback (alert_id, alert_type, was_useful, features, created_at) VALUES (?,?,?,?,?)`);
      fbStmt.run([alertId, alertType, wasUseful ? 1 : 0, JSON.stringify(features), now]);
      fbStmt.free();

      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      console.warn("updateWeights error:", e);
    }
  }
}

export function buildAlertFeatures(
  alert: SmartAlert,
  input: AlertEngineInput
): AlertFeatures {
  const { db, accountId, currentDay, daysInMonth, categories } = input;
  
  if (!db) {
    return {
      ratio_vs_mean: 1.0, days_until_month_end: 0.5, same_type_dismissed_rate: 0,
      category_volatility: 0, alert_recency_score: 1.0
    };
  }

  const catId = categories.find(c => c.name === alert.categoryName)?.id;
  const stats = catId ? getCategoryStats(db, accountId, catId) : DEFAULT_STATS;

  let dismissedRate = 0;
  let recentSameTypeLength = 0;

  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const fbStmt = db.prepare(`SELECT was_useful FROM alert_feedback WHERE alert_type = ? AND created_at > ?`);
    fbStmt.bind([alert.type, thirtyDaysAgo]);
    
    let totalFb = 0;
    let notUsefulFb = 0;
    while (fbStmt.step()) {
      totalFb++;
      if (fbStmt.get()[0] === 0) notUsefulFb++;
    }
    fbStmt.free();
    dismissedRate = totalFb > 0 ? notUsefulFb / totalFb : 0;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recStmt = db.prepare(`SELECT id FROM alert_feedback WHERE alert_type = ? AND created_at > ? LIMIT 1`);
    recStmt.bind([alert.type, sevenDaysAgo]);
    if (recStmt.step()) recentSameTypeLength = 1;
    recStmt.free();
  } catch(e) {}

  return {
    ratio_vs_mean: alert.amount && stats.mean > 0
      ? Math.min(alert.amount / stats.mean, 5)
      : 1.0,
    days_until_month_end: (daysInMonth - currentDay) / daysInMonth,
    same_type_dismissed_rate: dismissedRate,
    category_volatility: stats.mean > 0 ? Math.min(stats.iqr / stats.mean, 3) : 0,
    alert_recency_score: recentSameTypeLength === 0 ? 1 : 0,
  };
}
