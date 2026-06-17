import { TelemetryReporter } from '@vscode/extension-telemetry';
import { Disposable, TreeView, workspace } from 'vscode';
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
  private panelVisibleFired = new Set<string>();
  private panelInteractionFired = new Set<string>();

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
   * Fired the first time a given tree view becomes visible in a session.
   * Proxy for "the user actually looks at this panel" — distinguishes
   * panels users keep open from ones they ignore. Subsequent visibility
   * changes for the same panel are dropped.
   */
  trackPanelVisible(panel: string): void {
    if (this.panelVisibleFired.has(panel)) return;
    this.panelVisibleFired.add(panel);
    this.trackEvent('panel-visible', { panel });
  }

  /**
   * Fired the first time the user interacts with a given panel in a session
   * (click, selection change). Subsequent interactions for the same panel
   * are dropped — the goal is "did they engage at all", not interaction
   * volume. If we want intensity later, add a separate event.
   */
  trackPanelInteraction(panel: string): void {
    if (this.panelInteractionFired.has(panel)) return;
    this.panelInteractionFired.add(panel);
    this.trackEvent('panel-interaction', { panel });
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
      'files.defaultNoteExtension': bucketNoteExtension(
        cfg.get('files.defaultNoteExtension', 'md')
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
  /**
   * `extras` carries per-feature contributions (smart-folder count, etc.)
   * already pre-formatted by the caller. The two positional args remain
   * because they're computed centrally from the workspace; everything else
   * comes through the bag so the event schema can grow without churning
   * this signature.
   */
  trackWorkspaceStats(
    noteCount: number,
    attachmentCount: number,
    extras: Record<string, string> = {}
  ): void {
    this.trackEvent('workspace-stats', {
      noteCount: bucketNoteCount(noteCount),
      attachmentCount: bucketNoteCount(attachmentCount),
      ...extras,
    });
  }

  async dispose(): Promise<void> {
    await this.reporter.dispose();
  }
}

/**
 * `files.defaultNoteExtension` is a free-string user setting — clamp it to a
 * known allowlist so telemetry can't be turned into an unbounded dimension.
 * Anything we don't recognize collapses to `other`.
 */
const KNOWN_NOTE_EXTENSIONS = new Set([
  'md',
  'markdown',
  'mdx',
  'mdown',
  'mkd',
  'mkdn',
  'txt',
  'text',
  'rst',
  'org',
  'adoc',
  'asciidoc',
  'ipynb',
  'qmd',
  'rmd',
]);

function bucketNoteExtension(raw: string): string {
  const normalized = raw.trim().toLowerCase().replace(/^\./, '');
  return KNOWN_NOTE_EXTENSIONS.has(normalized) ? normalized : 'other';
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

/**
 * Wires `trackPanelVisible` + `trackPanelInteraction` into a tree view's
 * visibility and selection events. Returns the disposables — caller must
 * register them (typically `context.subscriptions.push(...)`). No-ops if
 * the telemetry singleton hasn't been initialized.
 */
export function instrumentTreeView<T>(
  treeView: TreeView<T>,
  panelId: string
): Disposable[] {
  return [
    treeView.onDidChangeVisibility(e => {
      if (e.visible) getTelemetry()?.trackPanelVisible(panelId);
    }),
    treeView.onDidChangeSelection(() =>
      getTelemetry()?.trackPanelInteraction(panelId)
    ),
  ];
}
