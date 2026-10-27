# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bagi is a **local-first personal finance app** (React + Vite + TypeScript). There is no backend, no REST API, no cloud database server. All business logic, AI, and persistence run entirely in the browser. Google Drive is the only external storage — it holds the SQLite database as a binary blob for multi-device sync. Responses to the user should be in Spanish (project convention); source code (identifiers, inline comments) stays in English. When referencing files or symbols in responses, use clickable markdown links with workspace-relative paths, e.g. `[Dashboard.tsx](src/presentation/views/Dashboard.tsx#L42)`.
## Commands

```bash
npm install         # install dependencies (requires Node ^22)
npm run dev          # start Vite dev server at http://localhost:5173
npm run dev:local    # start dev server in explicit "development" mode
npm run build         # type-check (tsc -b) then build with Vite
npm run lint           # run ESLint over the project
npm run preview        # preview a production build locally
npm run code:map       # regenerate docs/code_skeleton.md via ctags (Universal Ctags is installed via Homebrew)
```

There is no test suite configured in this repo.

Do **not** run functional/manual tests of the app yourself — the user verifies UI behavior manually.

### Definition of done

- `npx tsc -b` passes with no errors.
- **Lint has a pre-existing baseline** (~385 errors as of 2026-10-26, almost all `@typescript-eslint/no-explicit-any`, concentrated in `Dashboard.tsx`, `Settings.tsx`, `Transactions.tsx`, `AlertEngine.ts`). A clean `npm run lint` is not the bar. Instead, run `npx eslint <touched files>` before and after the change and make sure the change introduces **no new** lint errors. Fixing existing `any`s in lines you touch is welcome but not required.

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
│   ├── use-cases/BudgetService.ts         # Central orchestrator: CRUD, sync scheduling, month init logic, budget math helpers
│   └── intelligence/AlertEngine.ts        # AI alert engine (async generator, 8 detectors)
│
├── services/           # Heavy support logic that may need direct DB/thread access
│   ├── EmbeddingWorker.ts       # Web Worker running the ONNX model (all-MiniLM-L6-v2) off the main thread
│   ├── EmbeddingService.ts      # RPC proxy for the worker + in-memory/tx_embeddings cache
│   ├── FeatureExtractor.ts      # Per-category stats (IQR, percentiles) from monthly_category_summary
│   ├── AlertScorer.ts           # Online logistic regression (sigmoid + gradient descent) for alert scoring
│   ├── AIProviderFactory.ts     # Resolves the active AI provider (Gemini | OpenRouter), its API key and models from localStorage
│   ├── AIProviderTypes.ts       # Provider-neutral interface + types shared by both parsers
│   ├── AIPromptBuilder.ts       # Builds the prompt/context (categories, accounts, cards, recent tx) for any provider
│   ├── AIHttpRetry.ts           # Retry/fallback-model logic for provider HTTP calls
│   ├── GeminiParserService.ts   # Gemini implementation of the provider interface
│   ├── OpenRouterParserService.ts # OpenRouter implementation of the provider interface
│   ├── GeminiModelCatalog.ts    # Static list of selectable Gemini models
│   ├── OpenRouterModelCatalog.ts # Fetches free OpenRouter models (vision-aware)
│   ├── VoiceService.ts          # Web Speech API wrapper (STT + TTS)
│   ├── AnalyticsService.ts      # GA4 (gtag.js) wrapper
│   └── SentryLogger.ts          # Sentry error/debug capture wrapper
│
└── presentation/       # React only — views, hooks, components. No SQL, no business rules.
    ├── context/BudgetContext.tsx      # Instantiates BudgetService, manages auth/session, exposes app context (useBudget)
    ├── hooks/useBagiAI.ts            # Voice + chat + image hook: record/type → parse with active AI provider → confirm transaction
    ├── views/                        # Login, Home, Dashboard, Transactions, Intelligence, Analytics, MoreView, Settings
    ├── components/                   # SmartAlertPanel, TransactionConfirmForm, BagiActionModal, ApiKeyModal, AlertModal, PromptModal, etc.
    └── utils/                        # Pure formatting helpers (format.ts, currencies.ts)
```

### Non-negotiable dependency rule

```
presentation → application → infrastructure → domain
                  ↓
              services/  (may reach into infrastructure for DB access, never into presentation)
```

- **SQL lives only in `src/infrastructure/adapters/SqliteAdapter.ts`** (and equivalent infra files). No SQL anywhere else.
- **No new business logic in `.tsx` components.** In practice, views get `service` (the `BudgetService` instance) from `useBudget()` and call it directly — there are no per-feature hooks/services like `useTransactions`/`TransactionService`; that's the accepted pattern. New budget/balance math goes into `BudgetService` (see existing helpers such as `getIncomeAllocation`, `getBudgetBarSegments`, `getPlanDistribution`, `getCategoryLimitEdit`); pure display formatting can go in `presentation/utils/`.
- Several views (especially `Dashboard.tsx` and `Home.tsx`) still contain legacy inline calculations. Don't move them as a side effect of an unrelated task; only extract them when a task requires changing that logic.
- `domain/` stays framework-agnostic: no React, no SQL, no external APIs.
- Any schema change (tables/columns/indexes) **must** be accompanied by an update to `docs/DATABASE_SCHEMA.md` in the same change, including the `ALTER TABLE`/migration delta.

### Planning requirement for larger changes

For changes spanning multiple layers, SQLite schema changes, new features/refactors, or infrastructure changes (adapters, services, Google Drive), stop and produce an `implementation_plan.md` and get explicit user approval before touching code. Trivial fixes, typos, and minor UI tweaks can be applied directly.

**Exception — UI/UX roadmap:** tasks listed in `roadmap/UX_UI_IMPROVEMENTS.md` are already approved. If a task only touches `src/presentation/`, `src/index.css`, `index.html` or styles (copy, Tailwind classes, layout, accessibility attributes, new purely visual components), apply it directly even if it spans several files. Only write a plan first if the task needs changes outside presentation (e.g. new `BudgetService` methods, context/sync behavior).

## UI/UX work

- Backlog: `roadmap/UX_UI_IMPROVEMENTS.md`. Work one task ID at a time (e.g. `T1`), and mark it `[x]` in that file when done. If a task turns out to need a different approach, update its text there.
- Goal of the redesign: simple to use, little text. Prefer removing words over adding them; no explanatory paragraphs in the UI; sentence case instead of `uppercase tracking-widest` labels.
- Styling is **Tailwind CSS v4** via `@tailwindcss/postcss` and `@import "tailwindcss"` in `src/index.css`. `tailwind.config.js` is a v3-style file that v4 **ignores** (no `@config` directive) — define shared design tokens (colors, font sizes, radii) with `@theme` in `src/index.css`, not in the JS config.
- Icons: use `lucide-react` (already a dependency) for new/edited icons instead of inline `<svg>` paths.
- The app's UI language is Spanish (`es`); keep all user-facing copy in Spanish.
- The app has a demo mode (Login → "Probar en modo demo") with seeded data; it is the user's way of checking UI changes without a Google account.

## Key subsystems

**Google Drive sync** (`BudgetService` + `GoogleDriveAdapter`): mutations write to the in-memory SQLite DB immediately, then a debounced `syncToDrive()` fires after an 8s timeout (`SYNC_INTERVAL`). Before uploading, it checks the Drive file's `modifiedTime` against `lastKnownRemoteTime`; on mismatch (edited from another device), Drive always wins — local unsynced changes are discarded, the DB is reloaded from the remote blob, and the page reloads. Auth token lives in `localStorage` under `bagi_google_token`; a 401/403 throws `AUTH_ERROR`, handled by `BudgetContext` to force logout.

**Bagi AI (voice, chat and receipt images)**: `useBagiAI` → `VoiceService` (Web Speech API STT, optional TTS replies) or typed text / image → `AIProviderFactory.getActiveAIProvider()` picks `GeminiParserService` or `OpenRouterParserService` (same interface, prompt from `AIPromptBuilder`, retries/fallback model via `AIHttpRetry`) → `mapGeminiOutput()` in `useBagiAI` (name is historical; it is provider-agnostic) fuzzy-matches hints to local DB IDs → `TransactionConfirmForm` inside `BagiActionModal` for user confirmation → `BudgetService.addTransaction()`. The active provider is stored in `localStorage` (`bagi_ai_provider`), each provider has its own user-provided key (`bagi_gemini_api_key` / `bagi_openrouter_api_key`) and primary/fallback models (`bagi_<provider>_model_primary` / `_fallback`), all configured in Settings → "Bagi IA". Keys are never env vars. See `docs/ARCHITECTURE.md` for details.

**Smart Alert Engine** (`AlertEngine.ts`, orchestrated from `Intelligence.tsx` and `SmartAlertPanel`): an async generator chaining 8 independent detectors (`DUPLICATE`, `TREND`, `ANOMALY`, `OVERDUE`, `OPPORTUNITY`, `PATTERN` alert types). Duplicate detection needs the ONNX embedding model (`all-MiniLM-L6-v2`, 384-dim L2-normalized vectors, generated in `EmbeddingWorker.ts` off the main thread) and flags matches with amount diff < $0.01, within a 72h window, and cosine similarity ≥ 0.88. Alert scoring uses an online logistic regression (`AlertScorer.ts`) trained from `alert_feedback`.

**Environment variables** (`VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `VITE_GA_MEASUREMENT_ID`, `VITE_SENTRY_DSN`) configure Google OAuth/Drive, GA4 and Sentry — see `.env.example`. AI provider keys are end-user-provided via the Settings UI, not env vars.

## Naming conventions

| Kind | Pattern | Example |
|---|---|---|
| Presentation hook | `useX` | `useBudget`, `useBagiAI` |
| Application service | `XService` | `BudgetService` |
| Infrastructure adapter | `XAdapter` | `SqliteAdapter`, `GoogleDriveAdapter` |
| Domain entity | `IX` interface | `ITransaction`, `IBudget` |
| View | `X.tsx` in `presentation/views/` | `Dashboard.tsx` |
| Component | `X.tsx` in `presentation/components/` | `AlertModal.tsx` |

## Reference docs

Consult before non-trivial changes in the relevant area:
- `docs/ARCHITECTURE.md` — full architecture reference
- `docs/DATABASE_SCHEMA.md` — SQLite schema and business rules (keep in sync with any schema change)
- `docs/SMART_ALERTS_ENGINE.md` — AI alert engine details
- `docs/code_skeleton.md` — ctags-generated map of classes/functions/interfaces; regenerate with `npm run code:map` after adding/moving/renaming modules or symbols (pure copy/class changes don't need it)
- `roadmap/UX_UI_IMPROVEMENTS.md` — UI/UX backlog with status

## What not to do

- Don't introduce a backend, REST API, or server-side database (no Express, Prisma, etc.).
- Don't write SQL outside `infrastructure/`.
- Don't put new business logic in presentation components.
- Don't skip updating `docs/DATABASE_SCHEMA.md` when the schema changes.
- Don't run functional tests on the user's behalf.
