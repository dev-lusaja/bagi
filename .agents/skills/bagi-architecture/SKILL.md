---
name: bagi-architecture
description: >
  Contexto profundo de la arquitectura y convenciones de Bagi.
  Actívalo cuando vayas a crear, modificar o revisar cualquier
  archivo del proyecto: nuevas features, refactors, corrección de bugs,
  modificaciones al schema, o cambios en la lógica de negocio.
  También actívalo al proponer planes de implementación.
---

# Skill: Bagi Architecture

## Contexto del Proyecto

Bagi es una app de **finanzas personales local-first** construida con React + Vite + TypeScript.
No tiene backend. Toda la lógica corre en el navegador. Los datos viven en una SQLite en memoria (`sql.js` via WASM) y se sincronizan con Google Drive como único storage externo, ademas permite utilizar capacidades de voz mediante speechText y Gemini de google mediante una apikey que el usuario debe configurar.

---

## Capas de Clean Architecture

```
src/
├── domain/          # Entidades, interfaces, tipos puros. Sin dependencias externas.
├── infrastructure/  # Adapters: SQLite (WASM), Google Drive API, Workers.
├── application/     # Use Cases y Services. Orquestan domain + infrastructure.
├── presentation/    # React: Views, Hooks, Components. Solo UI y estado local.
└── services/        # Lógica pesada: AI (ONNX/WebAssembly), multithreading.
```

### Regla de dependencias (ESTRICTA)

```
presentation → application → infrastructure → domain
```

- Nunca una capa interna importa de una externa.
- `domain/` es completamente agnóstico (sin React, sin SQL, sin APIs).

---

## Reglas de Implementación

### SQL
- **Todo SQL va en** `src/infrastructure/adapters/SqliteAdapter.ts`.
- Ningún otro archivo escribe SQL directo.
- Las migraciones son auto-aplicadas al inicializar `BudgetService.init()`.

### Lógica de Negocio
- Los componentes React **solo consumen hooks**.
- Los hooks llaman a **Services/Use Cases** de `application/`.
- Los Services llaman a **Adapters** de `infrastructure/`.

### Schema de Base de Datos
- Toda modificación al schema (tablas, columnas, índices) **requiere actualizar** `docs/DATABASE_SCHEMA.md`.
- Incluir siempre el bloque `ALTER TABLE` o la migración correspondiente.

---

## Archivos de Referencia Obligatoria

Antes de proponer cambios, revisa el archivo más relevante:

| Situación | Archivo a leer |
|---|---|
| Cambios al schema de BD | `docs/DATABASE_SCHEMA.md` |
| Nueva feature o refactor | `docs/ARCHITECTURE.md` |
| Motor de AI o alertas | `docs/SMART_ALERTS_ENGINE.md` |
| Nueva capa de datos | `src/infrastructure/adapters/SqliteAdapter.ts` |
| Nueva regla de negocio | `src/application/use-cases/BudgetService.ts` |

---

## Checklist antes de Proponer Código

- [ ] ¿La nueva lógica está en la capa correcta?
- [ ] ¿Hay SQL fuera de `SqliteAdapter.ts`? (Si sí, moverlo)
- [ ] ¿Hay lógica de negocio en un `.tsx`? (Si sí, extraerla a un Service)
- [ ] ¿Se modifica el schema? → Actualizar `DATABASE_SCHEMA.md`
- [ ] ¿La feature requiere un plan de implementación? → Crear `implementation_plan.md`

---

## Convenciones de Nombres

| Tipo | Patrón | Ejemplo |
|---|---|---|
| Hook de presentación | `useNombre` | `useDashboard`, `useTransactions` |
| Service de aplicación | `NombreService` | `BudgetService`, `TransactionService` |
| Adapter de infraestructura | `NombreAdapter` | `SqliteAdapter`, `GoogleDriveAdapter` |
| Entidad de dominio | `INombre` (interface) | `ITransaction`, `IBudget` |
| Vista/Page | `Nombre.tsx` en `presentation/views/` | `Dashboard.tsx`, `Home.tsx` |
| Componente | `Nombre.tsx` en `presentation/components/` | `AccountCard.tsx` |
