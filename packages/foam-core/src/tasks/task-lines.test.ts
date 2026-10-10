import { Range } from '../model/range';
import { listItemAt, taskLinesOf } from './task-lines';

const linesOf = (...rows: string[]) =>
  taskLinesOf(rows.join('\n')).map(task => [task.line, task.done]);

describe('taskLinesOf', () => {
  it('finds bullet, numbered, quoted, nested and starred tasks, and no empty checkbox', () => {
    expect(
      linesOf(
        '- [ ] bullet task',
        '1. [ ] numbered task',
        '> - [ ] quoted task',
        '  - [x] nested done',
        '- [ ]',
        '* [X] star upper'
      )
    ).toEqual([
      [0, false],
      [1, false],
      [2, false],
      [3, true],
      [5, true],
    ]);
  });

  it('gives the line, its checkbox, the text after it and the days it links', () => {
    const [task] = taskLinesOf(
      '# Day\r\n> 1. [x]  Call [[Anna]] [[2026-10-09]] \r\n'
    );

    expect(task).toEqual({
      line: 1,
      raw: '> 1. [x]  Call [[Anna]] [[2026-10-09]] ',
      done: true,
      checkbox: Range.create(1, 5, 1, 8),
      text: ' Call [[Anna]] [[2026-10-09]] ',
      days: ['2026-10-09'],
    });
  });

  it('reads open and done tasks with their line, text and the line as written', () => {
    const content = '# Day\n\n- [ ] Call Anna\n- [x] Buy milk\n* [X] Post\n';

    expect(
      taskLinesOf(content).map(({ line, raw, done, text }) => ({
        line,
        raw,
        done,
        text,
      }))
    ).toEqual([
      { line: 2, raw: '- [ ] Call Anna', done: false, text: 'Call Anna' },
      { line: 3, raw: '- [x] Buy milk', done: true, text: 'Buy milk' },
      { line: 4, raw: '* [X] Post', done: true, text: 'Post' },
    ]);
  });

  it('reads indented tasks and keeps the line as written without its CR', () => {
    const tasks = taskLinesOf('- a\r\n  + [ ] nested  \r\n');

    expect(tasks).toHaveLength(1);
    expect(tasks[0].line).toBe(1);
    expect(tasks[0].raw).toBe('  + [ ] nested  ');
    expect(tasks[0].text).toBe('nested  ');
  });

  it('skips the frontmatter and code blocks', () => {
    const content = [
      '---',
      'todo:',
      '- [ ] not a task',
      '---',
      '```',
      '- [ ] not a task either',
      '```',
      '- [ ] a task',
    ].join('\n');

    expect(taskLinesOf(content).map(t => t.line)).toEqual([7]);
  });

  it('ignores bullets and text that only look like tasks', () => {
    expect(
      taskLinesOf('- plain [ ] item\n[ ] no bullet\n-[ ] no space')
    ).toEqual([]);
  });

  it('reads tasks after a line that only looks like a fence', () => {
    expect(
      taskLinesOf('```x``` inline code\n- [ ] a').map(t => t.line)
    ).toEqual([1]);
  });

  it('closes a fence only with the same marker, at least as long', () => {
    const content = [
      '````',
      '```',
      '- [ ] in',
      '````',
      '~~~',
      '```',
      '- [ ] in too',
      '~~~',
      '- [ ] out',
    ].join('\n');

    expect(taskLinesOf(content).map(t => t.text)).toEqual(['out']);
  });

  it('lists the days a task links, each once, in order', () => {
    const [task] = taskLinesOf(
      '- [ ] Book the room [[2026-10-09]] and [[2026-10-12]] [[2026-10-09]]'
    );

    expect(task.days).toEqual(['2026-10-09', '2026-10-12']);
  });

  it('takes a space, an x or a tab between the brackets, then a space or a tab', () => {
    expect(
      linesOf('- [\t] tab', '- [x]\tx', '- [x]x', '- [y] y', '- [ ]', '- [ ]  ')
    ).toEqual([
      [0, false],
      [1, true],
    ]);
  });

  it('needs a list marker followed by a space or a tab', () => {
    expect(
      linesOf(
        '-[ ] a',
        '1.[ ] b',
        '1) [ ] c',
        '\\- [ ] d',
        '+\t[ ] e',
        '10. [ ] f'
      )
    ).toEqual([
      [4, false],
      [5, false],
    ]);
  });

  it('skips frontmatter, also after blank lines, but not a rule further down', () => {
    expect(
      linesOf('', '---', '- [ ] in frontmatter', '---', '- [ ] a')
    ).toEqual([[4, false]]);
    expect(linesOf('# Title', '- [ ] a', '---', '- [ ] b')).toEqual([
      [1, false],
      [3, false],
    ]);
  });

  it('skips fenced code, also inside block quotes and list items', () => {
    expect(
      linesOf(
        '```',
        '- [ ] a',
        '```',
        '> ~~~',
        '> - [ ] b',
        '> ~~~',
        '- x',
        '  ```js',
        '  - [ ] c',
        '  ```',
        '- [ ] d'
      )
    ).toEqual([[10, false]]);
  });

  it('skips indented code, and lines that carry on a paragraph', () => {
    expect(
      linesOf(
        'text',
        '    - [ ] carries on the paragraph',
        '',
        '    - [ ] indented code',
        '',
        'text',
        '2. [ ] carries on the paragraph',
        '1. [ ] starts a list'
      )
    ).toEqual([[7, false]]);
  });

  it('reads items nested in list items by their indentation', () => {
    expect(
      linesOf(
        '- a',
        '',
        '    - [ ] in a',
        '- b',
        '',
        '      - [ ] code in b',
        '1. c',
        '',
        '       - [ ] in c'
      )
    ).toEqual([
      [2, false],
      [8, false],
    ]);
  });

  it('reads quoted lines without a marker as part of the quote', () => {
    expect(linesOf('> a', '- [ ] lazy', '', '> > 1. [x] deep')).toEqual([
      [1, false],
      [3, true],
    ]);
  });

  it('reads link definitions, after which a numbered line can start a list', () => {
    expect(
      linesOf(
        '[a]: https://example.com "A"',
        '2. [ ] after a definition',
        '',
        '[b]: <c>d',
        '2. [ ] after text'
      )
    ).toEqual([[1, false]]);
  });

  it('skips HTML blocks and comments', () => {
    expect(
      linesOf(
        '<!--',
        '- [ ] hidden',
        '-->',
        '<div>',
        '- [ ] in the div',
        '</div>',
        '',
        '- [ ] shown'
      )
    ).toEqual([[7, false]]);
  });

  it('keeps line numbers and every character of CRLF lines', () => {
    const tasks = taskLinesOf('- [ ] a\r\n\r\n1. [x] b\r\n');

    expect(tasks.map(t => [t.line, t.raw])).toEqual([
      [0, '- [ ] a'],
      [2, '1. [x] b'],
    ]);
  });
});

describe('listItemAt', () => {
  it('gives where the bullet and the content of the item on a line start, and its checkbox', () => {
    const content = 'text\n> 1. [x] done\n- \n\npara\n\n    - [ ] code\n';

    expect(listItemAt(content, 1)).toEqual({
      line: 1,
      bullet: 2,
      col: 5,
      checked: true,
    });
    expect(listItemAt(content, 2)).toEqual({
      line: 2,
      bullet: 0,
      col: 2,
      checked: null,
    });
    expect(listItemAt(content, 0)).toBeNull();
    expect(listItemAt(content, 6)).toBeNull();
  });
});
