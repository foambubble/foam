import {
  WIKILINK_EMBED_REGEX,
  WIKILINK_EMBED_REGEX_GROUPS,
  retrieveNoteConfig,
} from './wikilink-embed';
import * as config from '../../services/config';

describe('Wikilink Note Embedding', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Wikilink Parsing', () => {
    it('should match a wikilink item including a modifier and wikilink', () => {
      // no configuration
      expect('![[note-a]]').toMatch(WIKILINK_EMBED_REGEX);

      // one of the configurations
      expect('full![[note-a]]').toMatch(WIKILINK_EMBED_REGEX);
      expect('content![[note-a]]').toMatch(WIKILINK_EMBED_REGEX);
      expect('inline![[note-a]]').toMatch(WIKILINK_EMBED_REGEX);
      expect('card![[note-a]]').toMatch(WIKILINK_EMBED_REGEX);

      // any combination of configurations
      expect('full-inline![[note-a]]').toMatch(WIKILINK_EMBED_REGEX);
      expect('full-card![[note-a]]').toMatch(WIKILINK_EMBED_REGEX);
      expect('content-inline![[note-a]]').toMatch(WIKILINK_EMBED_REGEX);
      expect('content-card![[note-a]]').toMatch(WIKILINK_EMBED_REGEX);
    });

    it('should only match the wikilink if there are unrecognized keywords', () => {
      const match1 = 'random-word![[note-a]]'.match(WIKILINK_EMBED_REGEX);
      expect(match1[0]).toEqual('![[note-a]]');
      expect(match1[1]).toEqual('![[note-a]]');

      const match2 = 'foo![[note-a#section 1]]'.match(WIKILINK_EMBED_REGEX);
      expect(match2[0]).toEqual('![[note-a#section 1]]');
      expect(match2[1]).toEqual('![[note-a#section 1]]');
    });

    it('should group the wikilink into modifier and wikilink', () => {
      const match1 = 'content![[note-a]]'.match(WIKILINK_EMBED_REGEX_GROUPS);
      expect(match1[0]).toEqual('content![[note-a]]');
      expect(match1[1]).toEqual('content');
      expect(match1[2]).toEqual('note-a');

      const match2 = 'full-inline![[note-a#section 1]]'.match(
        WIKILINK_EMBED_REGEX_GROUPS
      );
      expect(match2[0]).toEqual('full-inline![[note-a#section 1]]');
      expect(match2[1]).toEqual('full-inline');
      expect(match2[2]).toEqual('note-a#section 1');

      const match3 = '![[note-a#section 1]]'.match(WIKILINK_EMBED_REGEX_GROUPS);
      expect(match3[0]).toEqual('![[note-a#section 1]]');
      expect(match3[1]).toEqual(undefined);
      expect(match3[2]).toEqual('note-a#section 1');
    });
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
