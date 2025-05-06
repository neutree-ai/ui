export type Metadata = {
	name: string;
	workspace: string | null;
	deletion_timestamp: string | null;
	creation_timestamp: string;
	update_timestamp: string;
	labels: Record<string, string>;
};
