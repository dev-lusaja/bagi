# Mejoras UX/UI

Revisión de `src/presentation` (desktop + móvil) del 2026-10-26. Objetivo: que la app sea simple de usar y no esté cargada de textos.

Cada tarea es independiente. Esfuerzo: **(S)** rápido · **(M)** unas horas. Marca `[x]` al completar.

## Orden sugerido (más impacto, menos esfuerzo)

1. T1 + T2 + T10 (menos texto)
2. R1 (presupuesto primero en móvil)
3. A1 (bug de alineación en Obligaciones)
4. C1 + C4 (color por concepto y contraste)
5. F1 + F2 (sin aviso que tapa la pantalla ni modal de éxito)
6. T9 (glosario único)

---

## 1. Textos

- [x] **T1 (S): Quitar los subtítulos de cabecera de cada vista.** El título basta.
  - `views/Home.tsx:175`, `views/Dashboard.tsx:734`, `views/Transactions.tsx:195`, `views/MoreView.tsx:14`, `views/Analytics.tsx:162`, `views/Settings.tsx:368`, `views/Intelligence.tsx:187`
- [x] **T2 (S): Quitar los `<h3>` que repiten el nombre de la pestaña en Presupuesto.**
  - `views/Dashboard.tsx:873`, `:897`, `:1036`, `:1148`
- [x] **T3 (M): Reducir "Análisis del Desvío" a una frase y una acción.**
  - Ejemplo: *"Te pasaste S/ 120, sobre todo en Comida."* + botón "Ajustar límites".
  - Quitar la etiqueta "Plan vs Realidad" y los paréntesis en los nombres ("Consumo Variable (Límites)" → "Categorías").
  - `components/BudgetDiagnosticWidget.tsx`
- [ ] **T4 (S): Resumir el banner "Acción Requerida: Configuración Pendiente" en una línea.**
  - Ejemplo: *"Sin límite: Comida, Ocio"* + botón "Asignar".
  - `views/Dashboard.tsx:791-814`
- [x] **T5 (S): Quitar los párrafos introductorios de las secciones de Configuración.**
  - `views/Settings.tsx:462`, `:509`, `:588`, `:871` y el de Categorías. La nota bajo el selector de proveedor ("Cambiar este selector solo te deja ver/editar…") se quita en F4.
- [x] **T6 (S): Convertir "Más opciones" en una lista simple** (ícono + nombre + flecha, sin descripciones). "Analítica Comparativa" → "Analítica".
  - `views/MoreView.tsx`
- [x] **T7 (S): Quitar el lenguaje "Mes A / Mes B" de Analítica.** Usar "Mes" y "Comparar con" en una sola fila; quitar "Selección de Periodos a Comparar". ("Mes" en vez de "Este mes" porque el primer periodo también es editable.)
  - `views/Analytics.tsx:187-248`
- [x] **T8 (M): Reescribir el Login para un usuario no técnico.**
  - Botón "Google Drive / CONECTAR NUBE SEGURA" → "Continuar con Google".
  - Quitar las 3 mini-tarjetas en 9px dentro de la tarjeta de login.
  - Quitar jerga de las secciones de abajo ("WebAssembly", "open-source", "API Key"); acortar el párrafo de `:278`.
  - `views/Login.tsx:75-168`
- [x] **T9 (M): Unificar el vocabulario en toda la app.**
  - [x] Navegación: desktop "Presupuesto"/"Transacciones" vs móvil "Resumen"/"Registro" (`App.tsx:206-215`) → un solo nombre: "Presupuesto" y "Movimientos" (también en títulos y textos: "transacción" → "movimiento").
  - [x] "Saldo Libre" / "Por gastar" / "Disp:" → "Disponible".
  - [x] Tarjetas: "Reserva" vs "Asignar Límite" (`views/Dashboard.tsx:1196` vs `:1217`) → un solo término: "Reserva".
  - [x] "REGISTRAR PAGO" / "Realizar Abono" / "OBLIGACIÓN CUBIERTA" / "Pagado Real" → "Pagar" → "Pagado".
  - [x] "Google Account" (`App.tsx:156`) → "Cuenta de Google".
  - [x] Reemplazar "Ejecución", "fallback", "Independiente" por lenguaje simple.
- [x] **T10 (M): Etiquetas en minúscula normal.** Eliminar `uppercase tracking-widest` en etiquetas, botones y chips (~150 usos; la mayoría en `views/Dashboard.tsx` y `views/Settings.tsx`).

## 2. Colores

- [x] **C1 (S): Un color fijo por concepto, definido en una constante compartida.** `presentation/utils/conceptColors.ts`: Categorías azul, Obligaciones teal, Tarjetas morado.
  - Hoy: Obligaciones ámbar en Planificación (`views/Dashboard.tsx:676`) pero verde-teal en Diagnóstico y verde en Configuración; Tarjetas morado vs rosa; Categorías azul vs índigo-morado.
- [x] **C2 (M): Reducir la paleta** a indigo (principal) + verde/ámbar/rojo (estado) + grises.
  - Verde = `emerald`, rojo = `rose` (ya eran los más usados). Los colores por concepto de C1 (azul/teal/morado) se mantienen como excepción.
  - Quitar el texto con degradado de todos los `<h2>` de vista.
  - Quitar los degradados de las barras del Diagnóstico.
- [x] **C3 (S): Usar el rojo solo para errores y gastos.**
  - El tipo "Gasto" se queda en rojo (`rose`) en toda la app, aunque comparta color con los errores. Ingreso verde, Transferencia gris.
  - Analítica: indigo-500 vs purple-500 casi no se distinguen (`views/Analytics.tsx:388-389`) → indigo vs gris.
  - También a gris: "Cerrar sesión" y las etiquetas de fecha de fin de obligaciones. Los botones de borrar siguen en rojo (acción destructiva).
- [x] **C4 (S): Corregir el contraste.** Como mínimo `gray-500` para todo texto con significado.
  - `text-gray-400` sobre blanco ≈ 2.5:1 (falla WCAG AA).
  - `text-gray-200/300` en "Otras Tarjetas" (`views/Home.tsx:211`) y estados vacíos.
  - También: errores en `rose-600` y etiquetas/enlaces `indigo-400/500` → `indigo-600` o `gray-500`. Íconos decorativos y placeholders siguen en `gray-400`; los botones de solo ícono quedan para R3.
- [x] **C5 (S): Dejar animaciones solo para alertas reales** y respetar `prefers-reduced-motion`.
  - Decisión: solo se animan el corazón del login y el robot del chat de Bagi IA. Se mantienen los spinners de carga (`animate-spin`) porque indican progreso. Regla global de `prefers-reduced-motion` en `src/index.css`.
  - `animate-ping` permanente en el estado de IA (`views/Intelligence.tsx:211`).
  - Pulse en el ícono de Bagi IA, banner demo, corazón del login, flecha "›" de pestañas.
  - Bounce en el bot y el logo de carga.

## 3. Alineación y layout

- [x] **A1 (S): Bug de alineación en las tarjetas de Obligaciones.** La fila superior tiene 3 hijos en un `justify-between` y el ojo queda en el centro; envolver los dos botones en un `div`.
  - `views/Dashboard.tsx:1046-1073`
- [x] **A2 (M): Simplificar la tarjeta de categoría.** Nombre + %, barra, *"S/ 120 de S/ 300"*; la tarjeta abre el detalle. Editar y borrar quedan juntos arriba a la derecha (40×40, mismo tamaño que Cancelar/Guardar en modo edición).
  - `views/Dashboard.tsx:926-1027`
- [ ] **A3 (M): Escala tipográfica corta:** 12 / 14 / 16 / 20 / 28px, mínimo 12px (hoy llega a 8px). `font-black` solo en cifras principales.
- [ ] **A4 (S): Crear un componente `PageHeader` común** (título a la izquierda, controles a la derecha, mismo espaciado).
- [ ] **A5 (S): Mismo orden mes/año en toda la app** (mes primero). Hoy Presupuesto muestra "2026 | Octubre".
  - `views/Dashboard.tsx:739-755`
- [x] **A6 (S): Reducir los bordes redondeados** de 10 variantes a 3 (controles, tarjetas, modales). Tokens en `@theme` (`src/index.css`): `rounded-control` 12px, `rounded-card` 24px, `rounded-modal` 32px; `rounded-full` solo para píldoras, puntos y barras.
- [x] **A7 (S): Tarjeta de cuenta en Inicio** siempre alineada a la izquierda y clickeable entera (en vez del enlace suelto "Ver presupuesto").
  - `views/Home.tsx:81-146`

## 4. Responsive (móvil)

- [ ] **R1 (S): Mostrar primero la tarjeta "Presupuesto mensual" en móvil y tablet** (`order-first xl:order-none`; la vista pasa a 3 columnas desde `xl`).
  - `views/Dashboard.tsx:778` y `:1266`
- [x] **R2 (S): Pestañas de Presupuesto con nombres cortos:** "Resumen", "Categorías", "Pagos fijos", "Tarjetas" (sin scroll horizontal ni flecha parpadeante).
- [x] **R3 (S): Hacer visibles los botones de borrar en pantallas táctiles** (hoy `text-gray-200` + `group-hover`).
  - Mismo estilo que el borrar de la tarjeta de categoría (A2): 40×40, `bg-gray-100 text-gray-500`, rojo al pasar el cursor. También los botones de editar junto a ellos (tarjetas y pagos fijos en Configuración). Además: ver/borrar en Pagos fijos y borrar reserva de tarjeta; todos los `<svg>` inline de `presentation/` pasados a `lucide-react` con grosor por defecto (sin `strokeWidth` propio).
  - `views/Dashboard.tsx:962`, `views/Settings.tsx:447`, `:493`, `:555`
- [x] **R4 (S): Permitir el zoom y corregir el idioma.** Quitar `maximum-scale=1, user-scalable=0`; `lang="en"` → `"es"`.
  - `index.html:2-6`
- [ ] **R5 (S): Modal de detalle de categoría como lista en móvil** (hoy tabla de 4 columnas con `p-8`).
  - `views/Dashboard.tsx:1600-1667`
- [x] **R6 (M): Chat de Bagi IA a pantalla completa** con el campo de texto fijo sobre la barra inferior.
  - `views/Intelligence.tsx:206-250`

## 5. Flujo e interacción

- [ ] **F1 (M): Cambiar el aviso de sincronización a pantalla completa por un ícono de nube en la cabecera** (también en móvil, que hoy no tiene indicador).
  - `components/SavingOverlay.tsx`
- [ ] **F2 (S): Toast en vez del modal "¡Movimiento registrado!"** tras guardar una transacción.
  - `views/Transactions.tsx:519-526`
- [ ] **F3 (M): Formulario de transacción más corto.** "Período Presupuestario" detrás de "Más opciones"; no dejarlo siempre abierto en desktop; opcional botón flotante "+" en móvil.
  - `views/Transactions.tsx:203-300`
- [ ] **F4 (M): Un solo selector de "Proveedor de IA"** que se active directamente si ya tiene clave guardada.
  - Al hacerlo, quitar la nota bajo el selector que explica que cambiarlo no lo activa (pendiente de T5).
  - `views/Settings.tsx:874-907`
- [ ] **F5 (S): Quitar el selector de idioma con una sola opción.**
  - `views/Intelligence.tsx:235-245`

## 6. Detalles y bugs visuales

- [ ] **D1 (S): Usar la moneda de la cuenta en lugar de `'$0.00'` fijo.**
  - `views/Dashboard.tsx:1003`
- [ ] **D2 (S): Generar los años de los selectores a partir del año actual** (hoy 2024–2030, 2025–2030 y 2025–2028).
  - `views/Dashboard.tsx:744`, `views/Analytics.tsx` (constante `YEARS`), `views/Settings.tsx:645`, `:674`, `:716`, `:792`
- [ ] **D3 (S): Mostrar nombres de meses en los selectores de obligaciones** (hoy 1–12).
  - `views/Settings.tsx:639`, `:668`, `:710`, `:785`
- [ ] **D4 (S): El error genérico debe nombrar el proveedor activo** (hoy dice "Gemini" siempre).
  - `views/Intelligence.tsx:516`
- [ ] **D5 (S): Botones "Cancelar"/"Guardar" en vez de "X"/"OK" al editar.**
  - `views/Settings.tsx:565-566`, `:800`
- [ ] **D6 (M): Accesibilidad básica.**
  - [ ] `aria-label` en botones de solo ícono (enviar, adjuntar, cerrar modal, ojo, borrar).
  - [ ] `htmlFor` en las etiquetas de formularios.
  - [ ] Estilo `focus-visible` consistente.
- [ ] **D7 (S): Borrar `src/App.css`** (plantilla de Vite sin uso).
