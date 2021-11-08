import { window, workspace } from 'vscode';
import {
  resolveFoamVariables,
  resolveFoamTemplateVariables,
  substituteFoamVariables,
  determineDefaultFilepath,
} from './create-from-template';
import path from 'path';
import { isWindows } from '../utils';
import { URI } from '../core/model/uri';
import { fromVsCodeUri } from '../utils/vsc-utils';

describe('substituteFoamVariables', () => {
  test('Does nothing if no Foam-specific variables are used', () => {
    const input = `
      # \${AnotherVariable} <-- Unrelated to foam
      # \${AnotherVariable:default_value} <-- Unrelated to foam
      # \${AnotherVariable:default_value/(.*)/\${1:/upcase}/}} <-- Unrelated to foam
      # $AnotherVariable} <-- Unrelated to foam
      # $CURRENT_YEAR-\${CURRENT_MONTH}-$CURRENT_DAY <-- Unrelated to foam
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
    const foamTitle = 'My note title';
    const variables = ['FOAM_TITLE'];

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foamTitle)));

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE', foamTitle);

    const givenValues = new Map<string, string>();
    expect(await resolveFoamVariables(variables, givenValues)).toEqual(
      expected
    );
  });

  test('Resolves FOAM_TITLE without asking the user when it is provided', async () => {
    const foamTitle = 'My note title';
    const variables = ['FOAM_TITLE'];

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE', foamTitle);

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_TITLE', foamTitle);
    expect(await resolveFoamVariables(variables, givenValues)).toEqual(
      expected
    );
  });

  test('Resolves FOAM_DATE_* properties with current day by default', async () => {
    const variables = [
      'FOAM_DATE_YEAR',
      'FOAM_DATE_YEAR_SHORT',
      'FOAM_DATE_MONTH',
      'FOAM_DATE_MONTH_NAME',
      'FOAM_DATE_MONTH_NAME_SHORT',
      'FOAM_DATE_DATE',
      'FOAM_DATE_DAY_NAME',
      'FOAM_DATE_DAY_NAME_SHORT',
      'FOAM_DATE_HOUR',
      'FOAM_DATE_MINUTE',
      'FOAM_DATE_SECOND',
      'FOAM_DATE_SECONDS_UNIX',
    ];

    const expected = new Map<string, string>();
    expected.set(
      'FOAM_DATE_YEAR',
      new Date().toLocaleString('default', { year: 'numeric' })
    );
    expected.set(
      'FOAM_DATE_MONTH_NAME',
      new Date().toLocaleString('default', { month: 'long' })
    );
    expected.set(
      'FOAM_DATE_DATE',
      new Date().toLocaleString('default', { day: '2-digit' })
    );
    const givenValues = new Map<string, string>();

    expect(await resolveFoamVariables(variables, givenValues)).toEqual(
      expect.objectContaining(expected)
    );
  });

  test('Resolves FOAM_DATE_* properties with given date', async () => {
    const targetDate = new Date(2021, 9, 12, 1, 2, 3);
    const variables = [
      'FOAM_DATE_YEAR',
      'FOAM_DATE_YEAR_SHORT',
      'FOAM_DATE_MONTH',
      'FOAM_DATE_MONTH_NAME',
      'FOAM_DATE_MONTH_NAME_SHORT',
      'FOAM_DATE_DATE',
      'FOAM_DATE_DAY_NAME',
      'FOAM_DATE_DAY_NAME_SHORT',
      'FOAM_DATE_HOUR',
      'FOAM_DATE_MINUTE',
      'FOAM_DATE_SECOND',
      'FOAM_DATE_SECONDS_UNIX',
    ];

    const expected = new Map<string, string>();
    expected.set('FOAM_DATE_YEAR', '2021');
    expected.set('FOAM_DATE_YEAR_SHORT', '21');
    expected.set('FOAM_DATE_MONTH', '10');
    expected.set('FOAM_DATE_MONTH_NAME', 'October');
    expected.set('FOAM_DATE_MONTH_NAME_SHORT', 'Oct');
    expected.set('FOAM_DATE_DATE', '12');
    expected.set('FOAM_DATE_DAY_NAME', 'Tuesday');
    expected.set('FOAM_DATE_DAY_NAME_SHORT', 'Tue');
    expected.set('FOAM_DATE_HOUR', '01');
    expected.set('FOAM_DATE_MINUTE', '02');
    expected.set('FOAM_DATE_SECOND', '03');
    expected.set(
      'FOAM_DATE_SECONDS_UNIX',
      (targetDate.getTime() / 1000).toString()
    );

    const givenValues = new Map<string, string>();

    expect(
      await resolveFoamVariables(variables, givenValues, targetDate)
    ).toEqual(expected);
  });
});

describe('resolveFoamTemplateVariables', () => {
  test('Does nothing for template without Foam-specific variables', async () => {
    const input = `
      # \${AnotherVariable} <-- Unrelated to foam
      # \${AnotherVariable:default_value} <-- Unrelated to foam
      # \${AnotherVariable:default_value/(.*)/\${1:/upcase}/}} <-- Unrelated to foam
      # $AnotherVariable} <-- Unrelated to foam
      # $CURRENT_YEAR-\${CURRENT_MONTH}-$CURRENT_DAY <-- Unrelated to foam
    `;

    const expectedMap = new Map<string, string>();
    const expectedString = input;
    const expected = [expectedMap, expectedString];

    expect(await resolveFoamTemplateVariables(input)).toEqual(expected);
  });

  test('Does nothing for unknown Foam-specific variables', async () => {
    const input = `
      # $FOAM_FOO
      # \${FOAM_FOO}
      # \${FOAM_FOO:default_value}
      # \${FOAM_FOO:default_value/(.*)/\${1:/upcase}/}}
    `;

    const expectedMap = new Map<string, string>();
    const expectedString = input;
    const expected = [expectedMap, expectedString];

    expect(await resolveFoamTemplateVariables(input)).toEqual(expected);
  });

  test('Allows extra variables to be provided; only resolves the unique set', async () => {
    const foamTitle = 'My note title';

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foamTitle)));

    const input = `
      # $FOAM_TITLE
    `;

    const expectedOutput = `
      # My note title
    `;

    const expectedMap = new Map<string, string>();
    expectedMap.set('FOAM_TITLE', foamTitle);

    const expected = [expectedMap, expectedOutput];

    expect(
      await resolveFoamTemplateVariables(input, new Set(['FOAM_TITLE']))
    ).toEqual(expected);
  });

  test('Appends FOAM_SELECTED_TEXT with a newline to the template if there is selected text but FOAM_SELECTED_TEXT is not referenced and the template ends in a newline', async () => {
    const foamTitle = 'My note title';

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foamTitle)));

    const input = `# \${FOAM_TITLE}\n`;

    const expectedOutput = `# My note title\nSelected text\n`;

    const expectedMap = new Map<string, string>();
    expectedMap.set('FOAM_TITLE', foamTitle);
    expectedMap.set('FOAM_SELECTED_TEXT', 'Selected text');

    const expected = [expectedMap, expectedOutput];
    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_SELECTED_TEXT', 'Selected text');
    expect(
      await resolveFoamTemplateVariables(
        input,
        new Set(['FOAM_TITLE', 'FOAM_SELECTED_TEXT']),
        givenValues
      )
    ).toEqual(expected);
  });

  test('Appends FOAM_SELECTED_TEXT with a newline to the template if there is selected text but FOAM_SELECTED_TEXT is not referenced and the template ends in multiple newlines', async () => {
    const foamTitle = 'My note title';

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foamTitle)));

    const input = `# \${FOAM_TITLE}\n\n`;

    const expectedOutput = `# My note title\n\nSelected text\n`;

    const expectedMap = new Map<string, string>();
    expectedMap.set('FOAM_TITLE', foamTitle);
    expectedMap.set('FOAM_SELECTED_TEXT', 'Selected text');

    const expected = [expectedMap, expectedOutput];
    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_SELECTED_TEXT', 'Selected text');
    expect(
      await resolveFoamTemplateVariables(
        input,
        new Set(['FOAM_TITLE', 'FOAM_SELECTED_TEXT']),
        givenValues
      )
    ).toEqual(expected);
  });

  test('Appends FOAM_SELECTED_TEXT without a newline to the template if there is selected text but FOAM_SELECTED_TEXT is not referenced and the template does not end in a newline', async () => {
    const foamTitle = 'My note title';

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foamTitle)));

    const input = `# \${FOAM_TITLE}`;

    const expectedOutput = '# My note title\nSelected text';

    const expectedMap = new Map<string, string>();
    expectedMap.set('FOAM_TITLE', foamTitle);
    expectedMap.set('FOAM_SELECTED_TEXT', 'Selected text');

    const expected = [expectedMap, expectedOutput];
    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_SELECTED_TEXT', 'Selected text');
    expect(
      await resolveFoamTemplateVariables(
        input,
        new Set(['FOAM_TITLE', 'FOAM_SELECTED_TEXT']),
        givenValues
      )
    ).toEqual(expected);
  });

  test('Does not append FOAM_SELECTED_TEXT to a template if there is no selected text and is not referenced', async () => {
    const foamTitle = 'My note title';

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foamTitle)));

    const input = `
      # \${FOAM_TITLE}
      `;

    const expectedOutput = `
      # My note title
      `;

    const expectedMap = new Map<string, string>();
    expectedMap.set('FOAM_TITLE', foamTitle);
    expectedMap.set('FOAM_SELECTED_TEXT', '');

    const expected = [expectedMap, expectedOutput];
    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_SELECTED_TEXT', '');
    expect(
      await resolveFoamTemplateVariables(
        input,
        new Set(['FOAM_TITLE', 'FOAM_SELECTED_TEXT']),
        givenValues
      )
    ).toEqual(expected);
  });
});

describe('determineDefaultFilepath', () => {
  test('Absolute filepath metadata is unchanged', () => {
    const absolutePath = isWindows
      ? 'C:\\absolute_path\\journal\\My Note Title.md'
      : '/absolute_path/journal/My Note Title.md';

    const resolvedValues = new Map<string, string>();
    const templateMetadata = new Map<string, string>();
    templateMetadata.set('filepath', absolutePath);

    const resultFilepath = determineDefaultFilepath(
      resolvedValues,
      templateMetadata
    );

    expect(URI.toFsPath(resultFilepath)).toMatch(absolutePath);
  });

  test('Relative filepath metadata is appended to current directory', () => {
    const relativePath = isWindows
      ? 'journal\\My Note Title.md'
      : 'journal/My Note Title.md';

    const resolvedValues = new Map<string, string>();
    const templateMetadata = new Map<string, string>();
    templateMetadata.set('filepath', relativePath);

    const resultFilepath = determineDefaultFilepath(
      resolvedValues,
      templateMetadata
    );

    const expectedPath = path.join(
      URI.toFsPath(fromVsCodeUri(workspace.workspaceFolders[0].uri)),
      relativePath
    );

    expect(URI.toFsPath(resultFilepath)).toMatch(expectedPath);
  });
});
