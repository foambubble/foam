import * as vscode from 'vscode';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { createFile, deleteFile } from '../../../test/test-utils-vscode';

/** A token from `_workbench.captureSyntaxTokens`: its text and space-separated scopes. */
interface SyntaxToken {
  c: string;
  t: string;
}

/**
 * Tokenizes markdown with the grammars VS Code has loaded, Foam's injection
 * included. `_workbench.captureSyntaxTokens` is the internal command VS
 * Code's own colorization tests use.
 */
const captureSyntaxTokens = async (content: string) => {
  const file = await createFile(content);
  try {
    return await vscode.commands.executeCommand<SyntaxToken[]>(
      '_workbench.captureSyntaxTokens',
      toVsCodeUri(file.uri)
    );
  } finally {
    await deleteFile(file);
  }
};

const scopesOf = (tokens: SyntaxToken[], text: string) =>
  tokens.find(token => token.c.includes(text))?.t;

describe('Wikilink syntax highlighting', () => {
  it.each([
    ['a numbered list item', '1. [[note]] *italic*'],
    ['a bullet list item', '- [[note]] *italic*'],
    ['a list item continuation line', '- first line\n  [[note]] *italic*'],
  ])(
    'highlights a wikilink at the start of %s and the emphasis after it (#1631)',
    async (_, source) => {
      const tokens = await captureSyntaxTokens(source);
      expect(scopesOf(tokens, 'note')).toContain(
        'meta.link.wikilink.markdown.foam'
      );
      expect(scopesOf(tokens, 'italic')).toContain('markup.italic.markdown');
    }
  );

  it('highlights emphasis after a footnote reference at the start of a list item (#1631)', async () => {
    const tokens = await captureSyntaxTokens('- [^1] *italic*');
    expect(scopesOf(tokens, 'italic')).toContain('markup.italic.markdown');
  });
});
