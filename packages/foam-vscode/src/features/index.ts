import { FoamFeature } from '../types';
import * as commands from './commands';
import * as panels from './panels';
import dateSnippets from '../vscode/features/daily-notes/index';
import hoverProvider from '../vscode/features/navigation/hover-provider';
import preview from './preview';
import completionProvider from '../vscode/features/navigation/link-completion';
import tagCompletionProvider from '../vscode/features/tags/tag-completion';
import linkDecorations from '../vscode/features/editing/document-decorator';
import navigationProviders from '../vscode/features/navigation/navigation-provider';
import wikilinkDiagnostics from '../janitor/vscode/wikilink-diagnostics';
import refactor from '../vscode/features/editing/refactor';
import convertLinks from '../vscode/features/editing/convert-links';
import workspaceSymbolProvider from '../vscode/features/navigation/workspace-symbol-provider';
import tagRenameProvider from '../vscode/features/tags/tag-rename-provider';
import headingRenameProvider from '../vscode/features/editing/heading-rename-provider';
import blockRenameProvider from '../vscode/features/editing/block-rename-provider';

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
