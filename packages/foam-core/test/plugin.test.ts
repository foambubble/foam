import path from 'path';
import { loadPlugins } from '../src/plugins';
import { NoteGraph } from '../src/note-graph';
import { createTestNote } from './core.test';

describe('Foam plugins', () => {
  it('can load', async () => {
    const plugins = await loadPlugins([path.join(__dirname, 'test-plugin')]);
    expect(plugins.length).toEqual(1);
    expect(plugins[0].name).toEqual('Test Plugin');
  });
});
