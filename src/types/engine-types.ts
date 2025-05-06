import type { Metadata } from "./basic-types";

export type Engine = {
	id: number;
	api_version: "v1";
	kind: "Engine";
	metadata: Metadata;
	spec: EngineSpec;
	status: EngineStatus | null;
};

export type EngineSpec = {
	versions: EngineVersion[];
	supported_tasks: string[];
};

export type EngineVersion = {
	version: string;
	values_schema: Record<string, string | number | boolean>;
};

export type EngineStatus = {
	phase: EnginePhase | null;
	last_transition_time: string | null;
	error_message: string | null;
};

export enum EnginePhase {
	PENDING = "Pending",
	CREATED = "Created",
	FAILED = "Failed",
	DELETED = "Deleted",
}
