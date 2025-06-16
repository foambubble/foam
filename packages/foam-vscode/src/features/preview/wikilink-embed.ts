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
import { URI } from '../../core/model/uri';
import { Position } from '../../core/model/position';
import { Range } from '../../core/model/range'; // Add this import
import { TextEdit } from '../../core/services/text-edit';
import { isNone, isSome } from '../../core/utils';
import {
  asAbsoluteWorkspaceUri,
  isVirtualWorkspace,
} from '../../services/editor';

export const WIKILINK_EMBED_REGEX =
  /((?:(?:full|content)-(?:inline|card)|full|content|inline|card)?!\[\[[^[\]]+?\]\])/;
// we need another regex because md.use(regex, replace) only permits capturing one group
// so we capture the entire possible wikilink item (ex. content-card![[note]]) using WIKILINK_EMBED_REGEX and then
// use WIKILINK_EMBED_REGEX_GROUPER to parse it into the modifier(content-card) and the wikilink(note)
export const WIKILINK_EMBED_REGEX_GROUPS =
  /((?:\w+)|(?:(?:\w+)-(?:\w+)))?!\[\[([^[\]]+?)\]\]/;
export const CONFIG_EMBED_NOTE_TYPE = 'preview.embedNoteType';
let refsStack: string[] = [];

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
        const [, noteEmbedModifier, wikilink] = wikilinkItem.match(
          WIKILINK_EMBED_REGEX_GROUPS
        );

        if (isVirtualWorkspace()) {
          return `
<div class="foam-embed-not-supported-warning">
  Embed not supported in virtual workspace: ![[${wikilink}]]
</div>
          `;
        }

        const includedNote = workspace.find(wikilink);

        if (!includedNote) {
          return `![[${wikilink}]]`;
        }

        const cyclicLinkDetected = refsStack.includes(
          includedNote.uri.path.toLocaleLowerCase()
        );

        if (cyclicLinkDetected) {
          return `
<div class="foam-cyclic-link-warning">
  Cyclic link detected for wikilink: ${wikilink}
  <div class="foam-cyclic-link-warning__stack">
    Link sequence: 
    <ul>
      ${refsStack.map(ref => `<li>${ref}</li>`).join('')}
    </ul>
  </div>
</div>
          `;
        }

        refsStack.push(includedNote.uri.path.toLocaleLowerCase());

        const content = getNoteContent(
          includedNote,
          noteEmbedModifier,
          parser,
          workspace,
          md
        );
        refsStack.pop();
        return refsStack.length === 0 ? md.render(content) : content;
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

function getNoteContent(
  includedNote: Resource,
  noteEmbedModifier: string | undefined,
  parser: ResourceParser,
  workspace: FoamWorkspace,
  md: markdownit
): string {
  let content = `Embed for [[${includedNote.uri.path}]]`;
  let toRender: string;

  switch (includedNote.type) {
    case 'note': {
      const { noteScope, noteStyle } = retrieveNoteConfig(noteEmbedModifier);

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
      toRender = formatter(content, md);
      break;
    }
    case 'attachment':
      content = `
<div class="embed-container-attachment">
${md.renderInline('[[' + includedNote.uri.path + ']]')}<br/>
Embed for attachments is not supported
</div>`;
      toRender = md.render(content);
      break;
    case 'image':
      content = `<div class="embed-container-image">${md.render(
        `![](${md.normalizeLink(includedNote.uri.path)})`
      )}</div>`;
      toRender = md.render(content);
      break;
    default:
      toRender = content;
  }

  return toRender;
}

function withLinksRelativeToWorkspaceRoot(
  noteUri: URI,
  noteText: string,
  parser: ResourceParser,
  workspace: FoamWorkspace
): string {
  const note = parser.parse(
    fromVsCodeUri(vsWorkspace.workspaceFolders[0].uri),
    noteText
  );
  const edits = note.links
    .map(link => {
      const info = MarkdownLink.analyzeLink(link);
      const resource = workspace.find(info.target, noteUri);
      // embedded notes that aren't created are still collected
      // return null so it can be filtered in the next step
      if (isNone(resource)) {
        return null;
      }
      const pathFromRoot = asAbsoluteWorkspaceUri(resource.uri).path;
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
    let rows = noteText.split('\n');
    // Check if the line at section.range.end.line is a heading.
    // If it is, it means the section ends *before* this line, so we don't add +1.
    // Otherwise, add +1 to include the last line of content (e.g., for lists, code blocks).
    const isLastLineHeading = rows[section.range.end.line]?.match(/^\s*#+\s/);
    let slicedRows = rows.slice(
      section.range.start.line,
      section.range.end.line + (isLastLineHeading ? 0 : 1)
    );
    noteText = slicedRows.join('\n');
  }
  noteText = withLinksRelativeToWorkspaceRoot(
    note.uri,
    noteText,
    parser,
    workspace
  ).replace(/\s*\^[\w-]+$/m, ''); // Strip block ID, multiline aware
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
    const isLastLineHeading = rows[section.range.end.line]?.match(/^\s*#+\s/);
    rows = rows.slice(
      section.range.start.line,
      section.range.end.line + (isLastLineHeading ? 0 : 1)
    );
  }
  rows.shift();
  noteText = rows.join('\n');
  noteText = withLinksRelativeToWorkspaceRoot(
    note.uri,
    noteText,
    parser,
    workspace
  ).replace(/\s*\^[\w-]+$/m, ''); // Strip block ID, multiline aware
  return noteText;
}

/**
 * A type of function that renders note content with the desired style in html
 */
export type EmbedNoteFormatter = (content: string, md: markdownit) => string;

function cardFormatter(content: string, md: markdownit): string {
  return `<div class="embed-container-note">\n\n${content}\n\n</div>`;
}

function inlineFormatter(content: string, md: markdownit): string {
  return content;
}

export default markdownItWikilinkEmbed;
