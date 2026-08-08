# Motor de Alertas Inteligentes de Bagi

Bagi resuelve uno de los problemas clásicos de las apps financieras estáticas: usar umbrales duros quemados en código (ej. "alerta si un gasto es > $100.000"). El Alert Engine aprende el patrón de gasto personal de cada usuario y genera alertas contextuales y personalizadas, 100% offline, directamente en el navegador.

El motor vive en [`AlertEngine.ts`](../src/application/intelligence/AlertEngine.ts) y es orquestado desde la vista de Inteligencia (`Intelligence.tsx`).

---

## Tipos de Alerta

| `AlertType` | Descripción |
|---|---|
| `DUPLICATE` | Detecta cobros posiblemente duplicados en una ventana de tiempo |
| `TREND` | Gasto en una categoría significativamente más alto que el mismo punto del mes pasado |
| `ANOMALY` | Un gasto individual es inusualmente alto para su categoría (spike), o una tarjeta/obligación superó su presupuesto |
| `OVERDUE` | Obligación periódica vencida sin registrar pago |
| `OPPORTUNITY` | Categoría cerrando el mes con saldo muy por debajo del presupuesto (ahorro potencial) |
| `PATTERN` | Patrón de comportamiento detectado (ej. concentración de gastos en fines de semana) |

## Severidades

| `AlertSeverity` | Uso |
|---|---|
| `INFO` | Informativo, sin urgencia |
| `WARNING` | Situación a revisar |
| `CRITICAL` | Requiere atención inmediata |

---

## Arquitectura del Engine en 3 Fases

### Fase 1: Desacople del Hilo Principal (Web Worker)

JavaScript tiene un único hilo de ejecución. Generar embeddings para cientos de transacciones en el Main Thread congela la UI. Para evitarlo:

- [`EmbeddingWorker.ts`](../src/services/EmbeddingWorker.ts) corre en un hilo separado e importa `@huggingface/transformers`.
- Ejecuta el modelo **`all-MiniLM-L6-v2`** (~22 MB), almacenado en el Cache Storage del navegador para ejecución offline.
- [`EmbeddingService.ts`](../src/services/EmbeddingService.ts) actúa como proxy del Worker con un sistema de RPC asíncrono (mensajes con `id` para correlacionar respuestas).
- Cada texto se convierte en un vector de **384 dimensiones** normalizado a `L2 = 1`.

### Fase 2: Detección por 8 Detectores Independientes

`runAlertEngine(input)` es un async generator que encadena todos los detectores secuencialmente. Cada detector es a su vez un async generator que puede producir cero o más alertas.

#### Detector 1: `detectDuplicates` → `DUPLICATE`
Requiere el modelo de embeddings disponible. Compara cada par de transacciones del mes actual:
- **Condición de monto**: diferencia < $0.01.
- **Condición temporal**: dentro de una ventana de **72 horas**.
- **Condición semántica**: similitud coseno (dot product de vectores L2-normalizados) **≥ 0.88**.

Si las tres condiciones se cumplen, genera una alerta `CRITICAL`. Esto detecta duplicados incluso si la descripción tiene errores tipográficos ("McDonalds" vs "Mc Donal's").

#### Detector 2: `detectTrendVsLastMonth` → `TREND`
Compara el gasto acumulado por categoría hasta el día actual vs. el mismo punto del mes pasado.

- Solo activo a partir del **día 5** del mes.
- Calcula `ratio = gastoActual / gastoPrevio`.
- Umbral dinámico basado en el percentil 85 de los ratios históricos (`stats.trendP85`) si hay ≥ 3 meses de historial. Si no hay historial, usa umbrales fijos: `WARNING` en 1.3x, `CRITICAL` en 1.6x.
- Ignora categorías con gasto actual < $500.

#### Detector 3: `detectSpike` → `ANOMALY`
Detecta gastos individuales recientes (últimas **72 horas**) que superan el Tukey Upper Fence de su categoría.

- `upperFence = Q3 + 1.5 × IQR`, calculado sobre el historial de `monthly_category_summary`.
- Requiere al menos **2 meses** de historial (`sampleSize ≥ 2`).
- Severidad: `CRITICAL` si el gasto supera 2x el fence, `WARNING` en caso contrario.

#### Detector 4: `detectOverdueObligations` → `OVERDUE`
Recorre las `budget_obligations` del mes y detecta las que:
- Tienen `due_day` anterior al día actual.
- No han sido marcadas como pagadas (`isPaid = false`).

Severidad progresiva: `INFO` (≤ 2 días), `WARNING` (3-7 días), `CRITICAL` (> 7 días).

#### Detector 5: `detectSavingOpportunity` → `OPPORTUNITY`
Solo activo en los **últimos 7 días del mes**. Detecta categorías donde el gasto real es significativamente menor al presupuesto asignado.

- `remainingPct = (presupuesto - gastado) / presupuesto`.
- Solo alerta si `remainingPct ≥ 35%` Y es mayor al promedio histórico de ahorro en esa categoría + 5%.

Sugiere trasladar el excedente a Ahorros.

#### Detector 6: `detectWeekendSpending` → `PATTERN`
Detecta si una proporción inusualmente alta de gastos ocurre en fines de semana (viernes, sábado, domingo).

- Solo activo a partir del **día 10** del mes y con al menos **5 transacciones**.
- Calcula el `weekendPct` actual vs el `baseline` histórico (promedio de los últimos 3 meses desde `monthly_category_summary`).
- Alerta si `weekendPct > baseline + 15%`.

#### Detector 7: `detectCardOverspend` → `ANOMALY` (CRITICAL)
Detecta tarjetas de crédito donde el gasto bruto del mes supera la reserva presupuestada (`card_budgets`).

- Suma todos los gastos de tipo `EXPENSE` de las transacciones de la tarjeta.
- Compara contra el `amount` del `card_budget` del período.
- Solo genera alerta si la reserva es > 0.

#### Detector 8: `detectObligationOverspend` → `ANOMALY` (WARNING)
Detecta `budget_obligations` cuyo pago real (`paidAmount`) superó el monto presupuestado (`amount`).

- Solo actúa sobre obligaciones marcadas como pagadas.
- El exceso se reporta en el mensaje.

---

### Fase 3: Scoring Adaptativo Logístico

Todas las alertas pasan por el [`AlertScorer.ts`](../src/services/AlertScorer.ts) antes de ser mostradas.

#### Por qué un Scorer

Sin scoring, alertas frecuentes pero irrelevantes para el usuario (ej. una alerta de tendencia en una categoría volátil por naturaleza) compiten al mismo nivel que alertas críticas. El scorer aprende las preferencias personales del usuario para ordenar y filtrar.

#### Features por alerta (5 dimensiones)

| Feature | Cálculo |
|---|---|
| `ratio_vs_mean` | `alert.amount / estadísticaMean` de la categoría, clamped a 5 |
| `days_until_month_end` | `(diasEnMes - diaActual) / diasEnMes` |
| `same_type_dismissed_rate` | Porcentaje de alertas del mismo tipo rechazadas (👎) en los últimos 30 días |
| `category_volatility` | `IQR / mean` de la categoría, clamped a 3 |
| `alert_recency_score` | `1` si no hubo feedback en los últimos 7 días, `0` si hubo |

#### Modelo: Regresión Logística

```
score = σ( Σ weight_i × feature_i )
```

Donde `σ` es la función sigmoide. El resultado es un score de `0.0` a `1.0`.

**Pesos iniciales por defecto:**

| Tipo | ratio_vs_mean | days_until_month_end | same_type_dismissed_rate | category_volatility | alert_recency_score |
|---|---|---|---|---|---|
| DUPLICATE | 0 | 0 | -2.5 | 0 | 1.5 |
| TREND | 1.2 | -0.3 | -2.0 | 0.8 | 0.5 |
| ANOMALY | 1.5 | 0 | -1.8 | -0.5 | 1.0 |
| OVERDUE | 0 | -1.0 | -1.5 | 0 | 2.0 |
| OPPORTUNITY | 0 | -1.5 | -2.0 | 0.3 | 0.3 |
| PATTERN | 0.5 | -0.5 | -2.5 | 0.5 | 0.2 |

#### Aprendizaje Online (Gradient Descent)

Cuando el usuario interactúa con una alerta (👍 útil / 👎 no útil), [`AlertScorer.updateWeights()`](../src/services/AlertScorer.ts) ejecuta:

```
error = σ(dot) - label        // label = 1 si útil, 0 si no
w_i = w_i - 0.05 × error × feature_i
```

Learning rate: **0.05** (constante).

Los pesos actualizados se persisten inmediatamente en `alert_scorer_weights` en SQLite (dentro de una transacción, con rollback en caso de error). El feedback se registra en `alert_feedback`.

---

## Infraestructura Estadística: `FeatureExtractor.ts`

El cálculo de percentiles e IQR no se hace sobre transacciones brutas (lo que sería O(n) en tiempo de render), sino sobre la tabla precalculada `monthly_category_summary`.

### `getCategoryStats(db, accountId, categoryId)`
Lee los últimos **12 meses** de datos de `monthly_category_summary` y retorna:

```typescript
interface CategoryStats {
  mean: number;        // Promedio de gastos mensuales
  median: number;      // Mediana
  p75: number;         // Percentil 75 (Q3)
  p85: number;         // Percentil 85
  p95: number;         // Percentil 95
  iqr: number;         // Q3 - Q1
  upperFence: number;  // Q3 + 1.5 × IQR (Tukey Upper Fence)
  trendP85: number;    // Percentil 85 de los ratios mes-a-mes (umbral dinámico de tendencia)
  avgWeekendPct: number; // Promedio histórico de % de gasto en fin de semana
  sampleSize: number;  // Cantidad de meses con datos
}
```

### `refreshMonthlySummary(db, accountId, yearMonth)`
Query SQL que agrega las transacciones y escribe/actualiza `monthly_category_summary`. Debe llamarse tras cada batch de operaciones para mantener el agregado actualizado.

```sql
INSERT OR REPLACE INTO monthly_category_summary (...)
SELECT
  t.account_id, t.category_id,
  strftime('%Y-%m', t.imputation_date) AS ym,
  SUM(t.amount),
  COUNT(*),
  SUM(CASE WHEN strftime('%w', t.imputation_date) IN ('0','5','6') THEN t.amount ELSE 0 END)
  / NULLIF(SUM(t.amount), 0)
FROM transactions t
JOIN categories c ON c.id = t.category_id AND c.type = 'EXPENSE'
WHERE t.account_id = ? AND strftime('%Y-%m', t.imputation_date) = ?
GROUP BY t.account_id, t.category_id, ym
```

---

## Ciclo Completo del Engine

```
runAlertEngine(input)
  │
  ├── embeddingService.init()        ← inicia el Worker ONNX si no está listo
  ├── embeddingService.loadFromDB()  ← carga vectores guardados en tx_embeddings
  │
  ├── detectDuplicates()             ← requiere embeddings disponibles
  ├── detectTrendVsLastMonth()
  ├── detectSpike()
  ├── detectOverdueObligations()
  ├── detectSavingOpportunity()
  ├── detectWeekendSpending()
  ├── detectCardOverspend()
  └── detectObligationOverspend()
        │
        ├── embeddingService.saveToDB()   ← persiste vectores nuevos en tx_embeddings
        │
        └── AlertScorer
              ├── loadWeights(db)         ← lee pesos de alert_scorer_weights
              ├── score(alert, features)  ← sigmoide(dot product)
              └── sort por score DESC     ← las más relevantes primero
```

> **Nota**: Si el modelo ONNX no está disponible (fallo de carga del Worker), el detector de duplicados se omite silenciosamente. El resto del engine funciona sin embeddings.
