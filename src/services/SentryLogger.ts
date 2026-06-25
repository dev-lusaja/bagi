import * as Sentry from '@sentry/react';

export const ErrorLogger = {
  /**
   * Captura un error, lo envía a Sentry y lo imprime en consola.
   * @param error El objeto del error.
   * @param context Contexto adicional que incluye el `source`.
   */
  capture: (error: any, context: { source: string; [key: string]: any }) => {
    console.error(`[${context.source}]`, error, context);
    
    Sentry.captureException(error, {
      extra: context,
    });
  }
};
