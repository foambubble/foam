import { URI } from '@foam/core';
import { isNoteTargetAllowed } from './note-factory';

describe('isNoteTargetAllowed', () => {
  const root = URI.file('/workspace');
  const otherRoot = URI.file('/other-workspace');

  describe('in a trusted workspace', () => {
    it('allows a target inside the workspace', () => {
      expect(
        isNoteTargetAllowed(URI.file('/workspace/note.md'), [root], true)
      ).toBe(true);
    });

    it('allows a target outside the workspace', () => {
      // Trusting the workspace is the deliberate opt-in: templates are the
      // user's own, and filing a note into a sibling directory is a
      // legitimate thing to want.
      expect(
        isNoteTargetAllowed(URI.file('/elsewhere/note.md'), [root], true)
      ).toBe(true);
    });
  });

  describe('in an untrusted workspace', () => {
    it('allows a target inside the workspace', () => {
      expect(
        isNoteTargetAllowed(URI.file('/workspace/note.md'), [root], false)
      ).toBe(true);
    });

    it('allows a target nested deeper inside the workspace', () => {
      expect(
        isNoteTargetAllowed(
          URI.file('/workspace/journal/2026/note.md'),
          [root],
          false
        )
      ).toBe(true);
    });

    it('denies a target that escapes the workspace', () => {
      // This is the resolved form of a template `filepath: ../../etc/foo.md`
      // once `posix.join` has normalized the traversal away.
      expect(
        isNoteTargetAllowed(URI.file('/etc/foo.md'), [root], false)
      ).toBe(false);
    });

    it('denies a sibling directory that merely shares the root prefix', () => {
      expect(
        isNoteTargetAllowed(URI.file('/workspace-evil/note.md'), [root], false)
      ).toBe(false);
    });

    it('allows a target inside any root of a multi-root workspace', () => {
      expect(
        isNoteTargetAllowed(URI.file('/other-workspace/note.md'), [
          root,
          otherRoot,
        ], false)
      ).toBe(true);
    });

    it('denies a target outside every root of a multi-root workspace', () => {
      expect(
        isNoteTargetAllowed(URI.file('/elsewhere/note.md'), [root, otherRoot], false)
      ).toBe(false);
    });
  });
});
