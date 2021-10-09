import { window, commands, ExtensionContext } from 'vscode';
import { IDisposable } from '../core/common/lifecycle';
import { BaseLogger, ILogger, LogLevel } from '../core/utils/log';
import { getFoamLoggerLevel } from '../settings';

export interface VsCodeLogger extends ILogger, IDisposable {
  show();
}

export class VsCodeOutputLogger extends BaseLogger implements VsCodeLogger {
  private channel = window.createOutputChannel('Foam');

  constructor() {
    super(getFoamLoggerLevel());
    this.channel.appendLine('Foam Logging: ' + getFoamLoggerLevel());
  }

  log(lvl: LogLevel, msg?: any, ...extra: any[]): void {
    if (msg) {
      this.channel.appendLine(
        `[${lvl} - ${new Date().toLocaleTimeString()}] ${msg}`
      );
    }
    extra?.forEach(param => {
      if (param?.stack) {
        this.channel.appendLine(JSON.stringify(param.stack, null, 2));
      } else {
        this.channel.appendLine(JSON.stringify(param, null, 2));
      }
    });
  }

  show() {
    this.channel.show();
  }
  dispose(): void {
    this.channel.dispose();
  }
}

export const exposeLogger = (
  context: ExtensionContext,
  logger: VsCodeLogger
): void => {
  context.subscriptions.push(
    commands.registerCommand('foam-vscode.set-log-level', async () => {
      const items: LogLevel[] = ['debug', 'info', 'warn', 'error'];
      const level = await window.showQuickPick(
        items.map(item => ({
          label: item,
          description: item === logger.getLevel() && 'Current',
        }))
      );
      logger.setLevel(level.label);
    })
  );
};
