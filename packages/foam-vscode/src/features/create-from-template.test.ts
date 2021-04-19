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
    expect(substituteFoamVariables(input, givenValues)).toEqual(input);
  });

  test('Correctly substitutes variables that are substrings of one another', () => {
    // FOAM_TITLE is a substring of FOAM_TITLE_NON_EXISTENT_VARIABLE
    // If we're not careful with how we substitute the values
    // we can end up putting the FOAM_TITLE in place FOAM_TITLE_NON_EXISTENT_VARIABLE should be.
    const input = `
      # \${FOAM_TITLE}
      # $FOAM_TITLE
      # \${FOAM_TITLE_NON_EXISTENT_VARIABLE}
      # $FOAM_TITLE_NON_EXISTENT_VARIABLE
    `;

    const expected = `
      # My note title
      # My note title
      # \${FOAM_TITLE_NON_EXISTENT_VARIABLE}
      # $FOAM_TITLE_NON_EXISTENT_VARIABLE
    `;

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_TITLE', 'My note title');
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
});
