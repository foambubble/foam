import { isSome } from './core';
import { FoamConfig } from '../config';
import { ParserPlugin } from 'plugins';
import { Node } from 'unist';
import { Note } from '../model/note';

export class TagExtractor implements ParserPlugin {
  private hashtagRegex: RegExp = /(^|[ ])#([\w_-]*[a-zA-Z][\w_-]*\b)/gm;
  private wordRegex: RegExp = /(^|[ ])([\w_-]*[a-zA-Z][\w_-]*\b)/gm;

  constructor(config: FoamConfig) {
    console.log(config.numericTaggingEnabled);
    if (config.numericTaggingEnabled) {
      this.hashtagRegex = /(^|[ ])#([\w_-]*[a-zA-Z0-9][\w_-]*\b)/gm;
      this.wordRegex = /(^|[ ])([\w_-]*[a-zA-Z0-9][\w_-]*\b)/gm;
    }
  }

  name = 'tags';

  onWillVisitTree = (tree: Node, note: Note) => {
    note.tags = this.extractHashtags(note.source.text);
  };

  onDidFindProperties = (props: any, note: Note) => {
    const yamlTags = this.extractTagsFromProp(props.tags);
    yamlTags.forEach(tag => note.tags.add(tag));
  };

  onDidInitializeParser = () => {};
  onWillParseMarkdown = () => {
    return '';
  };
  onDidVisitTree = () => {};
  visit = () => {};

  extractHashtags = (text: string): Set<string> => {
    return isSome(text)
      ? new Set(Array.from(text.matchAll(this.hashtagRegex), m => m[2].trim()))
      : new Set();
  };

  extractTagsFromProp = (prop: string | string[]): Set<string> => {
    const text = Array.isArray(prop) ? prop.join(' ') : prop;
    return isSome(text)
      ? new Set(Array.from(text.matchAll(this.wordRegex)).map(m => m[2].trim()))
      : new Set();
  };
}
