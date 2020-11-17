// this file can't simply be .d.ts because the TS compiler wouldn't copy it to the dist directory
// see https://stackoverflow.com/questions/56018167/typescript-does-not-copy-d-ts-files-to-build
import { Position, Point } from 'unist';
export { Position, Point };

export type URI = string;
export type ID = string;

export interface NoteSource {
  uri: URI;
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

// at the moment we only model wikilink
export type NoteLink = WikiLink;

export interface NoteLinkDefinition {
  label: string;
  url: string;
  title?: string;
  position?: Position;
}

export interface Note {
  title: string | null;
  slug: string; // note: this slug is not necessarily unique
  properties: any;
  // sections: NoteSection[]
  tags: Set<string>;
  links: NoteLink[];
  definitions: NoteLinkDefinition[];
  source: NoteSource;
}

export interface NoteParser {
  parse: (uri: string, text: string) => Note;
}
