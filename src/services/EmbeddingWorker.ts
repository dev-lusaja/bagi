import { pipeline, env } from '@huggingface/transformers';

// Desactivar modelos locales por defecto, para que siempre busque en el repositorio remoto
env.allowLocalModels = false;

let pipe: any = null;

self.addEventListener('message', async (e) => {
  const { id, type, payload } = e.data;
  
  if (type === 'init') {
    try {
      if (!pipe) {
        // Inicializa el pipeline de embeddings
        // all-MiniLM-L6-v2 es muy rápido y ligero (~22MB)
        pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          device: 'auto'
        });
      }
      self.postMessage({ id, type: 'init_done' });
    } catch (error: any) {
      console.warn("EmbeddingWorker init error:", error);
      self.postMessage({ id, type: 'init_error', error: error.message });
    }
  } else if (type === 'embedBatch') {
    try {
      if (!pipe) throw new Error('Not initialized');
      const texts = payload;
      
      const out = await pipe(texts, {
        pooling: 'mean',
        normalize: true,
      });
      
      const dim = out.dims ? out.dims[out.dims.length - 1] : 384;
      const results: Float32Array[] = [];
      const buffersToTransfer: ArrayBuffer[] = [];
      
      for (let i = 0; i < texts.length; i++) {
        // Clonar el slice para poder usar Transferable Objects y evitar copies memory lockeos
        const slice = new Float32Array(out.data.subarray(i * dim, (i + 1) * dim));
        results.push(slice);
        buffersToTransfer.push(slice.buffer);
      }
      
      self.postMessage({ id, type: 'embedBatch_done', payload: results }, buffersToTransfer);
    } catch (error: any) {
      console.warn("EmbeddingWorker embedBatch error:", error);
      self.postMessage({ id, type: 'embedBatch_error', error: error.message });
    }
  }
});
