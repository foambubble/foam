import { Resource } from '../../model/note';
import { TextEdit } from '../../services/text-edit';
import { stripFrontMatter, stripFrontMatterAndTitle } from '../../utils/md';
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
  // Targets show the title on their own, so drop the frontmatter and the H1
  // the title comes from. Link edits don't add or remove lines, so the
  // parsed heading lines still apply.
  const titleHeading = note.sections.find(s => s.level === 1);
  const body =
    titleHeading?.label === note.title
      ? stripFrontMatterAndTitle(rewrittenMarkdown, note.sections)
      : stripFrontMatter(rewrittenMarkdown);

  return {
    note: {
      sourceUri: note.uri,
      route: location.href,
      title: note.title,
      description,
      properties,
      markdown: body,
      backlinks: buildBacklinks(note, context),
    },
    diagnostics,
  };
};
