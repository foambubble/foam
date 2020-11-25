export interface ILogger {
  log(message?: any, ...optionalParams: any[]): void;
  debug(message?: any, ...optionalParams: any[]): void;
  info(message?: any, ...optionalParams: any[]): void;
  warn(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
  getLevel(): LogLevel;
  setLevel(level: LogLevel): void;
}

export enum LogLevel {
  off = 0,
  debug = 1,
  info = 2,
  warn = 3,
  error = 4,
}

export const createLogger = (
  log: (level: LogLevel, message?: any, ...params: any[]) => void,
  startLevel: LogLevel = LogLevel.info
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
    log: (m, ...p) => checkAndLog(LogLevel.info, m, ...p),
    debug: (m, ...p) => checkAndLog(LogLevel.debug, m, ...p),
    info: (m, ...p) => checkAndLog(LogLevel.info, m, ...p),
    warn: (m, ...p) => checkAndLog(LogLevel.warn, m, ...p),
    error: (m, ...p) => checkAndLog(LogLevel.error, m, ...p),
    getLevel: () => currentLogLevel,
    setLevel: level => {
      currentLogLevel = level;
    },
  };
};

export const consoleLogger: ILogger = createLogger(
  (level, message, ...params) => {
    const fn =
      level === LogLevel.debug
        ? console.debug
        : level === LogLevel.info
        ? console.info
        : level === LogLevel.warn
        ? console.warn
        : level === LogLevel.error
        ? console.error
        : console.log;
    fn(message, params);
  }
);
