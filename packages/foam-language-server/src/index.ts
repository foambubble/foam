import {
	createConnection,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver';

const data = [
	{
		text: 'Foam',
		displayName: 'Foam',
		description: 'Foam is a personal knowledge management and sharing system built on Visual Studio Code and GitHub.'
	},
	{
		text: 'Roam',
		displayName: 'Roam Research',
		description: 'Roam is a A note-taking tool for networked thought',
	},
	{
		text: 'Obsidian',
		displayName: "Obsidian",
		description: 'Obsidian is a powerful knowledge base that works on top of a local folder of plain text Markdown files.'
	}
];

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
			completionProvider: {
				triggerCharacters: ["["],
				resolveProvider: true
			}
		}
    };
    
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {

	}
});

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		console.log('onCompletion.textDocumentPosition', _textDocumentPosition);
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return data.map(item => ({
			label: item.displayName,
			kind: CompletionItemKind.Text,
			data: item.text
		}));
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		console.log('onCompletionResolve.item', item);
		const product = data.find(p => p.text = item.data);
		if (product) {
			item.detail = product.displayName;
			item.documentation = product.description;
		}
		return item;
	}
);

// Listen on the connection
connection.listen();
