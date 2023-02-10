/*global markdownit:readonly*/

import markdownItRegex from 'markdown-it-regex';
import { isSome } from '../../utils';
import { FoamWorkspace } from '../../core/model/workspace';
import { Logger } from '../../core/utils/log';
import { Resource } from '../../core/model/note';
import { getFoamVsCodeConfig } from '../../services/config';
// eslint-disable-next-line no-restricted-imports
import { readFileSync } from 'fs';

export const CONFIG_EMBED_NOTE_IN_CONTAINER = 'preview.embedNoteInContainer';
const refsStack: string[] = [];

export const markdownItWikilinkEmbed = (
  md: markdownit,
  workspace: FoamWorkspace
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
            const noteText = readFileSync(
              includedNote.uri.toFsPath()
            ).toString();
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
        const section = Resource.findSection(
          includedNote,
          includedNote.uri.fragment
        );
        if (isSome(section)) {
          const rows = content.split('\n');
          content = rows
            .slice(section.range.start.line, section.range.end.line)
            .join('\n');
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

export default markdownItWikilinkEmbed;
