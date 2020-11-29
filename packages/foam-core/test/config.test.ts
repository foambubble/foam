import { createConfigFromFolders } from '../src/config';
import { Logger } from '../src/utils/log';
import { URI } from '../src/common/uri';

Logger.setLevel('error');

const testFolder = URI.joinPath(URI.file(__dirname), 'test-config');

describe('Foam configuration', () => {
  it('can read settings from config.json', () => {
    const config = createConfigFromFolders([
      URI.joinPath(testFolder, 'folder1'),
    ]);
    expect(config.get('feature1.setting1.value')).toBeTruthy();
    expect(config.get('feature2.value')).toEqual(12);

    const section = config.get<{ value: boolean }>('feature1.setting1');
    expect(section!.value).toBeTruthy();
  });

  it('can merge settings from multiple foam folders', () => {
    const config = createConfigFromFolders([
      URI.joinPath(testFolder, 'folder1'),
      URI.joinPath(testFolder, 'folder2'),
    ]);

    // override value
    expect(config.get('feature1.setting1.value')).toBe(false);
    // this was not overridden
    expect(config.get('feature1.setting1.extraValue')).toEqual('go foam');
    // new value from second config file
    expect(config.get('feature1.setting1.value2')).toBe('hello');

    // this whole section doesn't exist in second file
    expect(config.get('feature2.value')).toEqual(12);
  });

  it('cannot activate local plugins from workspace config', () => {
    const config = createConfigFromFolders([
      URI.joinPath(testFolder, 'enable-plugins'),
    ]);
    expect(config.get('experimental.localPlugins.enabled')).toBeUndefined();
  });
});
