# Reglas del Agente — Proyecto Bagi

## Idioma

- **Responde siempre en español**, incluso si el usuario escribe en inglés.
- El código fuente (nombres de variables, funciones, comentarios inline) debe mantenerse en **inglés** como convención del proyecto.

---

## Estilo de Respuesta

- Respuestas **balanceadas**: resumen claro + detalles clave cuando sea necesario.
- No sobreexpliques lo obvio. Si un cambio es directo, documenta la decisión no el código.
- Usa siempre **links clickeables** a archivos y símbolos con el formato `[nombre](file:///ruta/absoluta)`.

---

## Flujo de Trabajo con el Código

### Cambios Grandes → Plan Primero
Para cualquier cambio que implique:
- Múltiples archivos o capas de la arquitectura
- Modificaciones al schema de SQLite
- Nuevas features o refactors
- Cambios que afecten infraestructura (adapters, servicios, Google Drive)

**Detente, crea un `implementation_plan.md` y espera aprobación explícita del usuario antes de tocar código.**

### Cambios Pequeños → Aplicar Directamente
Fixes triviales, typos, ajustes de UI menores, o correcciones de una sola línea pueden aplicarse sin plan previo.

---

## Pruebas y Verificación

- **No ejecutes pruebas funcionales de la app.** El usuario las realiza manualmente.
- Puedes proponer un `Verification Plan` en los planes de implementación, pero **no lo ejecutes tú mismo**.
- Si el código compila y no hay errores de lint/TS, tu trabajo está listo.

---

## Arquitectura — Reglas Estrictas de Bagi

Bagi usa **Clean Architecture** de forma estricta. Estas reglas son **no negociables** y aplican siempre:

### 1. Capas y Dependencias

```
domain/ ← infrastructure/ ← application/ ← presentation/
```

- Las capas **solo dependen hacia adentro** (presentación puede importar aplicación, nunca al revés).
- `domain/` no importa nada externo, solo utilidades puras y TypeScript nativo.
- `infrastructure/` interactúa con el mundo real (SQL, Google Drive, WASM, Workers).
- `application/` orquesta reglas de negocio usando entidades del dominio e inyección de adaptadores.
- `presentation/` es React puro. Hooks de estado, Views y componentes visuales.

### 2. SQL — Solo en SqliteAdapter

- **Nunca escribas sentencias SQL fuera de** `src/infrastructure/adapters/SqliteAdapter.ts`.
- Toda consulta, inserción, migración o DDL va exclusivamente en ese archivo o en archivos de infraestructura equivalentes.

### 3. Lógica de Negocio — Nunca en Componentes React

- Un componente React **no calcula reglas de negocio**. Delega en un Hook (`useX`), que a su vez llama a un Service o Use Case en `application/`.
- Ejemplo correcto: `useTransactions` → `TransactionService` → `SqliteAdapter`.
- Ejemplo incorrecto: cálculos de saldo o presupuesto directamente en un `.tsx`.

### 4. Schema de SQLite — Documentar Siempre

- Si se modifica el schema (tablas, columnas, índices), **actualizar obligatoriamente** `docs/DATABASE_SCHEMA.md` en el mismo PR/commit.
- Nunca proponer migraciones sin incluir el delta de documentación.

---

## Archivos Clave del Proyecto

| Archivo | Propósito |
|---|---|
| `docs/ARCHITECTURE.md` | Referencia de la arquitectura general |
| `docs/DATABASE_SCHEMA.md` | Schema SQLite y reglas de negocio de BD |
| `docs/SMART_ALERTS_ENGINE.md` | Motor de alertas AI con WebAssembly/ONNX |
| `src/infrastructure/adapters/SqliteAdapter.ts` | Único punto de acceso a SQLite |
| `src/application/use-cases/BudgetService.ts` | Orquestación de presupuestos |

---

## Stack Tecnológico

- **Framework:** React + Vite + TypeScript
- **BD:** SQLite en memoria (`sql.js` via WASM) — sin backend
- **Nube:** Google Drive como único storage externo
- **AI Offline:** HuggingFace Transformers + ONNX via WebAssembly
- **Estilos:** TailwindCSS
- **Deploy:** Netlify (estático)

---

## Qué NO hacer

- ❌ Proponer backends, APIs REST, o bases de datos en servidor.
- ❌ Agregar dependencias de servidor (Express, Prisma, etc.).
- ❌ Ejecutar pruebas funcionales en nombre del usuario.
- ❌ Omitir actualizar `DATABASE_SCHEMA.md` al cambiar el schema.
- ❌ Escribir SQL en archivos fuera de `infrastructure/`.
- ❌ Mezclar lógica de negocio en componentes de presentación.
- ❌ Responder en inglés.
