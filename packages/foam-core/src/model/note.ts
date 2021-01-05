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

export interface Note {
  uri: URI;
  title: string | null;
  properties: any;
  // sections: NoteSection[]
  tags: Set<string>;
  links: NoteLink[];
  definitions: NoteLinkDefinition[];
  source: NoteSource;
}

export interface NoteParser {
  parse: (uri: URI, text: string) => Note;
}
