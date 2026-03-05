# HTTP Handlers

Custom error handling utilities with standardized HTTP status codes and error responses for Express.js applications.

## Overview

The HTTP Handlers module provides:
- Standardized error handling middleware
- Custom error classes
- HTTP status codes and messages constants
- 404 handler for unmatched routes
- Utility functions for error formatting
- Axios error handling helpers

## Available Exports

```javascript
import { 
  httpCodes,           // HTTP status code constants
  httpMessages,        // HTTP status message constants
  httpErrorHandler,    // Error handling middleware
  httpNotFoundHandler, // 404 handler middleware
  CustomError,         // Custom error class
  httpHelper,          // Utility functions
  httpError            // Error factory function
} from '@igxjs/node-components';
```

## Quick Start

```javascript
import express from 'express';
import {
  httpCodes,
  httpErrorHandler,
  httpNotFoundHandler,
  httpError
} from '@igxjs/node-components';

const app = express();

// Your routes
app.get('/api/data', async (req, res, next) => {
  try {
    const data = await fetchData();
    res.json(data);
  } catch (error) {
    next(httpError(httpCodes.SYSTEM_FAILURE, 'Failed to fetch data', error));
  }
});

// Add 404 handler before error handler
app.use(httpNotFoundHandler);

// Add error handler as the last middleware
app.use(httpErrorHandler);

app.listen(3000);
```

## HTTP Status Codes

The `httpCodes` object provides constants for common HTTP status codes:

```javascript
import { httpCodes } from '@igxjs/node-components';

// Success codes
httpCodes.OK                  // 200
httpCodes.CREATED             // 201
httpCodes.NO_CONTENT          // 204

// Client error codes
httpCodes.BAD_REQUEST         // 400
httpCodes.UNAUTHORIZED        // 401
httpCodes.FORBIDDEN           // 403
httpCodes.NOT_FOUND           // 404
httpCodes.NOT_ACCEPTABLE      // 406
httpCodes.CONFLICT            // 409
httpCodes.LOCKED              // 423

// Server error codes
httpCodes.SYSTEM_FAILURE      // 500
httpCodes.NOT_IMPLEMENTED     // 501
```

## HTTP Status Messages

Corresponding status messages are available via `httpMessages`:

```javascript
import { httpMessages } from '@igxjs/node-components';

httpMessages.OK               // 'OK'
httpMessages.BAD_REQUEST      // 'Bad Request'
httpMessages.UNAUTHORIZED     // 'Unauthorized'
// ... etc.
```

## CustomError Class

Create custom errors with specific HTTP status codes:

```javascript
import { CustomError, httpCodes } from '@igxjs/node-components';

// Constructor: new CustomError(code, message, error?, data?)
throw new CustomError(
  httpCodes.BAD_REQUEST,
  'Email is required',
  null,
  { field: 'email' }
);
```

**Properties:**
- `code` (number) - HTTP status code
- `message` (string) - Error message
- `error` (object, optional) - Original error object
- `data` (object, optional) - Additional error data

## httpError Function

Convenience function to create CustomError instances:

```javascript
import { httpError, httpCodes } from '@igxjs/node-components';

// Same as: new CustomError(code, message, error, data)
throw httpError(
  httpCodes.UNAUTHORIZED,
  'Invalid credentials',
  originalError,
  { attempted: username }
);
```

## Middleware

### httpErrorHandler

Express error handling middleware that processes CustomError and other errors:

```javascript
import { httpErrorHandler } from '@igxjs/node-components';

// Add as the last middleware
app.use(httpErrorHandler);
```

**Features:**
- Automatically handles `CustomError` instances
- Sets appropriate HTTP status codes
- Adds CORS headers
- Logs error details to console
- Returns standardized JSON error responses

**Response Format:**
```json
{
  "error": {
    "code": 400,
    "message": "Email is required",
    "data": { "field": "email" }
  }
}
```

### httpNotFoundHandler

Middleware that catches all unmatched routes and returns 404:

```javascript
import { httpNotFoundHandler } from '@igxjs/node-components';

// Add before error handler
app.use(httpNotFoundHandler);
app.use(httpErrorHandler);
```

## httpHelper Utilities

### `handleAxiosError(error, defaultMessage?)`

Analyze and convert Axios/HTTP errors to CustomError:

```javascript
import axios from 'axios';
import { httpHelper } from '@igxjs/node-components';

try {
  const response = await axios.get('https://api.example.com/data');
  return response.data;
} catch (error) {
  // Converts Axios error to CustomError with extracted status and message
  throw httpHelper.handleAxiosError(error, 'API request failed');
}
```

### `format(str, ...args)`

Format strings with placeholders:

```javascript
import { httpHelper } from '@igxjs/node-components';

const message = httpHelper.format(
  'User {0} not found in {1}',
  'john@example.com',
  'database'
);
// Result: 'User john@example.com not found in database'
```

### `toZodMessage(error)`

Generate friendly Zod validation error messages:

```javascript
import { z } from 'zod';
import { httpHelper, httpError, httpCodes } from '@igxjs/node-components';

const userSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18)
});

app.post('/api/users', (req, res, next) => {
  try {
    const validated = userSchema.parse(req.body);
    // Process validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = httpHelper.toZodMessage(error);
      throw httpError(httpCodes.BAD_REQUEST, message, error);
    }
    next(error);
  }
});
```

## Complete Example

```javascript
import express from 'express';
import {
  httpCodes,
  httpMessages,
  httpError,
  httpErrorHandler,
  httpNotFoundHandler,
  CustomError
} from '@igxjs/node-components';

const app = express();
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: httpMessages.OK });
});

app.post('/api/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      throw httpError(
        httpCodes.BAD_REQUEST,
        'Username and password are required'
      );
    }
    
    const user = await authenticate(username, password);
    
    if (!user) {
      throw new CustomError(
        httpCodes.UNAUTHORIZED,
        'Invalid credentials'
      );
    }
    
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// 404 handler
app.use(httpNotFoundHandler);

// Error handler (must be last)
app.use(httpErrorHandler);

app.listen(3000);
```

## Related Documentation

- [JWT Manager](./jwt-manager.md) - For token-based authentication
- [SessionManager](./session-manager.md) - For session-based authentication
- [Back to main documentation](../README.md)