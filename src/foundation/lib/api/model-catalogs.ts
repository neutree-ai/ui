import { clientPostgrest, REST_URL } from "@/foundation/lib/api";

export type ModelCatalogImportItem = {
  index: number;
  name?: string;
  ok: boolean;
  error?: string;
  id?: number;
  skipped?: boolean;
};

type ModelCatalogImportResponse = {
  items: ModelCatalogImportItem[];
};

type ModelCatalogImportRequest = {
  yaml?: string;
  url?: string;
  workspace?: string;
};

export async function importModelCatalogs(
  payload: ModelCatalogImportRequest,
): Promise<ModelCatalogImportResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const auth = clientPostgrest.headers.Authorization;
  if (typeof auth === "string" && auth) {
    headers.Authorization = auth;
  }

  const res = await fetch(`${REST_URL}/model_catalogs/import`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error ?? "";
    } catch {
      // ignore
    }
    throw new Error(`import failed: ${res.status} ${detail || res.statusText}`);
  }

  return (await res.json()) as ModelCatalogImportResponse;
}
