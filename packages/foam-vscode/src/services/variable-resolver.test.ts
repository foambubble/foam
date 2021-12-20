import { Text, Variable } from '../core/common/snippetParser';
import { findFoamVariables, substituteVariables } from './variable-resolver';

describe('findFoamVariables', () => {
  test('it finds Foam variables in any part of the snippet syntax', () => {
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

    expect(findFoamVariables(input).map(v => v.name)).toEqual(expected);
  });

  test('it ignores non-Foam variables', () => {
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

  test('it ignores variable-looking text values', () => {
    const input = `
      # \${CURRENT_DATE/.*/\${FOAM_TITLE}/} <-- FOAM_TITLE is not a variable here, but a text in a transform
      # \${1|one,two,\${FOAM_TITLE}|} <-- FOAM_TITLE is not a variable here, but a text in a choice
    `;

    const expected = [];

    expect(findFoamVariables(input)).toEqual(expected);
  });
});

describe('substituteVariables', () => {
  test('it handles different Variables with the same name', () => {
    const input = `
      # $FOAM_TITLE <-- On its own, using the $VARIABLE syntax
      # \${FOAM_TITLE} <-- On its own, using the \${VARIABLE} syntax
      # \${1:\${FOAM_TITLE}} <-- In a placeholder
      # \${2:\${3:\${FOAM_TITLE}}} <-- In a nested placeholder
      # \${FOAM_TITLE:default_value} <-- With a default
      # \${FOAM_TITLE/(.*)/\${1:/upcase}/} <-- With a transform
    `;

    const foamTitle1 = new Variable('FOAM_TITLE', 9, 20);
    foamTitle1.children.push(new Text('My new note'));

    const foamTitle2 = new Variable('FOAM_TITLE', 72, 85);
    foamTitle2.children.push(new Text('My new note'));

    const foamTitle3 = new Variable('FOAM_TITLE', 139, 157);
    foamTitle3.children.push(new Text('My new note'));

    const foamTitle4 = new Variable('FOAM_TITLE', 187, 210);
    foamTitle4.children.push(new Text('My new note'));

    const foamTitle5 = new Variable('FOAM_TITLE', 247, 274);
    foamTitle5.children.push(new Text('My new note'));

    const foamTitle6 = new Variable('FOAM_TITLE', 302, 334);
    foamTitle6.children.push(new Text('MY NEW NOTE'));

    const variables = [
      foamTitle1,
      foamTitle2,
      foamTitle3,
      foamTitle4,
      foamTitle5,
      foamTitle6,
    ];
    const expected = `
      # My new note <-- On its own, using the $VARIABLE syntax
      # My new note <-- On its own, using the \${VARIABLE} syntax
      # My new note <-- In a placeholder
      # My new note <-- In a nested placeholder
      # My new note <-- With a default
      # MY NEW NOTE <-- With a transform
    `;

    expect(substituteVariables(input, variables)).toEqual(expected);
  });

  test('it substitutes variables at start/end of a string', () => {
    const input = `\${FOAM_TITLE}`;
    const variable = new Variable('FOAM_TITLE', 0, 13);
    variable.children.push(new Text('My new note'));

    const variables = [variable];
    const expected = 'My new note';

    expect(substituteVariables(input, variables)).toEqual(expected);
  });

  test('it ignores Variables that are missing positions', () => {
    // This can happen when variables are given as `extraVariablesToResolve`
    // but do not exist in the text.
    const input = `\${FOAM_DATE_MONTH}\n`;

    const foamDateMonth = new Variable('FOAM_DATE_MONTH', 0, 18);
    foamDateMonth.children.push(new Text('07'));

    const foamTitle = new Variable('FOAM_TITLE');
    foamTitle.children.push(new Text('My new note'));

    const variables = [foamTitle, foamDateMonth];
    const expected = '07\n';

    expect(substituteVariables(input, variables)).toEqual(expected);
  });
});
