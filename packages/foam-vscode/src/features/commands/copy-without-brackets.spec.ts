import { env, Position, Selection, commands } from 'vscode';
import { createFile, showInEditor } from '../../test/test-utils-vscode';
import { removeBrackets, toTitleCase } from './copy-without-brackets';

describe('copy-without-brackets command', () => {
  it('should get the input from the active editor selection', async () => {
    const { uri } = await createFile('This is my [[test-content]].', [
      'copy-without-brackets',
      'file.md',
    ]);
    const { editor } = await showInEditor(uri);
    editor.selection = new Selection(new Position(0, 0), new Position(1, 0));
    await commands.executeCommand('foam-vscode.copy-without-brackets');
    const value = await env.clipboard.readText();
    expect(value).toEqual('This is my Test Content.');
  });
});

describe('removeBrackets', () => {
  it('removes the brackets', () => {
    const input = 'hello world [[this-is-it]]';
    const actual = removeBrackets(input);
    const expected = 'hello world This Is It';
    expect(actual).toEqual(expected);
  });
  it('removes the brackets and the md file extension', () => {
    const input = 'hello world [[this-is-it.md]]';
    const actual = removeBrackets(input);
    const expected = 'hello world This Is It';
    expect(actual).toEqual(expected);
  });
  it('removes the brackets and the mdx file extension', () => {
    const input = 'hello world [[this-is-it.mdx]]';
    const actual = removeBrackets(input);
    const expected = 'hello world This Is It';
    expect(actual).toEqual(expected);
  });
  it('removes the brackets and the markdown file extension', () => {
    const input = 'hello world [[this-is-it.markdown]]';
    const actual = removeBrackets(input);
    const expected = 'hello world This Is It';
    expect(actual).toEqual(expected);
  });
  it('removes the brackets even with numbers', () => {
    const input = 'hello world [[2020-07-21.markdown]]';
    const actual = removeBrackets(input);
    const expected = 'hello world 2020 07 21';
    expect(actual).toEqual(expected);
  });
  it('removes brackets for more than one word', () => {
    const input =
      'I am reading this as part of the [[book-club]] put on by [[egghead]] folks (Lauro).';
    const actual = removeBrackets(input);
    const expected =
      'I am reading this as part of the Book Club put on by Egghead folks (Lauro).';
    expect(actual).toEqual(expected);
  });
});

describe('toTitleCase', () => {
  it('title cases a word', () => {
    const input =
      'look at this really long sentence but I am calling it a word';
    const actual = toTitleCase(input);
    const expected =
      'Look At This Really Long Sentence But I Am Calling It A Word';
    expect(actual).toEqual(expected);
  });
  it('works on one word', () => {
    const input = 'word';
    const actual = toTitleCase(input);
    const expected = 'Word';
    expect(actual).toEqual(expected);
  });
});
