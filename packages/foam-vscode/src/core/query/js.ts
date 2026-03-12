import * as vm from 'vm';
import { FoamWorkspace } from '../model/workspace';
import { FoamGraph } from '../model/graph';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { QueryFilter, QueryResult } from '.';
import { toSlug } from '../utils/slug';
import dayjs from 'dayjs';
import { escapeHtml, renderList, renderResults } from './html';

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

export function renderJsQuery(
  code: string,
  workspace: FoamWorkspace,
  graph: FoamGraph,
  trusted: boolean,
  toRelativePath: (path: string) => string
): string {
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
      const needsPath =
        listFields.includes('title') && !listFields.includes('path');
      const data = needsPath
        ? qr.select([...listFields, 'path']).toArray()
        : qr.select(listFields).toArray();
      return renderList(data, listFields, toRelativePath);
    }
    // Ensure path is fetched for link generation when title is selected,
    // but pass the original descriptor to renderResults so path isn't shown as a column.
    const needsPath =
      desc.select &&
      desc.select.includes('title') &&
      !desc.select.includes('path');
    const results = needsPath
      ? qr.select([...desc.select, 'path']).toArray()
      : qr.toArray();
    return renderResults(results, desc, toRelativePath);
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
        new QueryResult(workspace, graph, trusted, filter as QueryFilter),
    },
  });

  try {
    const context = vm.createContext(sandbox);
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
