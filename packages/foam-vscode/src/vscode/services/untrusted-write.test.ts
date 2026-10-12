import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { URI } from '@foam/core';
import { assertInsideWorkspace } from './untrusted-write';

describe('assertInsideWorkspace', () => {
  describe.skipIf(process.platform === 'win32')(
    'where a backslash is part of a name',
    () => {
      it('refuses one that a symlink places next to the workspace', async () => {
        const parent = fs.mkdtempSync(
          path.join(os.tmpdir(), 'foam-untrusted-')
        );
        const root = path.join(parent, 'notes');
        fs.mkdirSync(root);
        fs.symlinkSync('..', path.join(root, 'up'));
        try {
          await expect(
            assertInsideWorkspace(
              URI.file(root).joinPath('up', 'notes\\planted.md'),
              [URI.file(root)]
            )
          ).rejects.toThrow('outside the workspace');
        } finally {
          fs.rmSync(parent, { recursive: true, force: true });
        }
      });
    }
  );
});
