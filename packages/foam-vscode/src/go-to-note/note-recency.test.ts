import { URI } from '@foam/core';
import { NoteRecency } from './note-recency';

describe('NoteRecency', () => {
  it('ranks the most recently visited note ahead of an older one (#1792)', () => {
    const recency = new NoteRecency();
    const first = URI.file('/first.md');
    const second = URI.file('/second.md');

    recency.visit(first);
    recency.visit(second);

    expect(recency.rank(second)).toBeLessThan(recency.rank(first));
  });

  it('ranks a note that was never visited behind every visited note', () => {
    const recency = new NoteRecency();
    recency.visit(URI.file('/visited.md'));

    expect(recency.rank(URI.file('/never-visited.md'))).toBeGreaterThan(
      recency.rank(URI.file('/visited.md'))
    );
  });

  it('ranks every unvisited note equally, so they keep the order they came in', () => {
    const recency = new NoteRecency();

    expect(recency.rank(URI.file('/a.md'))).toEqual(
      recency.rank(URI.file('/b.md'))
    );
  });

  it('moves a revisited note back to the front', () => {
    const recency = new NoteRecency();
    const old = URI.file('/old.md');
    const recent = URI.file('/recent.md');

    recency.visit(old);
    recency.visit(recent);
    recency.visit(old);

    expect(recency.rank(old)).toBeLessThan(recency.rank(recent));
  });

  it('counts a note reached through a section link as the same note', () => {
    const recency = new NoteRecency();
    const note = URI.file('/note.md');
    const other = URI.file('/other.md');

    recency.visit(note.with({ fragment: 'a-section' }));
    recency.visit(other);
    recency.visit(note.with({ fragment: 'another-section' }));

    expect(recency.rank(note)).toBeLessThan(recency.rank(other));
  });

  it('forgets the notes visited beyond its limit', () => {
    const recency = new NoteRecency(2);
    const dropped = URI.file('/dropped.md');

    recency.visit(dropped);
    recency.visit(URI.file('/kept-1.md'));
    recency.visit(URI.file('/kept-2.md'));

    expect(recency.rank(dropped)).toEqual(
      recency.rank(URI.file('/unknown.md'))
    );
  });
});
