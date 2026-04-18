import { window, env, ExtensionContext, commands } from 'vscode';

export default async function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(
      'foam-vscode.copy-without-brackets',
      copyWithoutBrackets
    )
  );
}

async function copyWithoutBrackets() {
  // Get the active text editor
  const editor = window.activeTextEditor;

  if (editor) {
    const document = editor.document;
    const selection = editor.selection;

    // Get the words within the selection
    const text = document.getText(selection);

    // Remove brackets from text
    const modifiedText = removeBrackets(text);

    // Copy to the clipboard
    await env.clipboard.writeText(modifiedText);

    // Alert the user it was successful
    window.showInformationMessage('Successfully copied to clipboard!');
  }
}

/**
 * Used for the "Copy to Clipboard Without Brackets" command
 *
 */
export function removeBrackets(s: string): string {
  // take in the string, split on space
  const stringSplitBySpace = s.split(' ');

  // loop through words
  const modifiedWords = stringSplitBySpace.map(currentWord => {
    if (currentWord.includes('[[')) {
      // all of these transformations will turn this "[[you-are-awesome]]"
      // to this "you are awesome"
      let word = currentWord.replace(/(\[\[)/g, '');
      word = word.replace(/(\]\])/g, '');
      word = word.replace(/(.mdx|.md|.markdown)/g, '');
      word = word.replace(/[-]/g, ' ');

      // then we titlecase the word so "you are awesome"
      // becomes "You Are Awesome"
      const titleCasedWord = toTitleCase(word);

      return titleCasedWord;
    }

    return currentWord;
  });

  return modifiedWords.join(' ');
}

/**
 * Takes in a string and returns it titlecased
 *
 * @example toTitleCase("hello world") -> "Hello World"
 */
export function toTitleCase(word: string): string {
  return word
    .split(' ')
    .map(word => word[0].toUpperCase() + word.substring(1))
    .join(' ');
}
