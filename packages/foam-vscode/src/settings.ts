import { workspace, GlobPattern } from 'vscode';
import { uniq } from 'lodash';
import { LogLevel } from './core/utils/log';
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

export function getWikilinkDefinitionSetting():
  | 'withExtensions'
  | 'withoutExtensions'
  | 'off' {
  return workspace
    .getConfiguration('foam.edit')
    .get('linkReferenceDefinitions', 'withoutExtensions');
}

/** Retrieve the list of file ignoring globs. */
export function getIgnoredFilesSetting(): GlobPattern[] {
  return [
    '**/.foam/**',
    ...workspace.getConfiguration().get('foam.files.ignore', []),
    ...Object.keys(workspace.getConfiguration().get('files.exclude', {})),
  ];
}

/** Retrieves the maximum length for a Graph node title. */
export function getTitleMaxLength(): number {
  return workspace.getConfiguration('foam.graph').get('titleMaxLength');
}

/** Retrieve the graph's style object */
export function getGraphStyle(): object {
  return workspace.getConfiguration('foam.graph').get('style');
}

export function getFoamLoggerLevel(): LogLevel {
  return workspace.getConfiguration('foam.logging').get('level') ?? 'info';
}

/** Retrieve the orphans configuration */
export function getOrphansConfig(): GroupedResourcesConfig {
  const orphansConfig = workspace.getConfiguration('foam.orphans');
  const exclude: string[] = orphansConfig.get('exclude');
  return { exclude };
}

/** Retrieve the placeholders configuration */
export function getPlaceholdersConfig(): GroupedResourcesConfig {
  const placeholderCfg = workspace.getConfiguration('foam.placeholders');
  const exclude: string[] = placeholderCfg.get('exclude');
  return { exclude };
}

export interface GroupedResourcesConfig {
  exclude: string[];
}
