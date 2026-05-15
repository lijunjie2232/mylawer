import { config } from '../config/environment.js';

/**
 * Mask sensitive information in strings
 * Shows only last 4 characters, replaces rest with asterisks
 */
function maskSensitiveValue(value: string): string {
  if (!value || value.length <= 4) {
    return '****';
  }
  const visibleChars = value.slice(-4);
  const maskedLength = value.length - 4;
  return '*'.repeat(Math.min(maskedLength, 8)) + visibleChars;
}

/**
 * Check if a string value looks like sensitive data
 */
function looksLikeSensitiveData(value: string): boolean {
  if (!value || value.length <= 4) {
    return false;
  }
  
  const sensitivePatterns = [
    /^sk-[a-zA-Z0-9]/i,           // OpenAI-style API keys
    /^eyJ[a-zA-Z0-9]/i,           // JWT tokens
    /^[a-f0-9]{32,}$/i,           // Hex strings (API keys)
    /^token[_-]?/i,               // Token prefixes
    /^key[_-]?/i,                 // Key prefixes
    /^secret[_-]?/i,              // Secret prefixes
    /password/i,                  // Password patterns
    /postgresql:\/\//i,          // Database URLs
    /^https?:\/\//i,             // URLs
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(value));
}

/**
 * Recursively mask sensitive fields in objects
 */
function maskSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') {
    // Check if it's a string that looks like sensitive data
    if (typeof data === 'string' && looksLikeSensitiveData(data)) {
      return maskSensitiveValue(data);
    }
    return data;
  }

  // Sensitive field patterns
  const sensitivePatterns = [
    /api[_-]?key/i,
    /token/i,
    /secret/i,
    /password/i,
    /auth/i,
    /credential/i,
    /access[_-]?token/i,
    /channel[_-]?secret/i,
    /jwt[_-]?secret/i,
    /base[_-]?url/i,
    /url/i
  ];

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }

  const masked: any = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
    
    if (isSensitive && typeof value === 'string' && value.length > 0) {
      masked[key] = maskSensitiveValue(value);
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else if (typeof value === 'string' && looksLikeSensitiveData(value)) {
      // Mask strings that look sensitive even if the key doesn't match
      masked[key] = maskSensitiveValue(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

export class Logger {
  static log(level: string, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    // Mask sensitive data in meta
    const maskedMeta = meta ? maskSensitiveData(meta) : undefined;
    const logEntry = {
      timestamp,
      level,
      message,
      meta: maskedMeta,
    };
    
    console.log(JSON.stringify(logEntry));
  }

  static info(message: string, meta?: any) {
    if (['info', 'debug'].includes(config.app.logLevel)) {
      this.log('INFO', message, meta);
    }
  }

  static error(message: string, meta?: any) {
    if (['error', 'warn', 'info', 'debug'].includes(config.app.logLevel)) {
      this.log('ERROR', message, meta);
    }
  }

  static warn(message: string, meta?: any) {
    if (['warn', 'info', 'debug'].includes(config.app.logLevel)) {
      this.log('WARN', message, meta);
    }
  }

  static debug(message: string, meta?: any) {
    if (config.app.logLevel === 'debug') {
      this.log('DEBUG', message, meta);
    }
  }
}