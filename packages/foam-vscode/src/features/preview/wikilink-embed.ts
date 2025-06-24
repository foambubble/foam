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
import { stripFrontMatter } from '../../core/utils/md';
import {
  asAbsoluteWorkspaceUri,
  isVirtualWorkspace,
} from '../../services/editor';

export const WIKILINK_EMBED_REGEX =
  /((?:(?:full|content)-(?:inline|card)|full|content|inline|card)?!\[\[[^[\]]+?\]\])/;
// we need another regex because md.use(regex, replace) only permits capturing one group
// so we capture the entire possible wikilink item (ex. content-card![[note]]) using WIKILINK_EMBED_REGEX and then
// use WIKILINK_EMBED_REGEX_GROUPS to parse it into the modifier(content-card) and the wikilink(note)
export const WIKILINK_EMBED_REGEX_GROUPS =
  /((?:\w+)|(?:(?:\w+)-(?:\w+)))?!\[\[([^[\]]+?)\]\]/;
export const CONFIG_EMBED_NOTE_TYPE = 'preview.embedNoteType';
// refsStack is used to detect and prevent cyclic embeds.
let refsStack: string[] = [];

/**
 * A markdown-it plugin to handle wikilink embeds (e.g., ![[note-name]]).
 * It supports embedding entire notes, specific sections, or blocks with block IDs.
 */
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
        const [, noteEmbedModifier, wikilinkTarget] = wikilinkItem.match(
          WIKILINK_EMBED_REGEX_GROUPS
        );

        if (isVirtualWorkspace()) {
          return `
 <div class="foam-embed-not-supported-warning">
   Embed not supported in virtual workspace: ![[${wikilinkTarget}]]
 </div>
           `;
        }

        // Parse the wikilink to separate the note path from the fragment.
        const { noteTarget, fragment } = parseWikilink(wikilinkTarget);
        const includedNote = workspace.find(noteTarget);

        if (!includedNote) {
          return `![[${wikilinkTarget}]]`;
        }

        const cyclicLinkDetected = refsStack.includes(
          includedNote.uri.path.toLocaleLowerCase()
        );

        if (cyclicLinkDetected) {
          return `
 <div class="foam-cyclic-link-warning">
   Cyclic link detected for wikilink: ${wikilinkTarget}
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

        const htmlContent = getNoteContent(
          includedNote,
          fragment,
          noteEmbedModifier,
          parser,
          workspace,
          md
        );
        refsStack.pop();

        return htmlContent;
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
  linkFragment: string | undefined,
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
        noteScope === 'content' ? contentExtractor : fullExtractor;

      content = extractor(includedNote, linkFragment, parser, workspace);

      const formatter: EmbedNoteFormatter =
        noteStyle === 'card' ? cardFormatter : inlineFormatter;
      toRender = formatter(content, md);
      break;
    }
    case 'attachment':
      content = `> [[${includedNote.uri.path}]]
>
> Embed for attachments is not supported`;
      toRender = md.render(content);
      break;
    case 'image':
      content = `![](${md.normalizeLink(includedNote.uri.path)})`;
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
      const update: { target: string; text?: string } = {
        target: pathFromRoot,
      };
      if (!info.alias) {
        update.text = info.target;
      }
      return MarkdownLink.createUpdateLinkEdit(link, update);
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
    } else if (explicitModifier.includes('-')) {
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
  linkFragment: string | undefined,
  parser: ResourceParser,
  workspace: FoamWorkspace
) => string;

/**
 * Extracts the full content of a note or a specific section/block.
 * For sections, it includes the heading itself.
 */
function fullExtractor(
  note: Resource,
  linkFragment: string | undefined,
  parser: ResourceParser,
  workspace: FoamWorkspace
): string {
  let noteText = readFileSync(note.uri.toFsPath()).toString();
  // Find the specific section or block being linked to, if a fragment is provided.
  const section = linkFragment
    ? Resource.findSection(note, linkFragment)
    : null;
  if (isSome(section)) {
    if (section.isHeading) {
      // For headings, extract all content from that heading to the next.
      let rows = noteText.split('\n');
      // Find the next heading after this one
      let nextHeadingLine = rows.length;
      for (let i = section.range.start.line + 1; i < rows.length; i++) {
        if (/^\s*#+\s/.test(rows[i])) {
          nextHeadingLine = i;
          break;
        }
      }
      let slicedRows = rows.slice(section.range.start.line, nextHeadingLine);
      noteText = slicedRows.join('\n');
    } else {
      // For block-level embeds (paragraphs, list items with a ^block-id),
      // extract the content precisely using the range from the parser.
      const rows = noteText.split('\n');
      noteText = rows
        .slice(section.range.start.line, section.range.end.line + 1)
        .join('\n');
    }
  } else {
    // No fragment: transclude the whole note (excluding frontmatter if present)
    noteText = stripFrontMatter(noteText);
  }
  noteText = withLinksRelativeToWorkspaceRoot(
    note.uri,
    noteText,
    parser,
    workspace
  );
  return noteText;
}

/**
 * Extracts the content of a note, excluding the main title.
 * For sections, it extracts the content *under* the heading.
 */
function contentExtractor(
  note: Resource,
  linkFragment: string | undefined,
  parser: ResourceParser,
  workspace: FoamWorkspace
): string {
  let noteText = readFileSync(note.uri.toFsPath()).toString();
  // Find the specific section or block being linked to.
  let section = Resource.findSection(note, linkFragment);
  if (!linkFragment) {
    // If no fragment is provided, default to the first section (usually the main title)
    // to extract the content of the note, excluding the title.
    section = note.sections.length ? note.sections[0] : null;
  }
  if (isSome(section)) {
    if (section.isHeading) {
      // For headings, extract the content *under* the heading.
      let rows = noteText.split('\n');
      const isLastLineHeading = rows[section.range.end.line]?.match(/^\s*#+\s/);
      rows = rows.slice(
        section.range.start.line,
        section.range.end.line + (isLastLineHeading ? 0 : 1)
      );
      rows.shift(); // Remove the heading itself
      noteText = rows.join('\n');
    } else {
      // For block-level embeds (e.g., a list item with a ^block-id),
      // extract the content of just that block using its range.
      const rows = noteText.split('\n');
      noteText = rows
        .slice(section.range.start.line, section.range.end.line + 1)
        .join('\n');
    }
  } else {
    // If no fragment, or fragment not found as a section,
    // treat as content of the entire note (excluding title)
    let rows = noteText.split('\n');
    rows.shift(); // Remove the title
    noteText = rows.join('\n');
  }
  noteText = withLinksRelativeToWorkspaceRoot(
    note.uri,
    noteText,
    parser,
    workspace
  );
  return noteText;
}

/**
 * A type of function that renders note content with the desired style in html
 */
export type EmbedNoteFormatter = (content: string, md: markdownit) => string;

function cardFormatter(content: string, md: markdownit): string {
  return `<div class="embed-container-note">

${md.render(content)}

</div>`;
}

function inlineFormatter(content: string, md: markdownit): string {
  const tokens = md.parse(content.trim(), {});
  // Optimization: If the content is just a single paragraph, render only its
  // inline content. This prevents wrapping the embed in an extra, unnecessary <p> tag,
  // which can cause layout issues.
  if (
    tokens.length === 3 &&
    tokens[0].type === 'paragraph_open' &&
    tokens[1].type === 'inline' &&
    tokens[2].type === 'paragraph_close'
  ) {
    // Render only the inline content to prevent double <p> tags.
    // The parent renderer will wrap this in <p> tags as needed.
    return md.renderer.render(tokens[1].children, md.options, {});
  }
  // For more complex content (headings, lists, etc.), render as a full block.
  return md.render(content);
}

/**
 * Parses a wikilink target into its note and fragment components.
 * @param wikilinkTarget The full string target of the wikilink (e.g., 'my-note#my-heading').
 * @returns An object containing the noteTarget and an optional fragment.
 */
function parseWikilink(wikilinkTarget: string): {
  noteTarget: string;
  fragment?: string;
} {
  const [noteTarget, fragment] = wikilinkTarget.split('#');
  return { noteTarget, fragment };
}

export default markdownItWikilinkEmbed;
