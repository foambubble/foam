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
        // --- Replacement logic: robust fragment and block ID support ---
        // Parse fragment (block ID or header) if present
        let fragment: string | undefined = undefined;
        let noteTarget = wikilinkTarget;
        if (wikilinkTarget.includes('#')) {
          const parts = wikilinkTarget.split('#');
          noteTarget = parts[0];
          fragment = parts[1];
        }
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

        const markdownContent = getNoteContent(
          includedNote,
          fragment,
          noteEmbedModifier,
          parser,
          workspace,
          md
        );
        refsStack.pop();

        // Only render at the top level, to avoid corrupting markdown-it state
        return refsStack.length === 0
          ? md.render(markdownContent)
          : markdownContent;
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

  switch (includedNote.type) {
    case 'note': {
      // Only 'full' and 'content' note scopes are supported.
      // The 'card' and 'inline' styles are removed in favor of a single,
      // seamless inline rendering for all transclusions.
      const noteScope = ['full', 'content'].includes(noteEmbedModifier)
        ? noteEmbedModifier
        : getFoamVsCodeConfig<string>(CONFIG_EMBED_NOTE_TYPE).startsWith(
            'content'
          )
        ? 'content'
        : 'full';

      const extractor: EmbedNoteExtractor =
        noteScope === 'content' ? contentExtractor : fullExtractor;

      content = extractor(includedNote, linkFragment, parser, workspace);
      break;
    }
    case 'attachment':
      content = `> [[${includedNote.uri.path}]]
>
> Embed for attachments is not supported`;
      break;
    case 'image':
      content = `![](${md.normalizeLink(includedNote.uri.path)})`;
      break;
  }

  return content;
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

/**
 * A type of function that gets the desired content of the note
 */
export type EmbedNoteExtractor = (
  note: Resource,
  linkFragment: string | undefined,
  parser: ResourceParser,
  workspace: FoamWorkspace
) => string;

function fullExtractor(
  note: Resource,
  linkFragment: string | undefined,
  parser: ResourceParser,
  workspace: FoamWorkspace
): string {
  let noteText = readFileSync(note.uri.toFsPath()).toString();
  const section = linkFragment
    ? Resource.findSection(note, linkFragment)
    : null;
  if (isSome(section)) {
    if (section.isHeading) {
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
      // For non-headings (list items, blocks), always use section.label
      noteText = section.label;
    }
  } else {
    // No fragment: transclude the whole note (excluding frontmatter if present)
    // Remove YAML frontmatter if present
    noteText = noteText.replace(/^---[\s\S]*?---\s*/, '');
    noteText = noteText.trim();
  }
  noteText = withLinksRelativeToWorkspaceRoot(
    note.uri,
    noteText,
    parser,
    workspace
  );
  return noteText;
}

function contentExtractor(
  note: Resource,
  linkFragment: string | undefined,
  parser: ResourceParser,
  workspace: FoamWorkspace
): string {
  let noteText = readFileSync(note.uri.toFsPath()).toString();
  let section = Resource.findSection(note, linkFragment);
  if (!linkFragment) {
    // if there's no fragment(section), the wikilink is linking to the entire note,
    // in which case we need to remove the title. We could just use rows.shift()
    // but should the note start with blank lines, it will only remove the first blank line
    // leaving the title
    // A better way is to find where the actual title starts by assuming it's at section[0]
    // then we treat it as the same case as link to a section
    section = note.sections.length ? note.sections[0] : null;
  }
  if (isSome(section)) {
    if (section.isHeading) {
      let rows = noteText.split('\n');
      const isLastLineHeading = rows[section.range.end.line]?.match(/^\s*#+\s/);
      rows = rows.slice(
        section.range.start.line,
        section.range.end.line + (isLastLineHeading ? 0 : 1)
      );
      rows.shift(); // Remove the heading itself
      noteText = rows.join('\n');
    } else {
      noteText = section.label; // Directly use the block's raw markdown
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

export default markdownItWikilinkEmbed;
