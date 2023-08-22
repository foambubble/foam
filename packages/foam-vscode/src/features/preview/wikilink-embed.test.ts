import { retrieveNoteConfig } from './wikilink-embed';
import * as config from '../../services/config';

describe('Wikilink Note Embedding', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Config Parsing', () => {
    it('should use preview.embedNoteType if deprecated preview.embedNoteInContainer not used', () => {
      jest
        .spyOn(config, 'getFoamVsCodeConfig')
        .mockReturnValueOnce('full-card')
        .mockReturnValueOnce(false);

      const { noteScope, noteStyle } = retrieveNoteConfig();
      expect(noteScope).toEqual('full');
      expect(noteStyle).toEqual('card');
    });

    it('should use preview.embedNoteInContainer if set', () => {
      jest
        .spyOn(config, 'getFoamVsCodeConfig')
        .mockReturnValueOnce('full-inline')
        .mockReturnValueOnce(true);

      const { noteScope, noteStyle } = retrieveNoteConfig();
      expect(noteScope).toEqual('full');
      expect(noteStyle).toEqual('card');
    });
  });
});
