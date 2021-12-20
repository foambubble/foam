import { findFoamVariables } from './variable-resolver';

describe('findFoamVariables', () => {
  test('Finds Foam variables in any part of the snippet syntax', () => {
    const input = `
      # $FOAM_TITLE <-- On its own, using the $VARIABLE syntax
      # \${FOAM_SELECTED_TEXT} <-- On its own, using the \${VARIABLE} syntax
      # \${1:\${FOAM_DATE_YEAR}} <-- In a placeholder
      # \${2:\${3:\${FOAM_DATE_YEAR_SHORT}}} <-- In a nested placeholder
      # \${FOAM_DATE_MONTH:default_value} <-- With a default
      # \${FOAM_DATE_MONTH_NAME/(.*)/\${1:/upcase}/} <-- With a transform
    `;

    const expected = [
      'FOAM_TITLE',
      'FOAM_SELECTED_TEXT',
      'FOAM_DATE_YEAR',
      'FOAM_DATE_YEAR_SHORT',
      'FOAM_DATE_MONTH',
      'FOAM_DATE_MONTH_NAME',
    ];

    expect(findFoamVariables(input)).toEqual(expected);
  });

  test('Ignores non-Foam variables', () => {
    const input = `
      # \${AnotherVariable} <-- Unrelated to Foam
      # \${AnotherVariable:default_value} <-- Unrelated to Foam
      # \${AnotherVariable:default_value/(.*)/\${1:/upcase}/}} <-- Unrelated to Foam
      # $AnotherVariable} <-- Unrelated to Foam
      # $CURRENT_YEAR-\${CURRENT_MONTH}-$CURRENT_DAY <-- Unrelated to Foam
    `;

    const expected = [];

    expect(findFoamVariables(input)).toEqual(expected);
  });

  test('Ignores variable-looking text values', () => {
    const input = `
      # \${CURRENT_DATE/.*/\${FOAM_TITLE}/} <-- FOAM_TITLE is not a variable here, but a text in a transform
      # \${1|one,two,\${FOAM_TITLE}|} <-- FOAM_TITLE is not a variable here, but a text in a choice
    `;

    const expected = [];

    expect(findFoamVariables(input)).toEqual(expected);
  });
});
