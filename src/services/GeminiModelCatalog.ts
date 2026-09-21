import { AIModelOption } from './AIProviderTypes';

/**
 * Catálogo de Gemini: estable, no rota como el `:free` de OpenRouter, no amerita fetch en vivo.
 * Limitado a los modelos sin fecha de cierre anunciada en
 * https://ai.google.dev/gemini-api/docs/deprecations (consultado 2026-09-20).
 */
export const GEMINI_MODEL_OPTIONS: AIModelOption[] = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', supportsImage: true },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', supportsImage: true },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', supportsImage: true },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', supportsImage: true },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', supportsImage: true },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', supportsImage: true },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', supportsImage: true },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', supportsImage: true },
];
