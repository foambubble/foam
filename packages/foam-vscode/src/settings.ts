import { workspace, GlobPattern } from 'vscode';
import { uniq } from 'lodash';
import { getFoamVsCodeConfig } from './services/config';

/**
 * Gets the notes extensions and default extension from the config.
 *
 * @returns {notesExtensions: string[], defaultExtension: string}
 */
export function getNotesExtensions() {
  const notesExtensionsFromSetting = getFoamVsCodeConfig(
    'files.notesExtensions',
    ''
  )
    .split(' ')
    .filter(ext => ext.trim() !== '')
    .map(ext => '.' + ext.trim());
  const defaultExtension =
    '.' +
    (getFoamVsCodeConfig('files.defaultNoteExtension', 'md') ?? 'md').trim();

  // we make sure that the default extension is always included in the list of extensions
  const notesExtensions = uniq(
    notesExtensionsFromSetting.concat(defaultExtension)
  );

  return { notesExtensions, defaultExtension };
}

/**
 * Gets the attachment extensions from the config.
 *
 * @returns string[]
 */
export function getAttachmentsExtensions() {
  return getFoamVsCodeConfig('files.attachmentExtensions', '')
    .split(' ')
    .map(ext => '.' + ext.trim());
}

/** Retrieve the list of file ignoring globs. */
export function getIgnoredFilesSetting(): GlobPattern[] {
  return [
    '**/.foam/**',
    ...workspace.getConfiguration().get('foam.files.ignore', []),
    ...Object.keys(workspace.getConfiguration().get('files.exclude', {})),
  ];
}
