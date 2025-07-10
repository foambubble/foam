import { URI } from './uri';
import { Range } from './range';

export interface ResourceLink {
  type: 'wikilink' | 'link';
  rawText: string;
  range: Range;
  isEmbed: boolean;
}

export interface NoteLinkDefinition {
  label: string;
  url: string;
  title?: string;
  range?: Range;
}

export abstract class NoteLinkDefinition {
  static format(definition: NoteLinkDefinition) {
    const url =
      definition.url.indexOf(' ') > 0 ? `<${definition.url}>` : definition.url;
    let text = `[${definition.label}]: ${url}`;
    if (definition.title) {
      text = `${text} "${definition.title}"`;
    }

    return text;
  }
}

export interface Tag {
  label: string;
  range: Range;
}

export interface Alias {
  title: string;
  range: Range;
}

export interface Section {
  id?: string; // A unique identifier for the section within the note.
  label: string;
  range: Range;
  blockId?: string; // The optional block identifier, if one exists (e.g., '^my-id').
  isHeading?: boolean; // A boolean flag to clearly distinguish headings from other content blocks.
}

export interface Resource {
  uri: URI;
  type: string;
  title: string;
  properties: any;
  sections: Section[];
  tags: Tag[];
  aliases: Alias[];
  links: ResourceLink[];

  // TODO to remove
  definitions: NoteLinkDefinition[];
}

export interface ResourceParser {
  parse: (uri: URI, text: string) => Resource;
}

export abstract class Resource {
  public static sortByTitle(a: Resource, b: Resource) {
    return a.title.localeCompare(b.title);
  }

  public static sortByPath(a: Resource, b: Resource) {
    return a.uri.path.localeCompare(b.uri.path);
  }

  public static isResource(thing: any): thing is Resource {
    if (!thing) {
      return false;
    }
    return (
      (thing as Resource).uri instanceof URI &&
      typeof (thing as Resource).title === 'string' &&
      typeof (thing as Resource).type === 'string' &&
      typeof (thing as Resource).properties === 'object' &&
      typeof (thing as Resource).tags === 'object' &&
      typeof (thing as Resource).aliases === 'object' &&
      typeof (thing as Resource).links === 'object'
    );
  }

  public static findSection(
    resource: Resource,
    fragment: string
  ): Section | null {
    if (!fragment) return null;
    // Normalize for robust matching
    const normalize = (str: string | undefined) =>
      str
        ? str
            .toLocaleLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9_-]/g, '')
        : '';
    const normFragment = normalize(fragment);
    return (
      resource.sections.find(s => {
        // For headings with blockId, match slug, caret-prefixed blockId, or blockId without caret
        if (s.isHeading && s.blockId) {
          return (
            normalize(s.id) === normFragment ||
            s.blockId === fragment ||
            (s.blockId && s.blockId.substring(1) === fragment)
          );
        }
        // For headings without blockId, match slug
        if (s.isHeading) {
          return normalize(s.id) === normFragment;
        }
        // For non-headings, match blockId (with/without caret) or id
        if (s.blockId) {
          return (
            s.blockId === fragment ||
            (s.blockId && s.blockId.substring(1) === fragment) ||
            s.id === fragment
          );
        }
        return s.id === fragment;
      }) ?? null
    );
  }
}
