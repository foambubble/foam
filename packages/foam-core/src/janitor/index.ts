import { Position } from 'unist';
import dashify from 'dashify';
import { Note, NoteGraph } from '../index';
import {
  createMarkdownReferences,
  stringifyMarkdownLinkReferenceDefinition,
} from '../markdown-provider';
import { getHeadingFromFileName } from '../utils'

export interface TextEdit {
  range: Position;
  newText: string;
}

export const generateLinkReferences = (note: Note, ng: NoteGraph): TextEdit | null => {
  const newReferences = createMarkdownReferences(ng, note.id).map(
    stringifyMarkdownLinkReferenceDefinition
  ).join('\n');

  if (note.definitions.length === 0) {
    if (newReferences.length === 0) {
      return null;
    }

    // @todo: how to abstract new line?
    const padding = note.end.column === 1 ? '\n' : '\n\n';
    return {
      newText: `${padding}${newReferences}`,
      range: {
        start: note.end,
        end: note.end,
      },
    };
  } else {
    const first = note.definitions[0];
    const last = note.definitions[note.definitions.length - 1];

    const oldRefrences = note.definitions.map(stringifyMarkdownLinkReferenceDefinition).join('\n');

    if (oldRefrences === newReferences) {
      return null;
    }

    return {
      // @todo: do we need to ensure new lines?
      newText: `${newReferences}`,
      range: {
        start: first.position!.start,
        end: last.position!.end,
      },
    };
  }
};

export const generateHeading = (note: Note): TextEdit | null => {
  // Note: This may not work if the heading is same as the file name
  if (note.title !== note.id) {
    return null;
  }

  return {
    newText: `# ${getHeadingFromFileName(note.id)}\n\n`,
    range: {
      start: { line: 0, column: 0, offset: 0 },
      end: { line: 0, column: 0, offset: 0 }
    }
  }
};

/**
 * 
 * @param fileName 
 * @returns null if file name is already in kebab case otherise returns 
 * the kebab cased file name
 */
export const getKebabCaseFileName = (fileName: string) => {
  // NOTE: dashify will also rename camelCase filename
  const kebabCasedFileName = dashify(fileName);
  return kebabCasedFileName === fileName ? null : kebabCasedFileName;
}
