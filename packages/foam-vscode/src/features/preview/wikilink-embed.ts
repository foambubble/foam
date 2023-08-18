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
        switch (includedNote.type) {
          case 'note': {
            const noteStyle = getFoamVsCodeConfig(
              CONFIG_EMBED_NOTE_IN_CONTAINER
            )
              ? 'card'
              : 'inline';
            const noteEmbedder = new NoteEmbedder(
              includedNote,
              'full',
              noteStyle,
              parser,
              workspace,
              md
            );
            content = noteEmbedder.generateEmbedding();
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
    (text, edit) => TextEdit.apply(text, edit),
    noteText
  );
  return text;
}

interface EmbedNoteExtractor {
  extract(note: Resource): string;
}

class FullExtractor implements EmbedNoteExtractor {
  parser: ResourceParser;
  workspace: FoamWorkspace;

  constructor(parser: ResourceParser, workspace: FoamWorkspace) {
    this.parser = parser;
    this.workspace = workspace;
  }

  extract(note: Resource) {
    let noteText = readFileSync(note.uri.toFsPath()).toString();
    const section = Resource.findSection(note, note.uri.fragment);
    if (isSome(section)) {
      const rows = noteText.split('\n');
      noteText = rows
        .slice(section.range.start.line, section.range.end.line)
        .join('\n');
    }
    noteText = withLinksRelativeToWorkspaceRoot(
      noteText,
      this.parser,
      this.workspace
    );
    return noteText;
  }
}

interface EmbedNoteFormatter {
  format(content: string): string;
}

class CardFormatter implements EmbedNoteFormatter {
  md: markdownit;
  constructor(md: markdownit) {
    this.md = md;
  }
  format(content: string) {
    return `<div class="embed-container-note">${this.md.render(content)}</div>`;
  }
}

class InlineFormatter implements EmbedNoteFormatter {
  format(content: string) {
    return content;
  }
}

class NoteEmbedder {
  includedNote: Resource;
  extractor: EmbedNoteExtractor;
  formatter: EmbedNoteFormatter;

  /* extractor dependencies */
  parser: ResourceParser;
  workspace: FoamWorkspace;

  /* formatter dependencies */
  md: markdownit;

  constructor(
    includedNote: Resource,
    extractorType: string,
    formatterType: string,
    parser: ResourceParser,
    workspace: FoamWorkspace,
    md: markdownit
  ) {
    this.includedNote = includedNote;

    switch (extractorType) {
      case 'full':
      case 'content': // TODO: IMPLEMENT
      default:
        this.extractor = new FullExtractor(parser, workspace);
        break;
    }

    switch (formatterType) {
      case 'card':
        this.formatter = new CardFormatter(md);
        break;
      case 'inline':
      default:
        this.formatter = new InlineFormatter();
        break;
    }
  }

  generateEmbedding() {
    const rawContent = this.extractor.extract(this.includedNote);
    return this.formatter.format(rawContent);
  }
}

export default markdownItWikilinkEmbed;
