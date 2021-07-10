import { Identifier } from './Identifier';
import { Message } from './Message';
import { MessageType } from './MessageType';
import { Node } from './Node';
import { Reference } from './Reference';
import { ReferenceType } from './ReferenceType';
import { Prelude, SimpleShapes, Traits } from './schema';
import { Section } from './Section';
import { Token } from './Token';
import { TokenType } from './TokenType';

export class ParsedDocument {
	uri: string;
	sections: { [name in Section]?: Token };
	metadata: { [name: string]: Node };
	namespace: string;
	controls: { [name: string]: Node };
	relativeShapes: { [name: string]: string[] };
	shapes: { [name: string]: Token[] };
	references: Reference[];
	messages: Message[];
	parsedMessageCount: number;

	constructor(uri: string) {
		this.uri = uri;
		this.sections = {};
		this.metadata = {};
		this.namespace = undefined;
		this.controls = {};
		this.relativeShapes = {};
		this.shapes = {};
		this.references = [];
		this.messages = [];
		this.parsedMessageCount = 0;
	}

	addMessage(text: string, options: { token: Token; type?: MessageType, after?: boolean }): void {
		const token = options.token;
		const type = options.type || MessageType.Error;
		const position = !options.after && token.type !== TokenType.End
			? {
				startIndex: token.range.start.index,
				endIndex: token.range.end.index,
			}
			: {
				startIndex: token.range.end.index - 1,
				endIndex: token.range.end.index,
			};
		this.messages.push({
			type,
			text,
			...position,
		});
	}

	enterSection(section: Section, token: Token) {
		if (!this.sections[section]) {
			this.sections[section] = token;
		}

		switch (section) {
			case Section.Control:
				if (this.sections[Section.Metadata] || this.sections[Section.Shape]) {
					this.addMessage('Control section has to be defined first.', { token });
				}
				break;
			case Section.Metadata:
				if (this.sections[Section.Shape]) {
					this.addMessage('Metadata must be defined before shapes.', { token });
				}
				break;
			}
	}

	finishParsing() {
		this.parsedMessageCount = this.messages.length;
		this.references.sort(compareReferences);
	}

	resolveId(identifier: Identifier): string {
		if (identifier.namespace === undefined) {
			const resolvedId = this.relativeShapes[identifier.toRelative()];
			if (resolvedId) {
				return resolvedId[0];
			}
		}
		return `${identifier.namespace !== undefined ? identifier.namespace : this.namespace || 'smithy.api'}#${identifier.name}${identifier.member !== undefined ? `$${identifier.member}`: ''}`;
	}

	addShape(identifier: Identifier, token: Token) {
		const resolvedId = this.resolveId(identifier);
		const relative = identifier.toRelative();
		if (this.relativeShapes[relative]) {
			this.addMessage('Shape is already defined.', { token });
		}

		// console.log(`Add ${relative} -> ${resolvedId}`);

		putItem(this.shapes, resolvedId, token);
		putItem(this.relativeShapes, relative, resolvedId);
	}

	addReference(identifier: Identifier, token: Token, type: ReferenceType) {
		this.references.push({ token, identifier, type });
		// this.addMessage(`Token ${token.range.start.line}:${token.range.start.column}`, { token, type: MessageType.Hint });
	}

	validate(parsedFiles: ParsedDocument[]) {
		this.messages.length = this.parsedMessageCount;
		this.validateNamespace();
		this.validateReferences(parsedFiles);
	}

	validateNamespace() {
		if (!this.namespace && this.sections.Shape) {
			this.addMessage(
				'Missing namespace declaration. Namespace \'smithy.api\' from Smithy prelude will be used.',
				{ token: this.sections.Shape, type: MessageType.Warning });
		}
	}

	isKnownReference(identifier: Identifier) {
		return !identifier.namespace && !identifier.member && (simpleShapeNames.includes(identifier.name) || preludeShapeNames.includes(identifier.name));
	}

	isExternalShape(identifier: Identifier, parsedFiles: ParsedDocument[]) {
		for (const parsedDocument of parsedFiles) {
			// console.log('isExternalShape', parsedDocument.uri, parsedDocument.namespace, identifier.namespace, identifier.toRelative());
			if (identifier.namespace && parsedDocument.namespace === identifier.namespace
					|| !identifier.namespace && parsedDocument.namespace === this.namespace) {
				// console.log('isExternalShape.if', parsedDocument.uri);
				if (parsedDocument.relativeShapes[identifier.toRelative()]) {
					return true;
				}
			}
		}

		return false;
	}

	validateReferences(parsedFiles: ParsedDocument[]) {
		this.references.sort(compareReferences);
		// console.log('shapes:', Object.keys(this.shapes));
		// console.log('relative shapes:', Object.keys(this.relativeShapes));
		for (const reference of this.references) {
			const resolvedId = this.resolveId(reference.identifier);
			const start = reference.token.range.start;
			// console.log(`Resolved ID [${start.line}:${start.column}]: ${resolvedId}`);
			if (!this.shapes[resolvedId] && !this.isKnownReference(reference.identifier) && !this.isExternalShape(reference.identifier, parsedFiles)) {
				this.addMessage('Unknown shape.', { token: reference.token, type: MessageType.Error });
			}
		}
	}

	findSymbol(line: number, column: number): Reference {
		const index = binarySearch(this.references, { line, column }, ({line, column}, reference) => {
			const { start, end } = reference.token.range;
			// console.log(`comparing ${line}:${column} with ${reference.token.value} at ${start.line}:${start.column} - ${end.line}:${end.column}`);
			if (end.line < line) {
				return 1;
			}
			if (start.line > line) {
				return -1;
			}
			if (end.line === line && end.column < column) {
				return 1;
			}
			if (start.line === line && start.column > column) {
				return -1;
			}
			return 0;
		});
		return index >= 0
			? this.references[index]
			: undefined;
	}
}

const simpleShapeNames = Object.values<string>(SimpleShapes);
const preludeShapeNames = [...Object.keys(Prelude.shapes), ...Object.keys(Traits)];

function compareReferences(a: Reference, b: Reference) {
	const aStart = a.token.range.start;
	const bStart = b.token.range.start;
	return aStart.line - bStart.line || aStart.column - bStart.column;
}

function putItem<TItem>(map: { [key: string]: TItem[] }, key: string, item: TItem): void {
	if (!map[key]) {
		map[key] = [item];
	} else {
		map[key].push(item);
	}
}

function binarySearch<TItem, TValue>(array: TItem[], element: TValue, compareFunction: (value: TValue, item: TItem) => number) {
	let leftIndex = 0;
	let rightIndex = array.length - 1;
	while (leftIndex <= rightIndex) {
		const middleIndex = leftIndex + ((rightIndex - leftIndex) >> 1);
		const cmp = compareFunction(element, array[middleIndex]);
		if (cmp > 0) {
			leftIndex = middleIndex + 1;
		} else if (cmp < 0) {
			rightIndex = middleIndex - 1;
		} else {
			return middleIndex;
		}
	}
	return -leftIndex - 1;
}
