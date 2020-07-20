import { Position } from 'unist';
import GithubSlugger from 'github-slugger';
import { Note, NoteGraph } from '../index';
import {
  createMarkdownReferences,
  stringifyMarkdownLinkReferenceDefinition,
} from '../markdown-provider';
import { getHeadingFromFileName } from '../utils';

const slugger = new GithubSlugger();

const INCLUDE_EXTENSION__HARD_CODED_READ_FROM_PROJECT_SETTINGS_FILE = false;

export interface TextEdit {
  range: Position;
  newText: string;
}

export const generateLinkReferences = (
  note: Note,
  ng: NoteGraph
): TextEdit | null => {
  if (!note) {
    return null;
  }

  const newReferences = createMarkdownReferences(
    ng,
    note.id,
    INCLUDE_EXTENSION__HARD_CODED_READ_FROM_PROJECT_SETTINGS_FILE
  )
    .map(stringifyMarkdownLinkReferenceDefinition)
    .join('\n');

  if (note.definitions.length === 0) {
    if (newReferences.length === 0) {
      return null;
    }

    const padding = note.end.column === 1 ? note.eol : `${note.eol}${note.eol}`;
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

    const oldReferences = note.definitions
      .map(stringifyMarkdownLinkReferenceDefinition)
      .join(note.eol);

    if (oldReferences === newReferences) {
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
  if (!note) {
    return null;
  }
  // Note: This may not work if the heading is same as the file name
  if (note.title !== note.id) {
    return null;
  }

  return {
    newText: `# ${getHeadingFromFileName(note.id)}${note.eol}${note.eol}`,
    range: {
      start: { line: 0, column: 0, offset: 0 },
      end: { line: 0, column: 0, offset: 0 },
    },
  };
};

/**
 *
 * @param fileName
 * @returns null if file name is already in kebab case otherise returns
 * the kebab cased file name
 */
export const getKebabCaseFileName = (fileName: string) => {
  const kebabCasedFileName = slugger.slug(fileName);
  return kebabCasedFileName === fileName ? null : kebabCasedFileName;
};
