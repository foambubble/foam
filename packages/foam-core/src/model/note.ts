import { Position, Point } from 'unist';
import { URI } from '../common/uri';
import { getBasename } from '../utils';
export { Position, Point };

export interface NoteSource {
  text: string;
  contentStart: Point;
  end: Point;
  eol: string;
}

export interface WikiLink {
  type: 'wikilink';
  slug: string;
  target: string;
  position: Position;
}

export interface DirectLink {
  type: 'link';
  label: string;
  target: string;
}

export type NoteLink = WikiLink | DirectLink;

export interface NoteLinkDefinition {
  label: string;
  url: string;
  title?: string;
  position?: Position;
}

export interface BaseResource {
  uri: URI;
}

export interface Attachment extends BaseResource {
  type: 'attachment';
}

export interface Placeholder extends BaseResource {
  type: 'placeholder';
}

export interface Note extends BaseResource {
  type: 'note';
  title: string | null;
  properties: any;
  // sections: NoteSection[]
  tags: Set<string>;
  links: NoteLink[];
  definitions: NoteLinkDefinition[];
  source: NoteSource;
}

export type Resource = Note | Attachment | Placeholder;

export interface NoteParser {
  parse: (uri: URI, text: string) => Note;
}

export const isWikilink = (link: NoteLink): link is WikiLink => {
  return link.type === 'wikilink';
};

export const getTitle = (resource: Resource): string => {
  return resource.type === 'note'
    ? resource.title ?? getBasename(resource.uri)
    : getBasename(resource.uri);
};

export const isNote = (resource: Resource): resource is Note => {
  return resource.type === 'note';
};
