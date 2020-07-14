import { Note, NoteGraph } from '../index';
import {
  createMarkdownReferences,
  stringifyMarkdownLinkReferenceDefinition,
} from '../markdown-provider';
import { Position } from 'unist';

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

// const generateHeadings = (noteId: string, ng: any) => {
//   // get the Note

//   const note = ng.getNote(noteId);

//   const markdown = fs.readFileSync(note.path, { encoding: 'utf-8' });

//   const tree = parse(markdown);

//   const heading = getHeading(note.title);

//   let headingExists = false;

//   visit(tree, (node: any) => {
//     if (node.type === 'heading' && node.depth === 1) {
//       // Do nothing
//       headingExists = true;
//       return EXIT;
//     }
//     return CONTINUE;
//   });

//   const textEdit = {
//     range: {
//       start: { line: 0, character: 0 },
//       end: { line: 0, character: heading.length },
//     },
//     newText: heading,
//   };

//   return headingExists ? null : textEdit;
// };
