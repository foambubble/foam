/*global markdownit:readonly*/

import { workspace as vsWorkspace } from 'vscode';
import markdownItRegex from 'markdown-it-regex';
import { isSome } from '../../utils';
import { FoamWorkspace } from '../../core/model/workspace';
import { Logger } from '../../core/utils/log';
import { Resource, ResourceParser } from '../../core/model/note';
import { applyTextEdit } from '../../core/janitor/apply-text-edit';
import { getFoamVsCodeConfig } from '../../services/config';
// eslint-disable-next-line no-restricted-imports
import { readFileSync } from 'fs';
import { createMarkdownParser } from '../../core/services/markdown-parser';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { MarkdownLink } from '../../core/services/markdown-link';
import { Position } from '../../core/model/position';

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
        switch (includedNote.type) {
          case 'note': {
            let noteText = readFileSync(includedNote.uri.toFsPath()).toString();
            const section = Resource.findSection(
              includedNote,
              includedNote.uri.fragment
            );
            if (isSome(section)) {
              const rows = noteText.split('\n');
              noteText = rows
                .slice(section.range.start.line, section.range.end.line)
                .join('\n');
            }
            noteText = withLinksRelativeToWorkspaceRoot(
              noteText,
              parser,
              workspace
            );
            content = getFoamVsCodeConfig(CONFIG_EMBED_NOTE_IN_CONTAINER)
              ? `<div class="embed-container-note">${md.render(noteText)}</div>`
              : noteText;
            break;
          }
          case 'attachment':
            content = `
<div class="embed-container-attachment">
${md.renderInline('[[' + wikilink + ']]')}<br/>
Embed for attachments is not supported
</div>`;
            break;
          case 'image':
            content = `<div class="embed-container-image">${md.render(
              `![](${md.normalizeLink(includedNote.uri.path)})`
            )}</div>`;
            break;
        }
        const html = md.render(content);
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
    (text, edit) => applyTextEdit(text, edit),
    noteText
  );
  return text;
}

export default markdownItWikilinkEmbed;
