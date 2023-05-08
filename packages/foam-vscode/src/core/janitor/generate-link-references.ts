import { Resource } from '../model/note';
import { Range } from '../model/range';
import {
  createMarkdownReferences,
  stringifyMarkdownLinkReferenceDefinition,
} from '../services/markdown-provider';
import { FoamWorkspace } from '../model/workspace';
import { TextEdit } from '../services/text-edit';
import { Position } from '../model/position';

export const LINK_REFERENCE_DEFINITION_HEADER = `[//begin]: # "Autogenerated link references for markdown compatibility"`;
export const LINK_REFERENCE_DEFINITION_FOOTER = `[//end]: # "Autogenerated link references"`;

export const generateLinkReferences = async (
  note: Resource,
  text: string,
  eol: string,
  workspace: FoamWorkspace,
  includeExtensions: boolean
): Promise<TextEdit | null> => {
  if (!note) {
    return null;
  }

  const newWikilinkDefinitions = createMarkdownReferences(
    workspace,
    note.uri,
    includeExtensions
  );

  const beginDelimiterDef = note.definitions.find(
    ({ label }) => label === '//begin'
  );
  const endDelimiterDef = note.definitions.find(
    ({ label }) => label === '//end'
  );

  const lines = text.split(eol);

  const targetRange =
    beginDelimiterDef && endDelimiterDef
      ? Range.createFromPosition(
          beginDelimiterDef.range.start,
          endDelimiterDef.range.end
        )
      : Range.create(
          lines.length - 1,
          lines[lines.length - 1].length,
          lines.length - 1,
          lines[lines.length - 1].length
        );

  const newReferences =
    newWikilinkDefinitions.length === 0
      ? ''
      : [
          LINK_REFERENCE_DEFINITION_HEADER,
          ...newWikilinkDefinitions.map(
            stringifyMarkdownLinkReferenceDefinition
          ),
          LINK_REFERENCE_DEFINITION_FOOTER,
        ].join(eol);

  // check if the new references match the existing references
  const existingReferences = lines
    .slice(targetRange.start.line, targetRange.end.line + 1)
    .join(eol);

  // adjust padding based on whether there are existing definitions
  // and, if not, whether we are on an empty line at the end of the file
  const padding =
    newWikilinkDefinitions.length === 0 || // no definitions
    !Position.isEqual(targetRange.start, targetRange.end) // replace existing definitions
      ? ''
      : targetRange.start.character > 0 // not an empty line
      ? `${eol}${eol}`
      : eol;

  return existingReferences === newReferences
    ? null
    : {
        newText: `${padding}${newReferences}`,
        range: targetRange,
      };
};
