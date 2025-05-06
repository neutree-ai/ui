import type { Metadata } from "./basic-types";

export type ApiKey = {
	id: string;
	api_version: "v1";
	kind: "ApiKey";
	metadata: Metadata;
	spec: ApiKeySpec;
	status: ApiKeyStatus | null;
};

export type ApiKeySpec = {
	quota: number;
};

export type ApiKeyStatus = {
	phase: ApiKeyPhase | null;
	last_transition_time: string | null;
	error_message: string | null;
	sk_value: string | null;
	usage: number | null;
	last_used_at: string | null;
	last_sync_at: string | null;
};

export enum ApiKeyPhase {
	PENDING = "Pending",
	CREATED = "Created",
	DELETED = "Deleted",
}
