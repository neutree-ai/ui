import type { Metadata } from "./basic-types";

export type ImageRegistry = {
	id: number;
	api_version: "v1";
	kind: "ImageRegistry";
	metadata: Metadata;
	spec: ImageRegistrySpec;
	status: ImageRegistryStatus | null;
};

export type ImageRegistrySpec = {
	url: string;
	repository: string;
	authconfig: {
		username?: string;
		password?: string;
		auth?: string;
	};
	ca: string;
};

export type ImageRegistryStatus = {
	phase: ImageRegistryPhase | null;
	last_transition_time: string | null;
	error_message: string | null;
};

export enum ImageRegistryPhase {
	PENDING = "Pending",
	CONNECTED = "Connected",
	FAILED = "Failed",
	DELETED = "Deleted",
}
