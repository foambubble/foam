import { NoteLinkDefinition, Resource } from '../model/note';
import { FoamWorkspace } from '../model/workspace';
import { createMarkdownReferences } from '../services/markdown-provider';

export interface TextReplace {
  from: string;
  to: string;
}

/**
 * parse wikilink's rawText
 * possible inpout:
 *  1. [[\<filename\>#\<section\>|\<label\>]]
 *  2. [[#\<section\>|\<label\>]]
 *  3. [[\<filename\>#\<section\>]]
 *  4. [[\<filename\>|\<label\>]]
 */
class WikilinkRawText {
  private lable_m: string = '';
  private filename_m: string = '';
  private section_m: string = '';

  public readFromText(definition: NoteLinkDefinition): WikilinkRawText {
    const struct_rawText_regex =
      /(?:(?<filename>[^\]|#]+)?(?:#(?<section>[^\]|]+))?)?(?:\|(?<label>[^\]]+))?/;
    const match_result = definition.label.match(struct_rawText_regex);
    if (match_result) {
      this.filename_m = match_result[1];
      this.section_m = match_result[2];
      this.lable_m = match_result[3];
    }
    return this;
  }

  public getLable(): string {
    if (this.lable_m) {
      return this.lable_m;
    }
    // return `${this.getFilename()}${this.section_m ? '#' : ''}${this.getSection()}`;
    return '';
  }
  public getFilename(): string {
    if (this.filename_m) {
      return this.filename_m;
    }
    return '';
  }
  public getSection(): string {
    if (this.section_m) {
      return this.section_m;
    }
    return '';
  }
  public toMarkdownLink(
    definition: NoteLinkDefinition,
    toNote: Resource
  ): string {
    const struct_rawText_regex =
      /(?:(?<filename>[^\]|#]+)?(?:#(?<section>[^\]|]+))?)?(?:\|(?<label>[^\]]+))?/;
    const match_result = definition.label.match(struct_rawText_regex);
    this.filename_m = match_result[1];
    this.section_m = match_result[2];
    this.lable_m = match_result[3];

    let url = `${
      definition.url !== toNote.uri.getBasename() ? definition.url : ''
    }${this.section_m ? `#${this.getSection()}` : ''}`;
    if (url.indexOf(' ') > 0) {
      url = `<${url}>`;
    }
    url = `(${url}${definition.title ? ` "${definition.title}"` : ''})`;

    let label = this.lable_m;
    let filename =
      this.getFilename() !== toNote.uri.getName() ? this.getFilename() : '';
    let section = this.getSection();
    if (!label) {
      label = `${filename}${this.section_m ? `#${section}` : ''}`;
    }

    return `[${label}]${url}`;
  }
}

export const generateMarkdownLinks = async (
  note: Resource,
  workspace: FoamWorkspace
): Promise<TextReplace[]> => {
  if (!note) {
    return [] as TextReplace[];
  }

  const newWikilinkDefinitions = createMarkdownReferences(
    workspace,
    note,
    true
  );
  const wikilinkRawTextParser = new WikilinkRawText();
  const toReplaceArray = newWikilinkDefinitions.map(definition => {
    return {
      from: `[[${definition.label}]]`,
      to: wikilinkRawTextParser.toMarkdownLink(definition, note),
    };
  });

  return toReplaceArray;
};
