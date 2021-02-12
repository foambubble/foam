import * as path from 'path';
import { generateHeading } from '../../src/janitor';
import { bootstrap } from '../../src/bootstrap';
import { createConfigFromFolders } from '../../src/config';
import { Services, Note } from '../../src';
import { URI } from '../../src/common/uri';
import { FileDataStore } from '../../src/services/datastore';
import { Logger } from '../../src/utils/log';
import { FoamWorkspace } from '../../src/model/workspace';
import { getBasename } from '../../src/utils';

Logger.setLevel('error');

describe('generateHeadings', () => {
  let _workspace: FoamWorkspace;
  const findBySlug = (slug: string): Note => {
    return _workspace.list().find(res => getBasename(res.uri) === slug) as Note;
  };

  beforeAll(async () => {
    const config = createConfigFromFolders([
      URI.file(path.join(__dirname, '..', '__scaffold__')),
    ]);
    const services: Services = {
      dataStore: new FileDataStore(config),
    };
    const foam = await bootstrap(config, services);
    _workspace = foam.workspace;
  });

  it.skip('should add heading to a file that does not have them', () => {
    const note = findBySlug('file-without-title');
    const expected = {
      newText: `# File without Title

`,
      range: {
        start: {
          line: 1,
          column: 1,
          offset: 0,
        },
        end: {
          line: 1,
          column: 1,
          offset: 0,
        },
      },
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
      range: {
        start: { line: 4, column: 1, offset: 60 },
        end: { line: 4, column: 1, offset: 60 },
      },
    };

    const actual = generateHeading(note);

    expect(actual!.range.start).toEqual(expected.range.start);
    expect(actual!.range.end).toEqual(expected.range.end);
    expect(actual!.newText).toEqual(expected.newText);
  });
});
