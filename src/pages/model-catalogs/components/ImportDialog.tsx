import { useCreate, useDataProvider, useUpdate } from "@refinedev/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Link as LinkIcon, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type CatalogImportAction,
  type CatalogImportCandidate,
  runCatalogImport,
} from "@/domains/model-catalog/lib/catalog-import";
import { ALL_WORKSPACES, useWorkspace } from "@/foundation/hooks/use-workspace";
import {
  getErrorMessage,
  isDuplicateNameError,
} from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  isValidYamlResource,
  parseYamlDocuments,
  transformResourceForImport,
} from "@/foundation/lib/yaml-transform";
import type { RecipeVariant } from "@/foundation/recipe/types";

type Source = "yaml" | "url" | "file";

// Per-document result of a client-side import, shown in the results table.
type ModelCatalogImportItem = {
  index: number;
  name?: string;
  ok: boolean;
  // How the document landed. Absent on documents that never got written.
  action?: CatalogImportAction;
  error?: string;
};

// Every catalog write is addressed by (workspace, name) rather than row id,
// which is what makes re-importing the same document land on the same catalog.
const catalogMeta = (workspace: string) => ({
  idColumnName: "metadata->name",
  workspace,
  workspaced: true,
});

// Thrown when the user declines the type-change confirmation. Nothing has been
// written at that point, so the whole import stops rather than applying a batch
// the user did not agree to.
class ImportCancelled extends Error {}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImportDialog = ({ open, onOpenChange }: ImportDialogProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { current: currentWorkspace } = useWorkspace();
  const defaultWorkspace =
    currentWorkspace && currentWorkspace !== ALL_WORKSPACES
      ? currentWorkspace
      : "";

  const [source, setSource] = useState<Source>("yaml");
  const [yamlText, setYamlText] = useState("");
  const [url, setUrl] = useState("");
  const [workspace, setWorkspace] = useState(defaultWorkspace);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<ModelCatalogImportItem[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: createResource } = useCreate();
  const { mutateAsync: updateResource } = useUpdate();
  const dataProvider = useDataProvider();

  // Names whose import would flip Recipe <-> plain catalog, plus the resolver
  // that unblocks the in-flight import once the user answers. Held in a ref
  // because the mutation awaits it from outside React's render cycle.
  const [typeChangeNames, setTypeChangeNames] = useState<string[] | null>(null);
  const confirmResolverRef = useRef<((confirmed: boolean) => void) | null>(
    null,
  );

  const answerTypeChange = useCallback((confirmed: boolean) => {
    setTypeChangeNames(null);
    confirmResolverRef.current?.(confirmed);
    confirmResolverRef.current = null;
  }, []);

  const describeError = useCallback(
    (err: unknown, name: string): string => {
      if (isDuplicateNameError(err)) {
        return t(
          "model_catalogs.import.createdConcurrently",
          'A model catalog named "{{name}}" was created while this import was running. Import again to update it.',
          { name },
        );
      }

      return getErrorMessage(err, t("common.errors.unknown"));
    },
    [t],
  );

  const reset = useCallback(() => {
    setYamlText("");
    setUrl("");
    setFileName("");
    setResults(null);
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) {
      // Reset after close animation so users see "succeeded" briefly
      setTimeout(reset, 200);
    }
    onOpenChange(next);
  };

  const mutation = useMutation({
    mutationFn: async (): Promise<ModelCatalogImportItem[]> => {
      // Resolve the raw YAML text. URL imports are fetched in the browser (the
      // URL must be CORS-accessible) — there is no server-side fetch.
      let content = yamlText;
      if (source === "url") {
        let normalizedUrl = url.trim();
        if (
          !normalizedUrl.startsWith("http://") &&
          !normalizedUrl.startsWith("https://")
        ) {
          normalizedUrl = `https://${normalizedUrl}`;
        }
        const res = await fetch(normalizedUrl, {
          method: "GET",
          headers: { Accept: "application/x-yaml, text/yaml, text/plain, */*" },
        });
        if (!res.ok) {
          throw new Error(
            t(
              "model_catalogs.import.fetchFailed",
              "Failed to fetch URL: {{status}} {{statusText}}",
              { status: res.status, statusText: res.statusText },
            ),
          );
        }
        content = await res.text();
      }

      const docs = parseYamlDocuments(content);
      if (docs.length === 0) {
        throw new Error(
          t(
            "model_catalogs.import.noDocuments",
            "No model catalog documents found in the input.",
          ),
        );
      }

      // Classify here, write in runCatalogImport. Writes go through the normal,
      // RLS-scoped create / update flow — the path the recipe validation
      // middleware guards.
      const items: ModelCatalogImportItem[] = [];
      const candidates: CatalogImportCandidate[] = [];

      docs.forEach((doc, index) => {
        const name = doc.metadata?.name;

        if (doc.kind && doc.kind !== "ModelCatalog") {
          items.push({
            index,
            name,
            ok: false,
            error: t(
              "model_catalogs.wrongKind",
              'Expected kind ModelCatalog, got "{{kind}}"',
              { kind: doc.kind },
            ),
          });
          return;
        }

        if (!isValidYamlResource(doc) || !name) {
          items.push({
            index,
            name,
            ok: false,
            error: t(
              "model_catalogs.import.invalidResource",
              "Missing apiVersion, kind, or metadata.name.",
            ),
          });
          return;
        }

        const values = transformResourceForImport(
          doc,
          workspace || defaultWorkspace,
        );

        candidates.push({
          index,
          name,
          workspace: (values.metadata as { workspace: string }).workspace,
          values,
          spec: doc.spec,
        });
      });

      const run = await runCatalogImport(candidates, {
        readExisting: async (name, docWorkspace) => {
          // getOne resolves with no data for a name that does not exist, so
          // only a genuine transport / permission failure propagates.
          const found = await dataProvider().getOne<{
            metadata?: Record<string, unknown> | null;
            spec?: { variants?: Record<string, RecipeVariant> | null } | null;
          }>({
            resource: "model_catalogs",
            id: name,
            meta: catalogMeta(docWorkspace),
          });
          return found.data ?? null;
        },
        write: ({ action, name, workspace: docWorkspace, values }) =>
          action === "create"
            ? createResource({
                resource: "model_catalogs",
                values,
                meta: catalogMeta(docWorkspace),
                successNotification: false,
                errorNotification: false,
              })
            : updateResource({
                resource: "model_catalogs",
                id: name,
                values,
                mutationMode: "pessimistic",
                meta: catalogMeta(docWorkspace),
                successNotification: false,
                errorNotification: false,
              }),
        confirmTypeChange: (names) =>
          new Promise<boolean>((resolve) => {
            confirmResolverRef.current = resolve;
            setTypeChangeNames(names);
          }),
      });

      if (run.cancelled) throw new ImportCancelled();

      for (const outcome of run.outcomes) {
        items.push(
          outcome.status === "ok"
            ? {
                index: outcome.index,
                name: outcome.name,
                ok: true,
                action: outcome.action,
              }
            : {
                index: outcome.index,
                name: outcome.name,
                ok: false,
                error: describeError(outcome.error, outcome.name),
              },
        );
      }

      items.sort((a, b) => a.index - b.index);

      return items;
    },
    onSuccess: (items) => {
      setResults(items);
      const ok = items.filter((r) => r.ok).length;
      const failed = items.length - ok;
      const updated = items.filter((r) => r.ok && r.action !== "create").length;
      if (failed === 0) {
        toast.success(
          updated > 0
            ? t(
                "model_catalogs.import.successAllWithUpdates",
                "Imported {{count}} catalogs ({{updated}} updated)",
                { count: ok, updated },
              )
            : t(
                "model_catalogs.import.successAll",
                "Imported {{count}} catalogs",
                { count: ok },
              ),
        );
      } else if (ok === 0) {
        toast.error(
          t("model_catalogs.import.failedAll", "All {{count}} imports failed", {
            count: failed,
          }),
        );
      } else {
        toast.warning(
          t(
            "model_catalogs.import.partial",
            "{{ok}} imported, {{failed}} failed",
            { ok, failed },
          ),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["model_catalogs"] });
      // Refine's resource cache key shape
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey.some((k) => k === "model_catalogs"),
      });
    },
    onError: (err: Error) => {
      if (err instanceof ImportCancelled) {
        toast.info(
          t(
            "model_catalogs.import.cancelled",
            "Import cancelled — nothing was changed.",
          ),
        );
        return;
      }
      toast.error(err.message);
    },
  });

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setYamlText(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  };

  const submitDisabled =
    mutation.isLoading || (source === "url" ? !url.trim() : !yamlText.trim());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("model_catalogs.import.title", "Import model catalogs")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "model_catalogs.import.description",
              "Paste a recipe YAML, upload a file, or fetch from a URL. Multiple documents (separated by ---) are supported. A catalog that already exists in the same workspace is updated.",
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="yaml">
              <FileText className="size-4 mr-1.5" />
              {t("model_catalogs.import.tabYaml", "Paste YAML")}
            </TabsTrigger>
            <TabsTrigger value="file">
              <Download className="size-4 mr-1.5 rotate-180" />
              {t("model_catalogs.import.tabFile", "Upload file")}
            </TabsTrigger>
            <TabsTrigger value="url">
              <LinkIcon className="size-4 mr-1.5" />
              {t("model_catalogs.import.tabUrl", "From URL")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="yaml" className="mt-3">
            <Textarea
              className="font-mono text-xs h-64"
              placeholder={`apiVersion: v1
kind: ModelCatalog
metadata:
  name: my-recipe
spec:
  model:
    registry: huggingface
    name: ...`}
              value={yamlText}
              onChange={(e) => setYamlText(e.target.value)}
            />
          </TabsContent>

          <TabsContent value="file" className="mt-3 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml,text/yaml,application/x-yaml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Button
              variant="outline"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              {t("model_catalogs.import.chooseFile", "Choose file")}
            </Button>
            {fileName && (
              <div className="text-sm text-muted-foreground">{fileName}</div>
            )}
            {yamlText && (
              <Textarea
                className="font-mono text-xs h-44 mt-2"
                value={yamlText}
                readOnly
              />
            )}
          </TabsContent>

          <TabsContent value="url" className="mt-3">
            <Input
              placeholder="https://example.com/recipe.yaml"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {t(
                "model_catalogs.import.urlHint",
                "Fetched in your browser — the URL must allow cross-origin (CORS) access. Use a raw YAML link.",
              )}
            </p>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="import-workspace" className="text-xs">
              {t("model_catalogs.import.workspaceLabel", "Default workspace")}
            </Label>
            <Input
              id="import-workspace"
              placeholder={t(
                "model_catalogs.import.workspacePlaceholder",
                "Used when the YAML has no metadata.workspace",
              )}
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
            />
          </div>
        </div>

        {results && (
          <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left">#</th>
                  <th className="px-2 py-1 text-left">
                    {t("common.fields.name", "Name")}
                  </th>
                  <th className="px-2 py-1 text-left">
                    {t("common.fields.status", "Status")}
                  </th>
                  <th className="px-2 py-1 text-left">
                    {t("model_catalogs.import.detail", "Detail")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.index} className="border-t">
                    <td className="px-2 py-1 font-mono">{r.index + 1}</td>
                    <td className="px-2 py-1">{r.name || "-"}</td>
                    <td className="px-2 py-1">
                      <span
                        className={
                          r.ok
                            ? "text-green-600 dark:text-green-400"
                            : "text-destructive"
                        }
                      >
                        {r.ok ? "OK" : "FAIL"}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">
                      {r.error ||
                        (r.ok
                          ? r.action === "create"
                            ? t("model_catalogs.import.created", "Created")
                            : t("model_catalogs.import.updated", "Updated")
                          : "-")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {t("buttons.cancel", "Cancel")}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={submitDisabled}>
            {mutation.isLoading && (
              <Loader2 className="size-4 mr-1.5 animate-spin" />
            )}
            {t("model_catalogs.import.submit", "Import")}
          </Button>
        </DialogFooter>

        {/* Rendered as an overlay inside this dialog rather than as a second
            modal: stacking two Radix modals fights over the focus trap, and the
            question belongs to the import that is already in flight. */}
        {typeChangeNames && (
          <div className="absolute inset-0 z-10 flex flex-col gap-4 rounded-lg bg-background p-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">
                {t(
                  "model_catalogs.import.typeChangeTitle",
                  "This import changes the catalog type",
                )}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("model_catalogs.import.typeChangeDescription", {
                  names: typeChangeNames.join(", "),
                  defaultValue:
                    "{{names}} would switch between a recipe template and a plain catalog. Overwriting replaces the stored spec, including its variants and features. Nothing has been written yet.",
                })}
              </p>
            </div>
            <div className="mt-auto flex justify-end gap-2">
              <Button variant="outline" onClick={() => answerTypeChange(false)}>
                {t("buttons.cancel", "Cancel")}
              </Button>
              <Button onClick={() => answerTypeChange(true)}>
                {t("model_catalogs.import.typeChangeConfirm", "Overwrite")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
