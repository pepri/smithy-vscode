import { MessageType } from './MessageType';

export class Message {
	type: MessageType;
	startIndex: number;
	endIndex: number;
	text: string;
}
