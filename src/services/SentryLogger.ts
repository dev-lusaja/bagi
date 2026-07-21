import * as Sentry from '@sentry/react';

const DebugLogger = {
  capture: (message: string, data?: Record<string, any>) => {
    if (data) {
      console.log(`[Log]: ${message}`, data);
    } else {
      console.log(`[Log]: ${message}`);
    }
    Sentry.logger.debug(message, { data });
  }
}

const ErrorLogger = {
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

export { ErrorLogger, DebugLogger }