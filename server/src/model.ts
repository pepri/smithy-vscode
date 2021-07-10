import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Message } from './Message';
import { MessageType } from './MessageType';
import { ParsedDocument } from './ParsedDocument';
import { Parser } from './Parser';
import { Lexer } from './Lexer';

export class Model {
	log: (message: string) => void;
	parsedFiles: Map<string, ParsedDocument> = new Map();

	constructor(log: (message: string) => void) {
		this.log = log;
	}

	public parseDocument(document: TextDocument): ParsedDocument {
		const startTime = +new Date();
		this.log(`Parsing document: ${document.uri}`);
		const text = document.getText();
		const parsedDocument = new ParsedDocument(document.uri);
		const lexer = new Lexer(text);

		const parser = new Parser(lexer, parsedDocument);
		parser.parse();

		// this.log(`Parsing complete: ${+new Date() - startTime}ms`);

		return parsedDocument;
	}

	public messageToDiagnostic(document: TextDocument, message: Message): Diagnostic {
		return {
			severity: this.messageTypeToDiagnosticSeverity(message.type),
			range: {
				start: document.positionAt(message.startIndex),
				end: document.positionAt(message.endIndex),
			},
			message: message.text || 'error',
			source: 'smithy',
		};
	}

	private messageTypeToDiagnosticSeverity(type: MessageType): DiagnosticSeverity {
		switch (type) {
			case MessageType.Hint:
				return DiagnosticSeverity.Hint;

			case MessageType.Information:
				return DiagnosticSeverity.Information;

			case MessageType.Warning:
				return DiagnosticSeverity.Warning;

			default:
			case MessageType.Error:
				return DiagnosticSeverity.Error;
			}
	}
}
