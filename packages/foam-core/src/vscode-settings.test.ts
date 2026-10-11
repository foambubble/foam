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

  it('ignores values of the wrong type', () => {
    const config = foamConfigFromVsCodeSettings({
      'foam.openDailyNote.directory': 42,
    });

    expect(config.getDailyNoteDirectory()).toBeNull();
  });
});
