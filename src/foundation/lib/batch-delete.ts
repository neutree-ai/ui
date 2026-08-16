// Batch delete threads each selected row's OWN metadata into its delete call.
//
// Most Neutree resources are keyed by `metadata->name` and, for workspaced
// resources, `metadata->workspace`. API keys are the exception: names can
// repeat across Projects, so they use their UUID. The data provider's
// soft-delete first re-reads the record before stamping `deletion_timestamp`.
// A batch delete therefore cannot share a single `meta` across rows because
// each row may live in a different workspace.
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
  original: { id?: string; metadata?: RowMetadata };
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
    .map((row) => ({
      id: row.original.id,
      metadata: row.original.metadata ?? {},
    }))
    .filter(({ id, metadata }) =>
      resource === "api_keys"
        ? typeof id === "string" && id.length > 0
        : typeof metadata.name === "string" && metadata.name.length > 0,
    )
    .map(({ id, metadata }) => ({
      resource,
      id: resource === "api_keys" ? (id as string) : (metadata.name as string),
      meta: forceDelete ? { ...metadata, forceDelete: true } : { ...metadata },
      successNotification: false,
    }));
}
