import { AIModelOption } from './AIProviderTypes';

/**
 * Trae en vivo el catálogo `:free` de OpenRouter y lo filtra a los que soportan
 * `structured_outputs` — sin eso el modelo no sirve para extraer transacciones en JSON
 * de forma confiable (validado empíricamente: la mitad del catálogo gratis no lo soporta).
 */
export async function fetchFreeVisionAwareModels(): Promise<AIModelOption[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw new Error('MODEL_LIST_ERROR');
  const data = await res.json();
  const models = (data.data || []) as any[];

  return models
    .filter(m => m.id.endsWith(':free') && (m.supported_parameters || []).includes('structured_outputs'))
    .map(m => ({
      id: m.id as string,
      label: m.id.replace(':free', ''),
      supportsImage: (m.architecture?.input_modalities || []).includes('image'),
    }));
}
