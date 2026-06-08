import { TelemetryReporter } from '@vscode/extension-telemetry';
import { workspace } from 'vscode';
import {
  IDisposable,
  Logger,
  TELEMETRY_CONNECTION_STRING,
  bucketNoteCount,
} from '@foam/core';

const EVENT_PREFIX = 'vscode.';

export interface TelemetryServiceOptions {
  /** Version of the foam-vscode extension (from its `package.json`). */
  foamVersion: string;
  /** Version of `@foam/core` (from its `package.json`). */
  coreVersion: string;
}

/**
 * VS Code telemetry adapter. Wraps the Azure App Insights client from
 * `@vscode/extension-telemetry` and prefixes every event with `vscode.`
 * so the same App Insights resource can host events from CLI and MCP
 * without collision.
 *
 * Attaches Foam's common dimensions (`foam.component`, `foam.version`,
 * `foam.coreVersion`) to every event via the library's `commonProperties`
 * hook, so CLI / MCP / VS Code events can be filtered by the same
 * dimension names. The library additionally attaches its own `common.*`
 * set (extension name/version, OS, VS Code version, machine ID) — see
 * `docs/user/tools/telemetry.md` for the full list.
 */
export class TelemetryService implements IDisposable {
  private reporter: TelemetryReporter;
  private sessionWithCommandFired = false;
  private sessionWithNoteFired = false;

  constructor(opts: TelemetryServiceOptions) {
    this.reporter = new TelemetryReporter(
      TELEMETRY_CONNECTION_STRING,
      undefined,
      undefined,
      undefined,
      {
        commonProperties: {
          'foam.component': 'vscode',
          'foam.version': opts.foamVersion,
          'foam.coreVersion': opts.coreVersion,
        },
      }
    );
  }

  trackEvent(name: string, properties?: Record<string, string>): void {
    const fullName = EVENT_PREFIX + name;
    Logger.debug(
      `[telemetry] ${fullName}${properties ? ' ' + JSON.stringify(properties) : ''}`
    );
    this.reporter.sendTelemetryEvent(fullName, properties);
  }

  trackError(
    context: string,
    error: unknown,
    properties?: Record<string, string>
  ): void {
    const errorType =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    const fullName = EVENT_PREFIX + 'error';
    Logger.debug(`[telemetry] ${fullName} in ${context}: ${errorType}`);
    this.reporter.sendTelemetryErrorEvent(fullName, {
      context,
      errorType,
      ...properties,
    });
  }

  /**
   * Fired once per activation, before Foam loads. The canonical "active session" metric.
   */
  trackSession(): void {
    this.trackEvent('session-started');
  }

  /**
   * Fired every time a command is invoked. Also fires `session-with-command` once
   * per session on the first invocation, distinguishing "Foam loaded" from "Foam was used".
   */
  trackCommand(command: string): void {
    if (!this.sessionWithCommandFired) {
      this.trackEvent('session-with-command');
      this.sessionWithCommandFired = true;
    }
    this.trackEvent('command', { command });
  }

  /**
   * Fired the first time a markdown file is opened in this session.
   * Proxy for "this workspace is being used for notes, not just code".
   */
  trackNoteOpened(): void {
    if (this.sessionWithNoteFired) return;
    this.trackEvent('session-with-note');
    this.sessionWithNoteFired = true;
  }

  /**
   * Fired the first time a feature is activated within a session.
   */
  trackFeature(feature: string, properties?: Record<string, string>): void {
    this.trackEvent('feature', { feature, ...properties });
  }

  /**
   * Once per session: the values of selected enum/boolean settings.
   * Free-text settings (paths, templates) are never included.
   */
  trackConfigSnapshot(): void {
    const cfg = workspace.getConfiguration('foam');

    const properties: Record<string, string> = {
      'graph.onStartup': String(cfg.get('graph.onStartup', false)),
      'graph.navigateToPreview': String(
        cfg.get('graph.navigateToPreview', false)
      ),
      'graph.viewsConfigured': String(
        cfg.get<unknown[]>('graph.views', []).length
      ),
      'links.hover.enable': String(cfg.get('links.hover.enable', true)),
      'links.sync.enable': String(cfg.get('links.sync.enable', false)),
      'completion.linkFormat': cfg.get('completion.linkFormat', 'wikilink'),
      'completion.useAlias': String(cfg.get('completion.useAlias', false)),
      'files.defaultNoteExtension': cfg.get(
        'files.defaultNoteExtension',
        '.md'
      ),
      'ai.enabled': String(cfg.get('experimental.ai', false)),
      'edit.linkReferenceDefinitions': cfg.get(
        'edit.linkReferenceDefinitions',
        'off'
      ),
    };

    this.trackEvent('config-snapshot', properties);
  }

  /**
   * Once per session: bucketed workspace shape. No paths or note titles.
   *
   * `noteCount` is markdown notes only; `attachmentCount` covers images +
   * other attachments. Keeping them separate lets analytics distinguish
   * "heavy writer" workspaces from "image-heavy scratchpad" workspaces,
   * which otherwise look identical when collapsed into a single total.
   */
  trackWorkspaceStats(
    noteCount: number,
    attachmentCount: number,
    hasTemplates: boolean,
    hasDailyNoteTemplate: boolean
  ): void {
    this.trackEvent('workspace-stats', {
      noteCount: bucketNoteCount(noteCount),
      attachmentCount: bucketNoteCount(attachmentCount),
      hasTemplates: String(hasTemplates),
      hasDailyNoteTemplate: String(hasDailyNoteTemplate),
    });
  }

  async dispose(): Promise<void> {
    await this.reporter.dispose();
  }
}

// Singleton — initialized once in extension.ts, then imported where needed.
let _telemetry: TelemetryService | null = null;

export function initTelemetry(opts: TelemetryServiceOptions): TelemetryService {
  _telemetry = new TelemetryService(opts);
  return _telemetry;
}

export function getTelemetry(): TelemetryService | null {
  return _telemetry;
}
