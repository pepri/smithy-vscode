import { Position } from './Position';
import { Token } from './Token';
import { TokenType } from './TokenType';

export class Lexer {
	private static escapedCharacters = {
		'\\': '\\',
		'"': '"',
		'b': '\b',
		'f': '\f',
		'n': '\n',
		'r': '\r',
		't': '\t',
	};
	source: string;
	position: Position;

	constructor(source: string) {
		this.source = source;
		this.position = {
			index: 0,
			line: 0,
			column: 0,
		};
	}

	*getTokens(): Generator<Token> {
		while (!this.ended()) {
			while (this.char().match(/[ \t]/)) {
				if (!this.advance()) {
					return;
				}
			}

			const start = {...this.position};

			if (this.char() === '/' && this.peek() === '/') {
				this.advance();
				this.advance();
				const tokenType = this.char() === '/' ? TokenType.DocumentationComment : TokenType.Comment;
				if (tokenType === TokenType.DocumentationComment) {
					this.advance();
				}
				const value = this.skipUntil(/\n/);
				// yield this.createToken(tokenType, start, value);
				this.advance();
			} else if (this.char() === '\n' || this.char() === '\r' && this.peek() === '\n') {
				if (this.char() === '\r') {
					this.advance();
				}
				this.advance();
				// yield this.createToken(TokenType.Delimiter, start, '\n');
			} else if (this.char().match(/[(){}\[\],:=]/)) {
				const value = this.char();
				this.advance();
				yield this.createToken(TokenType.Delimiter, start, value);
			} else if (this.char() === '"') {
				const value = [];
				let done = false;

				while (!done && !this.ended()) {
					const char = this.advance();

					switch (char) {
						case '"': {
							this.advance();
							yield this.createToken(TokenType.String, start, value.join(''));
							done = true;
							break;
						}

						case '\\': {
							const escapedChar = this.advance();
							if (escapedChar === 'u') {
								let escapedValue = 0;
								for (let i = 0; i < 4; ++i) {
									const charValue = this.valueFromHexChar(this.advance());
									if (charValue === undefined) {
										// yield this.createToken(TokenType.Error, start, 'Expected unicode escape sequence.');
										break;
									}

									escapedValue = escapedValue * 16 + charValue;
								}
								value.push(String.fromCharCode(escapedValue));
							} else if (Lexer.escapedCharacters[escapedChar]) {
								value.push(Lexer.escapedCharacters[escapedChar]);
							} else {
								// yield this.createToken(TokenType.Error, start, 'Unnecessary escape character.');
								value.push(escapedChar);
							}
							break;
						}

						default: {
							value.push(char);
							break;
						}
					}
				}
				// yield this.createToken(TokenType.Error, start, 'Unexpected end of string.');
			} else if (this.char() === '-' && this.peek().match(/[0-9]/) || this.char().match(/[0-9]/)) {
				const negated = this.char() === '-';
				if (negated) {
					this.advance();
				}
				const value = this.skipWhile(/[0-9]/);
				let fraction = '';
				let exponentSign = '';
				let exponent = '';
				if (this.char() === '.' && this.peek().match(/[0-9]/)) {
					this.advance();
					fraction = this.skipWhile(/[0-9]/);
				}
				if (this.char() === 'e' && (this.peek().match(/[+\-]/) || this.peek().match(/[0-9]/))) {
					this.advance();
					if (this.char().match(/[\+\-]/)) {
						exponentSign = this.char();
						this.advance();
					}
					exponent = this.skipWhile(/[0-9]/);
				}
				const number = `${value}${fraction ? `.${fraction}` : ''}${exponent ? `e${exponentSign}${exponent}` : ''}`;
				yield this.createToken(TokenType.Number, start, number);
			} else if (this.char().match(/[a-z_.$#@]/i)) {
				const identifier = this.skipWhile(/[a-z0-9_.$#@]/i);
				yield this.createToken(TokenType.Identifier, start, identifier);
			} else {
				const value = this.char();
				this.advance();
				yield this.createToken(TokenType.Error, start, `Unknown token: ${value}, ${this.char()}`);
			}
		}
	}

	private valueFromHexChar(char: string): number {
		const code = char.charCodeAt(0);
		if (code >= '0'.charCodeAt(0) && code <= '9'.charCodeAt(0)) {
			return code - '0'.charCodeAt(0);
		}
		if (code >= 'a'.charCodeAt(0) && code <= 'f'.charCodeAt(0)) {
			return code - 'a'.charCodeAt(0);
		}
		if (code >= 'A'.charCodeAt(0) && code <= 'F'.charCodeAt(0)) {
			return code - 'A'.charCodeAt(0);
		}
		return undefined;
	}

	private ended(): boolean {
		return this.position.index >= this.source.length;
	}

	private char(): string {
		return this.source.charAt(this.position.index);
	}

	private advance(): string {
		const result = this.source.charAt(++this.position.index);
		++this.position.column;
		if (result === '\n') {
			++this.position.line;
			this.position.column = 0;
		}
		return result;
	}

	private peek(offset: number = 1, length: number = 1): string {
		return this.source.substr(this.position.index + offset, length);
	}

	private skipUntil(regExp: RegExp): string {
		const start = {...this.position};
		while (!this.char().match(regExp)) {
			this.advance();
		}
		return this.source.substring(start.index, this.position.index);
	}

	private skipWhile(regExp: RegExp): string {
		const start = {...this.position};
		while (this.char().match(regExp)) {
			this.advance();
		}
		return this.source.substring(start.index, this.position.index);
	}

	private textSince(start: Position): string {
		return this.source.substring(start.index, this.position.index);
	}

	private createToken(type: TokenType, start: Position, value?: string): Token {
		return {
			type,
			text: this.textSince(start),
			range: {
				start: {...start},
				end: {...this.position},
			},
			value,
		};
	}
}
