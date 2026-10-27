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

- [ ] **T1 (S): Quitar los subtítulos de cabecera de cada vista.** El título basta.
  - `views/Home.tsx:175`, `views/Dashboard.tsx:734`, `views/Transactions.tsx:195`, `views/MoreView.tsx:14`, `views/Analytics.tsx:162`, `views/Settings.tsx:368`, `views/Intelligence.tsx:187`
- [ ] **T2 (S): Quitar los `<h3>` que repiten el nombre de la pestaña en Presupuesto.**
  - `views/Dashboard.tsx:873`, `:897`, `:1036`, `:1148`
- [ ] **T3 (M): Reducir "Análisis del Desvío" a una frase y una acción.**
  - Ejemplo: *"Te pasaste S/ 120, sobre todo en Comida."* + botón "Ajustar límites".
  - Quitar la etiqueta "Plan vs Realidad" y los paréntesis en los nombres ("Consumo Variable (Límites)" → "Categorías").
  - `components/BudgetDiagnosticWidget.tsx`
- [ ] **T4 (S): Resumir el banner "Acción Requerida: Configuración Pendiente" en una línea.**
  - Ejemplo: *"Sin límite: Comida, Ocio"* + botón "Asignar".
  - `views/Dashboard.tsx:791-814`
- [ ] **T5 (S): Quitar los párrafos introductorios de las secciones de Configuración.**
  - `views/Settings.tsx:462`, `:509`, `:588`, `:871`, `:905` (este último depende de F4)
- [ ] **T6 (S): Convertir "Más opciones" en una lista simple** (ícono + nombre + flecha, sin descripciones). "Analítica Comparativa" → "Analítica".
  - `views/MoreView.tsx`
- [ ] **T7 (S): Quitar el lenguaje "Mes A / Mes B" de Analítica.** Usar "Este mes" y "Comparar con" en una sola fila; quitar "Selección de Periodos a Comparar".
  - `views/Analytics.tsx:187-248`
- [ ] **T8 (M): Reescribir el Login para un usuario no técnico.**
  - Botón "Google Drive / CONECTAR NUBE SEGURA" → "Continuar con Google".
  - Quitar las 3 mini-tarjetas en 9px dentro de la tarjeta de login.
  - Quitar jerga de las secciones de abajo ("WebAssembly", "open-source", "API Key"); acortar el párrafo de `:278`.
  - `views/Login.tsx:75-168`
- [ ] **T9 (M): Unificar el vocabulario en toda la app.**
  - [ ] Navegación: desktop "Presupuesto"/"Transacciones" vs móvil "Resumen"/"Registro" (`App.tsx:206-215`) → un solo nombre.
  - [ ] "Saldo Libre" / "Por gastar" / "Disp:" → "Disponible".
  - [ ] Tarjetas: "Reserva" vs "Asignar Límite" (`views/Dashboard.tsx:1196` vs `:1217`) → un solo término.
  - [ ] "REGISTRAR PAGO" / "Realizar Abono" / "OBLIGACIÓN CUBIERTA" / "Pagado Real" → "Pagar" → "Pagado".
  - [ ] "Google Account" (`App.tsx:156`) → "Cuenta de Google".
  - [ ] Reemplazar "Ejecución", "fallback", "Independiente" por lenguaje simple.
- [ ] **T10 (M): Etiquetas en minúscula normal.** Eliminar `uppercase tracking-widest` en etiquetas, botones y chips (~150 usos; la mayoría en `views/Dashboard.tsx` y `views/Settings.tsx`).

## 2. Colores

- [ ] **C1 (S): Un color fijo por concepto, definido en una constante compartida.**
  - Hoy: Obligaciones ámbar en Planificación (`views/Dashboard.tsx:676`) pero verde-teal en Diagnóstico y verde en Configuración; Tarjetas morado vs rosa; Categorías azul vs índigo-morado.
- [ ] **C2 (M): Reducir la paleta** a indigo (principal) + verde/ámbar/rojo (estado) + grises.
  - Quitar el texto con degradado de todos los `<h2>` de vista.
  - Quitar los degradados de las barras del Diagnóstico.
- [ ] **C3 (S): Usar el rojo solo para errores.**
  - Tipo "Gasto" en rojo en Configuración (`views/Settings.tsx:440-444`) → gris.
  - Analítica: indigo-500 vs purple-500 casi no se distinguen (`views/Analytics.tsx:388-389`) → indigo vs gris.
- [ ] **C4 (S): Corregir el contraste.** Como mínimo `gray-500` para todo texto con significado.
  - `text-gray-400` sobre blanco ≈ 2.5:1 (falla WCAG AA).
  - `text-gray-200/300` en "Otras Tarjetas" (`views/Home.tsx:211`) y estados vacíos.
- [ ] **C5 (S): Dejar animaciones solo para alertas reales** y respetar `prefers-reduced-motion`.
  - `animate-ping` permanente en el estado de IA (`views/Intelligence.tsx:211`).
  - Pulse en el ícono de Bagi IA, banner demo, corazón del login, flecha "›" de pestañas.
  - Bounce en el bot y el logo de carga.

## 3. Alineación y layout

- [ ] **A1 (S): Bug de alineación en las tarjetas de Obligaciones.** La fila superior tiene 3 hijos en un `justify-between` y el ojo queda en el centro; envolver los dos botones en un `div`.
  - `views/Dashboard.tsx:1046-1073`
- [ ] **A2 (M): Simplificar la tarjeta de categoría.** Nombre + %, barra, *"S/ 120 de S/ 300"*; la tarjeta abre el detalle; borrar pasa al modo edición.
  - `views/Dashboard.tsx:926-1027`
- [ ] **A3 (M): Escala tipográfica corta:** 12 / 14 / 16 / 20 / 28px, mínimo 12px (hoy llega a 8px). `font-black` solo en cifras principales.
- [ ] **A4 (S): Crear un componente `PageHeader` común** (título a la izquierda, controles a la derecha, mismo espaciado).
- [ ] **A5 (S): Mismo orden mes/año en toda la app** (mes primero). Hoy Presupuesto muestra "2026 | Octubre".
  - `views/Dashboard.tsx:739-755`
- [ ] **A6 (S): Reducir los bordes redondeados** de 10 variantes a 3 (controles, tarjetas, modales).
- [ ] **A7 (S): Tarjeta de cuenta en Inicio** siempre alineada a la izquierda y clickeable entera (en vez del enlace suelto "Ver presupuesto").
  - `views/Home.tsx:81-146`

## 4. Responsive (móvil)

- [ ] **R1 (S): Mostrar primero la tarjeta "Presupuesto mensual" en móvil** (`order-first md:order-none`).
  - `views/Dashboard.tsx:778` y `:1266`
- [ ] **R2 (S): Pestañas de Presupuesto con nombres cortos:** "Resumen", "Categorías", "Pagos fijos", "Tarjetas" (sin scroll horizontal ni flecha parpadeante).
- [ ] **R3 (S): Hacer visibles los botones de borrar en pantallas táctiles** (hoy `text-gray-200` + `group-hover`).
  - `views/Dashboard.tsx:962`, `views/Settings.tsx:447`, `:493`, `:555`
- [ ] **R4 (S): Permitir el zoom y corregir el idioma.** Quitar `maximum-scale=1, user-scalable=0`; `lang="en"` → `"es"`.
  - `index.html:2-6`
- [ ] **R5 (S): Modal de detalle de categoría como lista en móvil** (hoy tabla de 4 columnas con `p-8`).
  - `views/Dashboard.tsx:1600-1667`
- [ ] **R6 (M): Chat de Bagi IA a pantalla completa** con el campo de texto fijo sobre la barra inferior.
  - `views/Intelligence.tsx:206-250`

## 5. Flujo e interacción

- [ ] **F1 (M): Cambiar el aviso de sincronización a pantalla completa por un ícono de nube en la cabecera** (también en móvil, que hoy no tiene indicador).
  - `components/SavingOverlay.tsx`
- [ ] **F2 (S): Toast en vez del modal "¡Movimiento registrado!"** tras guardar una transacción.
  - `views/Transactions.tsx:519-526`
- [ ] **F3 (M): Formulario de transacción más corto.** "Período Presupuestario" detrás de "Más opciones"; no dejarlo siempre abierto en desktop; opcional botón flotante "+" en móvil.
  - `views/Transactions.tsx:203-300`
- [ ] **F4 (M): Un solo selector de "Proveedor de IA"** que se active directamente si ya tiene clave guardada.
  - `views/Settings.tsx:874-907`
- [ ] **F5 (S): Quitar el selector de idioma con una sola opción.**
  - `views/Intelligence.tsx:235-245`

## 6. Detalles y bugs visuales

- [ ] **D1 (S): Usar la moneda de la cuenta en lugar de `'$0.00'` fijo.**
  - `views/Dashboard.tsx:1003`
- [ ] **D2 (S): Generar los años de los selectores a partir del año actual** (hoy 2024–2030, 2025–2030 y 2025–2028).
  - `views/Dashboard.tsx:744`, `views/Analytics.tsx:214`, `:241`, `views/Settings.tsx:645`, `:674`, `:716`, `:792`
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
