import { foamConfigFromVsCodeSettings } from './vscode-settings';

describe('reading Foam settings from .vscode/settings.json', () => {
  it('returns the defaults when there is no settings file', () => {
    const config = foamConfigFromVsCodeSettings(null);

    expect(config.getTemplatesFolder()).toBe('.foam/templates');
    expect(config.getDailyNoteDirectory()).toBeNull();
    expect(config.getDailyNoteFilenameFormat()).toBe('isoDate');
    expect(config.getDailyNoteFileExtension()).toBe('md');
  });

  it('reads JSONC, with comments and trailing commas', () => {
    const config = foamConfigFromVsCodeSettings(`{
      // where daily notes go
      "foam.openDailyNote.directory": "diary",
      "foam.templates.folder": "templates", /* moved */
    }`);

    expect(config.getDailyNoteDirectory()).toBe('diary');
    expect(config.getTemplatesFolder()).toBe('templates');
  });

  it('reads the daily-note filename format and extension', () => {
    const config = foamConfigFromVsCodeSettings(`{
      "foam.openDailyNote.filenameFormat": "dd-mm-yyyy",
      "foam.openDailyNote.fileExtension": "markdown"
    }`);

    expect(config.getDailyNoteFilenameFormat()).toBe('dd-mm-yyyy');
    expect(config.getDailyNoteFileExtension()).toBe('markdown');
  });

  it('falls back to the defaults for a malformed file', () => {
    const config = foamConfigFromVsCodeSettings('{ "foam.templates.folder": ');

    expect(config.getTemplatesFolder()).toBe('.foam/templates');
  });

  it('ignores values of the wrong type', () => {
    const config = foamConfigFromVsCodeSettings(
      '{ "foam.openDailyNote.directory": 42 }'
    );

    expect(config.getDailyNoteDirectory()).toBeNull();
  });
});
