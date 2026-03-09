import { config } from '../config/environment.js';

export class Logger {
  static log(level: string, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      meta,
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