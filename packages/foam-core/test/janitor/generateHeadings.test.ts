import * as path from 'path';
import { generateHeading } from '../../src/janitor';
import { bootstrap } from '../../src/bootstrap';
import { createConfigFromFolders } from '../../src/config';
import { Note } from '../../src';
import { FileDataStore } from '../../src/services/datastore';
import { Logger } from '../../src/utils/log';
import { FoamWorkspace } from '../../src/model/workspace';
import { URI } from '../../src/model/uri';
import * as ranges from '../../src/model/range';

Logger.setLevel('error');

describe('generateHeadings', () => {
  let _workspace: FoamWorkspace;
  const findBySlug = (slug: string): Note => {
    return _workspace
      .list()
      .find(res => URI.getBasename(res.uri) === slug) as Note;
  };

  beforeAll(async () => {
    const config = createConfigFromFolders([
      URI.file(path.join(__dirname, '..', '__scaffold__')),
    ]);
    const foam = await bootstrap(config, new FileDataStore(config));
    _workspace = foam.workspace;
  });

  it.skip('should add heading to a file that does not have them', () => {
    const note = findBySlug('file-without-title');
    const expected = {
      newText: `# File without Title

`,
      range: ranges.create(0, 0, 0, 0),
    };

    const actual = generateHeading(note);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });

  it('should not cause any changes to a file that has a heading', () => {
    const note = findBySlug('index');
    expect(generateHeading(note)).toBeNull();
  });

  it.skip('should generate heading when the file only contains frontmatter', () => {
    const note = findBySlug('file-with-only-frontmatter');

    const expected = {
      newText: '\n# File with only Frontmatter\n\n',
      range: ranges.create(3, 0, 3, 0),
    };

    const actual = generateHeading(note);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });
});
