import { window, commands, ExtensionContext } from "vscode";
import { ILogger, IDisposable, createLogger } from "foam-core";
import { getFoamLoggerLevel } from "../settings";

enum LogLevel {
  off = 0,
  debug = 1,
  info = 2,
  warn = 3,
  error = 4
}

export interface VsCodeLogger extends ILogger, IDisposable {
  show();
}

export const createLoggerForVsCode = (): VsCodeLogger => {
  let startLogLevel = LogLevel[getFoamLoggerLevel() ?? LogLevel.debug];
  const channel = window.createOutputChannel("Foam");
  channel.appendLine("Foam Logging: " + LogLevel[startLogLevel]);

  const baseLogger = createLogger((level, message, ...params) => {
    if (message) {
      channel.appendLine(
        `[${LogLevel[level]} - ${new Date().toLocaleTimeString()}] ${message}`
      );
    }
    params?.forEach(param => {
      if (param?.stack) {
        channel.appendLine(JSON.stringify(param.stack, null, 2));
      } else {
        channel.appendLine(JSON.stringify(param, null, 2));
      }
    });
  }, startLogLevel);

  return {
    ...baseLogger,
    show: () => {
      channel.show();
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
        LogLevel.debug,
        LogLevel.info,
        LogLevel.warn,
        LogLevel.error
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
