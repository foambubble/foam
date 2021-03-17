import {
  createAttachment,
  createPlaceholder,
  createTestNote,
} from '../test/test-utils';
import { isPlaceholderResource } from './placeholders';

describe('isPlaceholderResource', () => {
  it('should return true when a placeholder', () => {
    expect(
      isPlaceholderResource(
        createPlaceholder({
          uri: '',
        })
      )
    ).toBeTruthy();
  });

  it('should return true when an empty note is provided', () => {
    expect(
      isPlaceholderResource(
        createTestNote({
          uri: '',
          text: '',
        })
      )
    ).toBeTruthy();
  });

  it('should return true when an empty note is provided', () => {
    expect(
      isPlaceholderResource(
        createTestNote({
          uri: '',
          text: '',
        })
      )
    ).toBeTruthy();
  });

  it('should return true when a note containing only whitespace is provided', () => {
    expect(
      isPlaceholderResource(
        createTestNote({
          uri: '',
          text: ' \n\t\n\t  ',
        })
      )
    ).toBeTruthy();
  });

  it('should return true when a note containing only a title is provided', () => {
    expect(
      isPlaceholderResource(
        createTestNote({
          uri: '',
          text: '# Title',
        })
      )
    ).toBeTruthy();
  });

  it('should return true when a note containing a title followed by whitespace is provided', () => {
    expect(
      isPlaceholderResource(
        createTestNote({
          uri: '',
          text: '# Title \n\t\n \t \n  ',
        })
      )
    ).toBeTruthy();
  });

  it('should return false when there is more than one line containing more than just whitespace', () => {
    expect(
      isPlaceholderResource(
        createTestNote({
          uri: '',
          text: '# Title\nA line that is not the title\nAnother line',
        })
      )
    ).toBeFalsy();
  });

  it('should return false when there is at least one line of non-text content', () => {
    expect(
      isPlaceholderResource(
        createTestNote({
          uri: '',
          text: 'A line that is not the title\n',
        })
      )
    ).toBeFalsy();
  });

  it('should return false when an attachment is provided', () => {
    expect(
      isPlaceholderResource(
        createAttachment({
          uri: '',
        })
      )
    ).toBeFalsy();
  });
});
