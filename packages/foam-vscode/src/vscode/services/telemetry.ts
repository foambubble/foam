import { TelemetryReporter } from '@vscode/extension-telemetry';
import { workspace } from 'vscode';
import { IDisposable } from '../../core/common/lifecycle';
import { Logger } from '../../core/utils/log';

// Application Insights connection string.
// This is not a secret — it is safe to commit and is only used for ingestion.
// See: https://learn.microsoft.com/en-us/azure/azure-monitor/app/connection-strings
const CONNECTION_STRING = 'YOUR_CONNECTION_STRING_HERE';

export type WorkspaceStatsBucket =
  | '0'
  | '1-10'
  | '11-50'
  | '51-200'
  | '201-500'
  | '500-1000'
  | '1000-2000'
  | '2000-5000'
  | '5000-10000'
  | '10000+';

function bucketNoteCount(count: number): WorkspaceStatsBucket {
  if (count === 0) return '0';
  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  if (count <= 500) return '201-500';
  if (count <= 1000) return '500-1000';
  if (count <= 2000) return '1000-2000';
  if (count <= 5000) return '2000-5000';
  if (count <= 10000) return '5000-10000';
  return '10000+';
}

export class TelemetryService implements IDisposable {
  private reporter: TelemetryReporter;

  constructor() {
    this.reporter = new TelemetryReporter(CONNECTION_STRING);
  }

  /**
   * Track a command invocation. Only the command name is recorded — no arguments.
   */
  trackCommand(command: string): void {
    Logger.debug(`[telemetry] command: ${command}`);
    this.reporter.sendTelemetryEvent('command', { command });
  }

  /**
   * Track a one-per-session signal that a feature was activated/used.
   */
  trackFeature(feature: string, properties?: Record<string, string>): void {
    Logger.debug(`[telemetry] feature: ${feature}`);
    this.reporter.sendTelemetryEvent('feature', { feature, ...properties });
  }

  /**
   * Track a configuration snapshot once per session. Only enum/boolean settings
   * are included — never free-text values that could contain user data.
   */
  trackConfigSnapshot(): void {
    const cfg = workspace.getConfiguration('foam');

    const properties: Record<string, string> = {
      'graph.onStartup': String(cfg.get('graph.onStartup', false)),
      'graph.navigateToPreview': String(cfg.get('graph.navigateToPreview', false)),
      'links.hover.enable': String(cfg.get('links.hover.enable', true)),
      'links.sync.enable': String(cfg.get('links.sync.enable', false)),
      'completion.linkFormat': cfg.get('completion.linkFormat', 'wikilink'),
      'completion.useAlias': String(cfg.get('completion.useAlias', false)),
      'files.defaultNoteExtension': cfg.get('files.defaultNoteExtension', '.md'),
      'ai.enabled': String(cfg.get('experimental.ai', false)),
      'edit.linkReferenceDefinitions': cfg.get('edit.linkReferenceDefinitions', 'off'),
    };

    Logger.debug(`[telemetry] config-snapshot: ${JSON.stringify(properties)}`);
    this.reporter.sendTelemetryEvent('config-snapshot', properties);
  }

  /**
   * Track bucketed workspace size stats. No paths or note titles are included.
   */
  trackWorkspaceStats(
    noteCount: number,
    hasTemplates: boolean,
    hasDailyNoteTemplate: boolean,
    hasAI: boolean,
    graphViewCount: number
  ): void {
    const properties: Record<string, string> = {
      noteCount: bucketNoteCount(noteCount),
      hasTemplates: String(hasTemplates),
      hasDailyNoteTemplate: String(hasDailyNoteTemplate),
      hasAI: String(hasAI),
      graphViewCount: String(graphViewCount),
    };

    Logger.debug(`[telemetry] workspace-stats: ${JSON.stringify(properties)}`);
    this.reporter.sendTelemetryEvent('workspace-stats', properties);
  }

  /**
   * Track an extension error. Only the feature context and error constructor
   * name are recorded — no stack traces or user paths.
   */
  trackError(context: string, error: unknown): void {
    const errorType =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    Logger.debug(`[telemetry] error in ${context}: ${errorType}`);
    this.reporter.sendTelemetryErrorEvent('error', { context, errorType });
  }

  dispose(): void {
    this.reporter.dispose();
  }
}

// Singleton — initialized once in extension.ts, then imported where needed.
let _telemetry: TelemetryService | null = null;

export function initTelemetry(): TelemetryService {
  _telemetry = new TelemetryService();
  return _telemetry;
}

export function getTelemetry(): TelemetryService | null {
  return _telemetry;
}
