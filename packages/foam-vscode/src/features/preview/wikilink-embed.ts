/*global markdownit:readonly*/

// eslint-disable-next-line no-restricted-imports
import { readFileSync } from 'fs';
import { workspace as vsWorkspace } from 'vscode';
import markdownItRegex from 'markdown-it-regex';
import { FoamWorkspace } from '../../core/model/workspace';
import { Logger } from '../../core/utils/log';
import { Resource, ResourceParser } from '../../core/model/note';
import { getFoamVsCodeConfig } from '../../services/config';
import { fromVsCodeUri } from '../../utils/vsc-utils';
import { MarkdownLink } from '../../core/services/markdown-link';
import { URI } from '../../core/model/uri';
import { Position } from '../../core/model/position';
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
  /((?:\w+)|(?:(?:\w+)-(?:\w+)))?!\[\[([^|[\]]+?)(\|[^[\]]+?)?\]\]/;
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
        const [, noteEmbedModifier, wikilink, parametersString] =
          wikilinkItem.match(WIKILINK_EMBED_REGEX_GROUPS);

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
          md,
          parametersString
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
  md: markdownit,
  parametersString?: string
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
    case 'image': {
      const imageParams = parseImageParameters(
        includedNote.uri.path,
        parametersString
      );
      const imageHtml = generateImageStyles(imageParams, md);
      content = `<div class="embed-container-image">${imageHtml}</div>`;
      toRender = content;
      break;
    }
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
    const rows = noteText.split('\n');
    noteText = rows
      .slice(section.range.start.line, section.range.end.line)
      .join('\n');
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
  return `<div class="embed-container-note">\n\n${content}\n\n</div>`;
}

function inlineFormatter(content: string, md: markdownit): string {
  return content;
}

interface ImageParameters {
  filename: string;
  width?: string;
  height?: string;
  align?: 'center' | 'left' | 'right';
  alt?: string;
}

function parseImageParameters(
  wikilink: string,
  parametersString?: string
): ImageParameters {
  const result: ImageParameters = {
    filename: wikilink,
  };

  if (!parametersString) {
    return result;
  }

  // Remove the leading pipe and split by remaining pipes
  const params = parametersString.slice(1).split('|');

  if (params.length === 0) {
    return result;
  }

  // First parameter is always size
  const sizeParam = params[0]?.trim();
  if (sizeParam) {
    // Parse size parameter: could be "300", "300x200", "50%", "300px", etc.
    // Check for width x height format (but not if it's just a unit like "px")
    const dimensionMatch = sizeParam.match(
      /^(\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh)?)\s*x\s*(\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh)?)$/i
    );
    if (dimensionMatch) {
      // Width x Height format
      result.width = dimensionMatch[1]?.trim();
      result.height = dimensionMatch[2]?.trim();
    } else {
      // Width only
      result.width = sizeParam;
    }
  }

  // Second parameter could be alignment
  const alignParam = params[1]?.trim().toLowerCase();
  if (alignParam && ['center', 'left', 'right'].includes(alignParam)) {
    result.align = alignParam as 'center' | 'left' | 'right';
  } else if (alignParam) {
    // If not alignment, treat as alt text
    result.alt = params.slice(1).join('|').trim();
  }

  // Third parameter onwards is alt text (if second wasn't alt text)
  if (result.align && params.length > 2) {
    result.alt = params.slice(2).join('|').trim();
  }

  return result;
}

function generateImageStyles(params: ImageParameters, md: markdownit): string {
  const { filename, width, height, align, alt } = params;

  // Build CSS styles for the image
  const styles: string[] = [];

  if (width) {
    styles.push(`width: ${addDefaultUnit(width)}`);

    // If only width is specified, set height to auto to maintain aspect ratio
    if (!height) {
      styles.push('height: auto');
    }
  }

  if (height) {
    styles.push(`height: ${addDefaultUnit(height)}`);
  }

  const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
  const altAttr = alt ? ` alt="${escapeHtml(alt)}"` : ' alt=""';

  // Generate the image HTML
  const imageHtml = `<img src="${md.normalizeLink(
    filename
  )}"${styleAttr}${altAttr}>`;

  // Wrap with alignment if specified
  if (align) {
    return `<div style="text-align: ${align};">${imageHtml}</div>`;
  }

  return imageHtml;
}

function addDefaultUnit(value: string): string {
  // If no unit is specified and it's a pure number, add 'px'
  if (/^\d+(\.\d+)?$/.test(value)) {
    return value + 'px';
  }
  return value;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { parseImageParameters, generateImageStyles };
export default markdownItWikilinkEmbed;
