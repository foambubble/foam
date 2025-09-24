import {
  WIKILINK_EMBED_REGEX,
  WIKILINK_EMBED_REGEX_GROUPS,
  retrieveNoteConfig,
  parseImageParameters,
  generateImageStyles,
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

  describe('Image Parameter Parsing', () => {
    it('should parse wikilinks with image sizing parameters', () => {
      // Width only
      const match1 = '![[image.png|300]]'.match(WIKILINK_EMBED_REGEX_GROUPS);
      expect(match1[0]).toEqual('![[image.png|300]]');
      expect(match1[1]).toEqual(undefined); // no modifier
      expect(match1[2]).toEqual('image.png');
      expect(match1[3]).toEqual('|300');

      // Width and height
      const match2 = '![[image.png|300x200]]'.match(
        WIKILINK_EMBED_REGEX_GROUPS
      );
      expect(match2[0]).toEqual('![[image.png|300x200]]');
      expect(match2[1]).toEqual(undefined);
      expect(match2[2]).toEqual('image.png');
      expect(match2[3]).toEqual('|300x200');

      // Percentage width
      const match3 = '![[image.png|50%]]'.match(WIKILINK_EMBED_REGEX_GROUPS);
      expect(match3[0]).toEqual('![[image.png|50%]]');
      expect(match3[1]).toEqual(undefined);
      expect(match3[2]).toEqual('image.png');
      expect(match3[3]).toEqual('|50%');
    });

    it('should parse wikilinks with modifiers and image parameters', () => {
      const match = 'content![[image.png|300]]'.match(
        WIKILINK_EMBED_REGEX_GROUPS
      );
      expect(match[0]).toEqual('content![[image.png|300]]');
      expect(match[1]).toEqual('content');
      expect(match[2]).toEqual('image.png');
      expect(match[3]).toEqual('|300');
    });

    it('should parse wikilinks with multiple parameters', () => {
      const match = '![[image.png|300|center]]'.match(
        WIKILINK_EMBED_REGEX_GROUPS
      );
      expect(match[0]).toEqual('![[image.png|300|center]]');
      expect(match[1]).toEqual(undefined);
      expect(match[2]).toEqual('image.png');
      expect(match[3]).toEqual('|300|center');
    });

    it('should handle wikilinks without parameters (backward compatibility)', () => {
      const match = '![[image.png]]'.match(WIKILINK_EMBED_REGEX_GROUPS);
      expect(match[0]).toEqual('![[image.png]]');
      expect(match[1]).toEqual(undefined);
      expect(match[2]).toEqual('image.png');
      expect(match[3]).toEqual(undefined);
    });

    it('should parse complex filenames with parameters', () => {
      const match = '![[folder/image-file.png|400px]]'.match(
        WIKILINK_EMBED_REGEX_GROUPS
      );
      expect(match[0]).toEqual('![[folder/image-file.png|400px]]');
      expect(match[1]).toEqual(undefined);
      expect(match[2]).toEqual('folder/image-file.png');
      expect(match[3]).toEqual('|400px');
    });
  });

  describe('parseImageParameters Function', () => {
    it('should parse width-only parameters', () => {
      const result = parseImageParameters('image.png', '|300');
      expect(result).toEqual({
        filename: 'image.png',
        width: '300',
      });
    });

    it('should parse width x height parameters', () => {
      const result = parseImageParameters('image.png', '|300x200');
      expect(result).toEqual({
        filename: 'image.png',
        width: '300',
        height: '200',
      });
    });

    it('should parse percentage widths', () => {
      const result = parseImageParameters('image.png', '|50%');
      expect(result).toEqual({
        filename: 'image.png',
        width: '50%',
      });
    });

    it('should parse width with units', () => {
      const result = parseImageParameters('image.png', '|400px');
      expect(result).toEqual({
        filename: 'image.png',
        width: '400px',
      });
    });

    it('should parse width and alignment', () => {
      const result = parseImageParameters('image.png', '|300|center');
      expect(result).toEqual({
        filename: 'image.png',
        width: '300',
        align: 'center',
      });
    });

    it('should parse width, alignment, and alt text', () => {
      const result = parseImageParameters(
        'image.png',
        '|300|left|My image description'
      );
      expect(result).toEqual({
        filename: 'image.png',
        width: '300',
        align: 'left',
        alt: 'My image description',
      });
    });

    it('should parse width and alt text (no alignment)', () => {
      const result = parseImageParameters(
        'image.png',
        '|300|My image description'
      );
      expect(result).toEqual({
        filename: 'image.png',
        width: '300',
        alt: 'My image description',
      });
    });

    it('should handle no parameters', () => {
      const result = parseImageParameters('image.png');
      expect(result).toEqual({
        filename: 'image.png',
      });
    });

    it('should handle empty parameters string', () => {
      const result = parseImageParameters('image.png', '');
      expect(result).toEqual({
        filename: 'image.png',
      });
    });

    it('should handle malformed parameters gracefully', () => {
      const result = parseImageParameters('image.png', '|');
      expect(result).toEqual({
        filename: 'image.png',
      });
    });

    it('should parse complex width x height with units', () => {
      const result = parseImageParameters('image.png', '|400px x 300px');
      expect(result).toEqual({
        filename: 'image.png',
        width: '400px',
        height: '300px',
      });
    });

    it('should handle right alignment', () => {
      const result = parseImageParameters('image.png', '|300|right');
      expect(result).toEqual({
        filename: 'image.png',
        width: '300',
        align: 'right',
      });
    });

    it('should handle alt text with pipes', () => {
      const result = parseImageParameters(
        'image.png',
        '|300|center|Alt text with | pipes'
      );
      expect(result).toEqual({
        filename: 'image.png',
        width: '300',
        align: 'center',
        alt: 'Alt text with | pipes',
      });
    });
  });

  describe('generateImageStyles Function', () => {
    const mockMd = {
      normalizeLink: (path: string) => path,
    } as any;

    it('should generate basic image HTML without parameters', () => {
      const params = { filename: 'image.png' };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual('<img src="image.png" alt="">');
    });

    it('should generate image with width only', () => {
      const params = { filename: 'image.png', width: '300' };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual(
        '<img src="image.png" style="width: 300px; height: auto" alt="">'
      );
    });

    it('should generate image with width and height', () => {
      const params = { filename: 'image.png', width: '300', height: '200' };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual(
        '<img src="image.png" style="width: 300px; height: 200px" alt="">'
      );
    });

    it('should generate image with percentage width', () => {
      const params = { filename: 'image.png', width: '50%' };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual(
        '<img src="image.png" style="width: 50%; height: auto" alt="">'
      );
    });

    it('should generate image with width and units preserved', () => {
      const params = { filename: 'image.png', width: '400px' };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual(
        '<img src="image.png" style="width: 400px; height: auto" alt="">'
      );
    });

    it('should generate image with center alignment', () => {
      const params = {
        filename: 'image.png',
        width: '300',
        align: 'center' as const,
      };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual(
        '<div style="text-align: center;"><img src="image.png" style="width: 300px; height: auto" alt=""></div>'
      );
    });

    it('should generate image with left alignment', () => {
      const params = {
        filename: 'image.png',
        width: '300',
        align: 'left' as const,
      };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual(
        '<div style="text-align: left;"><img src="image.png" style="width: 300px; height: auto" alt=""></div>'
      );
    });

    it('should generate image with right alignment', () => {
      const params = {
        filename: 'image.png',
        width: '300',
        align: 'right' as const,
      };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual(
        '<div style="text-align: right;"><img src="image.png" style="width: 300px; height: auto" alt=""></div>'
      );
    });

    it('should generate image with alt text', () => {
      const params = {
        filename: 'image.png',
        width: '300',
        alt: 'My image description',
      };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual(
        '<img src="image.png" style="width: 300px; height: auto" alt="My image description">'
      );
    });

    it('should escape HTML in alt text', () => {
      const params = {
        filename: 'image.png',
        alt: 'Image with <script>alert("xss")</script>',
      };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual(
        '<img src="image.png" alt="Image with &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;">'
      );
    });

    it('should generate image with width, alignment, and alt text', () => {
      const params = {
        filename: 'image.png',
        width: '300',
        align: 'center' as const,
        alt: 'Centered image',
      };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual(
        '<div style="text-align: center;"><img src="image.png" style="width: 300px; height: auto" alt="Centered image"></div>'
      );
    });

    it('should handle em units', () => {
      const params = { filename: 'image.png', width: '20em' };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual(
        '<img src="image.png" style="width: 20em; height: auto" alt="">'
      );
    });

    it('should handle decimal values', () => {
      const params = { filename: 'image.png', width: '300.5' };
      const result = generateImageStyles(params, mockMd);
      expect(result).toEqual(
        '<img src="image.png" style="width: 300.5px; height: auto" alt="">'
      );
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
