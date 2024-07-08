/*global markdownit:readonly*/

// eslint-disable-next-line no-restricted-imports
import { readFileSync } from 'fs';
import { workspace as vsWorkspace } from 'vscode';
import markdownItRegex from 'markdown-it-regex';
import { FoamWorkspace } from '../../core/model/workspace';
import { Logger } from '../../core/utils/log';
import { Resource, ResourceParser } from '../../core/model/note';
import { getFoamVsCodeConfig } from '../../services/config';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { MarkdownLink } from '../../core/services/markdown-link';
import { Position } from '../../core/model/position';
import { TextEdit } from '../../core/services/text-edit';
import { isNone, isSome } from '../../core/utils';

export const WIKILINK_EMBED_REGEX =
  /((?:(?:full|content)-(?:inline|card)|full|content|inline|card)?!\[\[[^[\]]+?\]\])/;
// we need another regex because md.use(regex, replace) only permits capturing one group
// so we capture the entire possible wikilink item (ex. content-card![[note]]) using WIKILINK_EMBED_REGEX and then
// use WIKILINK_EMBED_REGEX_GROUPER to parse it into the modifier(content-card) and the wikilink(note)
export const WIKILINK_EMBED_REGEX_GROUPS =
  /((?:\w+)|(?:(?:\w+)-(?:\w+)))?!\[\[([^[\]]+?)\]\]/;
export const CONFIG_EMBED_NOTE_TYPE = 'preview.embedNoteType';
const refsStack: string[] = [];

export const markdownItWikilinkEmbed = (
  md: markdownit,
  workspace: FoamWorkspace,
  parser: ResourceParser
) => {
  return md.use(markdownItRegex, {
    name: 'embed-wikilinks',
    regex: WIKILINK_EMBED_REGEX,
    replace: (wikilinkItem: string) => {
      try {
        const [_, noteEmbedModifier, wikilink] = wikilinkItem.match(
          WIKILINK_EMBED_REGEX_GROUPS
        );

        const includedNote = workspace.find(wikilink);

        if (!includedNote) {
          return `![[${wikilink}]]`;
        }

        const cyclicLinkDetected = refsStack.includes(
          includedNote.uri.path.toLocaleLowerCase()
        );

        if (!cyclicLinkDetected) {
          refsStack.push(includedNote.uri.path.toLocaleLowerCase());
        }

        if (cyclicLinkDetected) {
          return `<div class="foam-cyclic-link-warning">Cyclic link detected for wikilink: ${wikilink}</div>`;
        }
        let content = `Embed for [[${wikilink}]]`;
        let html: string;

        switch (includedNote.type) {
          case 'note': {
            const { noteScope, noteStyle } =
              retrieveNoteConfig(noteEmbedModifier);

            const extractor: EmbedNoteExtractor =
              noteScope === 'full'
                ? fullExtractor
                : noteScope === 'content'
                ? contentExtractor
                : fullExtractor;

            const formatter: EmbedNoteFormatter =
              noteStyle === 'card'
                ? cardFormatter
                : noteStyle === 'inline'
                ? inlineFormatter
                : cardFormatter;

            content = extractor(includedNote, parser, workspace);
            html = formatter(content, md);
            break;
          }
          case 'attachment':
            content = `
<div class="embed-container-attachment">
${md.renderInline('[[' + wikilink + ']]')}<br/>
Embed for attachments is not supported
</div>`;
            html = md.render(content);
            break;
          case 'image':
            content = `<div class="embed-container-image">${md.render(
              `![](${md.normalizeLink(includedNote.uri.path)})`
            )}</div>`;
            html = md.render(content);
            break;
        }
        refsStack.pop();
        return html;
      } catch (e) {
        Logger.error(
          `Error while including ${wikilinkItem} into the current document of the Preview panel`,
          e
        );
        return '';
      }
    },
  });
};

function withLinksRelativeToWorkspaceRoot(
  noteText: string,
  parser: ResourceParser,
  workspace: FoamWorkspace
) {
  const note = parser.parse(
    fromVsCodeUri(vsWorkspace.workspaceFolders[0].uri),
    noteText
  );
  const edits = note.links
    .map(link => {
      const info = MarkdownLink.analyzeLink(link);
      const resource = workspace.find(info.target);
      // embedded notes that aren't created are still collected
      // return null so it can be filtered in the next step
      if (isNone(resource)) {
        return null;
      }
      const pathFromRoot = vsWorkspace.asRelativePath(
        toVsCodeUri(resource.uri)
      );
      return MarkdownLink.createUpdateLinkEdit(link, {
        target: pathFromRoot,
      });
    })
    .filter(linkEdits => !isNone(linkEdits))
    .sort((a, b) => Position.compareTo(b.range.start, a.range.start));
  const text = edits.reduce(
    (text, edit) => TextEdit.apply(text, edit),
    noteText
  );
  return text;
}

export function retrieveNoteConfig(explicitModifier: string | undefined): {
  noteScope: string;
  noteStyle: string;
} {
  let config = getFoamVsCodeConfig<string>(CONFIG_EMBED_NOTE_TYPE); // ex. full-inline
  let [noteScope, noteStyle] = config.split('-');

  // an explicit modifier will always override corresponding user setting
  if (explicitModifier !== undefined) {
    if (['full', 'content'].includes(explicitModifier)) {
      noteScope = explicitModifier;
    } else if (['card', 'inline'].includes(explicitModifier)) {
      noteStyle = explicitModifier;
    } else {
      [noteScope, noteStyle] = explicitModifier.split('-');
    }
  }
  return { noteScope, noteStyle };
}

/**
 * A type of function that gets the desired content of the note
 */
export type EmbedNoteExtractor = (
  note: Resource,
  parser: ResourceParser,
  workspace: FoamWorkspace
) => string;

function fullExtractor(
  note: Resource,
  parser: ResourceParser,
  workspace: FoamWorkspace
): string {
  let noteText = readFileSync(note.uri.toFsPath()).toString();
  const section = Resource.findSection(note, note.uri.fragment);
  if (isSome(section)) {
    const rows = noteText.split('\n');
    noteText = rows
      .slice(section.range.start.line, section.range.end.line)
      .join('\n');
  }
  noteText = withLinksRelativeToWorkspaceRoot(noteText, parser, workspace);
  return noteText;
}

function contentExtractor(
  note: Resource,
  parser: ResourceParser,
  workspace: FoamWorkspace
): string {
  let noteText = readFileSync(note.uri.toFsPath()).toString();
  let section = Resource.findSection(note, note.uri.fragment);
  if (!note.uri.fragment) {
    // if there's no fragment(section), the wikilink is linking to the entire note,
    // in which case we need to remove the title. We could just use rows.shift()
    // but should the note start with blank lines, it will only remove the first blank line
    // leaving the title
    // A better way is to find where the actual title starts by assuming it's at section[0]
    // then we treat it as the same case as link to a section
    section = note.sections.length ? note.sections[0] : null;
  }
  let rows = noteText.split('\n');
  if (isSome(section)) {
    rows = rows.slice(section.range.start.line, section.range.end.line);
  }
  rows.shift();
  noteText = rows.join('\n');
  noteText = withLinksRelativeToWorkspaceRoot(noteText, parser, workspace);
  return noteText;
}

/**
 * A type of function that renders note content with the desired style in html
 */
export type EmbedNoteFormatter = (content: string, md: markdownit) => string;

function cardFormatter(content: string, md: markdownit): string {
  return md.render(
    `<div class="embed-container-note">${md.render(content)}</div>`
  );
}

function inlineFormatter(content: string, md: markdownit): string {
  return md.render(content);
}

export default markdownItWikilinkEmbed;
