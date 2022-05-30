import createReferences from './wikilink-reference-generation';
import openDailyNote from './open-daily-note';
import janitor from './janitor';
import dataviz from './dataviz';
import copyWithoutBrackets from './copy-without-brackets';
import openDatedNote from './open-dated-note';
import tagsExplorer from './tags-tree-view';
import createFromTemplate from './create-from-template';
import openRandomNote from './open-random-note';
import orphans from './orphans';
import placeholders from './placeholders';
import backlinks from './backlinks';
import utilityCommands from './utility-commands';
import hoverProvider from './hover-provider';
import previewNavigation from './preview-navigation';
import completionProvider, { completionCursorMove } from './link-completion';
import tagCompletionProvider from './tag-completion';
import linkDecorations from './document-decorator';
import navigationProviders from './navigation-provider';
import wikilinkDiagnostics from './wikilink-diagnostics';
// import completionMoveCursor from './completion-cursor-move';
import refactor from './refactor';
import { FoamFeature } from '../types';

export const features: FoamFeature[] = [
  refactor,
  navigationProviders,
  wikilinkDiagnostics,
  tagsExplorer,
  createReferences,
  openDailyNote,
  openRandomNote,
  janitor,
  dataviz,
  copyWithoutBrackets,
  openDatedNote,
  createFromTemplate,
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
