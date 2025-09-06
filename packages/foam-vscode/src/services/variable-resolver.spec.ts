/* @unit-ready */
import { Selection, window } from 'vscode';
import { Resolver } from './variable-resolver';
import { Variable } from '../core/common/snippetParser';
import {
  createFile,
  deleteFile,
  showInEditor,
} from '../test/test-utils-vscode';

describe('variable-resolver, text substitution', () => {
  it('should do nothing if no Foam-specific variables are used', async () => {
    const input = `
      # \${AnotherVariable} <-- Unrelated to Foam
      # \${AnotherVariable:default_value} <-- Unrelated to Foam
      # \${AnotherVariable:default_value/(.*)/\${1:/upcase}/}} <-- Unrelated to Foam
      # $AnotherVariable} <-- Unrelated to Foam
      # $CURRENT_YEAR-\${CURRENT_MONTH}-$CURRENT_DAY <-- Unrelated to Foam
    `;

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_TITLE', 'My note title');
    const resolver = new Resolver(givenValues, new Date());
    expect(await resolver.resolveText(input)).toEqual(input);
  });

  test('Ignores variable-looking text values', async () => {
    // Related to https://github.com/foambubble/foam/issues/602
    const input = `
        # \${CURRENT_DATE/.*/\${FOAM_TITLE}/} <-- FOAM_TITLE is not a variable here, but a text in a transform
        # \${1|one,two,\${FOAM_TITLE}|} <-- FOAM_TITLE is not a variable here, but a text in a choice
      `;

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_TITLE', 'My note title');
    const resolver = new Resolver(givenValues, new Date());
    expect(await resolver.resolveText(input)).toEqual(input);
  });

  it('should correctly substitute variables that are substrings of one another', async () => {
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
    const resolver = new Resolver(givenValues, new Date());
    expect(await resolver.resolveText(input)).toEqual(expected);
  });
});

describe('variable-resolver, variable resolution', () => {
  it('should do nothing for unknown Foam-specific variables', async () => {
    const variables = [new Variable('FOAM_FOO')];

    const expected = new Map<string, string>();

    const givenValues = new Map<string, string>();
    const resolver = new Resolver(givenValues, new Date());
    expect(await resolver.resolveAll(variables)).toEqual(expected);
  });

  it('should resolve FOAM_TITLE if provided in constructor', async () => {
    const foamTitle = 'My note title';

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE', foamTitle);
    expected.set('FOAM_SLUG', 'my-note-title');

    const variables = [new Variable('FOAM_TITLE'), new Variable('FOAM_SLUG')];

    const resolver = new Resolver(
      new Map<string, string>(),
      new Date(),
      foamTitle
    );
    expect(await resolver.resolveAll(variables)).toEqual(expected);
  });

  it('should resolve FOAM_TITLE if provided as variable', async () => {
    const foamTitle = 'My note title';
    const variables = [new Variable('FOAM_TITLE'), new Variable('FOAM_SLUG')];

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foamTitle)));

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE', foamTitle);
    expected.set('FOAM_SLUG', 'my-note-title');

    const givenValues = new Map<string, string>();
    const resolver = new Resolver(givenValues, new Date());
    expect(await resolver.resolveAll(variables)).toEqual(expected);
  });

  it('should resolve FOAM_TITLE without asking the user when it is provided', async () => {
    const foamTitle = 'My note title';
    const variables = [new Variable('FOAM_TITLE')];

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE', foamTitle);

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_TITLE', foamTitle);
    const resolver = new Resolver(givenValues, new Date());
    expect(await resolver.resolveAll(variables)).toEqual(expected);
  });

  it('should resolve FOAM_TITLE_SAFE', async () => {
    const foamTitle = 'My/note#title';
    const variables = [
      new Variable('FOAM_TITLE'),
      new Variable('FOAM_TITLE_SAFE'),
    ];

    const expected = new Map<string, string>();
    expected.set('FOAM_TITLE', foamTitle);
    expected.set('FOAM_TITLE_SAFE', 'My-note-title');

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_TITLE', foamTitle);
    const resolver = new Resolver(givenValues, new Date());
    expect(await resolver.resolveAll(variables)).toEqual(expected);
  });

  it('should resolve FOAM_DATE_* properties with current day by default', async () => {
    const variables = [
      new Variable('FOAM_DATE_YEAR'),
      new Variable('FOAM_DATE_YEAR_SHORT'),
      new Variable('FOAM_DATE_MONTH'),
      new Variable('FOAM_DATE_MONTH_NAME'),
      new Variable('FOAM_DATE_MONTH_NAME_SHORT'),
      new Variable('FOAM_DATE_DATE'),
      new Variable('FOAM_DATE_DAY_NAME'),
      new Variable('FOAM_DATE_DAY_NAME_SHORT'),
      new Variable('FOAM_DATE_HOUR'),
      new Variable('FOAM_DATE_MINUTE'),
      new Variable('FOAM_DATE_SECOND'),
      new Variable('FOAM_DATE_SECONDS_UNIX'),
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
    const resolver = new Resolver(givenValues, new Date());

    expect(await resolver.resolveAll(variables)).toEqual(
      expect.objectContaining(expected)
    );
  });

  it('should resolve FOAM_DATE_* properties with given date', async () => {
    const targetDate = new Date(2021, 9, 12, 1, 2, 3);
    const variables = [
      new Variable('FOAM_DATE_YEAR'),
      new Variable('FOAM_DATE_YEAR_SHORT'),
      new Variable('FOAM_DATE_MONTH'),
      new Variable('FOAM_DATE_MONTH_NAME'),
      new Variable('FOAM_DATE_MONTH_NAME_SHORT'),
      new Variable('FOAM_DATE_DATE'),
      new Variable('FOAM_DATE_DAY_NAME'),
      new Variable('FOAM_DATE_DAY_NAME_SHORT'),
      new Variable('FOAM_DATE_HOUR'),
      new Variable('FOAM_DATE_MINUTE'),
      new Variable('FOAM_DATE_SECOND'),
      new Variable('FOAM_DATE_SECONDS_UNIX'),
      new Variable('FOAM_DATE_WEEK'),
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
    expected.set('FOAM_DATE_WEEK', '41');
    expected.set('FOAM_DATE_MINUTE', '02');
    expected.set('FOAM_DATE_SECOND', '03');
    expected.set(
      'FOAM_DATE_SECONDS_UNIX',
      (targetDate.getTime() / 1000).toString()
    );

    const givenValues = new Map<string, string>();
    const resolver = new Resolver(givenValues, targetDate);

    expect(await resolver.resolveAll(variables)).toEqual(expected);
  });

  describe('FOAM_DATE_WEEK', () => {
    it('should start counting weeks from 1', async () => {
      // week number starts from 1, not 0
      // the first "partial week" of the year is really the last of the previous
      const resolver = new Resolver(
        new Map<string, string>(),
        new Date(2021, 0, 1, 1, 2, 3)
      );
      expect(await resolver.resolve(new Variable('FOAM_DATE_WEEK'))).toEqual(
        '53'
      );
    });

    it('should pad week number to 2 digits', async () => {
      // week number is 2-digit
      const resolver = new Resolver(
        new Map<string, string>(),
        new Date(2021, 0, 7, 1, 2, 3)
      );
      expect(await resolver.resolve(new Variable('FOAM_DATE_WEEK'))).toEqual(
        '01'
      );
    });
  });

  describe('FOAM_CURRENT_DIR', () => {
    it('should resolve to workspace root when no active editor', async () => {
      const resolver = new Resolver(new Map<string, string>(), new Date());
      const result = await resolver.resolve(new Variable('FOAM_CURRENT_DIR'));

      // Should resolve to some directory path
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should resolve to current directory when editor is active', async () => {
      // Create a test file in a subdirectory
      const testFile = await createFile('Test content', [
        'test-dir',
        'test-file.md',
      ]);

      try {
        // Open the file to make it the active editor
        await showInEditor(testFile.uri);

        const resolver = new Resolver(new Map<string, string>(), new Date());
        const result = await resolver.resolve(new Variable('FOAM_CURRENT_DIR'));

        // Should resolve to the test-dir directory
        expect(typeof result).toBe('string');
        expect(result).toContain('test-dir');
      } finally {
        // Clean up
        await deleteFile(testFile.uri);
      }
    });

    it('should be included in known foam variables', async () => {
      const input = '${FOAM_CURRENT_DIR}';
      const resolver = new Resolver(new Map(), new Date());
      const result = await resolver.resolveText(input);

      // Should resolve to a directory path, not remain as ${FOAM_CURRENT_DIR}
      expect(result).not.toEqual(input);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

describe('variable-resolver, resolveText', () => {
  it('should do nothing for template without Foam-specific variables', async () => {
    const input = `
        # \${AnotherVariable} <-- Unrelated to Foam
        # \${AnotherVariable:default_value} <-- Unrelated to Foam
        # \${AnotherVariable:default_value/(.*)/\${1:/upcase}/}} <-- Unrelated to Foam
        # $AnotherVariable} <-- Unrelated to Foam
        # $CURRENT_YEAR-\${CURRENT_MONTH}-$CURRENT_DAY <-- Unrelated to Foam
      `;

    const expected = input;

    const resolver = new Resolver(new Map(), new Date());
    expect(await resolver.resolveText(input)).toEqual(expected);
  });

  it.each([
    ['2021-10-12T00:00:00'],
    ['2021-10-12T23:59:59'],
    ['2021-10-12T12:34:56'],
  ])('should resolve date variables in local time', async (d: string) => {
    // Related to #1502
    const resolver = new Resolver(new Map(), new Date(d));
    expect(await resolver.resolve(new Variable('FOAM_DATE_DATE'))).toEqual(
      '12'
    );
  });

  it('should do nothing for unknown Foam-specific variables', async () => {
    const input = `
        # $FOAM_FOO
        # \${FOAM_FOO}
        # \${FOAM_FOO:default_value}
        # \${FOAM_FOO:default_value/(.*)/\${1:/upcase}/}}
      `;

    const expected = input;
    const resolver = new Resolver(new Map(), new Date());
    expect(await resolver.resolveText(input)).toEqual(expected);
  });

  it('should resolve FOAM_SELECTED_TEXT with the editor selection', async () => {
    const file = await createFile('Content of note file');
    const { editor } = await showInEditor(file.uri);
    editor.selection = new Selection(0, 11, 1, 0);
    const resolver = new Resolver(new Map(), new Date());
    expect(await resolver.resolveFromName('FOAM_SELECTED_TEXT')).toEqual(
      'note file'
    );
    await deleteFile(file);
  });

  it('should append FOAM_SELECTED_TEXT with a newline to the template if there is selected text but FOAM_SELECTED_TEXT is not referenced and the template ends in a newline', async () => {
    const foamTitle = 'My note title';

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foamTitle)));

    const input = `# \${FOAM_TITLE}\n`;

    const expected = `# My note title\nSelected text\n`;

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_SELECTED_TEXT', 'Selected text');
    const resolver = new Resolver(givenValues, new Date());
    expect(await resolver.resolveText(input)).toEqual(expected);
  });

  it('should append FOAM_SELECTED_TEXT with a newline to the template if there is selected text but FOAM_SELECTED_TEXT is not referenced and the template ends in multiple newlines', async () => {
    const foamTitle = 'My note title';

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foamTitle)));

    const input = `# \${FOAM_TITLE}\n\n`;

    const expected = `# My note title\n\nSelected text\n`;

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_SELECTED_TEXT', 'Selected text');
    const resolver = new Resolver(givenValues, new Date());
    expect(await resolver.resolveText(input)).toEqual(expected);
  });

  it('should append FOAM_SELECTED_TEXT without a newline to the template if there is selected text but FOAM_SELECTED_TEXT is not referenced and the template does not end in a newline', async () => {
    const foamTitle = 'My note title';

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foamTitle)));

    const input = `# \${FOAM_TITLE}`;

    const expected = '# My note title\nSelected text';

    const givenValues = new Map<string, string>();
    givenValues.set('FOAM_SELECTED_TEXT', 'Selected text');
    const resolver = new Resolver(givenValues, new Date());
    expect(await resolver.resolveText(input)).toEqual(expected);
  });

  it('should not append FOAM_SELECTED_TEXT to a template if there is no selected text and is not referenced', async () => {
    const foamTitle = 'My note title';

    jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(foamTitle)));

    const input = `
        # \${FOAM_TITLE}
        `;

    const expected = `
        # My note title
        `;

    const givenValues = new Map<string, string>();
    const resolver = new Resolver(givenValues, new Date());
    expect(await resolver.resolveText(input)).toEqual(expected);
  });
});
