import jexl from 'jexl';
import safeRegex from 'safe-regex2';
import { Resource } from '../model/note';
import { FoamWorkspace } from '../model/workspace';
import { FoamGraph } from '../model/graph';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { stripFrontMatter } from '../utils/md';
import { getDirectory, getExtension, getName } from '../utils/path';

const queryJexl = new jexl.Jexl();
queryJexl.addTransform('length', (v: unknown) =>
  v == null ? 0 : (v as { length: number }).length
);
queryJexl.addTransform('lower', (v: unknown) => String(v).toLowerCase());
queryJexl.addTransform('upper', (v: unknown) => String(v).toUpperCase());

/**
 * Builds a RegExp from a user-supplied pattern. Returns either the compiled
 * regex or a user-facing warning string explaining why it was rejected
 * (catastrophic backtracking, invalid syntax). The caller is responsible for
 * logging and/or surfacing the warning.
 */
export function tryBuildUserRegex(
  pattern: string,
  source: string,
  flags?: string
): { regex: RegExp } | { warning: string } {
  if (!safeRegex(pattern)) {
    return {
      warning: `${source}: pattern rejected as potentially catastrophic: "${pattern}"`,
    };
  }
  try {
    return { regex: new RegExp(pattern, flags) };
  } catch (e) {
    return { warning: `${source}: invalid regex "${pattern}": ${e}` };
  }
}

export type QueryFilter =
  | string // shorthand: "#tag", "[[note-id]]", "*", "/regex/"
  | {
      tag?: string;
      type?: string;
      path?: string; // regex
      title?: string; // regex
      links_to?: string | URI; // note identifier or URI — this resource has an outbound link to it
      links_from?: string | URI; // note identifier or URI — this resource is linked from it
      jexl?: string; // Jexl expression evaluated against `{ resource }`
      /**
       * @deprecated Replaced by `jexl`. The previous implementation used
       * `eval()` and is no longer evaluated — this field is kept on the
       * schema only so old query bodies fail loudly rather than being
       * silently re-interpreted. Use `jexl` instead.
       */
      expression?: string;
      and?: QueryFilter[];
      or?: QueryFilter[];
      not?: QueryFilter;
    };

const SECTION_FIELD_RE = /^section\[([^\]]+)\]$/;

export type SelectInput =
  | string
  | { field: string; label?: string; link?: boolean };
/**
 * Normalised projection entry. Every field is resolved — renderers read
 * `link` directly without re-deriving the default. The "title links by
 * default, everything else is plain text" rule lives in `normalizeSelectEntry`,
 * not in the rendering layer.
 */
export type SelectEntry = { field: string; label: string; link: boolean };

export interface QueryDescriptor {
  filter?: QueryFilter;
  select?: SelectInput[];
  sort?: string; // "field [ASC|DESC]"
  limit?: number;
  offset?: number;
  format?: 'table' | 'list' | 'count';
}

const PROPERTIES_PREFIX_RE = /^properties\.(.+)$/;

export function beautifyFieldLabel(field: string): string {
  const section = SECTION_FIELD_RE.exec(field);
  if (section) return section[1];
  const property = PROPERTIES_PREFIX_RE.exec(field);
  if (property) return property[1];
  return field;
}

/** Default link behaviour: only `title` is clickable unless overridden. */
function defaultLinkFor(field: string): boolean {
  return field === 'title';
}

export function normalizeSelectEntry(input: SelectInput): SelectEntry {
  if (typeof input === 'string') {
    return {
      field: input,
      label: beautifyFieldLabel(input),
      link: defaultLinkFor(input),
    };
  }
  return {
    field: input.field,
    label: input.label ?? beautifyFieldLabel(input.field),
    link: input.link ?? defaultLinkFor(input.field),
  };
}

/**
 * A row in a query result. The URI is structurally guaranteed — it's the
 * resource's identity, present on every projected row regardless of the
 * `select` clause. All other fields are user-selected.
 */
export type ResourceView = { uri: URI } & Record<string, unknown>;

export const DEFAULT_SELECT: SelectEntry[] = [
  { field: 'title', label: 'title', link: true },
  { field: 'path', label: 'path', link: false },
];
export const DEFAULT_LIST_SELECT: SelectEntry[] = [
  { field: 'title', label: 'title', link: true },
];

// --- Filter ---

type Predicate = (r: Resource) => boolean;

/**
 * Result of parsing a filter. `warnings` collects user-facing strings
 * describing each parse-time problem (rejected regex, deprecated field,
 * unresolved link target, Jexl compile error, ...). An empty array means
 * the filter parsed cleanly. Warnings are plain text — callers wrap them
 * for their output medium (HTML for the markdown preview, log line, etc.).
 */
export interface FilterResult {
  predicate: Predicate;
  warnings: string[];
}

export interface QueryExecutionResult {
  results: ResourceView[];
  warnings: string[];
}

/**
 * Builds a resource context for use in JS expressions.
 * Augments the raw Resource with graph-derived fields so users can write
 * `resource.backlinks.length > 3` in expressions.
 */
function makeExpressionContext(r: Resource, graph: FoamGraph) {
  return {
    ...r,
    path: r.uri.path,
    tags: r.tags.map(t => t.label),
    backlinks: graph.getBacklinks(r.uri),
    outlinks: graph.getLinks(r.uri),
  };
}

/**
 * Logs a parse-time warning and returns it for surfacing to the caller.
 * The log channel keeps the full story for debugging; the returned string
 * lets callers render the same message in their output medium.
 */
function warn(message: string): string {
  Logger.warn(`[Query] ${message}`);
  return message;
}

export function parseFilter(
  filter: QueryFilter | undefined,
  workspace: FoamWorkspace,
  graph: FoamGraph,
  trusted: boolean
): FilterResult {
  if (filter === undefined) return { predicate: () => true, warnings: [] };

  if (typeof filter === 'string') {
    return parseShorthand(filter, workspace, graph);
  }

  const predicates: Predicate[] = [];
  const warnings: string[] = [];

  if (filter.tag !== undefined) {
    const label = filter.tag.startsWith('#') ? filter.tag.slice(1) : filter.tag;
    predicates.push(r => r.tags.some(t => t.label === label));
  }

  if (filter.type !== undefined) {
    const type = filter.type;
    predicates.push(r => r.type === type);
  }

  if (filter.path !== undefined) {
    const built = tryBuildUserRegex(filter.path, 'path filter');
    if ('regex' in built) {
      const re = built.regex;
      predicates.push(r => re.test(r.uri.path));
    } else {
      warnings.push(warn(built.warning));
      predicates.push(() => false);
    }
  }

  if (filter.title !== undefined) {
    const built = tryBuildUserRegex(filter.title, 'title filter');
    if ('regex' in built) {
      const re = built.regex;
      predicates.push(r => re.test(r.title));
    } else {
      warnings.push(warn(built.warning));
      predicates.push(() => false);
    }
  }

  if (filter.links_to !== undefined) {
    const target = workspace.find(filter.links_to);
    if (!target) {
      warnings.push(
        warn(`links_to: "${filter.links_to}" not found in workspace`)
      );
      predicates.push(() => false);
    } else {
      const targetPath = target.uri.path;
      predicates.push(r =>
        graph.getLinks(r.uri).some(c => c.target.path === targetPath)
      );
    }
  }

  if (filter.links_from !== undefined) {
    const source = workspace.find(filter.links_from);
    if (!source) {
      warnings.push(
        warn(`links_from: "${filter.links_from}" not found in workspace`)
      );
      predicates.push(() => false);
    } else {
      const sourcePath = source.uri.path;
      predicates.push(r =>
        graph.getBacklinks(r.uri).some(c => c.source.path === sourcePath)
      );
    }
  }

  if (filter.jexl !== undefined) {
    let compiled: ReturnType<typeof queryJexl.compile> | undefined;
    try {
      compiled = queryJexl.compile(filter.jexl);
    } catch (e) {
      warnings.push(warn(`jexl compile error: ${e}`));
    }
    if (compiled === undefined) {
      predicates.push(() => false);
    } else {
      const expr = compiled;
      predicates.push(r => {
        try {
          return Boolean(
            expr.evalSync({ resource: makeExpressionContext(r, graph) })
          );
        } catch (e) {
          // Runtime errors fire per-resource and would be noisy if surfaced
          // to the rendered preview; log-only is intentional.
          Logger.warn(`[Query] jexl runtime error: ${e}`);
          return false;
        }
      });
    }
  } else if (filter.expression !== undefined) {
    // The `expression` field used to be evaluated with `eval()`, which is RCE
    // in any trusted workspace. The field is preserved on the schema so legacy
    // queries fail loudly — they match nothing rather than being silently
    // re-evaluated by the jexl engine with different semantics.
    warnings.push(
      warn(
        'the `expression` filter is deprecated and no longer evaluated; use `jexl` instead'
      )
    );
    predicates.push(() => false);
  }

  if (filter.and !== undefined) {
    const subs = filter.and.map(f => parseFilter(f, workspace, graph, trusted));
    subs.forEach(s => warnings.push(...s.warnings));
    predicates.push(r => subs.every(s => s.predicate(r)));
  }

  if (filter.or !== undefined) {
    const subs = filter.or.map(f => parseFilter(f, workspace, graph, trusted));
    subs.forEach(s => warnings.push(...s.warnings));
    predicates.push(r => subs.some(s => s.predicate(r)));
  }

  if (filter.not !== undefined) {
    const sub = parseFilter(filter.not, workspace, graph, trusted);
    warnings.push(...sub.warnings);
    predicates.push(r => !sub.predicate(r));
  }

  const predicate: Predicate =
    predicates.length === 0
      ? () => true
      : r => predicates.every(p => p(r));
  return { predicate, warnings };
}

function parseShorthand(
  filter: string,
  workspace: FoamWorkspace,
  graph: FoamGraph
): FilterResult {
  if (filter === '*' || filter === '') {
    return { predicate: () => true, warnings: [] };
  }

  // "#tag"
  if (filter.startsWith('#')) {
    const label = filter.slice(1);
    return {
      predicate: r => r.tags.some(t => t.label === label),
      warnings: [],
    };
  }

  // "[[note-id]]" — same identifier as used in wikilinks
  if (filter.startsWith('[[') && filter.endsWith(']]')) {
    const identifier = filter.slice(2, -2);
    const target = workspace.find(identifier);
    if (!target) {
      return {
        predicate: () => false,
        warnings: [warn(`[[${identifier}]] not found in workspace`)],
      };
    }
    const targetPath = target.uri.path;
    return {
      predicate: r =>
        graph.getLinks(r.uri).some(c => c.target.path === targetPath) ||
        graph.getBacklinks(r.uri).some(c => c.source.path === targetPath),
      warnings: [],
    };
  }

  // "/regex/"
  if (filter.startsWith('/') && filter.endsWith('/') && filter.length > 2) {
    const built = tryBuildUserRegex(filter.slice(1, -1), 'shorthand /regex/');
    if ('regex' in built) {
      const re = built.regex;
      return { predicate: r => re.test(r.uri.path), warnings: [] };
    }
    return {
      predicate: () => false,
      warnings: [warn(built.warning)],
    };
  }

  return {
    predicate: () => true,
    warnings: [warn(`unrecognized shorthand filter: "${filter}"`)],
  };
}

// --- Projection ---

/**
 * Synchronous reader returning the raw markdown source of a resource.
 * Injected by the host (VS Code, CLI, MCP) so the query layer stays
 * independent of `IDataStore`'s async API. When omitted, source-derived
 * fields (`body`, `content`, `section[...]`) resolve to `undefined`.
 */
export type SourceReader = (uri: URI) => string | null | undefined;

/**
 * Returns true for fields whose value is derived from the resource's raw
 * source text (`body`, `content`, `section[Label]`, and — eventually —
 * `block[id]`). These fields require a `SourceReader` to resolve and are
 * rendered as markdown rather than escaped as scalars. Centralised here so
 * we add a new content-bearing field by editing one place.
 */
export function requiresSource(field: string): boolean {
  return (
    field === 'body' || field === 'content' || SECTION_FIELD_RE.test(field)
  );
}

function stripH1Title(source: string): string {
  const lines = source.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    let next = i + 1;
    if (next < lines.length && lines[next].trim() === '') next++;
    return lines.slice(next).join('\n');
  }
  return source;
}

function getSectionContent(r: Resource, source: string, label: string): string | undefined {
  // Case-sensitive: matches `Resource.findSection` so labels work the same way
  // in `section[Foo]` selects as in `![[note#Foo]]` embeds.
  const section = r.sections.find(s => s.label === label);
  if (!section) return undefined;
  // Section range is half-open at end.line; start.line is the heading row, so
  // skip it.
  const lines = source.split(/\r?\n/);
  return lines.slice(section.range.start.line + 1, section.range.end.line).join('\n');
}

function buildFullView(r: Resource, graph: FoamGraph): Record<string, unknown> {
  return {
    title: r.title,
    path: r.uri.path,
    filename: getName(r.uri.path),
    folder: getDirectory(r.uri.path),
    extension: getExtension(r.uri.path),
    type: r.type,
    tags: r.tags.map(t => t.label),
    aliases: r.aliases.map(a => a.title),
    links: r.links,
    sections: r.sections.map(s => s.label),
    blocks: r.blocks,
    properties: r.properties,
    'backlink-count': graph.getBacklinks(r.uri).length,
    'outlink-count': graph.getLinks(r.uri).length,
  };
}

function resolveField(
  r: Resource,
  full: Record<string, unknown>,
  field: string,
  getSource: () => string | undefined
): unknown {
  if (field === 'body') {
    const src = getSource();
    return src === undefined ? undefined : stripFrontMatter(src);
  }
  if (field === 'content') {
    const src = getSource();
    return src === undefined ? undefined : stripH1Title(stripFrontMatter(src));
  }
  const sectionMatch = SECTION_FIELD_RE.exec(field);
  if (sectionMatch) {
    const src = getSource();
    if (src === undefined) return undefined;
    return getSectionContent(r, src, sectionMatch[1]);
  }
  const dot = field.indexOf('.');
  if (dot === -1) return full[field];
  const parent = full[field.slice(0, dot)];
  if (parent == null || typeof parent !== 'object') return undefined;
  return (parent as Record<string, unknown>)[field.slice(dot + 1)];
}

function projectResource(
  r: Resource,
  graph: FoamGraph,
  fields: string[],
  readSource?: SourceReader
): ResourceView {
  const full = buildFullView(r, graph);
  const needsSource = fields.some(requiresSource);
  let cached: string | undefined;
  let cacheLoaded = false;
  const getSource = (): string | undefined => {
    if (!needsSource || !readSource) return undefined;
    if (!cacheLoaded) {
      const raw = readSource(r.uri);
      cached = raw == null ? undefined : raw;
      cacheLoaded = true;
    }
    return cached;
  };
  // `uri` is stamped on every row regardless of `select` — see the
  // `ResourceView` type. Renderers rely on it to generate links and resolve
  // source-derived cells without forcing the user to add `path` to `select`.
  const projected: ResourceView = { uri: r.uri };
  for (const f of fields) {
    projected[f] = resolveField(r, full, f, getSource);
  }
  return projected;
}

// --- Sorting ---

function compareValues(a: unknown, b: unknown): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function parseSortDescriptor(sort: string): {
  field: string;
  direction: 'asc' | 'desc';
} {
  const parts = sort.trim().split(/\s+/);
  return {
    field: parts[0],
    direction: parts[1]?.toUpperCase() === 'DESC' ? 'desc' : 'asc',
  };
}

// All fields produced by buildFullView — used by QueryResult to fetch everything
// before JS predicates are applied.
export const ALL_QUERY_FIELDS = [
  'title',
  'path',
  'filename',
  'folder',
  'extension',
  'type',
  'tags',
  'aliases',
  'sections',
  'blocks',
  'properties',
  'backlink-count',
  'outlink-count',
];

// --- QueryResult (fluent JS query builder) ------------------------------

/**
 * Fluent builder for programmatic queries.
 * Call `foam.pages(filter)` in foam-query-js blocks to obtain one.
 */
export class QueryResult {
  private _descriptor: QueryDescriptor;
  private _jsPredicates: Array<(r: ResourceView) => boolean> = [];

  constructor(
    private readonly workspace: FoamWorkspace,
    private readonly graph: FoamGraph,
    private readonly trusted: boolean,
    filter?: QueryFilter,
    private readonly readSource?: SourceReader
  ) {
    this._descriptor = { filter };
  }

  get descriptor(): QueryDescriptor {
    return this._descriptor;
  }

  private clone(): QueryResult {
    const c = new QueryResult(
      this.workspace,
      this.graph,
      this.trusted,
      this._descriptor.filter,
      this.readSource
    );
    c._descriptor = { ...this._descriptor };
    c._jsPredicates = [...this._jsPredicates];
    return c;
  }

  /** Add a JS predicate applied after the base filter. */
  where(predicate: (r: ResourceView) => boolean): QueryResult {
    const c = this.clone();
    c._jsPredicates = [...c._jsPredicates, predicate];
    return c;
  }

  sortBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryResult {
    const c = this.clone();
    c._descriptor = {
      ...c._descriptor,
      sort: `${field} ${direction.toUpperCase()}`,
    };
    return c;
  }

  limit(n: number): QueryResult {
    const c = this.clone();
    c._descriptor = { ...c._descriptor, limit: n };
    return c;
  }

  offset(n: number): QueryResult {
    const c = this.clone();
    c._descriptor = { ...c._descriptor, offset: n };
    return c;
  }

  select(fields: SelectInput[]): QueryResult {
    const c = this.clone();
    c._descriptor = {
      ...c._descriptor,
      select: fields.map(normalizeSelectEntry),
    };
    return c;
  }

  format(f: 'table' | 'list' | 'count'): QueryResult {
    const c = this.clone();
    c._descriptor = { ...c._descriptor, format: f };
    return c;
  }

  /**
   * Executes the query and returns projected ResourceViews. `.where(...)`
   * predicates may reference source-derived fields, so they force the slow
   * path: fetch the full view, filter, then sort/limit. Without `.where`,
   * sort/offset/limit are pushed into `executeQuery` so source is read only
   * for the surviving slice.
   */
  toArray(): ResourceView[] {
    const userSelect = (this._descriptor.select ?? DEFAULT_SELECT).map(
      normalizeSelectEntry
    );
    const userFields = userSelect.map(e => e.field);

    if (this._jsPredicates.length === 0) {
      return executeQuery(
        {
          filter: this._descriptor.filter,
          select: userSelect,
          sort: this._descriptor.sort,
          offset: this._descriptor.offset,
          limit: this._descriptor.limit,
        },
        this.workspace,
        this.graph,
        { trusted: this.trusted, readSource: this.readSource }
      ).results;
    }

    const sourceDerived = userFields.filter(requiresSource);
    const fullSelect: SelectEntry[] = [
      ...ALL_QUERY_FIELDS.map(f => normalizeSelectEntry(f)),
      ...sourceDerived.map(f => normalizeSelectEntry(f)),
    ];
    let results = executeQuery(
      {
        filter: this._descriptor.filter,
        select: fullSelect,
      },
      this.workspace,
      this.graph,
      { trusted: this.trusted, readSource: this.readSource }
    ).results;

    for (const pred of this._jsPredicates) {
      try {
        results = results.filter(pred);
      } catch (e) {
        Logger.warn(`[foam-query] JS predicate error: ${e}`);
      }
    }

    if (this._descriptor.sort) {
      const { field, direction } = parseSortDescriptor(this._descriptor.sort);
      results = [...results].sort((a, b) => {
        const cmp = compareValues(a[field], b[field]);
        return direction === 'desc' ? -cmp : cmp;
      });
    }

    const offsetN = this._descriptor.offset ?? 0;
    if (offsetN > 0) results = results.slice(offsetN);
    if (this._descriptor.limit !== undefined)
      results = results.slice(0, this._descriptor.limit);

    return results.map(r => {
      const view: ResourceView = { uri: r.uri };
      for (const f of userFields) view[f] = r[f];
      return view;
    });
  }
}

// --- executeQuery ---

export function executeQuery(
  query: QueryDescriptor,
  workspace: FoamWorkspace,
  graph: FoamGraph,
  options: { trusted: boolean; readSource?: SourceReader }
): QueryExecutionResult {
  const { predicate, warnings } = parseFilter(
    query.filter,
    workspace,
    graph,
    options.trusted
  );
  const fields = (query.select ?? DEFAULT_SELECT)
    .map(normalizeSelectEntry)
    .map(e => e.field);

  // Sort + offset + limit before reading source — otherwise a query with
  // `select: [body]` over a broad filter would synchronously read every
  // matched note. Sort keys can't be source-derived so this is safe.
  const cheapFields = fields.filter(f => !requiresSource(f));
  const matched = workspace.list().filter(predicate);

  let slice = matched.map(r =>
    projectResource(r, graph, cheapFields, undefined)
  );

  if (query.sort) {
    const { field, direction } = parseSortDescriptor(query.sort);
    slice = [...slice].sort((a, b) => {
      const cmp = compareValues(a[field], b[field]);
      return direction === 'desc' ? -cmp : cmp;
    });
  }

  const offset = query.offset ?? 0;
  if (offset > 0) {
    slice = slice.slice(offset);
  }
  if (query.limit !== undefined) {
    slice = slice.slice(0, query.limit);
  }

  const sourceFields = fields.filter(requiresSource);
  if (sourceFields.length === 0) {
    return { results: slice, warnings };
  }

  // Map keeps the row→Resource lookup at O(1) per surviving row.
  const byPath = new Map<string, Resource>();
  for (const r of matched) byPath.set(r.uri.path, r);

  const results = slice.map(row => {
    const resource = byPath.get(row.uri.path);
    if (!resource) return row;
    const sourceProjection = projectResource(
      resource,
      graph,
      sourceFields,
      options.readSource
    );
    const merged: ResourceView = { ...row };
    for (const f of sourceFields) merged[f] = sourceProjection[f];
    return merged;
  });

  return { results, warnings };
}
