import * as commands from './commands';
import dataviz from './dataviz';
import dateSnippets from './date-snippets';
import tagsExplorer from './tags-tree-view';
import orphans from './orphans';
import placeholders from './placeholders';
import backlinks from './backlinks';
import hoverProvider from './hover-provider';
import previewNavigation from './preview';
import completionProvider, { completionCursorMove } from './link-completion';
import tagCompletionProvider from './tag-completion';
import linkDecorations from './document-decorator';
import navigationProviders from './navigation-provider';
import wikilinkDiagnostics from './wikilink-diagnostics';
import refactor from './refactor';
import { FoamFeature } from '../types';

export const features: FoamFeature[] = [
  ...Object.values(commands),
  refactor,
  navigationProviders,
  wikilinkDiagnostics,
  tagsExplorer,
  dataviz,
  dateSnippets,
  orphans,
  placeholders,
  backlinks,
  hoverProvider,
  linkDecorations,
  previewNavigation,
  completionProvider,
  tagCompletionProvider,
  completionCursorMove,
];
