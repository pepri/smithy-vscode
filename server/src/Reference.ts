import { Identifier } from './Identifier';
import { ReferenceType } from './ReferenceType';
import { Token } from './Token';

export class Reference {
	token: Token;
	type: ReferenceType;
	identifier: Identifier;
}
