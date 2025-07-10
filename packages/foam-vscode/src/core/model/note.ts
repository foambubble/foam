import { URI } from './uri';
import { Range } from './range';
import slugger from 'github-slugger';

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

// The base properties common to all section types
interface BaseSection {
  id: string; // The stable, linkable identifier (slug or blockId w/o caret)
  label: string; // The human-readable or raw markdown content for display/rendering
  range: Range; // The location of the section in the document
}

// A section created from a markdown heading
export interface HeadingSection extends BaseSection {
  type: 'heading';
  level: number;
  blockId?: string; // A heading can ALSO have a block-id
}

// A section created from a content block with a ^block-id
export interface BlockSection extends BaseSection {
  type: 'block';
  blockId: string; // For blocks, the blockId is mandatory
}

// The new unified Section type
export type Section = HeadingSection | BlockSection;

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
    identifier: string
  ): Section | null {
    if (!identifier) {
      return null;
    }

    if (identifier.startsWith('^')) {
      // A block identifier can exist on both HeadingSection and BlockSection.
      // We search for the `blockId` property, which includes the caret (e.g. '^my-id').
      return (
        resource.sections.find(section => {
          // The `blockId` property on the section includes the caret.
          if (section.type === 'block' || section.type === 'heading') {
            return section.blockId === identifier;
          }
          return false;
        }) ?? null
      );
    } else {
      // Heading identifier
      const sluggedIdentifier = slugger.slug(identifier);
      return (
        resource.sections.find(
          section =>
            section.type === 'heading' && section.id === sluggedIdentifier
        ) ?? null
      );
    }
  }
}
