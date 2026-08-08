# Arquitectura del Sistema Bagi

Bagi es una aplicación de finanzas personales **100% local-first**. No existe backend, no hay API REST, no hay servidor de base de datos. Toda la lógica de negocio, la inteligencia artificial y la persistencia ocurren en el navegador del usuario. Google Drive actúa como único canal de sincronización multi-dispositivo, almacenando el archivo SQLite como un blob binario.

---

## Principios Arquitectónicos

1. **Local-First**: Los datos nunca abandonan los dispositivos del usuario salvo para sincronizarse con su propio Google Drive.
2. **Clean Architecture**: Las capas dependen solo hacia adentro. La presentación no conoce SQL; el dominio no conoce React.
3. **Sin backend**: Cero servidores propios, cero bases de datos en la nube, cero APIs REST propias.

---

## Árbol de Capas

```
src/
├── domain/                         # Tipos puros. Sin dependencias externas.
│   ├── entities/index.ts           # Interfaces TypeScript (User, Account, Card, ...)
│   └── repositories/
│       └── IBudgetRepository.ts    # Contrato del repositorio (interfaz)
│
├── infrastructure/                 # Adapters: SQLite (WASM), Google Drive API
│   ├── adapters/
│   │   ├── SqliteAdapter.ts        # DDL, inicialización y acceso a sql.js
│   │   └── GoogleDriveAdapter.ts   # GSI + GAPI: login, upload, download, sync
│   └── repositories/
│       └── SqliteBudgetRepository.ts  # Implementación de IBudgetRepository
│
├── application/                    # Use Cases y Services. Orquestan domain + infra.
│   ├── use-cases/
│   │   └── BudgetService.ts        # Orquestador principal: CRUD + sync + lógica de mes
│   └── intelligence/
│       └── AlertEngine.ts          # Motor de alertas IA (8 detectores + scoring)
│
├── services/                       # Servicios utilitarios de soporte (IA, voz, analytics)
│   ├── EmbeddingWorker.ts          # Web Worker: ejecuta modelo ONNX en hilo separado
│   ├── EmbeddingService.ts         # Orquesta el Worker y cachea vectores
│   ├── FeatureExtractor.ts         # Estadísticas por categoría (IQR, percentiles)
│   ├── AlertScorer.ts              # Regresión logística + gradient descent online
│   ├── GeminiParserService.ts      # Llama a Gemini API para parsear texto/voz a transacción
│   ├── VoiceService.ts             # Web Speech API: STT + TTS
│   ├── AnalyticsService.ts         # Google Analytics 4 (gtag.js)
│   └── SentryLogger.ts             # Captura de errores vía Sentry
│
└── presentation/                   # React puro. Hooks, Views y Componentes.
    ├── context/
    │   └── BudgetContext.tsx        # Contexto global: instancia BudgetService y maneja auth
    ├── hooks/
    │   └── useBagiAI.ts            # Hook de voz + Gemini: graba, parsea y confirma transacciones
    ├── views/                       # Páginas principales de la SPA
    │   ├── Login.tsx
    │   ├── Home.tsx
    │   ├── Dashboard.tsx
    │   ├── Transactions.tsx
    │   ├── Intelligence.tsx
    │   └── Settings.tsx
    ├── components/                  # Componentes reutilizables
    │   ├── SmartAlertPanel.tsx
    │   ├── BudgetDiagnosticWidget.tsx
    │   ├── BudgetExplainer.tsx
    │   ├── TransactionConfirmForm.tsx
    │   ├── BagiActionModal.tsx
    │   ├── GeminiKeyModal.tsx
    │   ├── AlertModal.tsx
    │   ├── OnboardingChecklist.tsx
    │   ├── PromptModal.tsx
    │   └── SavingOverlay.tsx
    └── utils/
```

### Regla de dependencias (estricta)

```
presentation → application → infrastructure → domain
                ↓
            services/   (puede importar infrastructure para db, nunca presentation)
```

- `domain/` es agnóstico: sin React, sin SQL, sin APIs externas.
- `infrastructure/` interactúa con el mundo real (WASM, Google Drive, localStorage).
- `application/` orquesta usando entidades del dominio e inyección de adapters.
- `presentation/` es React puro: nunca contiene SQL ni reglas de negocio.
- `services/` contiene lógica pesada de soporte (AI, voz, analytics) que puede necesitar acceso directo a la `Database` de sql.js.

---

## Capa de Dominio

### Entidades (`src/domain/entities/index.ts`)

Interfaces TypeScript puras que definen la forma de los datos:

| Entidad | Descripción |
|---|---|
| `User` | Legado. Sin uso activo (login via Google) |
| `Account` | Cuenta bancaria o billetera. `currency: 'COP' \| 'PEN'` |
| `Card` | Tarjeta de crédito (`CREDIT`) o débito (`DEBIT`) |
| `Category` | Taxonomía de movimientos: `INCOME \| EXPENSE \| TRANSFER` |
| `Transaction` | Movimiento de dinero. Tiene `date` (real) e `imputation_date` (contable) |
| `RecurringItem` | Plantilla de gasto recurrente (`SERVICE \| DEBT`) con vigencia por fechas |
| `BudgetObligation` | Instancia mensual de un `RecurringItem` |
| `GlobalBudget` | Presupuesto total mensual por cuenta |
| `CategoryBudget` | Límite de gasto mensual por categoría |
| `CardBudget` | Reserva de pago mensual para una tarjeta |

### Repositorio (`src/domain/repositories/IBudgetRepository.ts`)

Contrato de interfaz que define todas las operaciones de persistencia. `SqliteBudgetRepository` es la única implementación concreta.

---

## Capa de Infraestructura

### `SqliteAdapter.ts`
- Carga `sql.js` WASM con `initSqlJs({ locateFile: file => '/${file}' })`.
- `initDb(buffer?)`: si recibe un `ArrayBuffer`, rehidrata la BD desde el blob de Drive. Si no, crea una BD vacía y ejecuta `createSchema()`.
- `createSchema()`: ejecuta el DDL de las 12 tablas en una sola llamada `db.run()`.
- **Singleton**: la instancia `db` es un módulo global. `getDb()` lanza error si no está inicializada.

### `GoogleDriveAdapter.ts`
- Autenticación via **Google Identity Services (GSI)** + **GAPI (Drive v3)**.
- El token de acceso se persiste en `localStorage` bajo la clave `bagi_google_token`.
- Scope requerido: `https://www.googleapis.com/auth/drive.file openid profile email`.
- Operaciones clave:

| Método | Descripción |
|---|---|
| `init()` | Carga scripts GSI y GAPI en el DOM |
| `login()` | Solicita token con `prompt: 'consent'` |
| `tryRestoreSession()` | Intenta recuperar token de localStorage y valida con `/oauth2/v3/userinfo` |
| `clearSession()` | Elimina token de localStorage |
| `getOrCreateFolder(name)` | Busca o crea la carpeta `Bagi_app` en Drive |
| `findFile(name, folderId)` | Busca el archivo `app_bagi.sqlite` en la carpeta |
| `downloadFile(fileId)` | Descarga el blob SQLite via `fetch` con Bearer token |
| `uploadFile(name, content, fileId?, folderId?)` | Sube/actualiza el blob via multipart upload |
| `getFileModifiedTime(fileId)` | Obtiene `modifiedTime` para detección de conflictos |
| `getUserInfo()` | Obtiene nombre, email y foto del usuario autenticado |

### `SqliteBudgetRepository.ts`
Implementación concreta de `IBudgetRepository`. Traduce cada método del contrato a SQL puro.

- `query<T>(sql, params)`: ejecuta un SELECT y retorna array de objetos tipados.
- `execute(sql, params)`: ejecuta INSERT/UPDATE/DELETE.
- `getTransactions(filters?)`: es el método más complejo — construye dinámicamente la query con JOINs a `categories`, `accounts` y `cards`, y retorna objetos enriquecidos con los datos relacionales.

---

## Capa de Aplicación

### `BudgetService.ts` — Orquestador Central

Es el único punto de contacto que la capa de presentación tiene con los datos. Actúa como proxy del repositorio añadiendo lógica de sincronización.

**Propiedades de sincronización:**
- `syncStrategy: 'immediate' | 'deferred'` — por defecto `deferred`.
- `SYNC_INTERVAL = 8000ms` — debounce de 8 segundos antes de sincronizar a Drive.
- `pendingChanges` — flag que indica si hay cambios sin sincronizar.
- `lastKnownRemoteTime` — timestamp del archivo en Drive al momento de la última sync exitosa.

**Ciclo de vida:**

```
BudgetService.init()
  └── GoogleDriveAdapter.init()  ← carga GSI + GAPI scripts

BudgetService.tryRestoreSession() o login()
  └── completeAuthentication()
        ├── getOrCreateFolder('Bagi_app')
        ├── findFile('app_bagi.sqlite')
        ├── si existe: downloadFile() → initializeDatabase(buffer) → seedCategories()
        └── si no existe: initializeDatabase() → seedCategories() → syncToDrive()
```

**`performOperation<T>(op)`**: wrapper que ejecuta cualquier mutación y dispara la sincronización según la estrategia configurada.

**Lógica de negocio exclusiva de `BudgetService`:**

| Método | Descripción |
|---|---|
| `instantiateRecurringItems(year, month, accountId, userId)` | Crea `budget_obligations` para los `recurring_items` activos que no tienen obligación en el período |
| `copyPreviousMonthLimits(year, month, accountId, userId)` | Copia `category_budgets` y `card_budgets` del mes anterior si no existen |
| `initializeMonth(year, month, accountId, userId)` | Wrapper: ejecuta `copyPreviousMonthLimits` + `instantiateRecurringItems` |
| `seedCategories()` | Siembra las categorías por defecto si no existen (privado) |
| `syncToDrive()` | Exporta la BD como blob y la sube a Drive con detección de conflictos |

---

## Estrategia de Sincronización con Google Drive

El flujo completo de una mutación:

1. El usuario realiza una acción (ej. agrega un gasto).
2. `BudgetService.performOperation()` ejecuta la escritura en SQLite (en memoria).
3. Se programa un `setTimeout` de 8 segundos (`scheduleSave`).
4. Al dispararse el timeout, `syncToDrive()`:
   a. Consulta `getFileModifiedTime(fileId)` del archivo en Drive.
   b. **Si el `modifiedTime` del Drive difiere del `lastKnownRemoteTime` local** → alguien modificó el archivo desde otro dispositivo.
      - Se descarga el blob actualizado y se reinicializa la BD local.
      - Se muestra una alerta nativa al usuario y se recarga la página (`window.location.reload()`).
   c. **Si no hay conflicto** → se exporta la BD con `repo.exportDatabase()` y se sube via `uploadFile()`.
   d. Se actualiza `lastKnownRemoteTime` con el nuevo `modifiedTime`.

> **Resolución de conflictos**: en la versión actual el Drive siempre gana. Los cambios locales no sincronizados se descartan y la página se recarga para limpiar el estado de React.

---

## Autenticación y Sesión

- **Proveedor**: Google OAuth 2.0 via GSI (Google Identity Services) — flujo de token implícito.
- **Sin backend**: el token de acceso OAuth se almacena directamente en `localStorage` bajo `bagi_google_token`.
- **Restauración de sesión**: al abrir la app, `BudgetProvider` llama a `tryRestoreSession()`. Si el token guardado es válido, la sesión se restaura automáticamente sin que el usuario inicie sesión de nuevo.
- **Expiración**: si el token falla (401/403), `handleGapiError()` lanza `AUTH_ERROR`, que `BudgetContext` captura para ejecutar `logout()`.

---

## Bagi AI — Subsistema de Voz + Gemini

Feature que permite registrar transacciones hablando al micrófono.

```
useBagiAI (hook)
  ├── VoiceService         → Web Speech API (STT): graba voz del usuario
  ├── GeminiParserService  → Gemini API: interpreta el texto y extrae la transacción
  └── mapGeminiOutput()    → mapea nombres de categoría/cuenta a IDs de la BD local
```

**Flujo detallado:**
1. `startListening()` → `VoiceService.start()` activa el micrófono.
2. Al detectar silencio, el navegador retorna el `transcript` (texto).
3. `parseText(transcript)` → `GeminiParserService.parse()` llama a `gemini-3.1-flash-lite` con el texto y las listas de categorías/cuentas/tarjetas del usuario como contexto.
4. Gemini retorna un JSON estructurado con: `description`, `amount`, `type`, `category_hint`, `source_hint`, `date_hint`.
5. `mapGeminiOutput()` resuelve los hints a IDs reales de la BD (fuzzy matching por nombre).
6. Se muestra `TransactionConfirmForm` para que el usuario revise y confirme.
7. `confirmAndSave()` → `BudgetService.addTransaction()` persiste y sincroniza.

**Gestión de API Key**: el usuario provee su propia Gemini API key, que se guarda en `localStorage` bajo `bagi_gemini_api_key`. Nunca sale del dispositivo salvo en la llamada directa a la API de Google.

**Errores manejados**: `OFF_TOPIC`, `QUOTA_EXHAUSTED`, `INVALID_API_KEY`, `SPEECH_NOT_SUPPORTED`, `NO_SPEECH_DETECTED`.

---

## Contexto React Global (`BudgetContext.tsx`)

`BudgetProvider` es el componente raíz que instancia y provee el `BudgetService` a toda la app.

**Responsabilidades:**
- Instancia `BudgetService` con `SqliteBudgetRepository` y `GoogleDriveAdapter`.
- Al montar, intenta restaurar sesión automáticamente.
- Identifica al usuario en Sentry (`Sentry.setUser`) y GA4 (`AnalyticsService.identify`) tras login exitoso.
- Expone el contexto: `service`, `isInitialized`, `isSyncing`, `hasPendingChanges`, `userInfo`, `isAuthenticated`, `login`, `logout`, `sync`.
- Verifica cambios pendientes cada 1 segundo via `setInterval`.

---

## Observabilidad

### Sentry (`SentryLogger.ts`)
- Captura de errores no controlados en producción.
- `ErrorLogger.capture(error, context)`: usado en todos los adapters y services.
- `DebugLogger.capture()`: para eventos de diagnóstico (ej. login exitoso).
- Identifica al usuario con email tras autenticación.

### Google Analytics 4 (`AnalyticsService.ts`)
- Tracking de navegación SPA: cada cambio de tab genera un evento `page_view`.
- Identificación de usuario: SHA-256 del email como `user_id` (privacy-safe, nunca PII directa).
- Configurado con `VITE_GA_MEASUREMENT_ID`.

---

## Variables de Entorno

| Variable | Descripción |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Client ID de la app en Google Cloud Console |
| `VITE_GOOGLE_API_KEY` | API Key para GAPI (Drive v3) |
| `VITE_GA_MEASUREMENT_ID` | ID de medición de Google Analytics 4 |

La Gemini API Key del usuario es de usuario final y **no va en variables de entorno**: se configura en la UI y se guarda en `localStorage`.

---

## Stack Tecnológico

| Categoría | Tecnología |
|---|---|
| Framework UI | React 18 + Vite 5 + TypeScript |
| Base de Datos | `sql.js` 1.14 (SQLite via WebAssembly) |
| Sincronización | Google Drive API v3 (GAPI) + GSI |
| IA Offline | HuggingFace Transformers 4.0.1 + ONNX (`all-MiniLM-L6-v2`) |
| IA Cloud | Gemini API (`gemini-3.1-flash-lite`) — requiere API key del usuario |
| Voz | Web Speech API (nativa del navegador) |
| Estilos | TailwindCSS 4 |
| Gráficos | Recharts 3 |
| Iconos | Lucide React |
| Errores | Sentry React 10 |
| Analytics | Google Analytics 4 (gtag.js) |
| Deploy | Netlify (estático, sin server-side rendering) |

---

## Servicios Compartidos (`src/services/`)

Lógica pesada que puede requerir multithreading o matemáticas intensivas:

| Archivo | Rol |
|---|---|
| `EmbeddingWorker.ts` | Web Worker que ejecuta el modelo ONNX en hilo separado |
| `EmbeddingService.ts` | Orquesta el Worker via RPC asíncrono, mantiene caché en memoria y persiste vectores en `tx_embeddings` |
| `FeatureExtractor.ts` | Lee `monthly_category_summary` y calcula IQR, percentiles y ratios de tendencia por categoría |
| `AlertScorer.ts` | Implementa regresión logística con sigmoide y gradient descent online para puntuar alertas |
| `GeminiParserService.ts` | Cliente HTTP de Gemini API con schema de respuesta JSON estructurado |
| `VoiceService.ts` | Abstracción del Web Speech API (STT via `SpeechRecognition`, TTS via `SpeechSynthesis`) |
| `AnalyticsService.ts` | Wrapper tipado de `gtag.js` para GA4 |
| `SentryLogger.ts` | Wrapper de `@sentry/react` para captura de errores |
