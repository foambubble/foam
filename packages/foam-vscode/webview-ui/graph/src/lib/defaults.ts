import type { ResolvedStyle } from './types';

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getDefaultStyle(): ResolvedStyle {
  return {
    background: getCSSVar('--vscode-panel-background') || '#202020',
    fontSize: parseInt(getCSSVar('--vscode-font-size') || '12') - 2,
    fontFamily: 'Sans-Serif',
    lineColor: getCSSVar('--vscode-editor-foreground') || '#277da1',
    lineWidth: 0.2,
    particleWidth: 1.0,
    highlightedForeground:
      getCSSVar('--vscode-list-highlightForeground') || '#f9c74f',
    node: {
      note: getCSSVar('--vscode-editor-foreground') || '#277da1',
      placeholder:
        getCSSVar('--vscode-list-deemphasizedForeground') || '#545454',
      tag: getCSSVar('--vscode-list-highlightForeground') || '#f9c74f',
    },
    colorMode: 'none',
  };
}
