export class Identifier {
	namespace: string;
	name: string;
	member: string;

	constructor(value: string) {
		const namespaceIndex = value.indexOf('#');
		const memberIndex = value.indexOf('$', namespaceIndex + 1);

		this.namespace = namespaceIndex !== -1 ? value.substr(0, namespaceIndex) : undefined;
		this.name = value.substring(namespaceIndex + 1, memberIndex !== -1 ? memberIndex : value.length);
		this.member = memberIndex !== -1 ? value.substr(memberIndex + 1) : undefined;
	}

	toRelative() {
		return this.member
			? `${this.name}$${this.member}`
			: this.name;
	}

	forMember(memberName: string): Identifier {
		return new Identifier(`${this.namespace ? this.namespace + '#' : ''}${this.name}$${memberName}`);
	}
}
