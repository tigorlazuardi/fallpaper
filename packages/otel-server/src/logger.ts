import pino, { type Logger, type LoggerOptions } from "pino";

export interface LoggerConfig {
  /** Log level. Defaults to 'info' */
  level?: pino.Level;
  /** Service name to include in logs */
  serviceName?: string;
  /** Additional base properties to include in all logs */
  base?: Record<string, unknown>;
  /** Force pretty printing regardless of TTY detection */
  forcePretty?: boolean;
  /** Force JSON output regardless of TTY detection */
  forceJson?: boolean;
}

/**
 * Check if running in development mode.
 * Used to determine whether to use pretty printing.
 */
export function isDevelopment(): boolean {
  if (typeof process !== "undefined") {
    // Check NODE_ENV
    if (process.env.NODE_ENV === "development") {
      return true;
    }
    // Check if running in Vite dev mode
    if (process.env.VITE_DEV_SERVER_URL || process.env.VITE) {
      return true;
    }
  }
  return false;
}

/**
 * Create a pino logger instance.
 * 
 * - If stderr is a TTY (or forcePretty is true), uses pino-pretty for colored output
 * - Otherwise, outputs pure JSON for structured logging
 * 
 * @example
 * ```ts
 * const logger = createLogger({ serviceName: 'my-service' });
 * logger.info('Hello world');
 * logger.error({ err }, 'Something went wrong');
 * ```
 */
export function createLogger(config: LoggerConfig = {}): Logger {
  const {
    level = "info",
    serviceName,
    base = {},
    forcePretty = false,
    forceJson = false,
  } = config;

  const usePretty = !forceJson && (forcePretty || isDevelopment());

  const baseConfig: Record<string, unknown> = {
    ...base,
  };

  if (serviceName) {
    baseConfig.service = serviceName;
  }

  const options: LoggerOptions = {
    level,
    base: Object.keys(baseConfig).length > 0 ? baseConfig : undefined,
  };

  if (usePretty) {
    // Use pino-pretty transport for TTY
    options.transport = {
      target: "pino-pretty",
      options: {
        destination: 2, // stderr
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname",
        messageFormat: "{msg}",
        errorLikeObjectKeys: ["err", "error"],
        singleLine: false,
      },
    };
  } else {
    // Pure JSON output to stderr
    options.timestamp = pino.stdTimeFunctions.isoTime;
  }

  // Create logger - for non-pretty mode, write to stderr
  if (usePretty) {
    return pino(options);
  } else {
    return pino(options, pino.destination(2)); // 2 = stderr
  }
}

// Default logger instance (lazy initialized)
let defaultLogger: Logger | null = null;

/**
 * Get or create the default logger instance.
 * Call initDefaultLogger() first to configure, or this will create one with defaults.
 */
export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger();
  }
  return defaultLogger;
}

/**
 * Initialize the default logger with configuration.
 * Should be called early in application startup.
 */
export function initDefaultLogger(config: LoggerConfig = {}): Logger {
  defaultLogger = createLogger(config);
  return defaultLogger;
}

/**
 * Create a child logger with additional context.
 * 
 * @example
 * ```ts
 * const requestLogger = getLogger().child({ requestId: 'abc123' });
 * requestLogger.info('Processing request');
 * ```
 */
export function childLogger(bindings: Record<string, unknown>): Logger {
  return getLogger().child(bindings);
}

// Re-export pino types for convenience
export type { Logger, LoggerOptions, Level } from "pino";
