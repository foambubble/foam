export interface ILogger {
  log(message?: any, ...optionalParams: any[]): void;
  debug(message?: any, ...optionalParams: any[]): void;
  info(message?: any, ...optionalParams: any[]): void;
  warn(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
  getLevel(): LogLevel;
  setLevel(level: LogLevel): void;
}

export type LogLevel = 'off' | 'debug' | 'info' | 'warn' | 'error';

export const createLogger = (
  log: (level: LogLevel, message?: any, ...params: any[]) => void,
  startLevel: LogLevel = 'info'
): ILogger => {
  let currentLogLevel = startLevel;

  const checkAndLog = (
    level: LogLevel,
    message?: string,
    ...params: any[]
  ): void => {
    if (level >= currentLogLevel) {
      log(level, message, ...params);
    }
  };

  return {
    log: (m, ...p) => checkAndLog('info', m, ...p),
    debug: (m, ...p) => checkAndLog('debug', m, ...p),
    info: (m, ...p) => checkAndLog('info', m, ...p),
    warn: (m, ...p) => checkAndLog('warn', m, ...p),
    error: (m, ...p) => checkAndLog('error', m, ...p),
    getLevel: () => currentLogLevel,
    setLevel: level => {
      currentLogLevel = level;
    },
  };
};

export const consoleLogger: ILogger = createLogger(
  (level, message, ...params) => {
    if (level != 'off') {
      console[level](message, params);
    }
  }
);
