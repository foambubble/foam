/*global markdownit:readonly*/

// eslint-disable-next-line no-restricted-imports
import { readFileSync } from 'fs';
import { workspace as vsWorkspace } from 'vscode';
import markdownItRegex from 'markdown-it-regex';
import { isSome } from '../../utils';
import { FoamWorkspace } from '../../core/model/workspace';
import { Logger } from '../../core/utils/log';
import { Resource, ResourceParser } from '../../core/model/note';
import { getFoamVsCodeConfig } from '../../services/config';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { MarkdownLink } from '../../core/services/markdown-link';
import { Position } from '../../core/model/position';
import { TextEdit } from '../../core/services/text-edit';

export const CONFIG_EMBED_NOTE_IN_CONTAINER = 'preview.embedNoteInContainer';
const refsStack: string[] = [];

export const markdownItWikilinkEmbed = (
  md: markdownit,
  workspace: FoamWorkspace,
  parser: ResourceParser
) => {
  return md.use(markdownItRegex, {
    name: 'embed-wikilinks',
    regex: /!\[\[([^[\]]+?)\]\]/,
    replace: (wikilink: string) => {
      try {
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
            let extractor: EmbedNoteExtractor = fullExtractor;
            const noteContentType = 'full';
            switch (noteContentType) {
              case 'full':
                extractor = fullExtractor;
                break;
            }

            const noteStyleType = getFoamVsCodeConfig(
              CONFIG_EMBED_NOTE_IN_CONTAINER
            )
              ? 'card'
              : 'inline';

            let formatter: EmbedNoteFormatter = cardFormatter;
            switch (noteStyleType) {
              case 'card':
                formatter = cardFormatter;
                break;
              case 'inline':
                formatter = inlineFormatter;
                break;
            }

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
          `Error while including [[${wikilink}]] into the current document of the Preview panel`,
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
      const pathFromRoot = vsWorkspace.asRelativePath(
        toVsCodeUri(resource.uri)
      );
      return MarkdownLink.createUpdateLinkEdit(link, {
        target: pathFromRoot,
      });
    })
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
