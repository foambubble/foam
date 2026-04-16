import detectNewline from 'detect-newline';
import { FoamWorkspace } from '../core/model/workspace';
import { Resource } from '../core/model/note';
import { TextEdit } from '../core/services/text-edit';
import { generateHeading, generateLinkReferences } from './index';

export type WikilinkDefinitionSetting = 'off' | 'withExtensions' | 'noExtensions';

export interface NoteEdits {
  uri: Resource['uri'];
  updatedText: string;
  addedHeading: boolean;
  addedDefinitions: boolean;
}

export interface InEditorNoteEdits {
  uri: Resource['uri'];
  heading: TextEdit | null;
  definitions: TextEdit[];
}

export interface JanitorResult {
  updatedHeadingCount: number;
  updatedDefinitionListCount: number;
  changedAnyFiles: number;
}

/**
 * Computes the fully-applied updated text for notes that are not open in an editor.
 * Returns one entry per note that actually changed.
 */
export async function computeNonDirtyEdits(
  notes: Resource[],
  workspace: FoamWorkspace,
  wikilinkSetting: WikilinkDefinitionSetting
): Promise<NoteEdits[]> {
  const results: NoteEdits[] = [];

  await Promise.all(
    notes.map(async note => {
      const noteText = await workspace.readAsMarkdown(note.uri);
      const noteEol = detectNewline(noteText);
      const heading = generateHeading(note, noteText, noteEol);

      const definitions =
        wikilinkSetting === 'off'
          ? []
          : generateLinkReferences(
              note,
              noteText,
              noteEol,
              workspace,
              wikilinkSetting === 'withExtensions'
            );

      if (!heading && definitions.length === 0) {
        return;
      }

      // Note: ordering matters — definitions before heading, since inserting
      // a heading changes line numbers below
      let text = noteText;
      text = definitions.length > 0 ? TextEdit.apply(text, definitions) : text;
      text = heading ? TextEdit.apply(text, heading) : text;

      results.push({
        uri: note.uri,
        updatedText: text,
        addedHeading: !!heading,
        addedDefinitions: definitions.length > 0,
      });
    })
  );

  return results;
}

/**
 * Computes the individual TextEdits for a note that is open (dirty) in an editor.
 * Returns null heading/empty definitions when there's nothing to do.
 */
export function computeDirtyEdits(
  note: Resource,
  noteText: string,
  eol: string,
  workspace: FoamWorkspace,
  wikilinkSetting: WikilinkDefinitionSetting
): InEditorNoteEdits {
  const heading = generateHeading(note, noteText, eol);
  const definitions =
    wikilinkSetting === 'off'
      ? []
      : generateLinkReferences(
          note,
          noteText,
          eol,
          workspace,
          wikilinkSetting === 'withExtensions'
        );

  return { uri: note.uri, heading: heading ?? null, definitions };
}
