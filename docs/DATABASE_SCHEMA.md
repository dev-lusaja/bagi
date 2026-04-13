# Modelo de Datos (Esquema SQLite Local)

Toda la persistencia dentro de Bagi ocurre en una base local inyectada por WASM. El archivo maestro encargado de controlar la creación de estas entidades es [`SqliteAdapter.ts`](../src/infrastructure/adapters/SqliteAdapter.ts), específicamente en su bloque `createSchema()`.

## Entidades Fundamentales

La estructura de Bagi se basa en relaciones estándar de finanzas (One-to-Many):

### 1. Tablas Core
- **`users`**: Permite manejo rudimentario de usuarios (preparando multi-tenancy a futuro en la misma UI).
- **`accounts`**: Define orígenes de fondos (Tarjetas Débito o Cuentas Bancarias limpias).
- **`cards`**: Especializa la definición para Tarjetas de Crédito, integrándose con `accounts` (ej: una tarjeta se debita y paga desde una cuenta específica).
- **`categories`**: Manejo de taxonomías, flagadas principalmente con el campo `type` (`EXPENSE`, `INCOME` o `TRANSFER`).

### 2. Operatividad y Movimientos
- **`transactions`**: El motor contable principal. 
  Campos vitales: `amount`, `date`, `category_id`, `account_id` / `card_id`. Además retiene claves de "origen" (`recurring_item_id`, `budget_obligation_id`) para saber qué sistema automático las inyectó.

- **`recurring_items`**: Suscripciones y servicios que actúan como "Blueprints" (plantillas master).
  El campo clave es `due_day` (día en que se generan). Si está "activo", servirá para generar el Snapshot de final de mes.

- **`budget_obligations`**: Son la instanciación fotográfica del `recurring_items` mes a mes. Al inicio del mes, bagi toma todo servicio vivo en *recurring_items* y crea un *budget_obligation* atado a su `year` y `month`. Esto habilita poder cambiar precios fijos históricos sin afectar el pasado.

### 3. Tablas de Inteligencia Artificial (AI Local)
Agregadas en el parche predictivo 1.0.

- **`tx_embeddings`**: Almacena el vector BLOB (384 float-dimensions) representativo de cada transacción mediante su descripción matemática. *Nota: Esto añade unos pocos Kilobytes por transacción pero acelera inmensamente la lógica offline.*
- **`monthly_category_summary`**: Tabla agregada precompilada que se llena mediante una sub-query en `FeatureExtractor.ts`, permitiendo contar con el IQR y promedios por categoría precalculados para acelerar los dashboards y las detecciones de Spike (Rango intercuartílico extendido).
- **`alert_scorer_weights` & `alert_feedback`**: Guardan los pesos logísticos (sigmoide) que retroalimentan los detectores de fraude o alertas y la bitácora física de cada pulgar arriba/abajo que hace el usuario, garantizando persistencia del perfil de aprendizaje.
