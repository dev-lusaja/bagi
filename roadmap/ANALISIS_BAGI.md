# Reporte de Análisis: Bagi — Sistema de Presupuesto Personal

---

## 🏆 Puntos Fuertes y Diferenciales de Bagi

Estas son las características que hacen a Bagi **único y superior** frente a sistemas convencionales como YNAB, Mint, Fintonic o Spendee:

### 1. 🔒 Privacidad Absoluta — Local-First Real
La mayoría de apps de presupuesto son SaaS con servidores propios donde los datos del usuario quedan expuestos a brechas, minería de datos o cambios de política de privacidad. Bagi almacena **todo** en una base SQLite que corre vía WebAssembly directamente en el navegador del usuario. **Ningún dato financiero sale del dispositivo.**

### 2. 🧠 IA Offline Adaptativa (el diferencial más grande)
Esto es excepcional en el mercado:
- **Embeddings NLP con ONNX (`all-MiniLM-L6-v2`)** corriendo en el browser via Web Workers, sin depender de APIs externas.
- **Detección de duplicados por similitud coseno** (≥0.88 en ventana de 72h): identifica "McDonalds" y "Mc Donal's" como el mismo gasto aunque estén escritos diferente.
- **Alertas con IQR estadístico (Tukey Upper Fence)**: no usa umbrales hardcodeados sino percentiles reales del historial del usuario por categoría. Una categoría volátil no genera spam de alertas.
- **Regresión logística con Gradient Descent en tiempo real**: el usuario da thumbs up/down y los pesos del modelo se actualizan localmente. El sistema personaliza su comportamiento sin escalar nada a la nube.
- **Ratio de tendencias comparando mes actual vs mes anterior** ajustado por el percentil-85 histórico de variabilidad.

### 3. 🗂️ Modelo de Obligaciones Snapshot (versioning de pagos fijos)
La mayoría de apps tratan los gastos recurrentes como plantillas globales. Bagi implementa un sistema de **`recurring_items` → `budget_obligations`** donde cada mes genera una "fotografía" de las obligaciones vigentes. Esto permite **editar el precio de un servicio (ej: el Internet subió) para este mes sin alterar el registro histórico de meses anteriores**. Es un nivel de integridad contable que pocas apps personales tienen.

### 4. ☁️ Sincronización Multi-Dispositivo sin Backend
Sin servidor propio: el archivo SQLite binario se sube a **Google Drive** del propio usuario. La sincronización incluye:
- **Control de concurrencia optimista**: compara `modifiedTime` del archivo en Drive antes de subir para detectar conflictos entre dispositivos.
- **Auto-descarga al iniciar sesión**: al abrir en otro dispositivo, la app baja automáticamente el estado más reciente.

### 5. 💳 Arquitectura Multi-cuenta / Multi-tarjeta Coherente
Bagi modela explícitamente la relación entre cuentas bancarias y tarjetas de crédito (`payment_account_id`). Cuando se hace un pago a tarjeta, genera **dos transacciones atómicas**: el cargo al banco y el abono a la tarjeta, manteniendo la contabilidad consistente.

### 6. 📐 Clean Architecture Frontend-Only
Implementa correctamente las 4 capas de Clean Architecture (Dominio → Infraestructura → Aplicación → Presentación) en un proyecto puramente frontend, lo cual es arquitectónicamente ambicioso y facilita el mantenimiento y extensión del sistema.

---

## 📋 Features Faltantes vs. un Sistema Estándar

Para ser considerado un sistema de presupuesto personal **completo y competitivo**, Bagi aún carece de las siguientes funcionalidades:

### 🔴 Críticas (Core Finance)

| Feature | Descripción | Impacto |
|---|---|---|
| **Saldo real de cuentas** | No existe tracking del saldo actual (balance) en cada cuenta. Solo se rastrea gasto vs. presupuesto, pero no cuánto dinero tiene el usuario realmente en el banco. | Alto |
| **Edición de transacciones** | Las transacciones solo se pueden eliminar, no editar. Un error de monto o categoría obliga a borrar y recriar. | Alto |
| **Transferencias entre cuentas propias** | Aunque existe la categoría "Transferencia", no hay un flujo de UI que registre el movimiento desde-hasta de forma bidireccional automática (restar de cuenta A, sumar a cuenta B). | Alto |
| **Flujo de caja / Neto mensual** | No hay una vista de **Ingresos − Gastos = Ahorro Neto** del mes. El dashboard muestra consumo vs. presupuesto, pero no la foto completa del flujo de caja. | Alto |
| **Búsqueda en transacciones** | No existe campo de búsqueda por texto en el historial de movimientos (solo filtros por categoría/cuenta/tarjeta). | Medio-Alto |

### 🟠 Importantes (UX y Completitud)

| Feature | Descripción | Impacto |
|---|---|---|
| **Metas de ahorro** | No existe un módulo de metas (ej: "quiero ahorrar $500 para navidad"). Es una de las features más demandadas en apps de presupuesto. | Alto |
| **Gráficos históricos** | Solo se muestran datos del mes actual. No hay gráficos de tendencia a lo largo de múltiples meses (evolución de gasto por categoría, ingresos vs. gastos en los últimos 6 meses, etc.). | Alto |
| **Reporte / Exportación** | No hay manera de exportar la data a CSV, PDF o Excel. Cualquier usuario que quiera hacer análisis externo no puede. | Medio-Alto |
| **Soporte de ingresos variables** | El sistema no tiene un mecanismo para registrar/proyectar ingresos mensuales de forma estructurada (ej: freelancing, varios empleadores). | Medio |
| **Notificaciones / Recordatorios** | No existe sistema de alertas fuera de la app (notificaciones push o email) para avisar vencimientos de obligaciones. | Medio |
| **Multi-moneda con conversión** | Aunque soporta COP, PEN, USD, EUR, no hay lógica de conversión de tasas de cambio para vistas consolidadas cuando el usuario tiene cuentas en múltiples monedas. | Medio |
| **Filtro de fechas custom en transacciones** | Solo se puede filtrar por categoría/cuenta en el historial. No hay un picker de rangos de fecha (semana, mes específico, última quincena). | Medio |
| **Modo oscuro** | La UI es 100% light. Un modo oscuro es una expectativa estándar hoy. | Bajo-Medio |

### 🟡 Deseables (Madurez del Producto)

| Feature | Descripción | Impacto |
|---|---|---|
| **Importación de extractos bancarios** | (está en ideas como OCR): poder importar CSV/OFX del banco para poblar transacciones automáticamente sin registro manual. | Alto a largo plazo |
| **Presupuesto anual / proyección** | Poder planificar presupuestos a nivel anual, no solo mensual. | Medio |
| **Categorías con subcategorías** | Solo existe un nivel de categorías. Apps más maduras permiten ej: "Alimentación > Restaurantes", "Alimentación > Mercado". | Bajo-Medio |
| **Etiquetas (tags) en transacciones** | Además de categorías, poder marcar transacciones con etiquetas libres (ej: #vacaciones, #trabajo). | Bajo |
| **Multi-usuario real** | La tabla `users` existe pero user_id=1 está hardcodeado en toda la UI. El sistema no está realmente listo para múltiples usuarios. | Bajo (por diseño local-first) |
| **Tutorial interactivo** | El onboarding checklist existe pero es pasivo. Un tutorial paso-a-paso guiado mejoraría la adopción. | Bajo |
| **Undo / historial de acciones** | No hay manera de deshacer una eliminación accidental. | Bajo |

---

## 📊 Resumen: Posicionamiento de Bagi

```
              PRIVACIDAD
                  ▲
                  │
       ★ BAGI     │
                  │
──────────────────┼────────────────── FUNCIONALIDAD
  (básico)        │                   (completo)
                  │
              Mint/Fintonic
              (cloud, completos)
                  ▼
```

Bagi se posiciona como un sistema **de alta privacidad y alta sofisticación técnica** pero con **funcionalidad estándar incompleta**. Es ideal para usuarios técnicos y conscientes de su privacidad, pero aún no es apto para el usuario masivo que espera las features básicas de cualquier app de finanzas como saldos reales, metas de ahorro, y exportación de datos.

---

## 🗺️ Recomendaciones de Priorización

Si el objetivo es acercar Bagi al estándar mínimo de un sistema de presupuesto personal completo, se recomienda abordar en este orden:

1. **Tracking de saldo real de cuentas** (balance running)
2. **Edición de transacciones existentes**
3. **Vista de flujo de caja neto** (Ingresos - Gastos)
4. **Gráficos históricos multi-mes**
5. **Metas de ahorro**
6. **Búsqueda en transacciones**
7. **Exportación CSV/PDF**
