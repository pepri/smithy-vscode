import { Identifier } from './Identifier';
import { Lexer } from './Lexer';
import { MessageType } from './MessageType';
import { Node } from './Node';
import { ParsedDocument } from './ParsedDocument';
import { ReferenceType } from './ReferenceType';
import { AggregateShapes, Schema, ServiceShapes, SimpleShapes } from './schema';
import { Section } from './Section';
import { Token } from './Token';
import { TokenType } from './TokenType';

export class Parser {
	private currentToken: Token;
	private tokens: Generator<Token>;
	private parsedDocument: ParsedDocument;

	constructor(lexer: Lexer, parsedDocument: ParsedDocument) {
		this.tokens = lexer.getTokens();
		this.parsedDocument = parsedDocument;
		this.currentToken = this.advanceToken();
	}

	advanceToken(): Token {
		const lastToken = this.currentToken || {
			type: TokenType.End,
			range: {
				start: {
					index: 0,
					line: 0,
					column: 0,
				},
				end: {
					index: 0,
					line: 0,
					column: 0,
				},
			},
		};
		return this.currentToken = this.tokens.next().value || {
			...lastToken,
			type: TokenType.End,
		};
	}

	token(): Token {
		return this.currentToken;
	}

	parse(): void {
		while (this.token()?.type !== TokenType.End) {
			// console.log(`Token: ${JSON.stringify(this.token())}`);
			const statementToken = this.token();

			switch (statementToken.type) {
				case TokenType.Identifier: {
					switch (statementToken.value) {
						case 'metadata': {
							this.parsedDocument.enterSection(Section.Metadata, statementToken);
							this.advanceToken();
							const node = this.expectKeyValuePair({ delimiter: '=' });
							const value = node?.value;

							const keyNode = node?.key;
							const keyValue = keyNode?.value;

							if (this.parsedDocument.metadata[keyValue]) {
								this.parsedDocument.addMessage(`Metadata '${keyValue}' is already defined.`, { token: keyNode?.token ?? this.currentToken, type: MessageType.Warning });
							}
							this.parsedDocument.metadata[keyValue] = value;
							break;
						}

						case 'namespace': {
							this.parsedDocument.enterSection(Section.Shape, statementToken);
							const namespaceToken = this.token();
							if (this.parsedDocument.namespace !== undefined) {
								this.parsedDocument.addMessage(`Namespace was already defined as '${this.parsedDocument}'.`, { token: namespaceToken });
							}
							this.advanceToken();
							if (this.token().type !== TokenType.Identifier) {
								this.parsedDocument.addMessage('Expected namespace.', { token: namespaceToken });
								break;
							}
							this.parsedDocument.namespace = this.token().value;
							this.advanceToken();
							break;
						}

						case 'use': {
							this.parsedDocument.enterSection(Section.Shape, statementToken);
							this.advanceToken();
							const identifierToken = this.expectIdentifier();
							if (!identifierToken) {
								this.parsedDocument.addMessage('Expected shape ID.', { token: statementToken, after: true });
								break;
							}
							const identifier = new Identifier(identifierToken.value);
							if (identifier.namespace === undefined) {
								this.parsedDocument.addMessage('Shape ID must be absolute.', { token: identifierToken });
							} else if (identifier.namespace === '') {
								this.parsedDocument.addMessage('Missing namespace.', { token: identifierToken });
							}
							if (identifier.member !== undefined) {
								this.parsedDocument.addMessage('Shapes IDs with member names cannot be imported with a use statement.', { token: identifierToken });
							}
							this.parsedDocument.addShape(identifier, identifierToken);
							this.parsedDocument.addReference(identifier, identifierToken, ReferenceType.Use);
							break;
						}

						case 'apply': {
							this.parsedDocument.enterSection(Section.Shape, statementToken);
							this.advanceToken();
							const identifierToken = this.expectIdentifier();
							if (!identifierToken) {
								this.parsedDocument.addMessage('Expected shape ID.', { token: statementToken, after: true });
								break;
							}
							const identifier = new Identifier(identifierToken.value);
							this.parsedDocument.addReference(identifier, identifierToken, ReferenceType.Apply);
							this.expectTrait(statementToken);
							break;
						}

						case AggregateShapes.List:
						case AggregateShapes.Set:
						case AggregateShapes.Map:
						case AggregateShapes.Structure:
						case AggregateShapes.Union:
						case ServiceShapes.Service:
						case ServiceShapes.Operation:
						case ServiceShapes.Resource: {
							this.parsedDocument.enterSection(Section.Shape, statementToken);
							this.advanceToken();
							const identifierToken = this.expectIdentifier();

							if (!identifierToken) {
								this.parsedDocument.addMessage(`Expected ${statementToken.value} name.`, { token: statementToken, after: true });
							}

							const node = this.expectNodeObject(identifierToken ?? statementToken);

							if (identifierToken) {
								const identifier = new Identifier(identifierToken.value);

								this.parsedDocument.addShape(identifier, identifierToken);
								this.parsedDocument.addReference(identifier, identifierToken, ReferenceType.Shape);

								if (node) {
									const schema = Schema[statementToken.value];
									this.validateValueAgainstSchema(identifierToken, node, schema);

									for (const [fieldName, fieldValue] of Object.entries<any>(node.value)) {
										this.addMember(identifier, identifierToken, fieldValue);
									}
								}
							}
							break;
						}

						case SimpleShapes.String:
						case SimpleShapes.Blob:
						case SimpleShapes.Boolean:
						case SimpleShapes.Document:
						case SimpleShapes.Byte:
						case SimpleShapes.Short:
						case SimpleShapes.Integer:
						case SimpleShapes.Long:
						case SimpleShapes.Float:
						case SimpleShapes.Double:
						case SimpleShapes.BigInteger:
						case SimpleShapes.BigDecimal:
						case SimpleShapes.Timestamp: {
							this.parsedDocument.enterSection(Section.Shape, this.currentToken);
							this.advanceToken();
							const identifierToken = this.expectIdentifier();

							if (!identifierToken) {
								this.parsedDocument.addMessage(`Expected ${statementToken.value} name.`, { token: statementToken, after: true });
								break;
							}
							const identifier = new Identifier(identifierToken.value);
							this.parsedDocument.addShape(identifier, identifierToken);
							this.parsedDocument.addReference(identifier, identifierToken, ReferenceType.Shape);
							break;
						}

						default: {
							switch (statementToken.value.charAt(0)) {
								case '@': {
									this.expectTrait(statementToken);
									break;
								}

								case '$': {
									this.parsedDocument.enterSection(Section.Control, this.currentToken);
									this.expectControlStatement();
									break;
								}

								default: {
									this.parsedDocument.addMessage(`Unexpected identifier: ${this.token().value}`, { token: this.currentToken });
									this.advanceToken();
									break;
								}
							}
						}
					}
					break;
				}

				default: {
					this.parsedDocument.addMessage(`Unexpected token: ${this.token().value} (${encodeURIComponent(this.token().value)})`, { token: this.currentToken });
					this.advanceToken();
					break;
				}
			}
		}

		this.parsedDocument.finishParsing();
	}

	validateValueAgainstSchema(identifierToken: Token, node: Node, schema: Schema) {
		if (!schema) {
			return;
		}
		if (!node || !node.token) {
			this.parsedDocument.addMessage('Expected a value.' + JSON.stringify(node), { token: identifierToken });
			return;
		}
		switch (schema.type) {
			case 'identifier': {
				if (node.token.type !== TokenType.Identifier) {
					this.parsedDocument.addMessage('Expected an identifier.', { token: node.token });
				}
				break;
			}

			case AggregateShapes.Member: {
				if (node.token.type !== TokenType.Identifier) {
					this.parsedDocument.addMessage('Expected an identifier.', { token: node.token });
					break;
				}
				this.addMemberReference(node);
				break;
			}

			case AggregateShapes.Structure: {
				if (node.token.type !== TokenType.Delimiter || node.token.value !== '{') {
					this.parsedDocument.addMessage('Expected an object.', { token: node.token });
					break;
				}

				if (schema.structure) {
					for (const [fieldName, fieldSchema] of Object.entries(schema.structure)) {
						if (fieldSchema.required && !node.value[fieldName]) {
							this.parsedDocument.addMessage(`Missing '${fieldName}' member.`, { token: identifierToken });
						}
					}
					for (const [fieldName, fieldValue] of Object.entries<any>(node.value)) {
						const fieldSchema = schema.anyMember ?? schema.structure[fieldName];
						if (!fieldSchema) {
							this.parsedDocument.addMessage(`Unexpected member '${fieldName}'.`, { token: fieldValue.key ? fieldValue.key.token : identifierToken });
						} else {
							this.validateValueAgainstSchema(fieldValue.token ?? identifierToken, fieldValue, fieldSchema);
						}
					}
				}

				for (const [fieldName, fieldValue] of Object.entries<any>(node.value)) {
					// this.addMemberReference(fieldValue);
					this.validateValueAgainstSchema(fieldValue.token ?? identifierToken, fieldValue, schema.anyMember);
				}

				break;
			}

			case AggregateShapes.List: {
				if (node.token.type !== TokenType.Delimiter || node.token.value !== '[' || !Array.isArray(node.value)) {
					this.parsedDocument.addMessage('Expected a list.', { token: node.token });
					break;
				}
				for (const itemValue of node.value) {
					this.validateValueAgainstSchema(itemValue.token ?? identifierToken, itemValue, schema.member);
				}
				break;
			}

			case AggregateShapes.Map: {
				if (node.token.type !== TokenType.Delimiter || node.token.value !== '{') {
					this.parsedDocument.addMessage('Expected a map.', { token: node.token });
					break;
				}
				for (const [fieldName, fieldValue] of Object.entries<any>(node.value)) {
					this.validateValueAgainstSchema(fieldValue.key?.token ?? identifierToken, fieldValue.key, schema.key);
					this.validateValueAgainstSchema(fieldValue.token ?? identifierToken, fieldValue, schema.value);
				}
				break;
			}

			case SimpleShapes.String: {
				if (node.token.type !== TokenType.String) {
					this.parsedDocument.addMessage('Expected a string.', { token: node.token });
				}
				break;
			}

			default: {
				this.parsedDocument.addMessage(`Not implemented yet ${schema.type}.`, { token: node.token });
				break;
			}
		}
	}

	addMember(identifier: Identifier, identifierToken: Token, value: Node) {
		const memberIdentifier = identifier.forMember(value.key.token.value);
		this.parsedDocument.addShape(memberIdentifier, value.key.token);
		this.parsedDocument.addReference(memberIdentifier, value.key.token, ReferenceType.Shape);
	}

	addMemberReference(value: any) {
		if (!value) {
			return;
		}
		if (value.token.type === TokenType.Identifier) {
			this.parsedDocument.addReference(new Identifier(value.token.value), value.token, ReferenceType.Member);
		} else {
			this.parsedDocument.addMessage('Expected shape identifier.', { token: value.token });
		}
	}

	isDelimiter(value: string) {
		return this.token().type === TokenType.Delimiter && this.token().value === value;
	}

	expectControlStatement() {
		if (!this.token().value.startsWith('$')) {
			this.parsedDocument.addMessage('Expected control statement key.', { token: this.currentToken });
		}

		const separatedPrefix = this.token().value.length === 1;
		if (separatedPrefix) {
			this.advanceToken();
		}

		const node = this.expectKeyValuePair();
		const value = node?.value;

		const keyNode = node?.key;
		const keyValue = !separatedPrefix && keyNode?.token?.type === TokenType.Identifier
			? keyNode?.value?.substr(1)
			: keyNode?.value;

		if (keyValue === 'version') {
			if (typeof value !== 'string') {
				this.parsedDocument.addMessage('Version value must be a string.', { token: node?.token ?? this.currentToken });
			} else if (!value.match(/^[0-9](?:\.[0-9])?$/)) {
				this.parsedDocument.addMessage('Version value must be in format \'major\' or \'major.minor\'.', { token: node?.token ?? this.currentToken });
			}
		} else {
			this.parsedDocument.addMessage('Only \'version\' is supported.', { token: keyNode?.token ?? this.currentToken, type: MessageType.Warning });
		}

		if (this.parsedDocument.controls[keyValue]) {
			this.parsedDocument.addMessage(`Control '${keyValue}' is already defined.`, { token: keyNode?.token ?? this.currentToken, type: MessageType.Error });
		}
		this.parsedDocument.controls[keyValue] = value;
	}

	expectTrait(previousToken: Token) {
		const identifierToken = this.expectIdentifier();
		if (!identifierToken || identifierToken.text.charAt(0) !== '@' || identifierToken.text.length === 1) {
			this.parsedDocument.addMessage('Expected trait name.', { token: previousToken });
			return;
		}

		const identifier = new Identifier(identifierToken.value.substr(1));
		this.parsedDocument.addReference(identifier, identifierToken, ReferenceType.Trait);

		if (this.isDelimiter('(')) {
			do {
				this.advanceToken();
				if (this.isDelimiter(')')) {
					break;
				}
				this.expectKeyValuePair({ optionalKey: true });
			} while (this.isDelimiter(','));

			if (!this.isDelimiter(')')) {
				this.parsedDocument.addMessage("Expected ')'.", { token: this.currentToken });
			}
			this.advanceToken();
		}
	}

	expectKeyValuePair(options?: { optionalKey?: boolean, delimiter?: string }): Node {
		while (this.token().type === TokenType.Identifier && this.token().value.startsWith('@')) {
			this.expectTrait(this.currentToken);
		}

		let token = {...this.token()};
		let key: Node = undefined;

		switch (token.type) {
			case TokenType.String:
			case TokenType.Number:
			case TokenType.Identifier: {
				key = {
					value: token.value,
					token: token,
				};
				this.advanceToken();
				break;
			}
			default: {
				if (!options?.optionalKey) {
					this.parsedDocument.addMessage('Expected key.', { token: this.currentToken });
					return;
				}
				break;
			}
		}

		const delimiter = options?.delimiter || ':';
		const hasKey = this.isDelimiter(delimiter);
		if (!options?.optionalKey && !hasKey) {
			this.parsedDocument.addMessage(`Expected '${delimiter} (${key})'.`, { token: this.currentToken });
			return { value: undefined, token: token };
		}

		if (hasKey) {
			this.advanceToken();
			token = this.token();
		}

		let value: any = undefined;

		switch (token.type) {
			case TokenType.String:
			case TokenType.Number:
			case TokenType.Identifier: {
				const nodeValue = token.type !== TokenType.Number
					? token.value
					: Number(token.value);
				if (hasKey) {
					this.advanceToken();
				}
				value = { value: nodeValue, token: token };
				break;
			}
			case TokenType.Delimiter: {
				switch (token.value) {
					case '[':
						value = this.expectArrayObject();
						break;
					case '{':
						value = this.expectNodeObject(token);
						break;
					default:
						this.parsedDocument.addMessage(`Expected value but found a delimiter. ${token.value}`, { token: this.currentToken });
						break;
				}
				break;
			}
			default: {
				this.parsedDocument.addMessage(`Expected value. ${token.type}`, { token: this.currentToken });
				break;
			}
		}

		return { key, ...value };
	}

	expectValue(): Node {
		const token = this.token();
		let value = undefined;
		switch (token.type) {
			case TokenType.String:
			case TokenType.Number:
			case TokenType.Identifier: {
				value = { token };
				this.advanceToken();
				break;
			}
			case TokenType.Delimiter: {
				switch (token.value) {
					case '[':
						value = this.expectArrayObject();
						break;
					case '{':
						value = this.expectNodeObject(token);
						break;
					default:
						break;
				}
				break;
			}
			default: {
				this.parsedDocument.addMessage('Expected value.', { token: this.currentToken });
				break;
			}
		}
		return value;
	}

	expectArrayObject(): Node {
		if (!this.isDelimiter('[')) {
			this.parsedDocument.addMessage("Expected '['.", { token: this.currentToken });
			return;
		}

		const token = this.token();
		const value = [];

		do {
			this.advanceToken();
			if (this.isDelimiter(']')) {
				break;
			}
			value.push(this.expectValue());
		} while (this.isDelimiter(','));

		if (!this.isDelimiter(']')) {
			this.parsedDocument.addMessage("Expected ']'.", { token: this.currentToken });
		}
		this.advanceToken();

		return { value, token };
	}

	expectNodeObject(afterToken: Token): Node {
		if (!this.isDelimiter('{')) {
			this.parsedDocument.addMessage(`Expected '{'. ${this.token().type}`, { token: afterToken, after: Boolean(afterToken)});
			return;
		}

		const token = this.token();
		const value = {};

		do {
			this.advanceToken();
			if (this.isDelimiter('}')) {
				break;
			}
			const pair = this.expectKeyValuePair();
			if (pair && pair.key) {
				if (value[pair.key.value]) {
					this.parsedDocument.addMessage(`Key '${pair.key.value}' is already defined.`, { token: pair.key.token });
					value[`${pair.key.value}${Object.keys(value).length}`] = pair;
				} else {
					value[pair.key.value] = pair;
				}
			}
		} while (this.isDelimiter(','));

		if (!this.isDelimiter('}')) {
			this.parsedDocument.addMessage("Expected '}'.", { token: this.currentToken });
		}
		this.advanceToken();

		return { value, token };
	}

	expectIdentifier(): Token {
		const identifierToken = this.currentToken.type === TokenType.Identifier
			? this.currentToken
			: undefined;
		if (identifierToken) {
			this.advanceToken();
		}
		return identifierToken;
	}
}
