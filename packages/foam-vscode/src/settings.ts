import { workspace, GlobPattern } from 'vscode';
import { LogLevel } from 'foam-core';

export enum LinkReferenceDefinitionsSetting {
  withExtensions = 'withExtensions',
  withoutExtensions = 'withoutExtensions',
  off = 'off',
}

export function getWikilinkDefinitionSetting(): LinkReferenceDefinitionsSetting {
  return workspace
    .getConfiguration('foam.edit')
    .get<LinkReferenceDefinitionsSetting>(
      'linkReferenceDefinitions',
      LinkReferenceDefinitionsSetting.withoutExtensions
    );
}

/** Retrieve the list of file ignoring globs. */
export function getIgnoredFilesSetting(): GlobPattern[] {
  return [
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
export function getOrphansConfig(): FilteredNotesConfig {
  const orphansConfig = workspace.getConfiguration('foam.orphans');
  const exclude: string[] = orphansConfig.get('exclude');
  const groupBy: FilteredNotesConfigGroupBy = orphansConfig.get('groupBy');
  return { exclude, groupBy };
}

/** Retrieve the blank notes configuration */
export function getBlankNotesConfig(): FilteredNotesConfig {
  const blankNoteConfig = workspace.getConfiguration('foam.blankNotes');
  const exclude: string[] = blankNoteConfig.get('exclude');
  const groupBy: FilteredNotesConfigGroupBy = blankNoteConfig.get('groupBy');
  return { exclude, groupBy };
}

export interface FilteredNotesConfig {
  exclude: string[];
  groupBy: FilteredNotesConfigGroupBy;
}

export enum FilteredNotesConfigGroupBy {
  Folder = 'folder',
  Off = 'off',
}
