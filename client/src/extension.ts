import * as fs from 'fs';
import * as path from 'path';
import { workspace, window, ExtensionContext, TextDocument, WorkspaceFolder, Uri, OutputChannel, ExtensionMode } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

let defaultClient: LanguageClient;
const clients: Map<string, LanguageClient> = new Map();

let _sortedWorkspaceFolders: string[] | undefined;
function sortedWorkspaceFolders(): string[] {
	if (_sortedWorkspaceFolders === undefined) {
		_sortedWorkspaceFolders = workspace.workspaceFolders
			? workspace.workspaceFolders
				.map(folder => appendTrailingSlash(folder.uri.toString()))
				.sort((a, b) => a.length - b.length)
			: [];
	}
	return _sortedWorkspaceFolders;
}
workspace.onDidChangeWorkspaceFolders(() => _sortedWorkspaceFolders = undefined);

function appendTrailingSlash(text: string): string {
	return text.charAt(text.length - 1) !== '/' ? text + '/' : text;
}

function getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
	for (const element of sortedWorkspaceFolders()) {
		const uri = appendTrailingSlash(folder.uri.toString());
		if (uri.startsWith(element)) {
			return workspace.getWorkspaceFolder(Uri.parse(element))!;
		}
	}
	return folder;
}

function createLanguageClient(module: string, outputChannel: OutputChannel, folder?: WorkspaceFolder): LanguageClient {
	const inspectPort = folder ? 6011 + clients.size : 6010;
	const serverOptions: ServerOptions = {
		run: {
			module,
			transport: TransportKind.ipc,
		},
		debug: {
			module,
			transport: TransportKind.ipc,
			options: { execArgv: ['--nolazy', `--inspect=${inspectPort}`] },
		},
	};
	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{
				scheme: folder ? 'file' : 'untitled',
				language: 'smithy',
				pattern: folder ? `${folder.uri.fsPath}/**/*` : undefined,
			},
		],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher('**/*.smithy'),
		},
		diagnosticCollectionName: 'lsp-smithy-multi-server',
		workspaceFolder: folder,
		outputChannel,
	};
	const client = new LanguageClient('lsp-smithy-multi-server', 'LSP Smithy Multi Server', serverOptions, clientOptions);
	client.start();

	return client;
}

export function activate(context: ExtensionContext) {
	const localModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
	const module = !fs.existsSync(localModule)
		? context.asAbsolutePath(path.join('node_modules', 'server', 'out', 'server.js'))
		: localModule;
	const outputChannel = window.createOutputChannel('lsp-smithy-multi-server');

	function didOpenTextDocument(document: TextDocument): void {
		// We are only interested in language mode smithy
		if (document.languageId !== 'smithy' || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')) {
			return;
		}

		const uri = document.uri;
		// Untitled files go to a default client.
		if (uri.scheme === 'untitled' && !defaultClient) {
			defaultClient = createLanguageClient(module, outputChannel);
			return;
		}
		let folder = workspace.getWorkspaceFolder(uri);
		// Files outside a folder can't be handled. This might depend on the language.
		// Single file languages like JSON might handle files outside the workspace folders.
		if (!folder) {
			return;
		}
		// If we have nested workspace folders we only start a server on the outer most workspace folder.
		folder = getOuterMostWorkspaceFolder(folder);

		if (!clients.has(folder.uri.toString())) {
			clients.set(folder.uri.toString(), createLanguageClient(module, outputChannel, folder));
		}
	}

	workspace.onDidOpenTextDocument(didOpenTextDocument);
	workspace.textDocuments.forEach(didOpenTextDocument);
	workspace.onDidChangeWorkspaceFolders(event => {
		for (const folder of event.removed) {
			const client = clients.get(folder.uri.toString());
			if (client) {
				clients.delete(folder.uri.toString());
				client.stop();
			}
		}
	});
}

export async function deactivate(): Promise<void> {
	const promises: Thenable<void>[] = [];
	if (defaultClient) {
		promises.push(defaultClient.stop());
	}
	for (const client of clients.values()) {
		promises.push(client.stop());
	}
	await Promise.all(promises);
}
