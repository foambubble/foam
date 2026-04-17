import { FoamFeature } from '../types';
import * as commands from './commands';
import * as panels from './panels';
import dateSnippets from './daily-notes/index';
import hoverProvider from './hover-provider';
import preview from './preview';
import completionProvider from './link-completion';
import tagCompletionProvider from './tag-completion';
import linkDecorations from './document-decorator';
import navigationProviders from './navigation-provider';
import wikilinkDiagnostics from '../janitor/vscode/wikilink-diagnostics';
import refactor from '../vscode/features/refactor';
import convertLinks from '../vscode/features/convert-links';
import workspaceSymbolProvider from './workspace-symbol-provider';
import tagRenameProvider from './tag-rename-provider';
import headingRenameProvider from './heading-rename-provider';
import blockRenameProvider from './block-rename-provider';

export const features: FoamFeature[] = [
  ...Object.values(commands),
  ...Object.values(panels),
  refactor,
  convertLinks,
  navigationProviders,
  wikilinkDiagnostics,
  dateSnippets,
  hoverProvider,
  linkDecorations,
  preview,
  completionProvider,
  tagCompletionProvider,
  workspaceSymbolProvider,
  tagRenameProvider,
  headingRenameProvider,
  blockRenameProvider,
];
