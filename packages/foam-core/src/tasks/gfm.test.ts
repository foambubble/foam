import { Logger } from '../utils/log';
import { taskLinesOf } from './task-lines';
import { parserTasks } from '../../test/parser-tasks';

// mulberry32: small, seedable, the same everywhere.
function generator(seed: number) {
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(list: readonly T[]): T =>
    list[Math.floor(random() * list.length)];
  const chance = (p: number) => random() < p;
  return { pick, chance };
}

const WORDS = ['call', 'Anna', '[[2026-10-09]]', '#later', '`code`', 'x'];
const MARKERS = ['-', '*', '+', '1.', '2.', '10.', '1)', '-', '-', '1.'];
const AFTER_MARKER = [' ', ' ', ' ', ' ', '  ', '    ', '     ', '\t', ''];
const CHECKBOXES = [
  '[ ] ',
  '[x] ',
  '[X] ',
  '[ ] ',
  '[x] ',
  '[\t] ',
  '[ ]\t',
  '[ ]',
  '[ ] ',
  '[x]',
  '[y] ',
  '',
  '',
];
const INDENTS = ['', '', ' ', '  ', '   ', '    ', '      ', '\t', '  \t'];
const QUOTES = ['> ', '>', '> > ', '  > '];
const FENCES = ['```', '~~~', '````', '``` js', '~~~~'];

/** Random notes made of the blocks people write, task-like lines all over. */
function notes(count: number, seed: number): string[] {
  const { pick, chance } = generator(seed);
  const words = () =>
    Array.from({ length: pick([1, 1, 2, 3]) }, () => pick(WORDS)).join(' ');
  const item = () =>
    pick(INDENTS) +
    pick(MARKERS) +
    pick(AFTER_MARKER) +
    pick(CHECKBOXES) +
    (chance(0.85) ? words() : '');
  const block = (depth: number): string[] => {
    const kinds = depth > 1 ? 3 : 14;
    switch (pick([...Array(kinds).keys()])) {
      case 0:
        return Array.from({ length: pick([1, 2, 3, 4]) }, item);
      case 1:
        return [words(), ...(chance(0.5) ? [item()] : [])];
      case 2:
        return [
          pick(['# Title', '## Tasks', 'Title', '###### x', '#tag']),
        ].concat(chance(0.3) ? [pick(['===', '---'])] : []);
      case 3: {
        const quote = pick(QUOTES);
        return block(depth + 1)
          .map(line => (chance(0.85) ? quote + line : line))
          .concat(chance(0.3) ? [block(depth + 1)[0]] : []);
      }
      case 4: {
        const fence = pick(FENCES);
        const indent = pick(['', '', '  ', '    ']);
        return [indent + fence, item(), words()].concat(
          chance(0.8) ? [indent + fence.split(' ')[0]] : []
        );
      }
      case 5:
        return ['', '    ' + item(), chance(0.5) ? '\t' + item() : ''];
      case 6:
        return pick([
          ['<!--', item(), '-->'],
          ['<div>', item(), '</div>'],
          ['<span>', item()],
          ['<!-- x -->', item()],
        ]);
      case 7:
        return [
          '| a | b |',
          pick(['|---|---|', '| :-: | --: |', '| x |']),
          item(),
        ];
      case 8:
        return [pick(['---', '***', '- - -', '* * *', '___'])];
      case 9:
        return pick([
          ['[note]: note.md "Note"'],
          ['[a]: <b>'],
          ['[c]:'],
          ['[[d]] e'],
          ['[e]: f', '"title"'],
          ['[f]: <g>x'],
          ['[h]:', '<i>'],
          ['[j', 'k]: l'],
        ]);
      case 10:
        return [item(), pick(['  ', '   ', '    ', '', '\t']) + words()];
      case 11:
        return [pick(['  ', '\t', ' ']), item()];
      default: {
        const nest = pick(['  ', '   ', '    ', '\t', ' ', '      ']);
        return [
          item(),
          ...(chance(0.3) ? [''] : []),
          ...block(depth + 1).map(line => nest + line),
        ];
      }
    }
  };
  return Array.from({ length: count }, () => {
    const lines: string[] = [];
    if (chance(0.3)) {
      lines.push(
        ...(chance(0.3) ? [''] : []),
        '---',
        pick(['title: x', 'tags: [a]', 'x: "- [ ] y"']),
        pick(['---', '---', '...', '----'])
      );
    }
    const blocks = pick([1, 2, 3, 4, 5, 6, 7]);
    for (let i = 0; i < blocks; i++) {
      lines.push(...block(0));
      lines.push(...pick([[''], [''], [], ['', ''], [' \t']]));
    }
    return lines.join(chance(0.2) ? '\r\n' : '\n');
  });
}

describe('the task rule', () => {
  it("reads the same task lines, with the same state, as core's parser", () => {
    const level = Logger.getLevel();
    // Frontmatter that isn't YAML is logged as a warning.
    Logger.setLevel('error');
    try {
      const differing = notes(3000, 0x7a5c).filter(
        note =>
          JSON.stringify(
            taskLinesOf(note).map(task => [task.line, task.done])
          ) !== JSON.stringify(parserTasks(note))
      );

      expect(differing.slice(0, 3)).toEqual([]);
    } finally {
      Logger.setLevel(level);
    }
  });
});
