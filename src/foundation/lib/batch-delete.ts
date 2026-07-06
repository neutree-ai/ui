// Batch delete threads each selected row's OWN metadata into its delete call.
//
// Neutree resources are keyed by `metadata->name` AND (for workspaced resources)
// `metadata->workspace`; the data provider's soft-delete first re-reads the
// record by that composite key before stamping `deletion_timestamp`. A batch
// delete therefore cannot share a single `meta` across rows: each row may live
// in a different workspace. Passing only the names (and dropping the workspace)
// makes the re-read match zero rows, and the provider then dereferences an
// undefined record -> "Cannot read properties of undefined (reading 'metadata')".
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
