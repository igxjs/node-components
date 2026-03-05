import { STATUS_CODES } from 'node:http';

export const httpMessages = {
  OK: 'OK',
  CREATED: 'Created',
  NO_CONTENT: 'No Content',
  BAD_REQUEST: 'Bad Request',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not Found',
  NOT_ACCEPTABLE: 'Not Acceptable',
  CONFLICT: 'Conflict',
  LOCKED: 'Locked',
  SYSTEM_FAILURE: 'System Error',
  NOT_IMPLEMENTED: 'Not Implemented',
};

export const httpCodes = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  NOT_ACCEPTABLE: 406,
  CONFLICT: 409,
  LOCKED: 423,
  SYSTEM_FAILURE: 500,
  NOT_IMPLEMENTED: 501,
};

export class CustomError extends Error {
  /** @type {number} */
  code;
  /** @type {object} */
  data;
  /** @type {object} */
  error;
  /**
   * Construct a custom error
   * @param {number} code Error code
   * @param {string} message Message
   */
  constructor(code, message, error = {}, data = {}) {
    super(message);
    this.code = code;
    this.error = error;
    this.data = data;
  }
}

/**
 * Custom Error handler
 *
 * @param {CustomError} err Error
 * @param {import('@types/express').Request} req Request
 * @param {import('@types/express').Response} res Response
 * @param {import('@types/express').NextFunction} next Next
 */
export const httpErrorHandler = (err, req, res, next) => {
  // If no error, pass to next middleware
  if (!err) {
    return next();
  }

  // Build response object with defaults
  const responseBody = {
    status: err.code || httpCodes.BAD_REQUEST,
    message: err.message || httpMessages.BAD_REQUEST,
  };

  // Merge additional error data if present
  if (err.data && typeof err.data === 'object') {
    Object.entries(err.data).forEach(([key, value]) => {
      responseBody[key] = value;
    });
  }

  // Set CORS and custom headers
  res.header('Access-Control-Expose-Headers', '*');
  res.header('X-IBM-Override-Error-Pages', 'not-found, client-error, server-error');

  // Send error response
  res.status(responseBody.status).json(responseBody);

  // Log error details
  console.error('### ERROR ###');
  console.error(`${req.method} ${req.path}`);

  // Log based on error type
  if ([httpCodes.UNAUTHORIZED, httpCodes.FORBIDDEN, httpCodes.NOT_FOUND].includes(err.code)) {
    console.error('>>> Auth Error:', err.message);
  } else {
    console.error('>>> Name:', err.name);
    console.error('>>> Message:', err.message);
    if (err.stack) {
      console.error('>>> Stack:', err.stack);
    }
  }

  console.error('### /ERROR ###');
};

/**
 * HTTP not found error handler
 * @param {Request} _req Request object
 * @param {Response} _res Response object
 * @param {NextFunction} next Next function
 */
export const httpNotFoundHandler = (_req, _res, next) => {
  next(new CustomError(httpCodes.NOT_FOUND, httpMessages.NOT_FOUND));
};

/**
 * Extract HTTP status code from error
 * @param {Error} error Error object
 * @returns {number} HTTP status code
 */
const _getErrorCode = (error) => {
  const statusCode = error.response?.status;
  // Validate it's a valid HTTP status code
  if (statusCode && typeof statusCode === 'number' && Object.hasOwn(STATUS_CODES, statusCode)) {
    return statusCode;
  }
  return httpCodes.SYSTEM_FAILURE;
};

/**
 * Extract error message from error
 * @param {Error} error Error object
 * @param {string} defaultMessage Default message
 * @returns {string} Error message
 */
const _getErrorMessage = (error, defaultMessage) => {
  // Priority: response.data.message > response.statusText > error.message > default
  return error.response?.data?.message
    || error.response?.statusText
    || error.message
    || defaultMessage;
};

export const httpHelper = {
  /**
   * Format a string with placeholders
   * @param {string} str String with {0}, {1}, etc. placeholders
   * @param {...string} args Values to replace placeholders
   * @returns {string} Formatted string
   */
  format (str, ...args) {
    const matched = str.match(/{\d}/ig);
    matched.forEach((element, index) => {
      if(args.length > index)
        str = str.replace(element, args[index]);
    });
    return str;
  },

  /**
   * Generate friendly Zod message
   * @param {Error} error Zod error
   * @returns {string} Returns friendly Zod message
   */
  toZodMessage(error) {
    return error.issues
    .map(issue => {
      const path = issue.path.join('.');
      return (path ? '['.concat(path).concat('] ').concat('') : '').concat(issue.message);
    })
    .join('; ');
  },

  /**
   * Try to analyze axios Error
   * @param {Error | import('axios').AxiosError} error Error object
   * @param {string} defaultMessage Default error message
   * @returns {CustomError} Returns CustomError instance
   */
  handleAxiosError(error, defaultMessage = 'An error occurred') {
    console.warn(`### TRY ERROR: ${defaultMessage} ###`);
    // Extract error details
    const errorCode = _getErrorCode(error);
    const errorMessage = _getErrorMessage(error, defaultMessage);
    const errorData = error.response?.data || {};
    return new CustomError(errorCode, errorMessage, error, errorData);
  }
};

/**
 * HTTP Error - alias of `new CustomError()`
 * @param {Number} code Error code
 * @param {string} message Error message
 * @param {Error} error Original Error instance
 * @param {any} data Error data
 * @returns {CustomError} Returns a new instance of CustomError
 */
export const httpError = (code, message, error, data) => {
  return new CustomError(code, message, error, data);
};
