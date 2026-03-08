import { URI } from './uri';
import { Range } from './range';
import { Position } from './position';

export interface ResourceLink {
  type: 'wikilink' | 'link';
  rawText: string;
  range: Range;
  isEmbed: boolean;
  definition?: string | NoteLinkDefinition;
}

export abstract class ResourceLink {
  /**
   * Check if this is any kind of reference-style link (resolved or unresolved)
   */
  static isReferenceStyleLink(link: ResourceLink): boolean {
    return link.definition !== undefined;
  }

  /**
   * Check if this is a reference-style link with unresolved definition
   */
  static isUnresolvedReference(
    link: ResourceLink
  ): link is ResourceLink & { definition: string } {
    return typeof link.definition === 'string';
  }

  /**
   * Check if this is a reference-style link with resolved definition
   */
  static isResolvedReference(
    link: ResourceLink
  ): link is ResourceLink & { definition: NoteLinkDefinition } {
    return typeof link.definition === 'object' && link.definition !== null;
  }

  /**
   * Check if this is a regular inline link (not reference-style)
   */
  static isRegularLink(link: ResourceLink): boolean {
    return link.definition === undefined;
  }
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

  static isEqual(def1: NoteLinkDefinition, def2: NoteLinkDefinition): boolean {
    return (
      def1.label === def2.label &&
      def1.url === def2.url &&
      def1.title === def2.title
    );
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
  label: string;
  range: Range;
}

export type BlockType = 'paragraph' | 'list-item' | 'blockquote' | 'code' | 'heading';

export interface Block {
  id: string;
  range: Range;
  type: BlockType;
}

export interface Resource {
  uri: URI;
  type: string;
  title: string;
  properties: any;
  sections: Section[];
  blocks: Block[];
  tags: Tag[];
  aliases: Alias[];
  links: ResourceLink[];
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

  public static findSection(resource: Resource, label: string): Section | null {
    if (label) {
      return resource.sections.find(s => s.label === label) ?? null;
    }
    return null;
  }

  public static findBlock(resource: Resource, id: string): Block | null {
    if (id) {
      return resource.blocks.find(b => b.id === id) ?? null;
    }
    return null;
  }

  /**
   * Returns the deepest section whose range contains the given position, or
   * undefined if the position does not fall within any section.
   *
   * Note: parent sections (e.g. h1) have ranges that extend to the end of the
   * document and therefore overlap with their child sections (h2, h3, …).
   * Iterating in reverse start-position order (sections are sorted by start)
   * ensures the innermost/deepest section is returned.
   */
  public static getSectionAtPosition(
    resource: Resource,
    position: Position
  ): Section | undefined {
    if (!resource.sections) {
      return undefined;
    }
    for (let i = resource.sections.length - 1; i >= 0; i--) {
      if (Range.containsPosition(resource.sections[i].range, position)) {
        return resource.sections[i];
      }
    }
    return undefined;
  }
}
