import { URI } from './model/uri';
import { GlobMatcher } from './services/glob-matcher';
import { foamConfigFromVsCodeSettings } from './vscode-settings';

describe('reading Foam settings from .vscode/settings.json', () => {
  it('returns the defaults when there are no settings', () => {
    const config = foamConfigFromVsCodeSettings({});

    expect(config.getTemplatesFolder()).toBe('.foam/templates');
    expect(config.getDailyNoteDirectory()).toBeNull();
    expect(config.getDailyNoteFilenameFormat()).toBe('isoDate');
    expect(config.getDailyNoteFileExtension()).toBe('md');
  });

  it('reads anything but an object as no settings', () => {
    for (const settings of [null, undefined, [], 'diary', 42]) {
      expect(foamConfigFromVsCodeSettings(settings).getTemplatesFolder()).toBe(
        '.foam/templates'
      );
    }
  });

  it('reads the daily-note directory and the templates folder', () => {
    const config = foamConfigFromVsCodeSettings({
      'foam.openDailyNote.directory': 'diary',
      'foam.templates.folder': 'templates',
    });

    expect(config.getDailyNoteDirectory()).toBe('diary');
    expect(config.getTemplatesFolder()).toBe('templates');
  });

  it('reads the daily-note filename format and extension', () => {
    const config = foamConfigFromVsCodeSettings({
      'foam.openDailyNote.filenameFormat': 'dd-mm-yyyy',
      'foam.openDailyNote.fileExtension': 'markdown',
    });

    expect(config.getDailyNoteFilenameFormat()).toBe('dd-mm-yyyy');
    expect(config.getDailyNoteFileExtension()).toBe('markdown');
  });

  it('excludes what is never workspace content, even when the workspace sets its own exclusions', () => {
    const root = URI.file('/workspace');
    const config = foamConfigFromVsCodeSettings({
      'foam.files.exclude': ['drafts/**'],
    });
    const matcher = new GlobMatcher([
      {
        uri: root,
        include: config.getFilesInclude(),
        exclude: config.getFilesExclude(),
      },
    ]);

    for (const path of [
      '.foam/trash/note.md',
      '.foam/templates/new-note.md',
      '.git/note.md',
      '.hg/note.md',
      '.svn/note.md',
      'notes/.DS_Store',
      'notes/Thumbs.db',
    ]) {
      expect(matcher.isMatch(root.joinPath(...path.split('/')))).toBe(false);
    }
    expect(matcher.isMatch(root.joinPath('drafts', 'note.md'))).toBe(false);
    expect(matcher.isMatch(root.joinPath('notes', 'note.md'))).toBe(true);
  });

  it('ignores values of the wrong type', () => {
    const config = foamConfigFromVsCodeSettings({
      'foam.openDailyNote.directory': 42,
    });

    expect(config.getDailyNoteDirectory()).toBeNull();
  });
});
