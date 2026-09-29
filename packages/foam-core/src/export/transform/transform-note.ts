import { Resource } from '../../model/note';
import { TextEdit } from '../../services/text-edit';
import { stripFrontMatter, stripFrontMatterAndTitle } from '../../utils/md';
import { isSome } from '../../utils/core';
import { buildBacklinks } from '../derive/build-backlink-index';
import type { SourceLinkRewriter } from '../target';
import { ExportContext, ExportedDiagnostic, ExportedNote } from '../types';
import { collectLinkDiagnostics } from './link-diagnostics';
import { resolveExportLink } from './resolve-link';

interface TransformedNote {
  note: ExportedNote;
  diagnostics: ExportedDiagnostic[];
}

export const transformNote = async (
  note: Resource,
  context: ExportContext,
  linkRewriter: SourceLinkRewriter
): Promise<TransformedNote> => {
  const markdown = (await context.workspace.readAsMarkdown(note.uri)) ?? '';
  const location = context.locations.get(note.uri.path);
  const properties =
    note.properties && typeof note.properties === 'object'
      ? { ...note.properties }
      : {};
  const description =
    typeof properties.description === 'string' ? properties.description : undefined;

  if (!location) {
    throw new Error(`Missing exported location for ${note.uri.path}`);
  }

  const edits: TextEdit[] = [];
  const diagnostics: ExportedDiagnostic[] = [];

  for (const link of note.links) {
    const resolved = resolveExportLink(link, note, context);
    if (!resolved) {
      continue;
    }

    const diagnostic = collectLinkDiagnostics(resolved, note, location.href);
    if (diagnostic) {
      diagnostics.push(diagnostic);
    }

    const result = linkRewriter.rewrite(resolved, note, context);
    if (result.kind === 'edit') {
      edits.push(result.edit);
    }
  }

  const rewrittenMarkdown =
    edits.length === 0 ? markdown : TextEdit.apply(markdown, edits);
  // The first H1 duplicates the title unless a different frontmatter title
  // replaces it. Link edits don't add or remove lines, so the parsed heading
  // lines still apply to the rewritten text.
  const titleHeading = note.sections.find(s => s.level === 1);
  const frontmatterTitle = properties.title;
  const isTitle =
    isSome(titleHeading) &&
    (frontmatterTitle == null ||
      String(frontmatterTitle) === titleHeading.label);
  const body = isTitle
    ? stripFrontMatterAndTitle(rewrittenMarkdown, note.sections)
    : stripFrontMatter(rewrittenMarkdown);

  return {
    note: {
      sourceUri: note.uri,
      route: location.href,
      title: note.title,
      description,
      properties,
      markdown: rewrittenMarkdown,
      body,
      backlinks: buildBacklinks(note, context),
    },
    diagnostics,
  };
};
