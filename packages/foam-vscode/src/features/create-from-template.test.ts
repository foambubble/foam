import { window } from 'vscode';
import {
  resolveFoamVariables,
  substituteFoamVariables,
} from './create-from-template';

describe('substituteFoamVariables', () => {
  test('Does nothing if no Foam-specific variables are used', () => {
    const input = `
      # \${AnotherVariable} <-- Unrelated to foam
      # \${AnotherVariable:default_value} <-- Unrelated to foam
      # \${AnotherVariable:default_value/(.*)/\${1:/upcase}/}} <-- Unrelated to foam
      # $AnotherVariable} <-- Unrelated to foam
      # #CURRENT_YEAR-\${CURRENT_MONTH}-$CURRENT_DAY <-- Unrelated to foam
    `;

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_TITLE', 'My note title');
    givenValues.set('FOAM_TITLE_SLUG', 'my-note-title');
    expect(substituteFoamVariables(input, givenValues)).toEqual(input);
  });

  test('Correctly substitutes variables that are substrings of one another', () => {
    // FOAM_TITLE is a substring of FOAM_TITLE_SLUG
    // If we're not careful with how we substitute the values
    // we can end up putting the FOAM_TITLE where FOAM_TITLE_SLUG should be.
    const input = `
      # \${FOAM_TITLE}
      # $FOAM_TITLE
      # \${FOAM_TITLE_SLUG}
      # $FOAM_TITLE_SLUG
    `;

    const expected = `
      # My note title
      # My note title
      # my-note-title
      # my-note-title
    `;

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_TITLE', 'My note title');
    givenValues.set('FOAM_TITLE_SLUG', 'my-note-title');
    expect(substituteFoamVariables(input, givenValues)).toEqual(expected);
  });
});

describe('resolveFoamVariables', () => {
  test('Does nothing for unknown Foam-specific variables', async () => {
    const variables = ['FOAM_FOO'];

    const expected = new Map<string, string>();
    expected.set('FOAM_FOO', 'FOAM_FOO');

    const givenValues = new Map<string, string>();
    expect(await resolveFoamVariables(variables, givenValues)).toEqual(
      expected
    );
  });

  test('Resolves FOAM_TITLE', async () => {
    const foam_title = 'My note title';
    const variables = ['FOAM_TITLE'];

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foam_title)));

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE', foam_title);

    const givenValues = new Map<string, string>();
    expect(await resolveFoamVariables(variables, givenValues)).toEqual(
      expected
    );
  });

  test('Resolves FOAM_TITLE without asking the user when it is provided', async () => {
    const foam_title = 'My note title';
    const variables = ['FOAM_TITLE'];

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE', foam_title);

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_TITLE', foam_title);
    expect(await resolveFoamVariables(variables, givenValues)).toEqual(
      expected
    );
  });

  test('Resolves FOAM_TITLE and FOAM_TITLE_SLUG, but only prompts the user for the title once', async () => {
    const foam_title = 'My note title';
    const variables = ['FOAM_TITLE', 'FOAM_TITLE_SLUG'];

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foam_title)));

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE', foam_title);
    expected.set('FOAM_TITLE_SLUG', 'my-note-title');

    const givenValues = new Map<string, string>();
    expect(await resolveFoamVariables(variables, givenValues)).toEqual(
      expected
    );
  });

  test('Resolves FOAM_TITLE_SLUG by resolving FOAM_TITLE first when FOAM_TITLE is not used', async () => {
    const foam_title = 'My note title';
    const variables = ['FOAM_TITLE_SLUG'];

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foam_title)));

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE_SLUG', 'my-note-title');

    const givenValues = new Map<string, string>();
    expect(await resolveFoamVariables(variables, givenValues)).toEqual(
      expected
    );
  });

  test('Resolves FOAM_TITLE_SLUG when FOAM_TITLE is provided', async () => {
    const foam_title = 'My note title';
    const variables = ['FOAM_TITLE_SLUG'];

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE_SLUG', 'my-note-title');

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_TITLE', foam_title);

    expect(await resolveFoamVariables(variables, givenValues)).toEqual(
      expected
    );
  });

  test('Resolves FOAM_TITLE_SLUG when FOAM_TITLE_SLUG is provided', async () => {
    const foam_title_slug = 'my-note-title';
    const variables = ['FOAM_TITLE_SLUG'];

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE_SLUG', foam_title_slug);

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_TITLE_SLUG', foam_title_slug);

    expect(await resolveFoamVariables(variables, givenValues)).toEqual(
      expected
    );
  });
});
