/* eslint-disable no-console */
import { URI } from './uri';
import { Range } from './range';
import { createMarkdownParser } from '../services/markdown-parser';
import { Resource, ResourceParser, Section } from './note';
import * as fs from 'fs';
import * as path from 'path';
import { isEqual } from 'lodash';
import {
  Logger,
  ILogger,
  BaseLogger,
  LogLevel,
  LogLevelThreshold,
  ConsoleLogger,
} from '../utils/log';

const diagnosticsFile = path.resolve(
  __dirname,
  '../../../../../test_output.log'
);

// Ensure the log file is clean before starting the tests
if (fs.existsSync(diagnosticsFile)) {
  fs.unlinkSync(diagnosticsFile);
}

const log = (message: string) => {
  fs.appendFileSync(diagnosticsFile, message + '\n', 'utf8');
  console.log(message);
};

// Custom logger that writes to the diagnostics file
class FileLogger extends BaseLogger {
  log(level: LogLevel, msg?: string, ...params: any[]): void {
    const formattedMessage = [msg, ...params]
      .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
      .join(' ');
    fs.appendFileSync(
      diagnosticsFile,
      `[${level.toUpperCase()}] ${formattedMessage}\n`,
      'utf8'
    );
  }
}

const runTestAndLog = (
  testName: string,
  markdown: string,
  expected: Partial<Resource>
) => {
  const parser: ResourceParser = createMarkdownParser();
  const uri = URI.parse('test-note.md');
  const actual = parser.parse(uri, markdown);

  let failureLog = '';

  // Compare sections
  if (expected.sections) {
    if (actual.sections.length !== expected.sections.length) {
      failureLog += `  - SECTIONS LENGTH MISMATCH: Expected ${expected.sections.length}, Got ${actual.sections.length}\n`;
    } else {
      for (let i = 0; i < expected.sections.length; i++) {
        const expectedSection = expected.sections[i];
        const actualSection = actual.sections[i];

        if (!isEqual(expectedSection, actualSection)) {
          failureLog += `  - SECTION[${i}] MISMATCH:\n`;
          failureLog += `    - EXPECTED: ${JSON.stringify(expectedSection)}\n`;
          failureLog += `    - ACTUAL:   ${JSON.stringify(actualSection)}\n`;
        }
      }
    }
  }

  if (failureLog) {
    let message = `\n--- TEST FAILURE: ${testName} ---\n`;
    message += `INPUT MARKDOWN:\n---\n${markdown}\n---\n`;
    message += `EXPECTED:\n${JSON.stringify(expected, null, 2)}\n`;
    message += `ACTUAL:\n${JSON.stringify(actual, null, 2)}\n`;
    message += `FAILURE DETAILS:\n${failureLog}`;
    log(message);
    throw new Error(message); // Explicitly fail the test in Jest
  } else {
    log(`--- TEST PASSED: ${testName} ---`);
  }
};

describe('Markdown Parser - Block Identifiers', () => {
  let originalLogger: ILogger;
  let originalLogLevel: LogLevelThreshold;

  beforeAll(() => {
    originalLogger = (Logger as any).defaultLogger; // Access private member for saving
    originalLogLevel = Logger.getLevel();
    Logger.setDefaultLogger(new FileLogger());
    Logger.setLevel('debug'); // Ensure debug logs are captured
  });

  afterAll(() => {
    Logger.setDefaultLogger(originalLogger);
    Logger.setLevel(originalLogLevel);
  });

  it('should parse a block ID on a simple paragraph', () => {
    runTestAndLog(
      'should parse a block ID on a simple paragraph',
      `
This is a paragraph. ^block-id-1
`,
      {
        sections: [
          {
            id: 'block-id-1',
            label: 'This is a paragraph. ^block-id-1',
            blockId: '^block-id-1',
            isHeading: false,
            range: Range.create(1, 0, 1, 32),
          },
        ],
      }
    );
  });

  it('should parse a block ID on a heading', () => {
    runTestAndLog(
      'should parse a block ID on a heading',
      `
## My Heading ^heading-id
`,
      {
        sections: [
          {
            id: 'my-heading',
            blockId: '^heading-id',
            isHeading: true,
            label: 'My Heading',
            range: Range.create(1, 0, 1, 25), // Adjusted range
          },
        ],
      }
    );
  });

  it('should parse a block ID on a list item', () => {
    runTestAndLog(
      'should parse a block ID on a list item',
      `
- List item one ^list-id-1
`,
      {
        sections: [
          {
            id: 'list-id-1',
            blockId: '^list-id-1',
            isHeading: false,
            label: '- List item one ^list-id-1',
            range: Range.create(1, 0, 1, 26),
          },
        ],
      }
    );
  });

  it('should parse a block ID on a parent list item with sub-items', () => {
    runTestAndLog(
      'should parse a block ID on a parent list item with sub-items',
      `
- Parent item ^parent-id
  - Child item 1
  - Child item 2
`,
      {
        sections: [
          {
            id: 'parent-id',
            blockId: '^parent-id',
            isHeading: false,
            label: `- Parent item ^parent-id
  - Child item 1
  - Child item 2`,
            range: Range.create(1, 0, 3, 16),
          },
        ],
      }
    );
  });

  it('should parse a block ID on a nested list item', () => {
    runTestAndLog(
      'should parse a block ID on a nested list item',
      `
- Parent item
  - Child item 1 ^child-id-1
  - Child item 2
`,
      {
        sections: [
          {
            id: 'child-id-1',
            blockId: '^child-id-1',
            isHeading: false,
            label: '- Child item 1 ^child-id-1',
            range: Range.create(2, 2, 2, 28),
          },
        ],
      }
    );
  });

  it('should parse a full-line block ID on a blockquote', () => {
    runTestAndLog(
      'should parse a full-line block ID on a blockquote',
      `
> This is a blockquote.
> It can span multiple lines.
^blockquote-id
`,
      {
        sections: [
          {
            id: 'blockquote-id',
            blockId: '^blockquote-id',
            isHeading: false,
            label: `> This is a blockquote.
> It can span multiple lines.`,
            range: Range.create(1, 0, 2, 28),
          },
        ],
      }
    );
  });

  it('should parse a full-line block ID on a code block', () => {
    runTestAndLog(
      'should parse a full-line block ID on a code block',
      `
\`\`\`typescript
function hello() {
  console.log('Hello, world!');
}
\`\`\`
^code-block-id
`,
      {
        sections: [
          {
            id: 'code-block-id',
            blockId: '^code-block-id',
            isHeading: false,
            label: `\`\`\`typescript
function hello() {
  console.log('Hello, world!');
}
\`\`\``,
            range: Range.create(1, 0, 5, 3),
          },
        ],
      }
    );
  });

  it('should parse a full-line block ID on a table', () => {
    runTestAndLog(
      'should parse a full-line block ID on a table',
      `
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
^my-table
`,
      {
        sections: [
          {
            id: 'my-table',
            blockId: '^my-table',
            isHeading: false,
            label: `| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`,
            range: Range.create(1, 0, 4, 23),
          },
        ],
      }
    );
  });

  it('should verify "last one wins" rule for inline block IDs', () => {
    runTestAndLog(
      'should verify "last one wins" rule for inline block IDs',
      `
This is a paragraph. ^first-id ^second-id
`,
      {
        sections: [
          {
            id: 'second-id',
            blockId: '^second-id',
            label: 'This is a paragraph. ^first-id ^second-id',
            isHeading: false,
            range: Range.create(1, 0, 1, 41),
          },
        ],
      }
    );
  });

  it('should verify "last one wins" rule for full-line block IDs', () => {
    runTestAndLog(
      'should verify "last one wins" rule for full-line block IDs',
      `
- list item 1
- list item 2
^old-list-id ^new-list-id
`,
      {
        sections: [
          {
            id: 'new-list-id',
            blockId: '^new-list-id',
            label: `- list item 1
- list item 2`,
            isHeading: false,
            range: Range.create(1, 0, 2, 13),
          },
        ],
      }
    );
  });

  it('should verify duplicate prevention for nested list items with IDs', () => {
    runTestAndLog(
      'should verify duplicate prevention for nested list items with IDs',
      `
- Parent item ^parent-id
  - Child item 1 ^child-id
`,
      {
        sections: [
          {
            id: 'parent-id',
            blockId: '^parent-id',
            label: `- Parent item ^parent-id
  - Child item 1 ^child-id`,
            isHeading: false,
            range: Range.create(1, 0, 2, 26), // Adjusted range
          },
        ],
      }
    );
  });

  it('should not create a section if an empty line separates block from ID', () => {
    runTestAndLog(
      'should not create a section if an empty line separates block from ID',
      `
- list item1
- list item2

^this-will-not-work
`,
      {
        sections: [],
      }
    );
  });

  it('should parse a full-line block ID on a list', () => {
    runTestAndLog(
      'should parse a full-line block ID on a list',
      `- list item 1
- list item 2
^list-id`,
      {
        sections: [
          {
            id: 'list-id',
            blockId: '^list-id',
            label: `- list item 1
- list item 2`,
            isHeading: false,
            range: Range.create(0, 0, 1, 13),
          },
        ],
      }
    );
  });
});
