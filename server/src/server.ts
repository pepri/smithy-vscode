import {
	createConnection,
	FileChangeType,
	ProposedFeatures,
	TextDocuments,
	TextDocumentSyncKind,
	WorkspaceFolder,
} from 'vscode-languageserver/node';

import { DocumentUri, TextDocument } from 'vscode-languageserver-textdocument';
import { Model } from './Model';
import * as fs from 'fs';
import * as path from 'path';
import { ParsedDocument } from './ParsedDocument';

// Creates the LSP connection
const connection = createConnection(ProposedFeatures.all);

function log(message: string): void {
	// console.log(message);
	connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] ${message}`);
}

// Create a manager for open text documents
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

const model = new Model(log);

// The workspace folder this server is operating on
let workspaceFolder: string | null;

let workspaceFolders: WorkspaceFolder[] = [];
let hasWorkspaceFolderCapability = false;

documents.onDidOpen(event => {
	log(`Document opened: ${event.document.uri}`);
});

documents.onDidChangeContent(event => {
	log(`Document content changed: ${event.document.uri}`);
	const parsedDocument = parseDocument(event.document);
	validateDocument(event.document, parsedDocument);
});

function parseDocument(document: TextDocument): ParsedDocument {
	const parsedDocument = model.parseDocument(document);
	document['parsedDocument'] = parsedDocument;
	model.parsedFiles.set(parsedDocument.uri, parsedDocument);
	return parsedDocument;
}

function validateDocument(document: TextDocument, parsedDocument: ParsedDocument): void {
	log(`Validating file: ${document.uri}`);
	parsedDocument.validate(Array.from(model.parsedFiles.values()));

	const diagnostics = parsedDocument.messages
		.map(message => model.messageToDiagnostic(document, message));
	connection.sendDiagnostics({ uri: parsedDocument.uri, diagnostics });
}

documents.onDidClose(event => {
	log(`Document closed: ${event.document.uri}`);
});

documents.listen(connection);

connection.onDidChangeWatchedFiles(event => {
	for (const change of event.changes) {
		switch (change.type) {
			case FileChangeType.Created:
				log(`Watched document created: ${change.uri}`);
				parseDocument(createDocument(change.uri, uriToPath(change.uri)));
				break;
			case FileChangeType.Changed:
				log(`Watched document changed: ${change.uri}`);
				parseDocument(createDocument(change.uri, uriToPath(change.uri)));
				break;
			case FileChangeType.Deleted:
				log(`Watched document deleted: ${change.uri}`);
				model.parsedFiles.delete(change.uri);
				break;
			default:
				break;
		}
	}
});

function createDocument(uri: DocumentUri, path: string): TextDocument {
	const text = fs.readFileSync(path, { encoding: 'utf-8' });
	return TextDocument.create(uri, 'smithy', 1, text);
}

function uriToPath(uri: string): string {
	const rest = decodeURIComponent(uri.substr('file://'.length));
	const firstSlash = rest.indexOf('/');
	const windows = rest[firstSlash + 2] === ':';
	return windows
		? rest.substring(firstSlash + 1)
		: rest;
}

function pathToUri(path: string): string {
	const rest = encodeURIComponent(path.replace(/\\/g, '/')).replace(/%2F/gi, '/');
	return rest[0] !== '/'
		? `file:///${rest}`
		: `file://${rest}`;
}

function fromDir(startUri: string, filter: RegExp, callback: (filePath: string) => void): void {
	if (!startUri.startsWith('file://')) {
		log(`Directory URI does not start with file://: ${startUri}`);
	}

	const startPath = uriToPath(startUri);

	if (!fs.existsSync(startPath)) {
		log(`Directory does not exist: ${startPath}`);
		return;
	}

	for (const filename of fs.readdirSync(startPath)) {
		// log(`Filename: ${filename}`);
		const filePath = path.join(startPath, filename);
		const stat = fs.lstatSync(filePath);
		if (stat.isDirectory()){
			fromDir(pathToUri(filePath), filter, callback);
		} else if (filter.test(filePath)) {
			callback(filePath);
		}
	};
};

async function parseAllFiles(workspaceFolders: WorkspaceFolder[]) {
	const documents = [];

	for (const workspaceFolder of workspaceFolders) {
		log(`workspaceFolder: ${workspaceFolder.uri}`);
		fromDir(workspaceFolder.uri, /\.smithy$/, filePath => {
			const fileUri = pathToUri(filePath);
			// log(`Parsing file: ${filePath} (${fileUri})`);
			const document = createDocument(fileUri, filePath);
			parseDocument(document);
			documents.push(document);
		});
	}

	log(`Validating all files: ${documents.length}`);

	for (const document of documents) {
		validateDocument(document, document['parsedDocument']);
	}

	// console.log(`parsedFiles: ${model.parsedFiles.keys()}`);
}

connection.onInitialize(params => {
	workspaceFolder = params.rootUri;
	workspaceFolders = params.workspaceFolders;
	log('Started and initialize received');

	setTimeout(() => parseAllFiles(workspaceFolders), 0);

	const capabilities = params.capabilities;

	hasWorkspaceFolderCapability = Boolean(capabilities.workspace?.configuration);

	return {
		capabilities: {
			workspace: hasWorkspaceFolderCapability
				? {
					workspaceFolders: { supported: true },
				}
				: undefined,
			definitionProvider: true,
			textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Incremental,
			},
		},
	};
});

connection.onInitialized(() => {
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(event => {
			log('Workspace folder change event received.');
			workspaceFolders = workspaceFolders
				.filter(folder => !event.removed.includes(folder))
				.concat(event.added);
		});
	}
});

function findShape(resolvedId: string) {
	for (const [uri, parsedDocument] of model.parsedFiles.entries()) {
		const shape = parsedDocument.shapes[resolvedId];
		if (shape) {
			return { parsedDocument, shape: shape[0] };
		}
	}
	return undefined;
}

connection.onDefinition(params => {
	const document = documents.get(params.textDocument.uri);
	const parsedDocument = document['parsedDocument'] as ParsedDocument;
	const reference = parsedDocument.findSymbol(params.position.line, params.position.character);
	if (!reference) {
		log(`No identifier found at ${params.textDocument.uri}:${params.position.line}:${params.position.character}.`);
		return undefined;
	}
	const resolvedId = parsedDocument.resolveId(reference.identifier);
	log(`Identifier found: ${resolvedId}`);
	const symbol = findShape(resolvedId);

	if (!symbol) {
		log('Symbol not found.');
		return undefined;
	}

	const { start, end } = symbol.shape.range;
	log(`Symbol found: ${symbol.parsedDocument.uri}:${start.line}:${start.column}`);
	return {
		uri: symbol.parsedDocument.uri,
		range: {
			start: { line: start.line, character: Math.max(0, start.column - 1) },
			end: { line: end.line, character: Math.max(0, end.column - 1) },
		},
	};
});

connection.listen();
