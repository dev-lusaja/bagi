# Entendiendo el "Alert Engine" (IA Offline de Bagi)

Bagi resuelve uno de los problemas clásicos de las apps financieras estáticas: usar "umbrales duros quemados en el código" (P.ej. lanzar alerta si un gasto siempre es > 100 USD). El motor de inteligencia de Bagi asimila cómo gasta el usuario comparativamente a sus promedios personales de forma 100% nativa de lado del cliente y aprende matemáticamente con el tiempo.

## El Modelo de Capas de Alerta

La magia ocurre cuando cargas el **Dashboard**. Se desencadenan tres fases ocultas en el UI:

### Fase 1: Desacople visual vs Proceso (Web Worker)
JavaScript sólo posee un hilo lógico maestro (Main Thread). Para evitar que animaciones se corten o que Bagi se detenga intentando cruzar números de miles de transacciones y vectores, la carga dura delega a un hilo segregado, en [`EmbeddingWorker.ts`](../src/services/EmbeddingWorker.ts). 
Ese Web Worker importa `Transformers.js` (un port del C++ ONNX Web Runtime de Microsoft) y ejecuta el modelo `all-MiniLM-L6-v2` el cual ocupa solamente ~22 MB que se almacenan automáticamente en el Cache Storage local del Browser para ejecuciones Offline. El proceso es orquestado por el [`EmbeddingService.ts`](../src/services/EmbeddingService.ts).

### Fase 2: Detectores Dinámicos y Extracción de Baseline Estadístico

El archivo central [`AlertEngine.ts`](../src/application/intelligence/AlertEngine.ts) procesa el arreglo de transacciones mes a mes pasando por filtros de alto nivel matemático:

* **Distancia Coseno para Duplicados:** En lugar de buscar similitud de strings, el modelo ONNX devuelve vectores matemáticos (una matriz de 384 dimensiones) normalizados a `L2=1` por cada transacción. Bagi usa el producto escalar (Dot Product) de estos dos vectores. Si la similitud angular es `>= 0.88` y ocurren en ventana de 72h, asume matemáticamente que son gastos duplicados, indiferentemente de letras faltantes ("McDonalds" vs "Mc Donal's").
* **Percentiles y Fences de Rango Intercuartil (IQR):** Para los avisos de varianza ("Gasto inusual" / "Spike"), utiliza a [`FeatureExtractor.ts`](../src/services/FeatureExtractor.ts). Éste no saca un simple promedio. Con base en la tabla `monthly_category_summary` compila un histórico ordenado y extrae el Quartil-1 (25%) y el Quartil-3 (75%). La alerta de anomalía o sobrepaso de gastos sólo se dispara matemáticamente si una transacción individual o un gasto consolidado cruza el *Tukey Upper Fence* `(Q3 + 1.5 * IQR)`. De esta forma, las categorías naturalmente volátiles no te enviarán notificaciones basura.
* **Ratio de Tendencias:** Mide el cambio de gasto al día de hoy, respecto al mismo día de corte relativo en tu mes anterior (`ratio = currentTotal / prevTotal`). El umbral de alerta sube dinámicamente basándose en la medida percentil-85 de tus brincos históricos en esa categoría en particular, castigando alertas si esa categoría acostumbra variar salvajemente.

### Fase 3: Feedback Loop (Scoring Adaptativo Logístico)
Todas las alertas candidatas entran finalmente al [`AlertScorer.ts`](../src/services/AlertScorer.ts). 

Bagi no muestra simples listas, evalúa su "Utilidad" a través de **Regresión Logística**. Por cada alerta construye 5 *features* en formato numérico (Volatilidad, Días para fin de mes, Ratio vs Promedio, Recencia). Estos números se multiplican por un "peso" individual, se suman, y el total pasa por una función de activación "Sigmoide" generandonos un Score probabilístico de `0.0 a 1.0`. Por ende, solo se te muestran las alertas ganadoras ordenadas de mayor a menor *Score*.

**El Proceso de Aprendizaje:**
En la interfaz gráfica ([`SmartAlertPanel.tsx`](../src/presentation/components/SmartAlertPanel.tsx)) verás íconos de un pulgar arriba (👍) y abajo (👎). Las interacciones no son botones tontos: 
> Cuando pulsas "Pulgar abajo" indicando que una alerta no te importa, el `AlertScorer` hace una bajada de gradiente manual (*Gradient Descent*) con un Learning Rate constante de `0.05` penalizando fuertemente los factores que contribuyeron a esa alerta basura, y sumando puntos a factores de alertas positivas.

Ese set de nuevos *Weights* ajustados en tiempo real se guardan en tu propia tabla SQLite `alert_scorer_weights`. Con tu constante uso, el output del Sigmoide modelará un ecosistema 100% personalizado para ti, ocultándote inteligentemente gastos recurrentes sin que intervengas.
