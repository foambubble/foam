import * as vm from 'vm';
import { FoamWorkspace } from '../model/workspace';
import { FoamGraph } from '../model/graph';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { QueryFilter, QueryResult, SourceReader, requiresSource } from '.';
import { toSlug } from '../utils/slug';
import dayjs from 'dayjs';
import {
  escapeHtml,
  renderList,
  renderResults,
  MarkdownRenderer,
} from './html';
import { RenderContext } from './render-context';

const EXECUTION_TIMEOUT = 10_000;

// Globals that must not be accessible in the query sandbox.
const BLOCKED_GLOBALS = [
  'require',
  'module',
  'exports',
  '__dirname',
  '__filename',
  'global',
  'process',
  'Buffer',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
  'eval',
  'Function',
];

const JS_PLACEHOLDER = `<div class="foam-query-placeholder">
<p>Use <code>\`\`\`foam-query-js</code> blocks to write a script to query notes. For example:</p>
<pre>\`\`\`foam-query-js
render(foam.pages('#my-tag').sortBy('title').format('list'));
\`\`\`</pre>
<p>Read the full documentation <a href="https://github.com/foambubble/foam/blob/main/docs/user/features/foam-queries.md">here</a></p>
</div>`;

export interface RenderJsQueryOptions {
  workspace: FoamWorkspace;
  graph: FoamGraph;
  trusted: boolean;
  toRelativePath: (path: string) => string;
  currentResource?: URI | null;
  readSource?: SourceReader;
  renderMarkdown?: MarkdownRenderer;
  context?: RenderContext;
}

export function renderJsQuery(
  code: string,
  opts: RenderJsQueryOptions
): string {
  const {
    workspace,
    graph,
    trusted,
    toRelativePath,
    currentResource,
    readSource,
    renderMarkdown,
    context,
  } = opts;
  if (code.trim() === '') {
    return JS_PLACEHOLDER;
  }

  if (!trusted) {
    return `<div class="foam-query-untrusted">foam-query-js requires a trusted workspace. <a href="command:workbench.action.manageTrustedDomain">Manage trust</a></div>`;
  }

  const htmlParts: string[] = [];

  const renderQueryResult = (qr: QueryResult): string => {
    const desc = qr.descriptor;
    const format =
      desc.format ?? (desc.select && desc.select.length > 1 ? 'table' : 'list');
    if (format === 'list') {
      const listFields = desc.select ?? ['title'];
      return renderList(
        qr.select(listFields).toArray(),
        listFields,
        toRelativePath,
        renderMarkdown,
        context
      );
    }
    return renderResults(
      qr.toArray(),
      desc,
      toRelativePath,
      renderMarkdown,
      context
    );
  };

  const render = (value: QueryResult | string | undefined | null) => {
    if (value instanceof QueryResult) {
      htmlParts.push(renderQueryResult(value));
    } else if (value !== undefined && value !== null) {
      htmlParts.push(`<p>${escapeHtml(String(value))}</p>`);
    }
  };

  const sandbox: Record<string, unknown> = {};
  BLOCKED_GLOBALS.forEach(g => {
    sandbox[g] = undefined;
  });
  Object.assign(sandbox, {
    Date,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    JSON,
    RegExp,
    Error,
    console: {
      log: (...args: unknown[]) =>
        Logger.info(`[foam-query-js] ${args[0]}`, ...args.slice(1)),
      warn: (...args: unknown[]) =>
        Logger.warn(`[foam-query-js] ${args[0]}`, ...args.slice(1)),
      error: (...args: unknown[]) =>
        Logger.error(`[foam-query-js] ${args[0]}`, ...args.slice(1)),
    },
    dayjs,
    slugify: toSlug,
    URI,
    render,
    foam: {
      pages: (filter?: QueryFilter | string) =>
        new QueryResult(
          workspace,
          graph,
          trusted,
          filter as QueryFilter,
          readSource
        ),
      current: null as URI | null,
    },
  });

  try {
    const context = vm.createContext(sandbox);
    // Reconstruct foam.current inside the VM context so it is a proper URI
    // instance from the context's perspective (instanceof checks do not
    // work correctly across contexts, so we recreate it).
    if (currentResource) {
      new vm.Script(
        `foam.current = new URI({ scheme: ${JSON.stringify(
          currentResource.scheme
        )}, authority: ${JSON.stringify(
          currentResource.authority
        )}, path: ${JSON.stringify(currentResource.path)} });`
      ).runInContext(context);
    }
    new vm.Script(code).runInContext(context, { timeout: EXECUTION_TIMEOUT });
  } catch (e) {
    return `<div class="foam-query-error">Script error: ${escapeHtml(
      String(e)
    )}</div>`;
  }

  return (
    htmlParts.join('\n') ||
    '<p class="foam-query-empty">No output. Did you forget to call render()?</p>'
  );
}
