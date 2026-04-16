import { FoamWorkspace } from '../core/model/workspace';
import { Resource } from '../core/model/note';
import { TextEdit } from '../core/services/text-edit';
import { generateHeading, generateLinkReferences } from './index';

export type WikilinkDefinitionSetting = 'off' | 'withExtensions' | 'noExtensions';

/**
 * Computes the edits needed to bring a note into a clean state:
 * - adds a missing h1 heading
 * - adds/updates/removes wikilink reference definitions
 *
 * Returns an empty array when no changes are needed.
 */
export function computeNoteEdits(
  note: Resource,
  noteText: string,
  eol: string,
  workspace: FoamWorkspace,
  wikilinkSetting: WikilinkDefinitionSetting
): TextEdit[] {
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
  return [...(heading ? [heading] : []), ...definitions];
}
