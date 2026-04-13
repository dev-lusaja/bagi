# Arquitectura del Sistema Bagi

La aplicación de Bagi se caracteriza fuertemente por adoptar un paradigma moderno **Local-First**, prescindiendo completamente de microservicios o backends API REST para la ejecución de sus reglas de negocio. Esto se conjuga a través de **Clean Architecture** (Arquitectura Limpia).

A continuación se detalla cómo organizamos los archivos para mantener desacoplada la presentación de las reglas de base de datos.

## Estructura de "Clean Architecture"

El árbol de directorios de src está dividido estrictamente con las siguientes capas de dominio:

### 1. Dominio (`src/domain/`)
Es la capa más interna. Sólo contiene interfaces y entidades agnósticas (no importa si se corre en Frontend o en NodeJS, aquí no deben existir tags HTML ni referenciarse a librerías externas complejas salvo utilerías puras).

### 2. Infraestructura (`src/infrastructure/`)
Donde Bagi interactúa con el "mundo real" y los I/O.
> **Referencia:** El archivo [`SqliteAdapter.ts`](../src/infrastructure/adapters/SqliteAdapter.ts) encapsula el uso de WASM y `sql.js`. En lugar de tener sentencias SQL regadas por componentes React, esta capa centraliza y abstrae todos los accesos con DDL y migraciones.

### 3. Aplicación (`src/application/`)
Agrupa las orquestaciones de reglas de negocio en base a entidades del dominio, inyectando o recibiendo adaptadores de infraestructura.
> **Referencia:** El archivo [`BudgetService.ts`](../src/application/use-cases/BudgetService.ts) manipula las operaciones de obtención, borrado e inserción consolidada de todos tus presupuestos. Excluye por diseño cualquier estado de "React" puro.

### 4. Presentación (`src/presentation/`)
Las carpetas de UI. React puro. Contiene los Hooks de estado, los Views (`pages`) y los `components` menores. Un Hook `useX` suele invocar a un Service/Use Case, no consultar SQL directo.

---

## Estrategia de Sincronización "Atom-State" (Google Drive)

Dado que `sql.js` no provee una sincronización directa estilo Firebase, se desarrolló un sistema para garantizar el uso multi-dispositivo sin perder datos:

1. El usuario modifica datos localmente (Ej. Agrega una Gasto).
2. `BudgetService` llama a la capa de persistencia `SqliteAdapter`, inserta tu registro en tu WASM de la RAM.
3. El frontend de React, mediante el hook principal de inicialización o una opción explícita dispara la acción **"Guardar"**.
4. Al solicitar "Guardar", el servicio extrae el Blob (Binario en crudo de la SQLite). Antes de subirlo, **Bagi realiza un chequeo de concurrencia optimista** (confronta tu `lastKnownRemoteTime` local contra el `modifiedTime` actual del archivo en Drive usando `GoogleDriveAdapter.getFileModifiedTime`).
    - **Si coinciden**: El archivo se sobrescribe exitosamente en la nube.
    - **Si el archivo en la nube es más nuevo**: La app rechaza tu guardado (throw de conflicto) para evitar que aplastes transacciones que tú hiciste en otro dispositivo.
5. Cuando abres la app desde otro dispositivo (ej. tu teléfono), el **proceso de inicialización de la app (`BudgetService.init`)** detecta tu sesión, descarga este Blob íntegro y su nuevo timestamp de manera automática en el fondo, y lo inyecta en la memoria local (`SqliteAdapter.initDb(buffer)`) sin que tengas que pulsar ningún botón.

---

## Servicios Compartidos (Services)

En `/src/services` hemos concentrado lógica pesada que puede y debe utilizar Multithreading o matemáticas que rompan las convenciones clásicas debido a sus requerimientos de CPU, como es el caso de la Inteligencia Artificial de alertas, que detallamos en su propio documento a continuación.
