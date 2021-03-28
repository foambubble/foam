import { window } from 'vscode';
import { substituteFoamVariables } from './create-from-template';

describe('substituteFoamVariables', () => {
  test('Does nothing if no Foam-specific variables are used', async () => {
    const input = `
      # \${AnotherVariable} <-- Unrelated to foam
      # \${AnotherVariable:default_value} <-- Unrelated to foam
      # \${AnotherVariable:default_value/(.*)/\${1:/upcase}/}} <-- Unrelated to foam
      # $AnotherVariable} <-- Unrelated to foam
      # #CURRENT_YEAR-\${CURRENT_MONTH}-$CURRENT_DAY <-- Unrelated to foam
    `;

    expect(await substituteFoamVariables(input)).toEqual(input);
  });

  test('Resolves FOAM_TITLE', async () => {
    const input = `
      # $FOAM_TITLE <-- The title goes here
      # \${FOAM_TITLE} <-- and also here
    `;

    const foam_title = 'My note title';

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foam_title)));

    const expected = `
      # My note title <-- The title goes here
      # My note title <-- and also here
    `;

    expect(await substituteFoamVariables(input)).toEqual(expected);
  });
});
