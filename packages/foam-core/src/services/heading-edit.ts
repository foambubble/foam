import { FoamGraph } from '../model/graph';
import { FoamWorkspace } from '../model/workspace';
import { URI } from '../model/uri';
import {
  Resource,
  ResourceLink,
  NoteLinkDefinition,
  Section,
} from '../model/note';
import { Position } from '../model/position';
import { Range } from '../model/range';
import { MarkdownLink } from './markdown-link';
import { WorkspaceTextEdit } from './text-edit';

export interface HeadingEditResult {
  edits: WorkspaceTextEdit[];
  totalOccurrences: number;
}

export abstract class HeadingEdit {
  /**
   * The section a rename at `position` in `resource` applies to: the one a
   * wikilink's `#section` there points to, otherwise the heading there.
   * `target` holds the section; `range` is the text in `resource` naming it.
   *
   * A note in `current` is used instead of the workspace's copy of it.
   */
  static getSectionAtPosition(
    workspace: FoamWorkspace,
    resource: Resource,
    position: Position,
    current: Resource[] = []
  ): { target: Resource; section: Section; range: Range } | undefined {
    const link = resource.links.find(l =>
      Range.containsPosition(l.range, position)
    );
    const linkSectionRange = link && MarkdownLink.getSectionRange(link);
    if (
      linkSectionRange &&
      Range.containsPosition(linkSectionRange, position)
    ) {
      const targetUri = workspace.resolveLink(resource, link);
      const target =
        current.find(r => r.uri.path === targetUri.path) ??
        workspace.find(targetUri);
      const section =
        target &&
        Resource.findSection(target, MarkdownLink.analyzeLink(link).section);
      return section ? { target, section, range: linkSectionRange } : undefined;
    }

    const section = resource.sections.find(s =>
      Range.containsPosition(s.headingRange, position)
    );
    return section
      ? { target: resource, section, range: section.labelRange }
      : undefined;
  }

  /**
   * Generate edits to update all links referencing block `^oldId` in the
   * resource at `resourceUri`, renaming it to `^newId`.
   *
   * Does NOT include the edit to update the block anchor text itself — that is
   * handled by the caller (the VS Code provider layer).
   *
   * Handles:
   * - Wikilinks: `[[note#^oldId]]` → `[[note#^newId]]`
   * - Direct markdown links: `[text](note.md#^oldId)` → `[text](note.md#^newId)`
   * - Reference-style markdown links: updates the definition URL fragment
   */
  static createRenameBlockEdits(
    graph: FoamGraph,
    workspace: FoamWorkspace,
    resourceUri: URI,
    oldId: string,
    newId: string
  ): HeadingEditResult {
    const backlinks = graph.getBacklinks(resourceUri);
    const edits: WorkspaceTextEdit[] = [];
    let totalOccurrences = 0;

    for (const connection of backlinks) {
      const link = connection.link;
      let blockId: string;
      try {
        ({ blockId } = MarkdownLink.analyzeLink(link));
      } catch {
        continue;
      }

      if (link.type === 'link' && ResourceLink.isResolvedReference(link)) {
        if (blockId !== oldId) {
          continue;
        }
        const def = link.definition as NoteLinkDefinition;
        if (!def.range) {
          continue;
        }
        const hashIdx = def.url.lastIndexOf('#');
        const newUrl =
          hashIdx >= 0
            ? def.url.slice(0, hashIdx + 1) + '^' + newId
            : def.url + '#^' + newId;

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
        const def = link.definition as NoteLinkDefinition;
        const rawTextMatchesBlock = blockId === oldId;
        const defHashIdx = def.url.lastIndexOf('#');
        const defFragment =
          defHashIdx >= 0 ? def.url.slice(defHashIdx + 1) : '';
        const defBlockMatch = defFragment.match(/^\^([a-zA-Z0-9-]+)$/);
        const defBlockId = defBlockMatch?.[1] ?? '';
        const defMatchesBlock = defBlockId === oldId;

        if (!rawTextMatchesBlock && !defMatchesBlock) {
          continue;
        }

        totalOccurrences++;

        if (rawTextMatchesBlock) {
          edits.push({
            uri: connection.source,
            edit: MarkdownLink.createUpdateLinkEdit(link, {
              section: '^' + newId,
            }),
          });
        }

        if (defMatchesBlock && def.range) {
          const newUrl = def.url.slice(0, defHashIdx + 1) + '^' + newId;
          const labelHashIdx = def.label.lastIndexOf('#');
          const labelFragment =
            labelHashIdx >= 0 ? def.label.slice(labelHashIdx + 1) : '';
          const labelBlockMatch = labelFragment.match(/^\^([a-zA-Z0-9-]+)$/);
          const newDefLabel =
            labelBlockMatch?.[1] === oldId
              ? def.label.slice(0, labelHashIdx + 1) + '^' + newId
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
        if (blockId !== oldId) {
          continue;
        }
        let edit: WorkspaceTextEdit['edit'];
        try {
          edit = MarkdownLink.createUpdateLinkEdit(link, {
            section: '^' + newId,
          });
        } catch {
          continue;
        }
        totalOccurrences++;
        edits.push({ uri: connection.source, edit });
      }
    }

    return { edits: WorkspaceTextEdit.dedupe(edits), totalOccurrences };
  }

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
   *
   * The links of a note in `current` are used instead of the graph's for it,
   * including links the graph doesn't have yet.
   */
  static createRenameSectionEdits(
    graph: FoamGraph,
    workspace: FoamWorkspace,
    resourceUri: URI,
    oldLabel: string,
    newLabel: string,
    current: Resource[] = []
  ): HeadingEditResult {
    const currentPaths = new Set(current.map(r => r.uri.path));
    const backlinks = [
      ...graph
        .getBacklinks(resourceUri)
        .filter(c => !currentPaths.has(c.source.path)),
      ...current.flatMap(r =>
        FoamGraph.resolveLinks(workspace, r).filter(
          c => c.target.path === resourceUri.path
        )
      ),
    ];
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
        let textEdit: WorkspaceTextEdit['edit'];
        try {
          textEdit = MarkdownLink.createUpdateLinkEdit(link, {
            section: newLabel,
          });
        } catch {
          continue;
        }
        totalOccurrences++;
        edits.push({ uri: connection.source, edit: textEdit });
      }
    }

    return { edits: WorkspaceTextEdit.dedupe(edits), totalOccurrences };
  }
}
