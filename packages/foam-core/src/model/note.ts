import { URI } from './uri';
import { Position } from './position';
import { Range } from './range';

export interface NoteSource {
  text: string;
  contentStart: Position;
  end: Position;
  eol: string;
}

export interface WikiLink {
  type: 'wikilink';
  slug: string;
  target: string;
  range: Range;
}

export interface DirectLink {
  type: 'link';
  label: string;
  target: string;
  range: Range;
}

export type NoteLink = WikiLink | DirectLink;

export type ResourceLink = NoteLink;

export interface NoteLinkDefinition {
  label: string;
  url: string;
  title?: string;
  range?: Range;
}

export interface Resource {
  uri: URI;
  type: string;
  title: string;
  properties: any;
  // sections: NoteSection[]
  tags: Set<string>;
  links: ResourceLink[];

  // TODO to remove
  definitions: NoteLinkDefinition[];
  source: NoteSource;
}

export interface ResourceParser {
  parse: (uri: URI, text: string) => Resource;
}

export const getTitle = (resource: Resource): string => {
  return resource.type === 'note'
    ? resource.title ?? URI.getBasename(resource.uri)
    : URI.getBasename(resource.uri);
};
