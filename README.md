# Bagi - Gestión Financiera Inteligente Personal

Bagi es una aplicación web local-first de finanzas personales que prioriza la privacidad absoluta del usuario sin sacrificar características avanzadas de Inteligencia Artificial ("IA"). No cuenta con servidores de bases de datos tradicionales ni un backend que robe datos: tu base de datos SQLite vive y viaja en la nube estrictamente ligada a tu cuenta de Google Drive para mantenerte sincronizado en múltiples dispositivos.

## Características Principales

* **Local-first (Privacidad Absoluta)**: Todos los datos existen únicamente de tu lado. Funciona combinando una base de datos SQLite persistente a través del navegador.
* **Sincronización Cloud (Google Drive)**: Respaldo asíncrono y transparente hacia un archivo en tu Drive para multi-dispositivos.
* **Inteligencia AI Offline**: Clasifica, avisa y detecta gastos duplicados o extraños usando redes neuronales profundas (Embeddings NLP) y Machine Learning adaptativo integrados localmente a través de WebAssembly nativo. ¡El modelo funciona sin internet!
* **Multi-cuentas & Monedas**: Separación e interpretación nativa de bancos o tarjetas y con presupuestos dedicados para no mezclar saldos.
* **Control de Deudas & Obligaciones**: Seguimiento mensual de deudas dinámicas con control de amortización.

---

## Documentación para Desarrolladores

El framework de trabajo que usa Bagi no es tradicional y emplea componentes altamente aislados bajo metodologías de **Clean Architecture**. Si eres desarrollador o contribuidor, por favor, procede a revisar directamente la sub-carpeta `/docs/` para empaparte profundamente en el flujo de la aplicación.

* [Arquitectura y Estilos de Código (`/docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)
* [Lógica y Reglas de Negocio de Base de Datos (`/docs/DATABASE_SCHEMA.md`)](./docs/DATABASE_SCHEMA.md)
* [Explicación del Motor Inteligente de Alertas (Web Workers / ONNX) (`/docs/SMART_ALERTS_ENGINE.md`)](./docs/SMART_ALERTS_ENGINE.md)

## Configuración y Entorno de Desarrollo (Setup)

Este proyecto está construido con [React](https://reactjs.org/), [Vite](https://vitejs.dev/) y está altamente vitaminado con librerías modernas de front-end sin backend de apoyo.

### Clonar y preparar

1. **Dependencias:** Asegúrate de contar con NodeJS ^22.
2. Extrae o clona el repositorio a tu máquina local.
3. Instala los paquetes requeridos usando npm:

    ```bash
    npm install
    ```

### Iniciar la App en entorno local

Usa Vite para orquestar la compilación e In-Memory Hot-Reload:

```bash
npm run dev
```

El proyecto estará corriendo por defecto en `http://localhost:5173`. Tras entrar, SQLite (`sql.js`) y HuggingFace Transformers detectarán el entorno y se iniciaran autónomamente.
