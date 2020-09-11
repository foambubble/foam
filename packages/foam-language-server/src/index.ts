import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocuments,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InsertTextFormat,
  InitializeResult,
  Position,
  TextDocumentContentChangeEvent,
  Range,
} from 'vscode-languageserver';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { getWorkspaceFiles } from './workspace';
import { getFileBlocks, FileBlock } from './file';

const innerUpdate = TextDocument.update;
TextDocument.update = (document: TextDocument, changes: TextDocumentContentChangeEvent[], version: number) => {
  const updated = innerUpdate(document, changes, version);
  siphonOnDidChangeTextDocumentEvent(document, changes);
  return updated;
}

const textDocumentManager = new TextDocuments(TextDocument);

let workspaceFiles: {
  title: string;
  fileName: string;
  filePath: string;
  target: string;
  preview: string;
}[] = [];

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
  let capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );

  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      executeCommandProvider: {
        commands: ['foam/insertHash'],
      },
      completionProvider: {
        triggerCharacters: ['[', '#'],
        resolveProvider: true,
      },
    },
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(async () => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }

  if (hasWorkspaceFolderCapability) {
    const folders = await connection.workspace.getWorkspaceFolders();
    if (!folders || folders.length === 0) {
      console.error('No workspace folders found');
    } else {
      if (folders.length > 1) {
        console.log('Multi-root workspaces not yet supported');
      }

      let folder = folders[0];
      console.log('Initializing workspace at ' + folder.uri);
      workspaceFiles = await getWorkspaceFiles(folder.uri);
    }
  }

  textDocumentManager.onDidOpen(e => {
    console.log('onDidOpen', e.document.uri);
  });

  textDocumentManager.onDidClose(e => {
    // console.log('onDidClose', e.document);
  });

  textDocumentManager.onDidChangeContent(e => {
    console.log('onDidChange', e.document.uri);
  });

  textDocumentManager.onWillSave(e => {
    // console.log('onWillSave', e.document, e.reason);
  });

  textDocumentManager.onWillSaveWaitUntil((e, cancellationToken) => {
    // console.log('onWillSaveTextDocumentWaitUntil', e.document,  e.reason);
    // Could return text edits here;
    return [];
  });

  textDocumentManager.onDidSave(e => {
    // console.log('onDidSave', e.document);
  });
});

connection.onDidChangeConfiguration(change => {
  if (hasConfigurationCapability) {
    // todo
  }
});

connection.onDidChangeWatchedFiles(_change => {
  // Monitored files have change in VSCode
  connection.console.log('We received an file change event');
});

connection.onExecuteCommand(async e => {
  if (e.command === 'foam/insertHash') {
    const {
      sourceUri,
      sourcePosition,
      targetUri,
      targetBlock,
    }: {
      sourceUri: string;
      sourcePosition: Position;
      targetUri: string;
      targetBlock: FileBlock;
    } = e.arguments![0];

    const astPosition = targetBlock.position;
    const docPosition = {
      line: astPosition.end.line - 1,
      character: astPosition.end.column - 1,
    };

    const result = await connection.workspace.applyEdit({
      label: 'Insert generated hash',
      edit: {
        changes: {
          [targetUri]: [
            {
              newText: ` ^${targetBlock.key}`,
              range: {
                start: docPosition,
                end: docPosition,
              },
            },
          ],
        },
      },
    });

    if (result.applied) {
      activeHashEdit = {
        sourceUri: sourceUri,
        sourceRange: {
          start: sourcePosition,
          end: {
            ...sourcePosition,
            character: sourcePosition.character + targetBlock.key.length,
          },
        },
        targetUri: targetUri,
        targetRange: {
          start: { ...docPosition, character: docPosition.character }, 
          end: {
            ...docPosition,
            character: docPosition.character + targetBlock.key.length + 2, // +" ^"
          },
        },
      };
    }

    console.log(
      'foam/insertHash',
      sourceUri,
      sourcePosition,
      targetUri,
      targetBlock
    );
  } else {
    console.log('unrecognized command', e.command, e.arguments);
  }
});

function getAvailableSections(
  uri: string,
  position: Position
): CompletionItem[] {
  const targetUri =
    'file:///Users/swanson/dev/foam-link-completion-demo/Principles.md';
  const document = textDocumentManager.get(targetUri);
  const blocks = getFileBlocks(document!.getText());

  // try to find the end brackets, so we can remove them and add them
  // back on the other side of our cursor, so when the insertion is
  // completed, the text cursor will remain on the outside of the brackets

  // const sections = getMockSections();
  // const document = textDocumentManager.get(uri);
  // if (document) {
  //   const endBracketRange = {
  //     start: position,
  //     end: { ...position, character: position.character + 2 },
  //   };

  //   if (document.getText(endBracketRange) == ']]') {
  //     return sections.map((section) => ({
  //       label: `#${section}`,
  //       kind: CompletionItemKind.Text,
  //       insertTextFormat: InsertTextFormat.Snippet,
  //       textEdit: {
  //         newText: '${1:' + shortHash(section) + '}]] $0',
  //         range: endBracketRange
  //       },
  //     }));
  //   }
  // }

  const kindsByType: { [x: string]: CompletionItemKind } = {
    heading: CompletionItemKind.Folder,
    paragraph: CompletionItemKind.Text,
    listItem: CompletionItemKind.Keyword,
  };

  // no luck locating end brocket range, just inject the value
  // and let user handle in manually
  return blocks.map(block => {
    const labelPrefix = block.type === 'heading' ? '# ' : '';
    const insertNewHash = block.type !== 'heading' && !block.hash;
    return {
      label: `${labelPrefix}${block.text}`,
      detail: block.key,
      documentation: {
        kind: 'markdown',
        value: block.text,
      },
      kind: kindsByType[block.type],
      sortText: block.sort.toString(),
      filterText: block.text,
      insertText: insertNewHash ? '${1:' + block.key + '}$0' : `${block.key}$0`,
      insertTextFormat: InsertTextFormat.Snippet,
      command: insertNewHash
        ? {
            title: 'Insert Hash',
            command: 'foam/insertHash',
            arguments: [
              {
                sourceUri: uri,
                sourcePosition: position,
                targetUri: targetUri,
                targetBlock: block,
              },
            ],
          }
        : undefined,
    };
  });
}

function isRequestAtWikiLinkStartBlock(
  uri: string,
  position: Position
): boolean {

  // find the currently open document
  const document = textDocumentManager.get(uri);
  if (!document) {
    console.log('document not found by uri', uri);
    return false;
  }

  // get the preceding three character range
  const text = document.getText({
    start: { line: position.line, character: position.character - 3 },
    end: position,
  });

  // we get three characters, so that we can trigger autocompletion in following cases:
  // 1. when user types the second "[", the range is " [[", and we show all files
  // 2. when user has cleared existing link content and types the first character
  //    of the new content, e.g. "[[S".
  return text.includes('[[');
}

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    console.log('onCompletion.textDocumentPosition', _textDocumentPosition);

    const documentContext = (_textDocumentPosition as any).context;
    if (documentContext && documentContext.triggerCharacter === '#') {
      return getAvailableSections(
        _textDocumentPosition.textDocument.uri,
        _textDocumentPosition.position
      );
    }

    if (
      isRequestAtWikiLinkStartBlock(
        _textDocumentPosition.textDocument.uri,
        _textDocumentPosition.position
      )
    ) {
      return workspaceFiles.map(document => ({
        label: document.title,
        detail: document.fileName,
        documentation: document.preview,
        commitCharacters: ['#', '|'],
        kind: CompletionItemKind.Text,
        insertTextFormat: InsertTextFormat.Snippet,
        textEdit: {
          newText: document.target + '$1]] $0',
          range: {
            start: _textDocumentPosition.position,
            end: {
              ..._textDocumentPosition.position,
              character: _textDocumentPosition.position.character + 2,
            },
          },
        },
      }));
    }

    return [];
  }
);

connection.onCompletionResolve(item => {
  return item;
});

textDocumentManager.listen(connection);

// Listen on the connection
connection.listen();


let activeHashEdit: {
  sourceUri: string;
  sourceRange: Range;
  targetUri: string;
  targetRange: Range;
} | null = null;


function siphonOnDidChangeTextDocumentEvent(document: TextDocument, changes: TextDocumentContentChangeEvent[]) {
  if (!activeHashEdit) return;
  if (document.uri !== activeHashEdit.sourceUri) return;
  if (changes.length !== 1) return;

  const edit = activeHashEdit;
  const text = changes[0].text;
  const range = (changes[0] as any).range as Range;

  if (!range) return;

  if (
    range.start.line === range.end.line &&
    range.start.line === edit.sourceRange.start.line &&
    range.end.line === edit.sourceRange.end.line &&
    range.start.character >= edit.sourceRange.start.character &&
    range.end.character <= edit.sourceRange.end.character + 1
  ) {
    const val = document.getText(edit.sourceRange);
    const hash = val.split(']')[0];

    console.log('Text at edit point', hash);

    if (range.end.character == edit.sourceRange.end.character + 1) {
      edit.sourceRange.end.character += 1;
      edit.targetRange.end.character += 1;
      activeHashEdit = edit;
    }

    connection.workspace.applyEdit({
      label: 'Update generated hash',
      edit: {
        changes: {
          [edit.targetUri]: [
            {
              newText: hash.length === 0 ? '' : ` ^${hash}`,
              range: edit.targetRange,
            },
          ],
        },
      },
    });

    
  } else {
    activeHashEdit = null;
  }
};