import { retrieveNoteConfig } from './wikilink-embed';
import * as config from '../../services/config';

describe('Wikilink Note Embedding', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Config Parsing', () => {
    it('should use preview.embedNoteType if an explicit modifier is not passed in', () => {
      jest
        .spyOn(config, 'getFoamVsCodeConfig')
        .mockReturnValueOnce('full-card');

      const { noteScope, noteStyle } = retrieveNoteConfig(undefined);
      expect(noteScope).toEqual('full');
      expect(noteStyle).toEqual('card');
    });

    it('should use explicit modifier over user settings if passed in', () => {
      jest
        .spyOn(config, 'getFoamVsCodeConfig')
        .mockReturnValueOnce('full-inline')
        .mockReturnValueOnce('full-inline')
        .mockReturnValueOnce('full-inline');

      let { noteScope, noteStyle } = retrieveNoteConfig('content-card');
      expect(noteScope).toEqual('content');
      expect(noteStyle).toEqual('card');

      ({ noteScope, noteStyle } = retrieveNoteConfig('content'));
      expect(noteScope).toEqual('content');
      expect(noteStyle).toEqual('inline');

      ({ noteScope, noteStyle } = retrieveNoteConfig('card'));
      expect(noteScope).toEqual('full');
      expect(noteStyle).toEqual('card');
    });
  });
});
