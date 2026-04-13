import { Database } from 'sql.js';

export interface CategoryStats {
  mean: number;
  median: number;
  p75: number;
  p85: number;
  p95: number;
  iqr: number;
  upperFence: number;
  trendP85: number;
  avgWeekendPct: number;
  sampleSize: number;
}

export const DEFAULT_STATS: CategoryStats = {
  mean: 0, median: 0, p75: 0, p85: 0, p95: 0,
  iqr: 0, upperFence: Infinity,
  trendP85: 1.4,
  avgWeekendPct: 0.45,
  sampleSize: 0,
};

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function getCategoryStats(
  db: Database,
  accountId: string,
  categoryId: number
): CategoryStats {
  try {
    const sql = `
      SELECT total_amount, year_month, weekend_pct
      FROM monthly_category_summary
      WHERE account_id = ? AND category_id = ?
      ORDER BY year_month DESC
      LIMIT 12
    `;
    
    const stmt = db.prepare(sql);
    stmt.bind([accountId, categoryId]);
    
    const rows: { total_amount: number, year_month: string, weekend_pct: number | null }[] = [];
    while (stmt.step()) {
      const row = stmt.get();
      rows.push({
        total_amount: row[0] as number,
        year_month: row[1] as string,
        weekend_pct: row[2] as number | null
      });
    }
    stmt.free();

    if (rows.length < 2) return DEFAULT_STATS;

    const amounts = [...rows.map(r => r.total_amount)].sort((a, b) => a - b);
    const q1 = percentile(amounts, 0.25);
    const q3 = percentile(amounts, 0.75);
    const iqr = q3 - q1;

    const ratios: number[] = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const prev = rows[i + 1].total_amount;
      if (prev > 0) ratios.push(rows[i].total_amount / prev);
    }
    const sortedRatios = [...ratios].sort((a, b) => a - b);

    const weekendPcts = rows
      .map(r => r.weekend_pct)
      .filter((v): v is number => v !== null);

    return {
      mean: amounts.reduce((a, b) => a + b, 0) / amounts.length,
      median: percentile(amounts, 0.5),
      p75: q3,
      p85: percentile(amounts, 0.85),
      p95: percentile(amounts, 0.95),
      iqr,
      upperFence: iqr > 0 ? q3 + 1.5 * iqr : q3 * 1.1,
      trendP85: sortedRatios.length >= 3
        ? percentile(sortedRatios, 0.85)
        : DEFAULT_STATS.trendP85,
      avgWeekendPct: weekendPcts.length
        ? weekendPcts.reduce((a, b) => a + b, 0) / weekendPcts.length
        : DEFAULT_STATS.avgWeekendPct,
      sampleSize: rows.length,
    };
  } catch (e) {
    console.warn("getCategoryStats error:", e);
    return DEFAULT_STATS;
  }
}

export function refreshMonthlySummary(
  db: Database,
  accountId: string,
  yearMonth: string
): void {
  try {
    const sql = `
      INSERT OR REPLACE INTO monthly_category_summary
        (account_id, category_id, year_month, total_amount, tx_count, weekend_pct)
      SELECT
        t.account_id,
        t.category_id,
        strftime('%Y-%m', t.date)                         AS ym,
        SUM(t.amount)                                      AS total_amount,
        COUNT(*)                                           AS tx_count,
        CAST(SUM(CASE WHEN strftime('%w', t.date) IN ('0','5','6')
                      THEN t.amount ELSE 0 END) AS REAL)
          / NULLIF(SUM(t.amount), 0)                       AS weekend_pct
      FROM transactions t
      JOIN categories c ON c.id = t.category_id AND c.type = 'EXPENSE'
      WHERE t.account_id = ?
        AND strftime('%Y-%m', t.date) = ?
      GROUP BY t.account_id, t.category_id, ym
    `;
    db.run(sql, [accountId, yearMonth]);
  } catch(e) {
    console.warn("refreshMonthlySummary error:", e);
  }
}
