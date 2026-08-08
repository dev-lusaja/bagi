# Modelo de Datos (Esquema SQLite Local)

Toda la persistencia dentro de Bagi ocurre en una base de datos SQLite cargada en memoria vía WASM (`sql.js`). El archivo maestro que define el DDL es [`SqliteAdapter.ts`](../src/infrastructure/adapters/SqliteAdapter.ts) — función `createSchema()`. El acceso a datos está encapsulado en [`SqliteBudgetRepository.ts`](../src/infrastructure/repositories/SqliteBudgetRepository.ts).

> **Regla fundamental**: Ningún archivo fuera de `infrastructure/` puede contener sentencias SQL. Toda lectura y escritura pasa por `SqliteBudgetRepository`, que a su vez usa `SqliteAdapter`.

---

## Diagrama de Relaciones

```
users (legado, sin uso activo)
  └──< accounts          [currency: COP | PEN]
        └──< cards        [type: CREDIT | DEBIT]
        └──< transactions
        └──< global_budgets
        └──< category_budgets
        └──< card_budgets
        └──< recurring_items
              └──< budget_obligations
                    └──< transactions (budget_obligation_id)

categories
  └──< transactions
  └──< category_budgets
  └──< monthly_category_summary   (tabla AI — agregado precalculado)

tx_embeddings                     (tabla AI — vectores ONNX por transacción)
alert_scorer_weights              (tabla AI — pesos logísticos por tipo de alerta)
alert_feedback                    (tabla AI — bitácora de feedback del usuario)
```

---

## Tablas Core

### `users`
> ⚠️ Tabla **legado**. Existe en el DDL pero **no se usa funcionalmente**. La autenticación real es via Google OAuth. Todo el código usa `user_id = 1` hardcodeado como valor de compatibilidad.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | ID del usuario |
| `username` | TEXT | UNIQUE | Nombre de usuario (sin uso) |
| `hashed_password` | TEXT | — | Contraseña hasheada (sin uso) |

---

### `accounts`
Orígenes de fondos del usuario (cuentas bancarias o billeteras digitales).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | ID de cuenta |
| `name` | TEXT | — | Nombre descriptivo (ej. "Bancolombia Ahorros") |
| `currency` | TEXT | `'COP' \| 'PEN'` | Moneda de la cuenta |
| `country` | TEXT | — | País de la cuenta |
| `user_id` | INTEGER | FK → `users.id` | Propietario (actualmente siempre `1`) |

---

### `cards`
Tarjetas de crédito o débito. Pueden estar vinculadas a una cuenta de pago (`payment_account_id`).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | ID de tarjeta |
| `name` | TEXT | — | Nombre descriptivo (ej. "Visa Platinum") |
| `type` | TEXT | `'CREDIT' \| 'DEBIT'` | Tipo de tarjeta |
| `credit_limit` | REAL | nullable | Cupo máximo (solo tarjetas de crédito) |
| `currency` | TEXT | — | Moneda de la tarjeta |
| `user_id` | INTEGER | FK → `users.id` | Propietario |
| `payment_account_id` | INTEGER | FK → `accounts.id`, nullable | Cuenta desde la cual se paga esta tarjeta |
| `monthly_payment_budget` | REAL | DEFAULT 0.0 | Reserva mensual asignada para pagar la tarjeta |

---

### `categories`
Taxonomía de transacciones. El campo `type` determina si aparece como gasto, ingreso o transferencia.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | ID de categoría |
| `name` | TEXT | — | Nombre (ej. "Restaurantes", "Salario") |
| `type` | TEXT | `'INCOME' \| 'EXPENSE' \| 'TRANSFER'` | Clasificación contable |
| `user_id` | INTEGER | FK → `users.id` | Propietario |

**Categorías por defecto** (sembradas en `BudgetService.seedCategories()` al primer login):

| Nombre | Tipo |
|---|---|
| Salida de dinero al exterior | EXPENSE |
| Servicios | EXPENSE |
| Deudas | EXPENSE |
| Servicios Recurrentes | EXPENSE |
| Deudas Recurrentes | EXPENSE |
| Ahorros | EXPENSE |
| Otros gastos | EXPENSE |
| Mercado | EXPENSE |
| Restaurantes | EXPENSE |
| Transporte | EXPENSE |
| Gastos hormiga | EXPENSE |
| Ropa | EXPENSE |
| Efectivo | EXPENSE |
| Mascotas | EXPENSE |
| Gasolina | EXPENSE |
| Parqueadero | EXPENSE |
| Taxis | EXPENSE |
| Pago tarjeta de crédito | TRANSFER |
| Abono a tarjeta | TRANSFER |
| Salario | INCOME |
| Otros ingresos | INCOME |

---

## Tablas de Operaciones

### `transactions`
El motor contable central. Cada movimiento de dinero, independientemente del origen.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | ID de la transacción |
| `date` | TEXT | — | Fecha real del movimiento (ISO string) |
| `imputation_date` | TEXT | NOT NULL | Fecha contable del movimiento. Se usa para filtrar por período. Normalizada al mes de presupuesto activo |
| `amount` | REAL | — | Monto del movimiento |
| `description` | TEXT | — | Descripción del movimiento |
| `account_id` | INTEGER | FK → `accounts.id`, nullable | Cuenta origen (mutuamente exclusivo con `card_id`) |
| `card_id` | INTEGER | FK → `cards.id`, nullable | Tarjeta origen (mutuamente exclusivo con `account_id`) |
| `category_id` | INTEGER | FK → `categories.id` | Categoría del movimiento |
| `recurring_item_id` | INTEGER | FK → `recurring_items.id`, nullable | Si fue generado por un item recurrente |
| `budget_obligation_id` | INTEGER | FK → `budget_obligations.id`, nullable | Si fue generado al registrar el pago de una obligación |
| `user_id` | INTEGER | FK → `users.id` | Propietario |

> **Nota sobre `imputation_date`**: cuando el día de la transacción no existe en el mes de imputación (ej. día 31 en un mes de 30 días), se normaliza al último día del mes.

**Filtros disponibles en `getTransactions()`**: `account_id`, `card_id`, `category_id`, `currency`, `year`, `month`, `limit`, `offset`.

---

### `recurring_items`
"Blueprints" o plantillas maestras de gastos/deudas recurrentes (suscripciones, servicios, cuotas).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | ID del item |
| `name` | TEXT | — | Nombre del servicio/deuda |
| `amount` | REAL | — | Monto mensual |
| `type` | TEXT | `'SERVICE' \| 'DEBT'` | Tipo de obligación |
| `due_day` | INTEGER | — | Día del mes en que vence |
| `is_active` | BOOLEAN | DEFAULT 1 | Si está activo para el ciclo actual |
| `category_id` | INTEGER | FK → `categories.id` | Categoría del gasto |
| `account_id` | INTEGER | FK → `accounts.id`, nullable | Cuenta de débito (si aplica) |
| `card_id` | INTEGER | FK → `cards.id`, nullable | Tarjeta de cargo (si aplica) |
| `notes` | TEXT | nullable | Notas adicionales |
| `start_year` | INTEGER | DEFAULT 2026 | Año de inicio de vigencia |
| `start_month` | INTEGER | DEFAULT 1 | Mes de inicio de vigencia |
| `end_year` | INTEGER | nullable | Año de fin de vigencia (null = indefinido) |
| `end_month` | INTEGER | nullable | Mes de fin de vigencia (null = indefinido) |
| `user_id` | INTEGER | FK → `users.id` | Propietario |

---

### `budget_obligations`
Instancias mensuales fotográficas de los `recurring_items`. Se crean al inicio de cada período por `BudgetService.instantiateRecurringItems()`.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | ID de la obligación |
| `year` | INTEGER | — | Año del período |
| `month` | INTEGER | — | Mes del período |
| `name` | TEXT | — | Nombre (copiado del `recurring_item` en el momento de instanciar) |
| `amount` | REAL | — | Monto (copiado del `recurring_item` en el momento de instanciar) |
| `due_day` | INTEGER | — | Día de vencimiento |
| `notes` | TEXT | nullable | Notas |
| `category_id` | INTEGER | FK → `categories.id` | Categoría |
| `account_id` | INTEGER | FK → `accounts.id`, nullable | Cuenta asociada |
| `card_id` | INTEGER | FK → `cards.id`, nullable | Tarjeta asociada |
| `recurring_item_id` | INTEGER | FK → `recurring_items.id`, nullable | Plantilla origen |
| `user_id` | INTEGER | FK → `users.id` | Propietario |

> **Regla de negocio clave**: Un `recurring_item` solo genera una `budget_obligation` por período. Si ya existe una obligación con ese `recurring_item_id` para el mismo `year`/`month`, no se re-instancia. Esto permite modificar el precio del `recurring_item` sin alterar el historial de obligaciones pasadas.

---

## Tablas de Presupuesto

### `global_budgets`
Presupuesto total mensual por cuenta.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | ID |
| `year` | INTEGER | — | Año |
| `month` | INTEGER | — | Mes |
| `total_amount` | REAL | — | Monto total presupuestado |
| `account_id` | INTEGER | FK → `accounts.id` | Cuenta presupuestada |
| `user_id` | INTEGER | FK → `users.id` | Propietario |

---

### `category_budgets`
Presupuesto mensual por categoría de gasto.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | ID |
| `year` | INTEGER | — | Año |
| `month` | INTEGER | — | Mes |
| `amount` | REAL | — | Límite de gasto para la categoría |
| `category_id` | INTEGER | FK → `categories.id` | Categoría presupuestada |
| `account_id` | INTEGER | FK → `accounts.id` | Cuenta a la que aplica |
| `user_id` | INTEGER | FK → `users.id` | Propietario |

---

### `card_budgets`
Reserva mensual de pago por tarjeta de crédito.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | ID |
| `year` | INTEGER | — | Año |
| `month` | INTEGER | — | Mes |
| `amount` | REAL | — | Monto reservado para pagar la tarjeta |
| `card_id` | INTEGER | FK → `cards.id` | Tarjeta presupuestada |
| `account_id` | INTEGER | FK → `accounts.id` | Cuenta de pago vinculada |
| `user_id` | INTEGER | FK → `users.id` | Propietario |

> **Regla de negocio**: Los presupuestos de categoría y tarjeta se copian automáticamente del mes anterior si no existen para el período actual. Ver `BudgetService.copyPreviousMonthLimits()`.

---

## Tablas de Inteligencia Artificial (Local)

### `tx_embeddings`
Vectores semánticos de transacciones generados por el modelo ONNX `all-MiniLM-L6-v2`. Se usan para detección de duplicados por similitud coseno.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `tx_id` | TEXT | PK | ID de la transacción referenciada |
| `account_id` | TEXT | NOT NULL | Cuenta del contexto del embedding |
| `vector` | BLOB | NOT NULL | 384 floats (Float32Array serializado) |
| `created_at` | INTEGER | NOT NULL | Timestamp Unix de creación |

---

### `monthly_category_summary`
Agregado precalculado de gastos por categoría y mes. Alimentado por `FeatureExtractor.refreshMonthlySummary()`. Permite al AlertEngine calcular percentiles e IQR sin recorrer toda la tabla de transacciones.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | ID |
| `account_id` | TEXT | NOT NULL | Cuenta |
| `category_id` | INTEGER | NOT NULL | Categoría |
| `year_month` | TEXT | NOT NULL | Período en formato `YYYY-MM` |
| `total_amount` | REAL | NOT NULL | Suma de gastos del período |
| `tx_count` | INTEGER | NOT NULL | Cantidad de transacciones |
| `weekend_pct` | REAL | nullable | Porcentaje del gasto que ocurrió en fin de semana |
| — | UNIQUE | `(account_id, category_id, year_month)` | Evita duplicados por período |

---

### `alert_scorer_weights`
Pesos del modelo de regresión logística del AlertScorer. Se actualizan con cada feedback del usuario (👍/👎).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `alert_type` | TEXT | PK (compuesta) | Tipo de alerta (`ANOMALY`, `TREND`, `DUPLICATE`, `OPPORTUNITY`, `PATTERN`, `OVERDUE`) |
| `feature_name` | TEXT | PK (compuesta) | Nombre del feature (`ratio_vs_mean`, `days_until_month_end`, etc.) |
| `weight` | REAL | DEFAULT 0.0 | Peso aprendido |
| `updated_at` | INTEGER | NOT NULL | Timestamp de última actualización |

---

### `alert_feedback`
Bitácora inmutable de cada interacción del usuario con una alerta.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | ID del registro |
| `alert_id` | TEXT | NOT NULL | ID único de la alerta mostrada |
| `alert_type` | TEXT | NOT NULL | Tipo de alerta |
| `was_useful` | INTEGER | NOT NULL | `1` = útil (👍) / `0` = no útil (👎) |
| `features` | TEXT | NOT NULL | JSON con los features del momento de la alerta |
| `created_at` | INTEGER | NOT NULL | Timestamp Unix |

---

## Reglas de Negocio de Base de Datos

1. **`imputation_date` ≠ `date`**: `date` es cuándo ocurrió el gasto. `imputation_date` es el período contable. El motor de filtros usa siempre `imputation_date` para reportes.
2. **`account_id` XOR `card_id`** en transacciones: una transacción tiene siempre uno de los dos, nunca ambos ni ninguno.
3. **Unicidad de obligaciones**: `budget_obligations` no puede tener dos registros con el mismo `recurring_item_id` para el mismo `(year, month)`.
4. **Categorías auto-sembradas**: si una categoría del listado por defecto no existe al abrir la app, `BudgetService.seedCategories()` la crea con `user_id = 1` automáticamente.
5. **Límites de presupuesto por mes**: Si no existen `category_budgets` o `card_budgets` para el período actual, se copian del período anterior via `BudgetService.copyPreviousMonthLimits()`.
