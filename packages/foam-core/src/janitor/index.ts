import { Position } from 'unist';
import GithubSlugger from 'github-slugger';
import {
  Note,
  NoteGraph,
  LINK_REFERENCE_DEFINITION_HEADER,
  LINK_REFERENCE_DEFINITION_FOOTER,
} from '../index';
import {
  createMarkdownReferences,
  stringifyMarkdownLinkReferenceDefinition,
} from '../markdown-provider';
import { getHeadingFromFileName } from '../utils';

const slugger = new GithubSlugger();

export interface TextEdit {
  range: Position;
  newText: string;
}

export const generateLinkReferences = (
  note: Note,
  ng: NoteGraph,
  includeExtensions: boolean
): TextEdit | null => {
  if (!note) {
    return null;
  }

  const markdownReferences = createMarkdownReferences(
    ng,
    note.id,
    includeExtensions
  );

  const newReferences =
    markdownReferences.length === 0
      ? ''
      : [
          LINK_REFERENCE_DEFINITION_HEADER,
          ...markdownReferences.map(stringifyMarkdownLinkReferenceDefinition),
          LINK_REFERENCE_DEFINITION_FOOTER,
        ].join(note.eol);

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

  if (note.title) {
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
