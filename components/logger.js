/**
 * Logger utility for node-components
 * Provides configurable logging with enable/disable functionality
 * Uses singleton pattern to manage logger instances per component
 *
 * @example
 * import { Logger } from './logger.js';
 *
 * // Recommended: Get logger instance (singleton pattern)
 * const logger = Logger.getInstance('ComponentName');
 *
 * // With explicit enable/disable
 * const logger = Logger.getInstance('ComponentName', true);  // Always enabled
 * const logger = Logger.getInstance('ComponentName', false); // Always disabled
 *
 * // Backward compatibility: Constructor still works
 * const logger = new Logger('ComponentName');
 *
 * // Use logger
 * logger.info('Operation completed');
 * logger.error('Error occurred', error);
 */
export class Logger {
  /** @type {Map<string, Logger>} */
  static #instances = new Map();

  /** @type {boolean} - Global flag to enable/disable colors */
  static #colorsEnabled = true;

  /** ANSI color codes for different log levels */
  static #colors = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',      // debug - dim/gray
    cyan: '\x1b[36m',    // info - cyan
    yellow: '\x1b[33m',  // warn - yellow
    red: '\x1b[31m',     // error - red
  };

  /** @type {boolean} */
  #enabled;
  /** @type {string} */
  #prefix;
  /** @type {boolean} */
  #useColors;

  /**
   * Get or create a Logger instance (singleton pattern)
   * @param {string} componentName Component name for log prefix
   * @param {boolean} [enableLogging] Enable/disable logging. Defaults to NODE_ENV !== 'production'
   * @returns {Logger} Logger instance
   */
  static getInstance(componentName, enableLogging) {
    const key = `${componentName}:${enableLogging ?? 'default'}`;

    if (!Logger.#instances.has(key)) {
      Logger.#instances.set(key, new Logger(componentName, enableLogging));
    }

    return Logger.#instances.get(key);
  }

  /**
   * Clear all logger instances (useful for testing)
   */
  static clearInstances() {
    Logger.#instances.clear();
  }

  /**
   * Disable colors globally for all logger instances
   */
  static disableColors() {
    Logger.#colorsEnabled = false;
  }

  /**
   * Enable colors globally for all logger instances
   */
  static enableColors() {
    Logger.#colorsEnabled = true;
  }

  /**
   * Create a new Logger instance
   * @param {string} componentName Component name for log prefix
   * @param {boolean} [enableLogging] Enable/disable logging. Defaults to NODE_ENV !== 'production'
   */
  constructor(componentName, enableLogging) {
    // If enableLogging is explicitly set (true/false), use it
    // Otherwise, default to enabled in development, disabled in production
    this.#enabled = enableLogging ?? (process.env.NODE_ENV !== 'production');
    this.#prefix = `[${componentName}]`;

    // Determine if colors should be used:
    // - Colors are globally enabled
    // - Output is a terminal (TTY)
    // - NO_COLOR environment variable is not set
    this.#useColors = Logger.#colorsEnabled &&
                     process.stdout.isTTY &&
                     !process.env.NO_COLOR;

    // Assign methods based on enabled flag to eliminate runtime checks
    // This improves performance by avoiding conditional checks on every log call
    if (this.#enabled) {
      const colors = Logger.#colors;

      if (this.#useColors) {
        // Logging enabled with colors: colorize the prefix
        this.debug = (...args) => console.debug(colors.dim + this.#prefix + colors.reset, ...args);
        this.info = (...args) => console.info(colors.cyan + this.#prefix + colors.reset, ...args);
        this.warn = (...args) => console.warn(colors.yellow + this.#prefix + colors.reset, ...args);
        this.error = (...args) => console.error(colors.red + this.#prefix + colors.reset, ...args);
        this.log = (...args) => console.log(this.#prefix, ...args);
      } else {
        // Logging enabled without colors: plain text
        this.debug = (...args) => console.debug(this.#prefix, ...args);
        this.info = (...args) => console.info(this.#prefix, ...args);
        this.warn = (...args) => console.warn(this.#prefix, ...args);
        this.error = (...args) => console.error(this.#prefix, ...args);
        this.log = (...args) => console.log(this.#prefix, ...args);
      }
    } else {
      // Logging disabled: assign no-op functions that do nothing
      this.debug = () => {};
      this.info = () => {};
      this.warn = () => {};
      this.error = () => {};
      this.log = () => {};
    }
  }
}
