/// Service types have specific semantics and define services, resources, and operations.
export enum ServiceShapes {
	/// Entry point of an API that aggregates resources and operations together.
	Service = 'service',
	/// Represents the input, output, and errors of an API operation.
	Operation = 'operation',
	/// Entity with an identity that has a set of operations.
	Resource = 'resource',
}

/// Simple types are types that do not contain nested types or shape references.
export enum SimpleShapes {
	/// Uninterpreted binary data.
	Blob = 'blob',
	/// Boolean value type.
	Boolean = 'boolean',
	/// UTF-8 encoded string.
	String = 'string',
	/// 8-bit signed integer ranging from -128 to 127 (inclusive).
	Byte = 'byte',
	/// 16-bit signed integer ranging from -32,768 to 32,767 (inclusive).
	Short = 'short',
	/// 32-bit signed integer ranging from -2^31 to (2^31)-1 (inclusive).
	Integer = 'integer',
	/// 64-bit signed integer ranging from -2^63 to (2^63)-1 (inclusive).
	Long = 'long',
	/// Single precision IEEE-754 floating point number.
	Float = 'float',
	/// Double precision IEEE-754 floating point number.
	Double = 'double',
	/// Arbitrarily large signed integer.
	BigInteger = 'bigInteger',
	/// Arbitrary precision signed decimal number.
	BigDecimal = 'bigDecimal',
	/// Represents an instant in time with no UTC offset or timezone.
	/// The serialization of a timestamp is an implementation detail that is determinedby a protocol
	/// and MUST NOT have any effect on the types exposed by tooling to represent a timestamp value.
	Timestamp = 'timestamp',
	/// Represents protocol-agnostic open content that functions as a kind of "any" type.
	/// Document types are represented by a JSON-like data model and can contain UTF-8 strings,
	/// arbitrary precision numbers, booleans, nulls, a list of these values, and a map of UTF-8 strings
	/// to these values. Open content is useful for modeling unstructured data that has no schema, data
	/// that can't be modeled using rigid types, or data that has a schema that evolves outside of the purview
	/// of a model. The serialization format of a document is an implementation detail of a protocol
	/// and MUST NOT have any effect on the types exposed by tooling to represent a document value.
	Document = 'document',
}

/// Aggregate types define shapes that are composed of other shapes.
/// Aggregate shapes reference other shapes using members.
export enum AggregateShapes {
	/// Defined in aggregate shapes to reference other shapes.
	Member = 'member',
	/// Ordered collection of homogeneous values.
	List = 'list',
	/// Unordered collection of unique homogeneous values.
	Set = 'set',
	/// Map data structure that maps string keys to homogeneous values.
	Map = 'map',
	/// Fixed set of named heterogeneous members.
	Structure = 'structure',
	/// Tagged union data structure that can take on one of several different, but fixed, types.
	Union = 'union',
}

export const Traits = {
	// Constraint traits
	enum: {},
	idRef: {},
	length: {},
	pattern: {},
	private: {},
	range: {},
	required: {},
	uniqueItems: {},
	// Documentation traits
	deprecated: {
		summary: 'Marks a shape or member as deprecated.',
		selector: '*',
		structure: {
			message: {
				type: SimpleShapes.String,
				description: 'Provides a plain text message for a deprecated shape or member.',
			},
			since: {
				type: SimpleShapes.String,
				description: 'Provides a plain text date or version for when a shape or member was deprecated.',
			},
		},
	},
	documentation: {
		summary: 'Adds documentation to a shape or member using the CommonMark format.',
		selector: '*',
		string: {},
	},
	examples: {
		summary: 'Provides example inputs and outputs for operations.',
		selector: 'operation',
		list: {
			title: {
				type: SimpleShapes.String,
				required: true,
				description: 'A short title that defines the example.',
			},
			documentation: {
				type: SimpleShapes.String,
				description: 'A longer description of the example in the CommonMark format.',
			},
			input: {
				type: SimpleShapes.Document,
				description: 'Provides example input parameters for the operation. Each key is the name of a top-level input structure member, and each value is the value of the member.',
			},
			output: {
				type: SimpleShapes.Document,
				description: 'Provides example output parameters for the operation. Each key is the name of a top-level output structure member, and each value is the value of the member.',
			},
		},
	},
	externalDocumentation: {
		summary: 'Provides named links to external documentation for a shape.',
		selector: '*',
		map: {
			key: 'Name.',
			value: 'Valid URL',
		},
	},
	internal: {
		summary: 'Shapes marked with the internal trait are meant only for internal use. Tooling can use the internal trait to filter out shapes from models that are not intended for external customers.',
		selector: '*',
		annotation: true,
	},
	recommended: {
		summary: 'Indicates that a structure member SHOULD be set. This trait is useful when the majority of use cases for a structure benefit from providing a value for a member, but the member is not actually required or cannot be made required backward compatibly.',
		selector: 'structure > member',
		structure: {
			reason: {
				type: SimpleShapes.String,
				description: 'Provides a reason why the member is recommended.',
			},
		},
		conflictsWith: ['required'],
	},
	sensitive: {
		summary: 'Indicates that the data stored in the shape or member is sensitive and MUST be handled with care.',
		selector: ':not(:is(service, operation, resource))',
		annotation: true,
	},
	since: {
		summary: 'Defines the version or date in which a shape or member was added to the model.',
		selector: '*',
		string: {
			description: 'String representing the date it was added.',
		},
	},
	tags: {
		summary: 'Tags a shape with arbitrary tag names that can be used to filter and group shapes in the model.',
		selector: '*',
		array: {
			type: SimpleShapes.String,
		},
	},
	title: {
		summary: 'Defines a proper name for a service or resource shape. This title can be used in automatically generated documentation and other contexts to provide a user friendly name for services and resources.',
		selector: ':is(service, resource)',
		string: {},
	},
	unstable: {
		summary: 'Indicates a shape is unstable and MAY change in the future. This trait can be applied to trait shapes to indicate that a trait is unstable or experimental. If possible, code generators SHOULD use this trait to warn when code generated from unstable features are used.',
		selector: '*',
		annotation: true,
	},
	// Type refinement traits
	box: {},
	error: {},
	sparse: {},
	// Protocol traits
	protocolDefinition: {},
	jsonName: {},
	mediaType: {},
	timestampFormat: {},
	// Authentication traits
	authDefinition: {},
	httpBasicAuth: {},
	httpDigestAuth: {},
	httpBearerAuth: {},
	httpApiKeyAuth: {},
	optionalAuth: {},
	auth: {},
	// Behavior traits
	idempotencyToken: {},
	idempotent: {},
	readonly: {},
	retryable: {},
	paginated: {},
	httpChecksumRequired: {},
	// Resource traits
	noReplace: {},
	references: {},
	resourceIdentifier: {},
	// Streaming traits
	streaming: {},
	requiresLength: {},
	eventHeader: {},
	eventPayload: {},
	// HTTP binding traits
	http: {},
	httpError: {},
	httpHeader: {},
	httpLabel: {},
	httpPayload: {},
	httpPrefixHeaders: {},
	httpQuery: {},
	httpQueryParams: {},
	httpResponseCode: {},
	cors: {},
	// XML binding traits
	xmlAttribute: {},
	xmlFlattened: {},
	xmlName: {},
	xmlNamespace: {},
	// Endpoint traits
	endpoint: {},
	hostLabel: {},
	// Model validation
	suppress: {},
};

export type Schema =
	MemberSchema |
	StructureSchema |
	ListSchema |
	MapSchema;

export interface BaseSchema {
	type: string;
	required?: boolean;
	description?: string;
}

export interface MemberSchema extends BaseSchema {
	type: 'identifier' | AggregateShapes.Member | SimpleShapes;
	description?: string;
}

export interface StructureSchema extends BaseSchema {
	type: AggregateShapes.Structure;
	structure?: { [fieldName: string]: Schema };
	anyMember?: Schema;
}

export interface ListSchema extends BaseSchema {
	type: AggregateShapes.List;
	member: Schema;
}

export interface MapSchema extends BaseSchema {
	type: AggregateShapes.Map;
	key: Schema;
	value: Schema;
}

export const Schema: { [name: string]: Schema } = {
	[AggregateShapes.Member]: {
		type: AggregateShapes.Member,
		description: 'Defined in aggregate shapes to reference other shapes.',
		// A member MUST NOT target a trait, operation, resource, service, or member.
	},
	[AggregateShapes.List]: {
		type: AggregateShapes.Structure,
		description: 'Ordered collection of homogeneous values.',
		structure: {
			member: {
				type: AggregateShapes.Member,
			},
		},
	},
	[AggregateShapes.Set]: {
		type: AggregateShapes.Structure,
		description: 'Unordered collection of unique homogeneous values.',
		structure: {
			member: {
				type: AggregateShapes.Member,
			},
		},
	},
	[AggregateShapes.Map]: {
		type: AggregateShapes.Structure,
		description: 'Map data structure that maps string keys to homogeneous values.',
		structure: {
			key: {
				type: AggregateShapes.Member,
			},
			value: {
				type: AggregateShapes.Member,
			},
		},
	},
	[AggregateShapes.Structure]: {
		type: AggregateShapes.Structure,
		description: 'Fixed set of named heterogeneous members.',
		anyMember: {
			type: AggregateShapes.Member,
		},
	},
	[AggregateShapes.Union]: {
		type: AggregateShapes.Structure,
		description: 'Tagged union data structure that can take on one of several different, but fixed, types.',
		anyMember: {
			type: AggregateShapes.Member,
		},
	},
	[ServiceShapes.Service]: {
		type: AggregateShapes.Structure,
		description: 'Entry point of an API that aggregates resources and operations together.',
		structure: {
			version: {
				type: SimpleShapes.String,
				required: true,
				description: 'Defines the version of the service. The version can be provided in any format (e.g., 2017-02-11, 2.0, etc).',
			},
			operations: {
				type: AggregateShapes.List,
				description: 'Binds a set of operation shapes to the service. Each element in the given list MUST be a valid shape ID that targets an operation shape.',
				member: {
					type: AggregateShapes.Member,
				},
			},
			resources: {
				type: AggregateShapes.List,
				description: 'Binds a set of operation shapes to the service. Each element in the given list MUST be a valid shape ID that targets an operation shape.',
				member: {
					type: AggregateShapes.Member,
				},
			},
			rename: {
				type: AggregateShapes.Map,
				description: 'Disambiguates shape name conflicts in the service closure. Map keys are shape IDs contained in the service, and map values are the disambiguated shape names to use in the context of the service. Each given shape ID MUST reference a shape contained in the closure of the service. Each given map value MUST match the identifier production used for shape IDs. Renaming a shape does not give the shape a new shape ID.',
				key: {
					type: SimpleShapes.String,
				},
				value: {
					type: SimpleShapes.String,
				},
			},
		},
	},
	[ServiceShapes.Operation]: {
		type: AggregateShapes.Structure,
		description: 'Represents the input, output, and errors of an API operation.',
		structure: {
			input: {
				type: AggregateShapes.Member,
				description: 'The optional input structure of the operation. The value MUST be a valid shape ID that targets a structure shape. The targeted shape MUST NOT be marked with the error trait.',
			},
			output: {
				type: AggregateShapes.Member,
				description: 'The optional output structure of the operation. The value MUST be a valid shape ID that targets a structure shape. The targeted shape MUST NOT be marked with the error trait.',
			},
			errors: {
				type: AggregateShapes.List,
				description: 'Defines the error structures that an operation can return using a set of shape IDs that MUST target structure shapes that are marked with the error trait.',
				member: {
					type: AggregateShapes.Member,
				},
			},
		},
	},
	[ServiceShapes.Resource]: {
		type: AggregateShapes.Structure,
		description: 'Entity with an identity that has a set of operations.',
		structure: {
			identifiers: {
				type: AggregateShapes.Map,
				description: 'Defines a map of identifier string names to Shape IDs used to identify the resource. Each shape ID MUST target a string shape.',
				key: {
					type: 'identifier',
				},
				value: {
					type: AggregateShapes.Member,
				},
			},
			create: {
				type: AggregateShapes.Member,
				description: 'Defines the lifecycle operation used to create a resource using one or more identifiers created by the service. The value MUST be a valid Shape ID that targets an operation shape.',
			},
			put: {
				type: AggregateShapes.Member,
				description: 'Defines an idempotent lifecycle operation used to create a resource using identifiers provided by the client. The value MUST be a valid Shape ID that targets an operation shape.',
			},
			read: {
				type: AggregateShapes.Member,
				description: 'Defines the lifecycle operation used to retrieve the resource. The value MUST be a valid Shape ID that targets an operation shape.',
			},
			update: {
				type: AggregateShapes.Member,
				description: 'Defines the lifecycle operation used to update the resource. The value MUST be a valid Shape ID that targets an operation shape.',
			},
			delete: {
				type: AggregateShapes.Member,
				description: 'Defines the lifecycle operation used to delete the resource. The value MUST be a valid Shape ID that targets an operation shape.',
			},
			list: {
				type: AggregateShapes.Member,
				description: 'Defines the lifecycle operation used to list resources of this type. The value MUST be a valid Shape ID that targets an operation shape.',
			},
			operations: {
				type: AggregateShapes.List,
				description: 'Binds a list of non-lifecycle instance operations to the resource. Each value in the list MUST be a valid Shape ID that targets an operation shape.',
				member: {
					type: AggregateShapes.Member,
				},
			},
			collectionOperations: {
				type: AggregateShapes.List,
				description: 'Binds a list of non-lifecycle collection operations to the resource. Each value in the list MUST be a valid Shape ID that targets an operation shape.',
				member: {
					type: AggregateShapes.Member,
				},
			},
			resources: {
				type: AggregateShapes.List,
				description: 'Binds a list of resources to this resource as a child resource, forming a containment relationship. Each value in the list MUST be a valid Shape ID that targets a resource. The resources MUST NOT have a cyclical containment hierarchy, and a resource can not be bound more than once in the entire closure of a resource or service.',
				member: {
					type: AggregateShapes.Member,
				},
			},
		},
	},
};

/// All Smithy models automatically include a prelude.
/// The prelude defines various simple shapes and every trait defined in the core specification.
/// When using the IDL, shapes defined in the prelude can be referenced from within any namespace
/// using a relative shape ID.
export const Prelude = {
	version: '1.0',
	namespace: 'smithy.api',
	shapes: {
		String: { type: SimpleShapes.String },
		Blob: { type: SimpleShapes.Blob },
		BigInteger: { type: SimpleShapes.BigInteger },
		BigDecimal: { type: SimpleShapes.BigDecimal },
		Timestamp: { type: SimpleShapes.Timestamp },
		Document: { type: SimpleShapes.Document },
		Boolean: { type: SimpleShapes.Boolean, trait: Traits.box },
		PrimitiveBoolean: { type: SimpleShapes.Boolean },
		Byte: { type: SimpleShapes.Byte, trait: Traits.box },
		PrimitiveByte: { type: SimpleShapes.Byte },
		Short: { type: SimpleShapes.Short, trait: Traits.box },
		PrimitiveShort: { type: SimpleShapes.Short },
		Integer: { type: SimpleShapes.Integer, trait: Traits.box },
		PrimitiveInteger: { type: SimpleShapes.Integer },
		Long: { type: SimpleShapes.Long, trait: Traits.box },
		PrimitiveLong: { type: SimpleShapes.Long },
		Float: { type: SimpleShapes.Float, trait: Traits.box },
		PrimitiveFloat: { type: SimpleShapes.Float },
		Double: { type: SimpleShapes.Double, trait: Traits.box },
		PrimitiveDouble: { type: SimpleShapes.Double },
	},
};
