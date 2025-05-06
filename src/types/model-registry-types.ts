import type { Metadata } from "./basic-types";

export type ModelRegistry = {
	id: number;
	api_version: "v1";
	kind: "ModelRegistry";
	metadata: Metadata;
	spec: ModelRegistrySpec;
	status: ModelRegistryStatus | null;
};

export type ModelRegistrySpec = {
	type: string; // 'bentoml' | 'hugging-face';
	// for now, local only support 'file:///home/aippp/models'
	url: string; // 'file://path/to/model' | 'https://huggingface.co' | 'nfs://path/to/model';
	credentials: string;
};

export type ModelRegistryStatus = {
	phase: ModelRegistryPhase | null;
	last_transition_time: string | null;
	error_message: string | null;
};

export enum ModelRegistryPhase {
	PENDING = "Pending",
	CONNECTED = "Connected",
	FAILED = "Failed",
	DELETED = "Deleted",
}
