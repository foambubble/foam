import { bench } from 'vitest';
import { makeJournalNote } from '../../test/parser-fixtures';
import { Logger } from '../utils/log';
import { completionAt } from './completion';

/**
 * The cost of `completionAt` with a link open at the end of a note. It parses
 * everything before the cursor, and an editor asks on every keystroke typed
 * inside a link, so this is typing lag in a large note (#1375).
 *
 * Run with `yarn bench`; the regression gate is `perf-regression.test.ts`.
 */

Logger.setLevel('error');

// [linear]: the journal shape parses in linear time, see markdown-parser.bench.ts
describe('completionAt — open link at the end of a note [linear]', () => {
  for (const lines of [250, 1000, 4000]) {
    const doc = `${makeJournalNote(lines)}\n- see [[proj`;
    bench(`${lines} lines`, () => completionAt(doc, doc.length));
  }
});
