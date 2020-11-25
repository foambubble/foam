import { window, commands, ExtensionContext } from "vscode";
import { ILogger, IDisposable } from "foam-core";
import { getFoamLoggerLevel } from "../settings";

enum LogLevel {
  OFF = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4
}

export interface VsCodeLogger extends ILogger, IDisposable {
  show();
  getLevel(): LogLevel;
  setLevel(level: LogLevel): void;
}

export const createLoggerForVsCode = (): VsCodeLogger => {
  const channel = window.createOutputChannel("Foam");
  let currentLogLevel = LogLevel[getFoamLoggerLevel() ?? LogLevel.DEBUG];

  channel.appendLine("Foam Logging: " + LogLevel[currentLogLevel]);

  const logger = (level: LogLevel) => (message?: any, ...params: any[]) => {
    if (level < currentLogLevel) {
      return;
    }
    if (message) {
      channel.appendLine(
        `[${LogLevel[level]} - ${new Date().toLocaleTimeString()}] ${message}`
      );
    }
    params.forEach(param => {
      if (param?.stack) {
        channel.appendLine(JSON.stringify(param.stack, null, 2));
      } else {
        channel.appendLine(JSON.stringify(param, null, 2));
      }
    });
  };

  return {
    log: logger(LogLevel.INFO),
    debug: logger(LogLevel.DEBUG),
    info: logger(LogLevel.INFO),
    warn: logger(LogLevel.WARN),
    error: logger(LogLevel.ERROR),
    show: () => {
      channel.show();
    },
    getLevel: () => currentLogLevel,
    setLevel: level => {
      currentLogLevel = level;
    },
    dispose: () => {
      channel.dispose();
    }
  };
};

export const exposeLogger = (
  context: ExtensionContext,
  logger: VsCodeLogger
): void => {
  context.subscriptions.push(
    commands.registerCommand("foam-vscode.set-log-level", async () => {
      const items = [
        LogLevel.DEBUG,
        LogLevel.INFO,
        LogLevel.WARN,
        LogLevel.ERROR
      ];
      const level = await window.showQuickPick(
        items.map(item => ({
          label: LogLevel[item],
          description: item === logger.getLevel() && "Current"
        }))
      );
      logger.setLevel(LogLevel[level.label]);
    })
  );
};
