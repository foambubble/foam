import { FoamFeature } from '../types';
import * as commands from './commands';
import * as panels from './panels';
import dateSnippets from './date-snippets';
import hoverProvider from './hover-provider';
import preview from './preview';
import completionProvider from './link-completion';
import tagCompletionProvider from './tag-completion';
import linkDecorations from './document-decorator';
import navigationProviders from './navigation-provider';
import wikilinkDiagnostics from './wikilink-diagnostics';
import refactor from './refactor';
import workspaceSymbolProvider from './workspace-symbol-provider';

export const features: FoamFeature[] = [
  ...Object.values(commands),
  ...Object.values(panels),
  refactor,
  navigationProviders,
  wikilinkDiagnostics,
  dateSnippets,
  hoverProvider,
  linkDecorations,
  preview,
  completionProvider,
  tagCompletionProvider,
  workspaceSymbolProvider,
];
