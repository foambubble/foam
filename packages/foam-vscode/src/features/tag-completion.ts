import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { FoamTags } from '../core/model/tags';
import { isInFrontMatter, isOnYAMLKeywordLine } from '../core/utils/md';
import { mdDocSelector } from '../services/editor';

// this regex is different from HASHTAG_REGEX in that it does not look for a
// #+character. It uses a negative look-ahead for `# `
const HASH_REGEX =
  /(?<=^|\s)#(?![ \t#])([0-9]*[\p{L}\p{Emoji_Presentation}\p{N}/_-]*)/dgu;
const MAX_LINES_FOR_FRONT_MATTER = 50;

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      mdDocSelector,
      new TagCompletionProvider(foam.tags),
      '#'
    )
  );
}

export class TagCompletionProvider
  implements vscode.CompletionItemProvider<vscode.CompletionItem>
{
  constructor(private foamTags: FoamTags) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionList<vscode.CompletionItem>> {
    const cursorPrefix = document
      .lineAt(position)
      .text.substr(0, position.character);

    const beginningOfFileText = document.getText(
      new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(
          position.line < MAX_LINES_FOR_FRONT_MATTER
            ? position.line
            : MAX_LINES_FOR_FRONT_MATTER,
          position.character
        )
      )
    );

    const isHashMatch = cursorPrefix.match(HASH_REGEX) !== null;
    const inFrontMatter = isInFrontMatter(beginningOfFileText, position.line);

    if (!isHashMatch && !inFrontMatter) {
      return null;
    }

    return inFrontMatter
      ? this.createTagsForFrontMatter(beginningOfFileText, position)
      : this.createTagsForContent(cursorPrefix, position);
  }

  private createTagsForFrontMatter(
    content: string,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionList<vscode.CompletionItem>> {
    const FRONT_MATTER_PREVIOUS_CHARACTER = /[#[\s\w]/g;

    const lines = content.split('\n');
    if (position.line >= lines.length) {
      return null;
    }

    const cursorPrefix = lines[position.line].substring(0, position.character);

    const isTagsMatch =
      isOnYAMLKeywordLine(content, 'tags') &&
      cursorPrefix
        .charAt(position.character - 1)
        .match(FRONT_MATTER_PREVIOUS_CHARACTER);

    if (!isTagsMatch) {
      return null;
    }

    const [lastMatchStartIndex, lastMatchEndIndex] = this.tagMatchIndices(
      cursorPrefix,
      HASH_REGEX
    );

    const isHashMatch = cursorPrefix.match(HASH_REGEX) !== null;
    if (isHashMatch && lastMatchEndIndex !== position.character) {
      return null;
    }

    const completionTags = this.createCompletionTagItems();
    // We are in the front matter and we typed #, remove the `#`
    if (isHashMatch) {
      completionTags.forEach(item => {
        item.additionalTextEdits = [
          vscode.TextEdit.delete(
            new vscode.Range(
              position.line,
              lastMatchStartIndex,
              position.line,
              lastMatchStartIndex + 1
            )
          ),
        ];
      });
    }

    return new vscode.CompletionList(completionTags);
  }

  private createTagsForContent(
    content: string,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionList<vscode.CompletionItem>> {
    const [, lastMatchEndIndex] = this.tagMatchIndices(content, HASH_REGEX);
    if (lastMatchEndIndex !== position.character) {
      return null;
    }

    return new vscode.CompletionList(this.createCompletionTagItems());
  }

  private createCompletionTagItems(): vscode.CompletionItem[] {
    const completionTags = [];
    [...this.foamTags.tags].forEach(([tag]) => {
      const item = new vscode.CompletionItem(
        tag,
        vscode.CompletionItemKind.Text
      );

      item.insertText = `${tag}`;
      item.documentation = tag;

      completionTags.push(item);
    });
    return completionTags;
  }

  private tagMatchIndices(content: string, match: RegExp): number[] {
    // check the match group length.
    // find the last match group, and ensure the end of that group is
    // at the cursor position.
    // This excludes both `#%` and also `here is #my-app1 and now # ` with
    // trailing space
    const matches = Array.from(content.matchAll(match));
    if (matches.length === 0) {
      return [-1, -1];
    }

    const lastMatch = matches[matches.length - 1];
    const lastMatchStartIndex = lastMatch.index;
    const lastMatchEndIndex = lastMatch[0].length + lastMatchStartIndex;

    return [lastMatchStartIndex, lastMatchEndIndex];
  }
}
