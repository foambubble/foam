import { Position, Point } from 'unist';
import { URI } from '../common/uri';
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

export type Resource = Note | Attachment;

export interface NoteParser {
  parse: (uri: URI, text: string) => Note;
}
