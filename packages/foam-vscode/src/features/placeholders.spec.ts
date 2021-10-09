import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { createTestNote } from '../test/test-utils';
import { isPlaceholderResource } from './placeholders';

describe('isPlaceholderResource', () => {
  it('should return true when a placeholder', () => {
    const noteA = createTestNote({
      uri: 'note-a.md',
      text: '',
      links: [{ slug: 'placeholder' }],
    });
    const ws = new FoamWorkspace().set(noteA);
    expect(
      isPlaceholderResource(URI.placeholder('placeholder'), ws)
    ).toBeTruthy();
  });

  it('should return true when an empty note is provided', () => {
    const noteA = createTestNote({ uri: 'note-a.md', text: '' });
    const ws = new FoamWorkspace().set(noteA);
    expect(isPlaceholderResource(noteA.uri, ws)).toBeTruthy();
  });

  it('should return true when a note containing only whitespace is provided', () => {
    const noteA = createTestNote({
      uri: '',
      text: ' \n\t\n\t  ',
    });
    const ws = new FoamWorkspace().set(noteA);
    expect(isPlaceholderResource(noteA.uri, ws)).toBeTruthy();
  });

  it('should return true when a note containing only a title is provided', () => {
    const noteA = createTestNote({
      uri: '',
      text: '# Title',
    });
    const ws = new FoamWorkspace().set(noteA);

    expect(isPlaceholderResource(noteA.uri, ws)).toBeTruthy();
  });

  it('should return true when a note containing a title followed by whitespace is provided', () => {
    const noteA = createTestNote({
      uri: '',
      text: '# Title \n\t\n \t \n  ',
    });
    const ws = new FoamWorkspace().set(noteA);
    expect(isPlaceholderResource(noteA.uri, ws)).toBeTruthy();
  });

  it('should return false when there is more than one line containing more than just whitespace', () => {
    const noteA = createTestNote({
      uri: '',
      text: '# Title\nA line that is not the title\nAnother line',
    });
    const ws = new FoamWorkspace().set(noteA);
    expect(isPlaceholderResource(noteA.uri, ws)).toBeFalsy();
  });

  it('should return false when there is at least one line of non-text content', () => {
    const noteA = createTestNote({
      uri: '',
      text: 'A line that is not the title\n',
    });
    const ws = new FoamWorkspace().set(noteA);

    expect(isPlaceholderResource(noteA.uri, ws)).toBeFalsy();
  });
});
