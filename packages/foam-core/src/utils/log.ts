export interface ILogger {
  debug(message?: any, ...params: any[]): void;
  info(message?: any, ...params: any[]): void;
  warn(message?: any, ...params: any[]): void;
  error(message?: any, ...params: any[]): void;
  getLevel(): LogLevel;
  setLevel(level: LogLevel): void;
}

export type LogLevel = 'off' | 'debug' | 'info' | 'warn' | 'error';

export abstract class BaseLogger implements ILogger {
  private static severity = {
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
  };

  constructor(private level: LogLevel = 'info') {}

  abstract log(lvl: Exclude<LogLevel, 'off'>, msg?: any, ...extra: any[]): void;

  doLog(msgLevel: LogLevel, message?: any, ...params: any[]): void {
    if (this.level === 'off' || msgLevel === 'off') {
      return;
    }
    if (BaseLogger.severity[msgLevel] >= BaseLogger.severity[this.level]) {
      this.log(msgLevel, message, ...params);
    }
  }

  debug(message?: any, ...params: any[]): void {
    this.doLog('debug', message, ...params);
  }
  info(message?: any, ...params: any[]): void {
    this.doLog('info', message, ...params);
  }
  warn(message?: any, ...params: any[]): void {
    this.doLog('warn', message, ...params);
  }
  error(message?: any, ...params: any[]): void {
    this.doLog('error', message, ...params);
  }
  getLevel(): LogLevel {
    return this.level;
  }
  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export class ConsoleLogger extends BaseLogger {
  log(level: Exclude<LogLevel, 'off'>, msg?: string, ...params: any[]): void {
    console[level](`[${level}] ${msg}`, ...params);
  }
}

export class NoOpLogger extends BaseLogger {
  log(_l: Exclude<LogLevel, 'off'>, _m?: string, ..._p: any[]): void {}
}

export class Logger {
  static debug(message?: any, ...params: any[]): void {
    Logger.defaultLogger.debug(message, ...params);
  }
  static info(message?: any, ...params: any[]): void {
    Logger.defaultLogger.info(message, ...params);
  }
  static warn(message?: any, ...params: any[]): void {
    Logger.defaultLogger.warn(message, ...params);
  }
  static error(message?: any, ...params: any[]): void {
    Logger.defaultLogger.error(message, ...params);
  }
  static getLevel(): LogLevel {
    return Logger.defaultLogger.getLevel();
  }
  static setLevel(level: LogLevel): void {
    Logger.defaultLogger.setLevel(level);
  }

  private static defaultLogger: ILogger = new ConsoleLogger();

  static setDefaultLogger(logger: ILogger) {
    Logger.defaultLogger = logger;
  }
}
