// Batch delete threads each selected row's OWN metadata into its delete call.
//
// Neutree resources are keyed by `metadata->name` AND (for workspaced
// resources) `metadata->workspace`; display names may repeat.
//
// This builds one delete variable object per row, carrying that row's full
// metadata (so `workspace` reaches the provider), merging the force-delete flag,
// and suppressing the per-row success toast so the caller can emit a single
// summary notification instead of N of them.

type RowMetadata = {
  name?: string;
  workspace?: string;
} & Record<string, unknown>;

export type BatchDeleteRow = {
  original: { metadata?: RowMetadata };
};

type BatchDeleteVariable = {
  resource: string;
  id: string;
  meta: Record<string, unknown>;
  successNotification: false;
};

export function buildBatchDeleteVariables(
  rows: BatchDeleteRow[],
  resource: string,
  forceDelete: boolean,
): BatchDeleteVariable[] {
  return rows
    .map((row) => row.original.metadata ?? {})
    .filter(
      (metadata): metadata is RowMetadata & { name: string } =>
        typeof metadata.name === "string" && metadata.name.length > 0,
    )
    .map((metadata) => ({
      resource,
      id: metadata.name,
      meta: forceDelete ? { ...metadata, forceDelete: true } : { ...metadata },
      successNotification: false,
    }));
}
