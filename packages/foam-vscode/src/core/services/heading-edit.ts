import { FoamGraph } from '../model/graph';
import { FoamWorkspace } from '../model/workspace';
import { URI } from '../model/uri';
import { ResourceLink, NoteLinkDefinition } from '../model/note';
import { MarkdownLink } from './markdown-link';
import { WorkspaceTextEdit } from './text-edit';

export interface HeadingEditResult {
  edits: WorkspaceTextEdit[];
  totalOccurrences: number;
}

export abstract class HeadingEdit {
  /**
   * Generate edits to update all links referencing `oldLabel` section in
   * the resource at `resourceUri`, renaming it to `newLabel`.
   *
   * Does NOT include the edit to update the heading text itself — that is
   * handled by the caller (the VS Code provider layer).
   *
   * Handles three link forms:
   * - Wikilinks: `[[note#OldLabel]]` → `[[note#NewLabel]]`
   * - Self-referencing wikilinks: `[[#OldLabel]]` → `[[#NewLabel]]`
   * - Direct markdown links: `[text](note.md#OldLabel)` → `[text](note.md#NewLabel)`
   * - Reference-style markdown links: updates the definition URL line, not the inline text
   */
  static createRenameSectionEdits(
    graph: FoamGraph,
    workspace: FoamWorkspace,
    resourceUri: URI,
    oldLabel: string,
    newLabel: string
  ): HeadingEditResult {
    const backlinks = graph.getBacklinks(resourceUri);
    const edits: WorkspaceTextEdit[] = [];
    let totalOccurrences = 0;

    for (const connection of backlinks) {
      const link = connection.link;
      let section: string;
      try {
        ({ section } = MarkdownLink.analyzeLink(link));
      } catch {
        continue;
      }

      // For resolved reference-style markdown links (e.g. `[text][ref]` with
      // `[ref]: note.md#OldLabel`), update the definition line URL rather than
      // the inline text, which doesn't contain the URL.
      if (link.type === 'link' && ResourceLink.isResolvedReference(link)) {
        if (section !== oldLabel) {
          continue;
        }
        const def = link.definition as NoteLinkDefinition;
        if (!def.range) {
          continue;
        }
        const hashIdx = def.url.lastIndexOf('#');
        const newUrl =
          hashIdx >= 0
            ? def.url.slice(0, hashIdx + 1) + newLabel
            : def.url + '#' + newLabel;

        totalOccurrences++;
        edits.push({
          uri: connection.source,
          edit: {
            range: def.range,
            newText: NoteLinkDefinition.format({ ...def, url: newUrl }),
          },
        });
      } else if (
        link.type === 'wikilink' &&
        ResourceLink.isResolvedReference(link)
      ) {
        // For resolved wikilinks, the section may appear in the rawText
        // identifier, in the definition URL, or both.
        //
        // - If only in definition: update definition URL only (rawText has no
        //   section to update, e.g. `[[note]]` + `[note]: note.md#OldLabel`)
        // - If in both: update rawText and update definition URL + label
        //   (e.g. `[[note#OldLabel]]` + `[note#OldLabel]: note.md#OldLabel`)
        const def = link.definition as NoteLinkDefinition;
        const rawTextMatchesSection = section === oldLabel;
        const defHashIdx = def.url.lastIndexOf('#');
        const defSection = defHashIdx >= 0 ? def.url.slice(defHashIdx + 1) : '';
        const defMatchesSection = defSection === oldLabel;

        if (!rawTextMatchesSection && !defMatchesSection) {
          continue;
        }

        totalOccurrences++;

        if (rawTextMatchesSection) {
          const textEdit = MarkdownLink.createUpdateLinkEdit(link, {
            section: newLabel,
          });
          edits.push({ uri: connection.source, edit: textEdit });
        }

        if (defMatchesSection && def.range) {
          const newUrl = def.url.slice(0, defHashIdx + 1) + newLabel;
          // If the definition label also encodes the section
          // (e.g. "note-a#OldLabel"), update the label portion too.
          const labelHashIdx = def.label.lastIndexOf('#');
          const labelSection =
            labelHashIdx >= 0 ? def.label.slice(labelHashIdx + 1) : '';
          const newDefLabel =
            labelSection === oldLabel
              ? def.label.slice(0, labelHashIdx + 1) + newLabel
              : def.label;

          edits.push({
            uri: connection.source,
            edit: {
              range: def.range,
              newText: NoteLinkDefinition.format({
                ...def,
                label: newDefLabel,
                url: newUrl,
              }),
            },
          });
        }
      } else {
        // Wikilinks without resolved definitions and regular inline markdown links.
        if (section !== oldLabel) {
          continue;
        }
        totalOccurrences++;
        const textEdit = MarkdownLink.createUpdateLinkEdit(link, {
          section: newLabel,
        });
        edits.push({ uri: connection.source, edit: textEdit });
      }
    }

    return { edits, totalOccurrences };
  }
}
