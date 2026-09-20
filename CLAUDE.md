# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bagi is a **local-first personal finance app** (React + Vite + TypeScript). There is no backend, no REST API, no cloud database server. All business logic, AI, and persistence run entirely in the browser. Google Drive is the only external storage — it holds the SQLite database as a binary blob for multi-device sync. Responses to the user should be in Spanish (project convention); source code (identifiers, inline comments) stays in English. When referencing files or symbols in responses, use clickable links formatted as `[nombre](file:///ruta/absoluta)`.

## Commands

```bash
npm install         # install dependencies (requires Node ^22)
npm run dev          # start Vite dev server at http://localhost:5173
npm run dev:local    # start dev server in explicit "development" mode
npm run build         # type-check (tsc -b) then build with Vite
npm run lint           # run ESLint over the project
npm run preview        # preview a production build locally
npm run code:map       # regenerate docs/code_skeleton.md via ctags (requires Universal/Exuberant Ctags)
```

There is no test suite configured in this repo.

Do **not** run functional/manual tests of the app yourself — the user verifies UI behavior manually. If the code type-checks and lints cleanly, the work is considered done.

## Architecture — Clean Architecture (strict)

```
src/
├── domain/            # Pure types/interfaces. Zero external dependencies (no React, no SQL).
│   ├── entities/index.ts              # User, Account, Card, Category, Transaction, RecurringItem, BudgetObligation, GlobalBudget, CategoryBudget, CardBudget
│   └── repositories/IBudgetRepository.ts   # Repository contract
│
├── infrastructure/    # Adapters to the real world: SQLite (WASM), Google Drive API
│   ├── adapters/SqliteAdapter.ts          # ONLY place allowed to contain SQL/DDL; sql.js singleton (getDb())
│   ├── adapters/GoogleDriveAdapter.ts     # GSI + GAPI: login, upload/download, conflict detection
│   └── repositories/SqliteBudgetRepository.ts  # Implements IBudgetRepository, translates calls to SQL
│
├── application/       # Use cases / orchestration of domain + infrastructure
│   ├── use-cases/BudgetService.ts         # Central orchestrator: CRUD, sync scheduling, month init logic
│   └── intelligence/AlertEngine.ts        # AI alert engine (async generator, 8 detectors)
│
├── services/           # Heavy support logic that may need direct DB/thread access
│   ├── EmbeddingWorker.ts       # Web Worker running the ONNX model (all-MiniLM-L6-v2) off the main thread
│   ├── EmbeddingService.ts      # RPC proxy for the worker + in-memory/tx_embeddings cache
│   ├── FeatureExtractor.ts      # Per-category stats (IQR, percentiles) from monthly_category_summary
│   ├── AlertScorer.ts           # Online logistic regression (sigmoid + gradient descent) for alert scoring
│   ├── GeminiParserService.ts   # Gemini API client: parses free text/voice into a structured transaction
│   ├── VoiceService.ts          # Web Speech API wrapper (STT + TTS)
│   ├── AnalyticsService.ts      # GA4 (gtag.js) wrapper
│   └── SentryLogger.ts          # Sentry error/debug capture wrapper
│
└── presentation/       # React only — views, hooks, components. No SQL, no business rules.
    ├── context/BudgetContext.tsx      # Instantiates BudgetService, manages auth/session, exposes app context
    ├── hooks/useBagiAI.ts            # Voice + Gemini hook: record → parse → confirm transaction
    ├── views/                        # Login, Home, Dashboard, Transactions, Intelligence, Settings
    └── components/                   # SmartAlertPanel, TransactionConfirmForm, BagiActionModal, etc.
```

### Non-negotiable dependency rule

```
presentation → application → infrastructure → domain
                  ↓
              services/  (may reach into infrastructure for DB access, never into presentation)
```

- **SQL lives only in `src/infrastructure/adapters/SqliteAdapter.ts`** (and equivalent infra files). No SQL anywhere else.
- **No business logic in `.tsx` components.** Components consume hooks; hooks call services/use-cases in `application/`; services call adapters in `infrastructure/`. (e.g. `useTransactions` → `TransactionService` → `SqliteAdapter`, never balance/budget math inline in a component.)
- `domain/` stays framework-agnostic: no React, no SQL, no external APIs.
- Any schema change (tables/columns/indexes) **must** be accompanied by an update to `docs/DATABASE_SCHEMA.md` in the same change, including the `ALTER TABLE`/migration delta.

### Planning requirement for larger changes

For changes spanning multiple files/layers, SQLite schema changes, new features/refactors, or infrastructure changes (adapters, services, Google Drive), stop and produce an `implementation_plan.md` and get explicit user approval before touching code. Trivial fixes, typos, and minor single-file UI tweaks can be applied directly.

## Key subsystems

**Google Drive sync** (`BudgetService` + `GoogleDriveAdapter`): mutations write to the in-memory SQLite DB immediately, then a debounced `syncToDrive()` fires after an 8s timeout (`SYNC_INTERVAL`). Before uploading, it checks the Drive file's `modifiedTime` against `lastKnownRemoteTime`; on mismatch (edited from another device), Drive always wins — local unsynced changes are discarded, the DB is reloaded from the remote blob, and the page reloads. Auth token lives in `localStorage` under `bagi_google_token`; a 401/403 throws `AUTH_ERROR`, handled by `BudgetContext` to force logout.

**Bagi AI (voice input)**: `useBagiAI` → `VoiceService` (Web Speech API STT) → `GeminiParserService` (calls `gemini-3.1-flash-lite` with the transcript plus the user's categories/accounts/cards as context) → `mapGeminiOutput()` fuzzy-matches hints to local DB IDs → `TransactionConfirmForm` for user confirmation → `BudgetService.addTransaction()`. The user's own Gemini API key is stored in `localStorage` (`bagi_gemini_api_key`), never in env vars.

**Smart Alert Engine** (`AlertEngine.ts`, orchestrated from `Intelligence.tsx`): an async generator chaining 8 independent detectors (`DUPLICATE`, `TREND`, `ANOMALY`, `OVERDUE`, `OPPORTUNITY`, `PATTERN` alert types). Duplicate detection needs the ONNX embedding model (`all-MiniLM-L6-v2`, 384-dim L2-normalized vectors, generated in `EmbeddingWorker.ts` off the main thread) and flags matches with amount diff < $0.01, within a 72h window, and cosine similarity ≥ 0.88. Alert scoring uses an online logistic regression (`AlertScorer.ts`) trained from `alert_feedback`.

**Environment variables** (`VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `VITE_GA_MEASUREMENT_ID`) configure Google OAuth/Drive and GA4 — see `.env.example`. The Gemini key is end-user-provided via Settings UI, not an env var.

## Naming conventions

| Kind | Pattern | Example |
|---|---|---|
| Presentation hook | `useX` | `useDashboard`, `useTransactions` |
| Application service | `XService` | `BudgetService`, `TransactionService` |
| Infrastructure adapter | `XAdapter` | `SqliteAdapter`, `GoogleDriveAdapter` |
| Domain entity | `IX` interface | `ITransaction`, `IBudget` |
| View | `X.tsx` in `presentation/views/` | `Dashboard.tsx` |
| Component | `X.tsx` in `presentation/components/` | `AccountCard.tsx` |

## Reference docs

Consult before non-trivial changes in the relevant area:
- `docs/ARCHITECTURE.md` — full architecture reference
- `docs/DATABASE_SCHEMA.md` — SQLite schema and business rules (keep in sync with any schema change)
- `docs/SMART_ALERTS_ENGINE.md` — AI alert engine details
- `docs/code_skeleton.md` — ctags-generated map of classes/functions/interfaces; regenerate with `npm run code:map` after adding/moving/renaming modules or symbols

## What not to do

- Don't introduce a backend, REST API, or server-side database (no Express, Prisma, etc.) — this app is local-first by design.
- Don't write SQL outside `infrastructure/`.
- Don't put business logic in presentation components.
- Don't skip updating `docs/DATABASE_SCHEMA.md` when the schema changes.
- Don't run functional tests on the user's behalf.
