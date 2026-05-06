import {
  getDailyNoteTemplateCandidateUris,
  getNewNoteTemplateCandidateUris,
  getTemplatesDir,
} from './template-discovery';
import { URI } from '../model/uri';
import { Config, DefaultFoamConfig, IFoamConfig } from '../config';

/**
 * Override the configured templates folder for the duration of `fn`,
 * restoring the default config afterwards. This guards other tests in the
 * suite from picking up our overridden config (Config is global state).
 */
function withTemplatesFolder<T>(folder: string, fn: () => T): T {
  const stub: IFoamConfig = Object.assign(new DefaultFoamConfig(), {
    getTemplatesFolder() {
      return folder;
    },
  });
  Config.setDefaultConfig(stub);
  try {
    return fn();
  } finally {
    Config.setDefaultConfig(new DefaultFoamConfig());
  }
}

describe('getTemplatesDir', () => {
  it('defaults to .foam/templates under the workspace root', () => {
    Config.setDefaultConfig(new DefaultFoamConfig());
    const root = URI.file('/workspace');
    const templates = getTemplatesDir(root);
    expect(templates.path).toBe('/workspace/.foam/templates');
  });

  it('honors a custom foam.templates.folder', () => {
    withTemplatesFolder('custom/templates', () => {
      const templates = getTemplatesDir(URI.file('/workspace'));
      expect(templates.path).toBe('/workspace/custom/templates');
    });
  });

  it('handles a single-segment custom folder', () => {
    withTemplatesFolder('templates', () => {
      const templates = getTemplatesDir(URI.file('/workspace'));
      expect(templates.path).toBe('/workspace/templates');
    });
  });

  it('handles a deeply nested custom folder', () => {
    withTemplatesFolder('a/b/c/templates', () => {
      const templates = getTemplatesDir(URI.file('/workspace'));
      expect(templates.path).toBe('/workspace/a/b/c/templates');
    });
  });
});

describe('getDailyNoteTemplateCandidateUris', () => {
  it('returns daily-note.js and daily-note.md under the templates dir', () => {
    const dir = URI.file('/workspace/.foam/templates');
    const candidates = getDailyNoteTemplateCandidateUris(dir);
    expect(candidates.map(c => c.path)).toEqual([
      '/workspace/.foam/templates/daily-note.js',
      '/workspace/.foam/templates/daily-note.md',
    ]);
  });

  it('follows a custom templates folder when used together with getTemplatesDir', () => {
    withTemplatesFolder('custom-tpl', () => {
      const dir = getTemplatesDir(URI.file('/workspace'));
      const candidates = getDailyNoteTemplateCandidateUris(dir);
      expect(candidates.map(c => c.path)).toEqual([
        '/workspace/custom-tpl/daily-note.js',
        '/workspace/custom-tpl/daily-note.md',
      ]);
    });
  });
});

describe('getNewNoteTemplateCandidateUris', () => {
  it('returns new-note.js and new-note.md under the templates dir', () => {
    const dir = URI.file('/workspace/.foam/templates');
    const candidates = getNewNoteTemplateCandidateUris(dir);
    expect(candidates.map(c => c.path)).toEqual([
      '/workspace/.foam/templates/new-note.js',
      '/workspace/.foam/templates/new-note.md',
    ]);
  });
});
