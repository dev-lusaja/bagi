import { Database } from 'sql.js';

export function vecToBlob(v: Float32Array): Uint8Array {
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}

export function blobToVec(b: Uint8Array): Float32Array {
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
}

class EmbeddingService {
  private worker: Worker | null = null;
  private memCache = new Map<string, Float32Array>();
  private available = false;
  private initPromise: Promise<void> | null = null;
  private requestCounter = 0;
  private pendingRequests = new Map<number, { resolve: Function, reject: Function }>();

  async init(): Promise<void> {
    if (this.available) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      try {
        // Inicializar worker
        this.worker = new Worker(new URL('./EmbeddingWorker.ts', import.meta.url), { type: 'module' });
        
        this.worker.onmessage = (e) => {
          const { id, type, payload, error } = e.data;
          
          if (type === 'init_done' || type === 'init_error') {
            if (type === 'init_done') {
              this.available = true;
            } else {
              console.warn('[EmbeddingService] Modelo no disponible', error);
              this.available = false;
            }
            resolve();
          } else {
            const req = this.pendingRequests.get(id);
            if (req) {
              if (type.endsWith('_done')) req.resolve(payload);
              else req.reject(new Error(error));
              this.pendingRequests.delete(id);
            }
          }
        };

        this.worker.onerror = (err) => {
          console.warn('[EmbeddingService] Worker error', err);
          this.available = false;
          resolve(); 
        };

        const id = ++this.requestCounter;
        this.worker.postMessage({ id, type: 'init' });

      } catch (e) {
        console.warn('[EmbeddingService] No se pudo instanciar worker', e);
        this.available = false;
        resolve(); // resolve para usar fallback de texto
      }
    });

    return this.initPromise;
  }

  isAvailable(): boolean {
    return this.available;
  }

  private rpc(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestCounter;
      this.pendingRequests.set(id, { resolve, reject });
      this.worker!.postMessage({ id, type, payload });
    });
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (!this.available) return texts.map(() => new Float32Array(0));

    const normalized = texts.map(t => t || '');
    const unique = [...new Set(normalized)];
    const toCompute = unique.filter(t => !this.memCache.has(t));

    if (toCompute.length > 0) {
      try {
        const outVectors = await this.rpc('embedBatch', toCompute);
        toCompute.forEach((t, i) => {
          this.memCache.set(t, outVectors[i]);
        });
      } catch (e) {
        console.warn('[EmbeddingService] error in embedBatch', e);
      }
    }

    return normalized.map(t => this.memCache.get(t)!);
  }

  similarity(a: Float32Array, b: Float32Array): number {
    if (a.length === 0 || b.length === 0) return 0;
    let sum = 0;
    // Puesto que los vectores ya están normalizados (L2 = 1) desde el pipeline,
    // el producto punto equivale al cosine similarity.
    for (let i = 0; i < a.length; i++) {
        sum += a[i] * b[i];
    }
    return sum;
  }

  async loadFromDB(db: Database, accountId: string, txs: any[]): Promise<void> {
    const ids = txs.map(t => t.id);
    if (!ids.length) return;
    
    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT tx_id, vector FROM tx_embeddings WHERE account_id = ? AND tx_id IN (${placeholders})`;
    
    try {
      const dbStmt = db.prepare(sql);
      dbStmt.bind([accountId, ...ids]);
      while (dbStmt.step()) {
        const row = dbStmt.get();
        const txId = row[0] as string;
        const vecBlob = row[1] as Uint8Array;
        const tx = txs.find(t => t.id === txId);
        if (tx) {
          this.memCache.set(tx.description || '', blobToVec(vecBlob));
        }
      }
      dbStmt.free();
    } catch (e) {
      console.warn('[EmbeddingService] loadFromDB error', e);
    }
  }

  saveToDB(db: Database, txs: any[], accountId: string): void {
    if (!this.available) return;
    const now = Date.now();
    try {
      db.exec('BEGIN TRANSACTION;');
      const stmt = db.prepare(`INSERT OR REPLACE INTO tx_embeddings (tx_id, account_id, vector, created_at) VALUES (?,?,?,?)`);
      
      for (const tx of txs) {
        const key = tx.description || '';
        const vec = this.memCache.get(key);
        if (!vec) continue;
        
        stmt.run([tx.id, accountId, vecToBlob(vec), now]);
      }
      
      stmt.free();
      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      console.warn('[EmbeddingService] saveToDB error', e);
    }
  }
}

export const embeddingService = new EmbeddingService();
