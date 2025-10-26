/**
 * Production-safe logger that only logs in development mode
 * Prevents sensitive information from being exposed in production console
 */

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

export const logger = {
  /**
   * General log - only in development
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[LOG]', ...args);
    }
  },

  /**
   * Info log - only in development
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },

  /**
   * Warning log - only in development
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Error log - always log errors but sanitize in production
   */
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error('[ERROR]', ...args);
    } else {
      // In production, only log error messages without sensitive data
      const sanitizedArgs = args.map(arg => {
        if (arg instanceof Error) {
          return { message: arg.message, stack: arg.stack };
        }
        if (typeof arg === 'object') {
          // Remove potentially sensitive fields
          const { password, token, auth, ...safe } = arg || {};
          return safe;
        }
        return arg;
      });
      console.error('[ERROR]', ...sanitizedArgs);
    }
  },

  /**
   * Debug log - only in development with verbose flag
   */
  debug: (...args: any[]) => {
    if (isDevelopment && localStorage.getItem('debug') === 'true') {
      console.debug('[DEBUG]', ...args);
    }
  },

  /**
   * Table log - only in development
   */
  table: (data: any) => {
    if (isDevelopment) {
      console.table(data);
    }
  },

  /**
   * Group logs - only in development
   */
  group: (label: string) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  /**
   * Group end - only in development
   */
  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },

  /**
   * Time tracking - only in development
   */
  time: (label: string) => {
    if (isDevelopment) {
      console.time(label);
    }
  },

  /**
   * Time end - only in development
   */
  timeEnd: (label: string) => {
    if (isDevelopment) {
      console.timeEnd(label);
    }
  },

  /**
   * Assert - only in development
   */
  assert: (condition: boolean, ...args: any[]) => {
    if (isDevelopment) {
      console.assert(condition, ...args);
    }
  }
};

// Export a function to enable debug mode
export const enableDebugMode = () => {
  if (isDevelopment) {
    localStorage.setItem('debug', 'true');
    logger.info('Debug mode enabled');
  }
};

// Export a function to disable debug mode
export const disableDebugMode = () => {
  localStorage.removeItem('debug');
  logger.info('Debug mode disabled');
};

// Make logger available globally in development for debugging
if (isDevelopment) {
  (window as any).logger = logger;
  (window as any).enableDebugMode = enableDebugMode;
  (window as any).disableDebugMode = disableDebugMode;
}