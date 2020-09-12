import path from 'path';
import { loadPlugins } from '../src/plugins';

describe('Foam plugins', () => {
  it('can load', async () => {
    const plugins = await loadPlugins([path.join(__dirname, 'test-plugin')]);
    expect(plugins.length).toEqual(1);
    expect(plugins[0].name).toEqual('Test Plugin');
  });
});
