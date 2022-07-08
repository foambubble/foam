import createReferencesCommand from './commands/wikilink-reference-generation';
import openDailyNoteCommand from './commands/open-daily-note';
import janitorCommand from './commands/janitor';
import copyWithoutBracketsCommand from './commands/copy-without-brackets';
import createFromTemplateCommand from './commands/create-from-template';
import openRandomNoteCommand from './commands/open-random-note';
import utilityCommands from './commands/utility-commands';
import updateGraphCommand from './commands/update-graph';
import dataviz from './dataviz';
import openDatedNote from './open-dated-note';
import tagsExplorer from './tags-tree-view';
import orphans from './orphans';
import placeholders from './placeholders';
import backlinks from './backlinks';
import hoverProvider from './hover-provider';
import previewNavigation from './preview-navigation';
import completionProvider, { completionCursorMove } from './link-completion';
import tagCompletionProvider from './tag-completion';
import linkDecorations from './document-decorator';
import navigationProviders from './navigation-provider';
import wikilinkDiagnostics from './wikilink-diagnostics';
import refactor from './refactor';
import { FoamFeature } from '../types';

export const features: FoamFeature[] = [
  refactor,
  updateGraphCommand,
  navigationProviders,
  wikilinkDiagnostics,
  tagsExplorer,
  createReferencesCommand,
  openDailyNoteCommand,
  openRandomNoteCommand,
  janitorCommand,
  dataviz,
  copyWithoutBracketsCommand,
  openDatedNote,
  createFromTemplateCommand,
  orphans,
  placeholders,
  backlinks,
  hoverProvider,
  utilityCommands,
  linkDecorations,
  previewNavigation,
  completionProvider,
  tagCompletionProvider,
  completionCursorMove,
];
