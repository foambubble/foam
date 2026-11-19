import { URI } from '../model/uri';
import { createTestWorkspace } from '../../test/test-utils';
import { uriToWorkspacePath } from './workspace';

describe('uriToWorkspacePath', () => {
  const root = URI.file('/notes');

  it('gives a note its path relative to the workspace folder', () => {
    const workspace = createTestWorkspace([root]);

    expect(uriToWorkspacePath(URI.file('/notes/sub/a.md'), workspace)).toEqual(
      'sub/a.md'
    );
  });

  it('gives the placeholder of a wikilink its link target', () => {
    const workspace = createTestWorkspace([root]);

    expect(
      uriToWorkspacePath(URI.placeholder('not-written-yet'), workspace)
    ).toEqual('not-written-yet');
  });

  it('gives the placeholder of a link to a missing file its path relative to the workspace folder', () => {
    const workspace = createTestWorkspace([root]);

    expect(
      uriToWorkspacePath(URI.placeholder('/notes/missing/file.md'), workspace)
    ).toEqual('missing/file.md');
  });
});
