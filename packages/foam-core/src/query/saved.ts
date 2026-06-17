import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { QueryDescriptor } from './index';

/**
 * A named, persisted query. Wraps a {@link QueryDescriptor} with an id and a
 * display name. Consumers (Smart Folders tree view, future CLI / MCP tools,
 * lint rules, etc.) read these from disk and execute them like any other
 * query.
 *
 * The `id` is structural and comes from the storage layer (typically the
 * filename without extension); it is not part of the serialized YAML.
 */
export interface Query {
  id: string;
  name: string;
  description?: string;
  descriptor: QueryDescriptor;
}

export interface ParseQueryResult {
  query?: Query;
  errors: string[];
}

const KNOWN_DESCRIPTOR_FIELDS = new Set([
  'filter',
  'select',
  'sort',
  'limit',
  'offset',
  'format',
]);

const KNOWN_WRAPPER_FIELDS = new Set(['name', 'description']);

/**
 * Parses the YAML content of a saved query file. The `id` comes from the
 * caller — it's derived from the file's location (e.g. the basename), not
 * the file contents.
 */
export function parseQuery(id: string, yamlContent: string): ParseQueryResult {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlContent);
  } catch (e) {
    return { errors: [`Invalid YAML: ${(e as Error).message}`] };
  }

  if (parsed == null) {
    return { errors: ['Query file is empty'] };
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { errors: ['Query file must be a YAML mapping'] };
  }

  const root = parsed as Record<string, unknown>;

  for (const key of Object.keys(root)) {
    if (!KNOWN_WRAPPER_FIELDS.has(key) && !KNOWN_DESCRIPTOR_FIELDS.has(key)) {
      errors.push(`Unknown field "${key}"`);
    }
  }

  const name =
    typeof root.name === 'string' && root.name.trim().length > 0
      ? root.name
      : humanizeQueryId(id);

  const description =
    typeof root.description === 'string' ? root.description : undefined;

  const descriptor: QueryDescriptor = {};
  for (const key of KNOWN_DESCRIPTOR_FIELDS) {
    if (root[key] !== undefined) {
      (descriptor as Record<string, unknown>)[key] = root[key];
    }
  }

  return {
    query: { id, name, description, descriptor },
    errors,
  };
}

/**
 * Serializes a saved query back to YAML. Only `name` and `description` are
 * emitted alongside the descriptor fields; `id` lives in the storage location.
 * A `name` that matches the humanized id is omitted as redundant.
 */
export function serializeQuery(query: Query): string {
  const out: Record<string, unknown> = {};
  if (query.name && query.name !== humanizeQueryId(query.id)) {
    out.name = query.name;
  }
  if (query.description) {
    out.description = query.description;
  }
  for (const key of KNOWN_DESCRIPTOR_FIELDS) {
    const value = (query.descriptor as Record<string, unknown>)[key];
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return stringifyYaml(out);
}

/** Derive an id from a filename like `work-in-progress.yaml` → `work-in-progress`. */
export function idFromQueryFilename(filename: string): string {
  return filename.replace(/\.ya?ml$/i, '');
}

/** Filename for a given id, using `.yaml` extension. */
export function filenameFromQueryId(id: string): string {
  return `${id}.yaml`;
}

/**
 * Convert an id like `work-in-progress` to a display name like
 * `Work In Progress`. Used when the YAML omits `name`.
 */
export function humanizeQueryId(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Sanitize a user-provided name into a filesystem-safe id.
 * Lowercases, replaces whitespace and disallowed characters with `-`.
 */
export function sanitizeQueryId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
