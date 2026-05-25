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
import { ALL_WORKSPACES, useWorkspace } from "@/foundation/hooks/use-workspace";
import {
  importModelCatalogs,
  type ModelCatalogImportItem,
} from "@/foundation/lib/api/model-catalogs";
import { useTranslation } from "@/foundation/lib/i18n";

type Source = "yaml" | "url" | "file";

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
    mutationFn: async () => {
      const payload =
        source === "url"
          ? { url, workspace: workspace || undefined }
          : { yaml: yamlText, workspace: workspace || undefined };
      return importModelCatalogs(payload);
    },
    onSuccess: (data) => {
      setResults(data.items);
      const ok = data.items.filter((r) => r.ok).length;
      const failed = data.items.length - ok;
      if (failed === 0) {
        toast.success(
          t("model_catalogs.import.successAll", "Imported {{count}} catalogs", {
            count: ok,
          }),
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
              "Paste a recipe YAML, upload a file, or fetch from a URL. Multiple documents (separated by ---) are supported.",
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
                "Backend fetches the URL (1 MiB / 10 s limit). Use a raw YAML link.",
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
                      {r.error || (r.ok ? `id=${r.id}` : "-")}
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
      </DialogContent>
    </Dialog>
  );
};
