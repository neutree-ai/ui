import type { Metadata } from "./basic-types";

export type UserProfileSpec = {
	email: string;
};

export type UserProfile = {
	id: string;
	api_version: "v1";
	kind: "UserProfile";
	metadata: Metadata;
	spec: UserProfileSpec;
};
