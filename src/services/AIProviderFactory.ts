import { geminiParserService } from './GeminiParserService';
import { openRouterParserService } from './OpenRouterParserService';
import { IAIProviderService } from './AIProviderTypes';

export type AIProviderId = 'gemini' | 'openrouter';

const API_KEY_STORAGE: Record<AIProviderId, string> = {
  gemini: 'bagi_gemini_api_key',
  openrouter: 'bagi_openrouter_api_key',
};

const MODEL_STORAGE: Record<AIProviderId, { primary: string; fallback: string }> = {
  gemini: { primary: 'bagi_gemini_model_primary', fallback: 'bagi_gemini_model_fallback' },
  openrouter: { primary: 'bagi_openrouter_model_primary', fallback: 'bagi_openrouter_model_fallback' },
};

/** Defaults validados manualmente (ver conversación de análisis) para el modelo principal/fallback de cada proveedor. */
export const DEFAULT_MODELS: Record<AIProviderId, { primary: string; fallback: string }> = {
  gemini: { primary: 'gemini-3.6-flash', fallback: 'gemini-3.5-flash' },
  openrouter: { primary: 'nex-agi/nex-n2.5-pro:free', fallback: 'dots-studio/dots-3-note-preview:free' },
};

/**
 * Proveedor activo real, o `null` si el usuario nunca lo configuró explícitamente desde Settings.
 * Excepción de migración: usuarios previos a esta feature ya tenían una API key de Gemini guardada
 * sin el concepto de "proveedor activo" — para no romperles el flujo, se asume Gemini en ese caso.
 */
export function getActiveAIProvider(): AIProviderId | null {
  const stored = localStorage.getItem('bagi_ai_provider');
  if (stored === 'gemini' || stored === 'openrouter') return stored;
  if (localStorage.getItem(API_KEY_STORAGE.gemini)) return 'gemini';
  return null;
}

export function setActiveAIProvider(provider: AIProviderId): void {
  localStorage.setItem('bagi_ai_provider', provider);
}

export function getProviderService(provider: AIProviderId): IAIProviderService {
  return provider === 'openrouter' ? openRouterParserService : geminiParserService;
}

export function getProviderApiKeyStorageKey(provider: AIProviderId): string {
  return API_KEY_STORAGE[provider];
}

export function getModelStorageKey(provider: AIProviderId, kind: 'primary' | 'fallback'): string {
  return MODEL_STORAGE[provider][kind];
}

export function getActiveApiKey(provider: AIProviderId): string {
  return localStorage.getItem(API_KEY_STORAGE[provider]) || '';
}

export function getActiveModelIds(provider: AIProviderId): { primary: string; fallback: string } {
  return {
    primary: localStorage.getItem(MODEL_STORAGE[provider].primary) || DEFAULT_MODELS[provider].primary,
    fallback: localStorage.getItem(MODEL_STORAGE[provider].fallback) || DEFAULT_MODELS[provider].fallback,
  };
}
