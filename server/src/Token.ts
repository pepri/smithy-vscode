import { Position } from './Position';
import { TokenType } from './TokenType';

export class Token {
	type: TokenType;
	range: {
		start: Position;
		end: Position;
	};
	text: string;
	value: string;
}
