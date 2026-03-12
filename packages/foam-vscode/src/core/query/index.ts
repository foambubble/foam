import { Resource } from '../model/note';
import { FoamWorkspace } from '../model/workspace';
import { FoamGraph } from '../model/graph';
import { Logger } from '../utils/log';

export type QueryFilter =
  | string // shorthand: "#tag", "[[note-id]]", "*", "/regex/"
  | {
      tag?: string;
      type?: string;
      path?: string; // regex
      title?: string; // regex
      links_to?: string; // note identifier — this resource has an outbound link to it
      links_from?: string; // note identifier — this resource is linked from it
      expression?: string; // JS expression; requires trusted workspace
      and?: QueryFilter[];
      or?: QueryFilter[];
      not?: QueryFilter;
    };

export interface QueryDescriptor {
  filter?: QueryFilter;
  select?: string[];
  sort?: string; // "field [ASC|DESC]"
  limit?: number;
  offset?: number;
  format?: 'table' | 'list' | 'count';
}

export type ResourceView = Record<string, unknown>;

const DEFAULT_SELECT = ['title', 'path'];

// --- Filter ---

type Predicate = (r: Resource) => boolean;

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

export function parseFilter(
  filter: QueryFilter | undefined,
  workspace: FoamWorkspace,
  graph: FoamGraph,
  trusted: boolean
): Predicate {
  if (filter === undefined) return () => true;

  if (typeof filter === 'string') {
    return parseShorthand(filter, workspace, graph);
  }

  const predicates: Predicate[] = [];

  if (filter.tag !== undefined) {
    const label = filter.tag.startsWith('#') ? filter.tag.slice(1) : filter.tag;
    predicates.push(r => r.tags.some(t => t.label === label));
  }

  if (filter.type !== undefined) {
    const type = filter.type;
    predicates.push(r => r.type === type);
  }

  if (filter.path !== undefined) {
    const re = new RegExp(filter.path);
    predicates.push(r => re.test(r.uri.path));
  }

  if (filter.title !== undefined) {
    const re = new RegExp(filter.title);
    predicates.push(r => re.test(r.title));
  }

  if (filter.links_to !== undefined) {
    const target = workspace.find(filter.links_to);
    if (!target) {
      Logger.warn(
        `[Query] links_to: "${filter.links_to}" not found in workspace`
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
      Logger.warn(
        `[Query] links_from: "${filter.links_from}" not found in workspace`
      );
      predicates.push(() => false);
    } else {
      const sourcePath = source.uri.path;
      predicates.push(r =>
        graph.getBacklinks(r.uri).some(c => c.source.path === sourcePath)
      );
    }
  }

  if (filter.expression !== undefined) {
    if (trusted) {
      const expr = filter.expression;
      predicates.push(r => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const resource = makeExpressionContext(r, graph);

          return Boolean(eval(expr));
        } catch (e) {
          Logger.warn(`[Query] expression error: ${e}`);
          return false;
        }
      });
    } else {
      Logger.warn(
        '[Query] expression filter skipped — workspace is not trusted'
      );
    }
  }

  if (filter.and !== undefined) {
    const subs = filter.and.map(f => parseFilter(f, workspace, graph, trusted));
    predicates.push(r => subs.every(p => p(r)));
  }

  if (filter.or !== undefined) {
    const subs = filter.or.map(f => parseFilter(f, workspace, graph, trusted));
    predicates.push(r => subs.some(p => p(r)));
  }

  if (filter.not !== undefined) {
    const sub = parseFilter(filter.not, workspace, graph, trusted);
    predicates.push(r => !sub(r));
  }

  if (predicates.length === 0) return () => true;
  return r => predicates.every(p => p(r));
}

function parseShorthand(
  filter: string,
  workspace: FoamWorkspace,
  graph: FoamGraph
): Predicate {
  if (filter === '*' || filter === '') return () => true;

  // "#tag"
  if (filter.startsWith('#')) {
    const label = filter.slice(1);
    return r => r.tags.some(t => t.label === label);
  }

  // "[[note-id]]" — same identifier as used in wikilinks
  if (filter.startsWith('[[') && filter.endsWith(']]')) {
    const identifier = filter.slice(2, -2);
    const target = workspace.find(identifier);
    if (!target) {
      Logger.warn(`[Query] [[${identifier}]] not found in workspace`);
      return () => false;
    }
    const targetPath = target.uri.path;
    return r =>
      graph.getLinks(r.uri).some(c => c.target.path === targetPath) ||
      graph.getBacklinks(r.uri).some(c => c.source.path === targetPath);
  }

  // "/regex/"
  if (filter.startsWith('/') && filter.endsWith('/') && filter.length > 2) {
    const re = new RegExp(filter.slice(1, -1));
    return r => re.test(r.uri.path);
  }

  Logger.warn(`[Query] unrecognized shorthand filter: "${filter}"`);
  return () => true;
}

// --- Projection ---

function buildFullView(r: Resource, graph: FoamGraph): Record<string, unknown> {
  return {
    title: r.title,
    path: r.uri.path,
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

function resolveField(full: Record<string, unknown>, field: string): unknown {
  const dot = field.indexOf('.');
  if (dot === -1) return full[field];
  const parent = full[field.slice(0, dot)];
  if (parent == null || typeof parent !== 'object') return undefined;
  return (parent as Record<string, unknown>)[field.slice(dot + 1)];
}

function projectResource(
  r: Resource,
  graph: FoamGraph,
  fields: string[]
): ResourceView {
  const full = buildFullView(r, graph);
  return Object.fromEntries(fields.map(f => [f, resolveField(full, f)]));
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
    filter?: QueryFilter
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
      this._descriptor.filter
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

  select(fields: string[]): QueryResult {
    const c = this.clone();
    c._descriptor = { ...c._descriptor, select: fields };
    return c;
  }

  format(f: 'table' | 'list' | 'count'): QueryResult {
    const c = this.clone();
    c._descriptor = { ...c._descriptor, format: f };
    return c;
  }

  /**
   * Executes the query and returns projected ResourceViews.
   * JS predicates (.where()) are applied before projection/sort/paginate
   * so they have access to all fields.
   */
  toArray(): ResourceView[] {
    const baseDescriptor: QueryDescriptor = {
      filter: this._descriptor.filter,
      select: ALL_QUERY_FIELDS,
    };
    let results = executeQuery(baseDescriptor, this.workspace, this.graph, {
      trusted: this.trusted,
    });

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

    const fields = this._descriptor.select ?? DEFAULT_SELECT;
    return results.map(r => Object.fromEntries(fields.map(f => [f, r[f]])));
  }
}

// --- executeQuery ---

export function executeQuery(
  query: QueryDescriptor,
  workspace: FoamWorkspace,
  graph: FoamGraph,
  options: { trusted: boolean }
): ResourceView[] {
  const predicate = parseFilter(
    query.filter,
    workspace,
    graph,
    options.trusted
  );
  const fields = query.select ?? DEFAULT_SELECT;

  let results = workspace
    .list()
    .filter(predicate)
    .map(r => projectResource(r, graph, fields));

  if (query.sort) {
    const { field, direction } = parseSortDescriptor(query.sort);
    results = [...results].sort((a, b) => {
      const cmp = compareValues(a[field], b[field]);
      return direction === 'desc' ? -cmp : cmp;
    });
  }

  const offset = query.offset ?? 0;
  if (offset > 0) {
    results = results.slice(offset);
  }

  if (query.limit !== undefined) {
    results = results.slice(0, query.limit);
  }

  return results;
}
