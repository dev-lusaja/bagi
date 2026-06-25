/**
 * AnalyticsService
 * Wraps Google Analytics 4 (gtag.js) with typed methods.
 * Handles user identification (name + SHA-256 hashed email as user_id)
 * and SPA page-view tracking per section.
 */
import { ErrorLogger } from './SentryLogger';

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

type GtagFn = (...args: any[]) => void;

const gtag: GtagFn = (...args) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag(...args);
  }
};

/** SHA-256 hash of a string via the Web Crypto API */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SECTION_LABELS: Record<string, string> = {
  home: 'Inicio',
  dashboard: 'Presupuesto',
  transactions: 'Transacciones',
  settings: 'Configuración',
};

export const AnalyticsService = {
  /**
   * Identify the authenticated user in GA4.
   * Sends a SHA-256 hash of their email as user_id (privacy-safe)
   * and their display name as a user property.
   */
  async identify(email: string, name: string): Promise<void> {
    if (!GA_ID) return;
    try {
      const userId = await sha256(email);
      gtag('set', 'user_properties', {
        user_name: name,
        user_email_hash: userId,
      });
      gtag('config', GA_ID, {
        user_id: userId,
      });
    } catch (err) {
      ErrorLogger.capture(err, { source: 'AnalyticsService - identify' });
    }
  },

  /**
   * Track navigation between SPA sections as page_view events.
   * Called on every activeTab change in App.tsx.
   */
  trackPageView(section: string): void {
    if (!GA_ID) return;
    gtag('event', 'page_view', {
      page_title: SECTION_LABELS[section] ?? section,
      page_location: `${window.location.origin}/#${section}`,
    });
  },

  /**
   * Track a custom event (e.g. sync_triggered, budget_created).
   */
  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    if (!GA_ID) return;
    gtag('event', eventName, params ?? {});
  },

  /**
   * Clear the user identity on logout.
   */
  reset(): void {
    if (!GA_ID) return;
    gtag('set', 'user_properties', {
      user_name: null,
      user_email_hash: null,
    });
    if (GA_ID) {
      gtag('config', GA_ID, { user_id: undefined });
    }
  },
};
