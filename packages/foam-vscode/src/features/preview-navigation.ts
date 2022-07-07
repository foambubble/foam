import markdownItRegex from 'markdown-it-regex';
import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { isNone, isSome } from '../utils';
import { Foam } from '../core/model/foam';
import { FoamWorkspace } from '../core/model/workspace';
import { Logger } from '../core/utils/log';
import { toVsCodeUri } from '../utils/vsc-utils';
import { Resource } from '../core/model/note';
import { MarkdownLink } from '../core/services/markdown-link';
import { Range } from '../core/model/range';
import { isEmpty } from 'lodash';
import { getFoamVsCodeConfig } from '../services/config';

const feature: FoamFeature = {
  activate: async (
    _context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    return {
      extendMarkdownIt: (md: markdownit) => {
        return [
          markdownItWithFoamTags,
          markdownItWithNoteInclusion,
          markdownItWithFoamLinks,
          markdownItWithRemoveLinkReferences,
        ].reduce((acc, extension) => extension(acc, foam.workspace), md);
      },
    };
  },
};

const refsStack: string[] = [];
export const markdownItWithNoteInclusion = (
  md: markdownit,
  workspace: FoamWorkspace
) => {
  return md.use(markdownItRegex, {
    name: 'include-notes',
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
          case 'note':
            const note = md.render(includedNote.source.text);
            content = getFoamVsCodeConfig('preview.embedNoteInContainer')
              ? `
<div class="embed-container-note">
  ${note}
</div>`
              : note;
            break;
          case 'attachment':
            const link = md.renderInline('[[' + wikilink + ']]');
            content = `
<div class="embed-container-attachment">
${link}<br/>
Embed for attachments is not supported
</div>`;
            break;
          case 'image':
            const image = md.render(
              `![](${vscode.workspace.asRelativePath(
                toVsCodeUri(includedNote.uri)
              )})`
            );
            content = `
<div class="embed-container-image">
  ${image}
</div>`;
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

export const markdownItWithFoamLinks = (
  md: markdownit,
  workspace: FoamWorkspace
) => {
  return md.use(markdownItRegex, {
    name: 'connect-wikilinks',
    regex: /\[\[([^[\]]+?)\]\]/,
    replace: (wikilink: string) => {
      try {
        const { target, alias } = MarkdownLink.analyzeLink({
          rawText: '[[' + wikilink + ']]',
          type: 'wikilink',
          range: Range.create(0, 0),
        });
        const label = isEmpty(alias) ? target : alias;

        const resource = workspace.find(target);
        if (isNone(resource)) {
          return getPlaceholderLink(label);
        }

        const link = vscode.workspace.asRelativePath(toVsCodeUri(resource.uri));
        return `
<a class='foam-note-link' title='${resource.title}' href='/${link}' data-href='/${link}'>
  ${label}
</a>`;
      } catch (e) {
        Logger.error(
          `Error while creating link for [[${wikilink}]] in Preview panel`,
          e
        );
        return getPlaceholderLink(wikilink);
      }
    },
  });
};

const getPlaceholderLink = (content: string) => `
<a class='foam-placeholder-link' title="Link to non-existing resource" href="javascript:void(0);">
  ${content}
</a>
`;

export const markdownItWithFoamTags = (
  md: markdownit,
  workspace: FoamWorkspace
) => {
  return md.use(markdownItRegex, {
    name: 'foam-tags',
    regex: /(?<=^|\s)(#[0-9]*[\p{L}/_-][\p{L}\p{N}/_-]*)/u,
    replace: (tag: string) => {
      try {
        const resource = workspace.find(tag);
        if (isNone(resource)) {
          return getFoamTag(tag);
        }
      } catch (e) {
        Logger.error(
          `Error while creating link for ${tag} in Preview panel`,
          e
        );
        return getFoamTag(tag);
      }
    },
  });
};

const getFoamTag = (content: string) =>
  `<span class='foam-tag'>${content}</span>`;

export const markdownItWithRemoveLinkReferences = (
  md: markdownit,
  workspace: FoamWorkspace
) => {
  md.inline.ruler.before('link', 'clear-references', state => {
    if (state.env.references) {
      const src = state.src.toLowerCase();
      const foamLinkRegEx = /\[\[([^[\]]+?)\]\]/g;
      const foamLinks = [...src.matchAll(foamLinkRegEx)].map(m =>
        m[1].toLowerCase()
      );

      Object.keys(state.env.references).forEach(refKey => {
        // Remove all references that have corresponding wikilinks.
        // If the markdown parser sees a reference, it will format it before
        // we get a chance to create the wikilink.
        if (foamLinks.includes(refKey.toLowerCase())) {
          delete state.env.references[refKey];
        }
      });
    }
    return false;
  });
  return md;
};

export default feature;
