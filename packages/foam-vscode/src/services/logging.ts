import { window, commands, ExtensionContext } from "vscode";
import { ILogger, IDisposable, createLogger, LogLevel } from "foam-core";
import { getFoamLoggerLevel } from "../settings";

export interface VsCodeLogger extends ILogger, IDisposable {
  show();
}

export const createLoggerForVsCode = (): VsCodeLogger => {
  const startLogLevel: LogLevel = getFoamLoggerLevel();
  const channel = window.createOutputChannel("Foam");
  channel.appendLine("Foam Logging: " + startLogLevel);

  const baseLogger = createLogger((level, message, ...params) => {
    if (message) {
      channel.appendLine(
        `[${level} - ${new Date().toLocaleTimeString()}] ${message}`
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
      const items: LogLevel[] = ["debug", "info", "warn", "error"];
      const level = await window.showQuickPick(
        items.map(item => ({
          label: item,
          description: item === logger.getLevel() && "Current"
        }))
      );
      logger.setLevel(level.label);
    })
  );
};
