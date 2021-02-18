import { createTestNote } from '../test/test-utils';
import { isBlank } from './blank-notes';

describe('isBlank', () => {
  it('should return true when an empty note is provided', () => {
    expect(
      isBlank(
        createTestNote({
          uri: '',
          text: '',
        })
      )
    ).toBeTruthy();
  });

  it('should return true when a note containing only whitespace is provided', () => {
    expect(
      isBlank(
        createTestNote({
          uri: '',
          text: ' \n\t\n\t  ',
        })
      )
    ).toBeTruthy();
  });

  it('should return true when a note containing only a title is provided', () => {
    expect(
      isBlank(
        createTestNote({
          uri: '',
          text: '# Title',
        })
      )
    ).toBeTruthy();
  });

  it('should return true when a note containing a title followed by whitespace is provided', () => {
    expect(
      isBlank(
        createTestNote({
          uri: '',
          text: '# Title \n\t\n \t \n  ',
        })
      )
    ).toBeTruthy();
  });

  it('should return false when there is more than one line containing more than just whitespace', () => {
    expect(
      isBlank(
        createTestNote({
          uri: '',
          text: '# Title\nA line that is not the title\nAnother line',
        })
      )
    ).toBeFalsy();
  });
});
