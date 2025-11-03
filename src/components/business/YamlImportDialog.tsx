import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useYamlImport } from "@/hooks/use-yaml-import";
import { cn } from "@/lib/utils";
import { CheckCircle, FileText, Upload, XCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface YamlImportDialogProps {
  trigger?: React.ReactNode;
  className?: string;
}

export const YamlImportDialog = ({
  trigger,
  className,
}: YamlImportDialogProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [yamlContent, setYamlContent] = useState("");
  const [yamlUrl, setYamlUrl] = useState("");
  const [showResults, setShowResults] = useState(false);

  const {
    progress,
    isImporting,
    importFromYaml,
    importFromUrl,
    resetProgress,
  } = useYamlImport();

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setYamlContent(content);
    } catch (error) {
      console.error("Error reading file:", error);
    }
  };

  const handleTextImport = async () => {
    if (!yamlContent.trim()) return;

    setShowResults(false);
    resetProgress();
    const result = await importFromYaml(yamlContent);
    setShowResults(true);
  };

  const handleUrlImport = async () => {
    if (!yamlUrl.trim()) return;

    setShowResults(false);
    resetProgress();
    const result = await importFromUrl(yamlUrl);
    setShowResults(true);
  };

  const resetDialog = () => {
    setYamlContent("");
    setYamlUrl("");
    setShowResults(false);
    resetProgress();
  };

  const successCount = progress.results.filter(
    (r) => r.success && !r.skipped,
  ).length;
  const skippedCount = progress.results.filter((r) => r.skipped).length;
  const errorCount = progress.results.filter((r) => !r.success).length;
  const progressPercentage =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          resetDialog();
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className={className}>
            <Upload className="mr-2 h-4 w-4" />
            {t("components.yamlImport.importYaml")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("components.yamlImport.title")}</DialogTitle>
          <DialogDescription>
            {t("components.yamlImport.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {!showResults ? (
            <div className="space-y-2">
              {/* File Upload Section */}
              <div className="space-y-1">
                <Label htmlFor="file-upload" className="text-base font-medium">
                  {t("components.yamlImport.uploadYamlFile")}
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".yaml,.yml"
                    onChange={handleFileSelect}
                    className="flex-1"
                  />
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("components.yamlImport.or")}
                  </span>
                </div>
              </div>

              {/* URL Input Section */}
              <div className="space-y-1">
                <Label htmlFor="yaml-url" className="text-base font-medium">
                  {t("components.yamlImport.importFromUrl")}
                </Label>
                <div className="flex gap-3">
                  <Input
                    id="yaml-url"
                    type="url"
                    placeholder={t("components.yamlImport.urlPlaceholder")}
                    value={yamlUrl}
                    onChange={(e) => setYamlUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleUrlImport}
                    disabled={!yamlUrl.trim() || isImporting}
                    variant="outline"
                  >
                    {isImporting
                      ? t("components.yamlImport.importing")
                      : t("components.yamlImport.fetch")}
                  </Button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("components.yamlImport.or")}
                  </span>
                </div>
              </div>

              {/* Text Input Section */}
              <div className="space-y-1">
                <Label htmlFor="yaml-text" className="text-base font-medium">
                  {t("components.yamlImport.pasteYamlContent")}
                </Label>
                <Textarea
                  id="yaml-text"
                  placeholder={t("components.yamlImport.pasteYamlPlaceholder")}
                  value={yamlContent}
                  onChange={(e) => setYamlContent(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>

              {/* Import Progress */}
              {isImporting && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {t("components.yamlImport.importingResources")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {progress.completed} / {progress.total}
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="w-full" />
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleTextImport}
                  disabled={!yamlContent.trim() || isImporting}
                  size="lg"
                >
                  {isImporting
                    ? t("components.yamlImport.importing")
                    : t("components.yamlImport.importResources")}
                </Button>
              </div>
            </div>
          ) : (
            /* Results Section */
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {t("components.yamlImport.importResults")}
                </h3>
                <div className="flex gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800"
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    {successCount} {t("components.yamlImport.success")}
                  </Badge>
                  {skippedCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-gray-100 text-gray-800"
                    >
                      <CheckCircle className="mr-1 h-3 w-3" />
                      {skippedCount} {t("components.yamlImport.skipped")}
                    </Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-red-100 text-red-800"
                    >
                      <XCircle className="mr-1 h-3 w-3" />
                      {errorCount} {t("components.yamlImport.error")}
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-4 space-y-1">
                  {progress.results.map((result, index: number) => (
                    <div
                      key={index}
                      className={cn(
                        "p-3 rounded-lg border",
                        result.success && !result.skipped
                          ? "bg-green-50 border-green-200"
                          : result.skipped
                            ? "bg-gray-50 border-gray-200"
                            : "bg-red-50 border-red-200",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {result.success && !result.skipped ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : result.skipped ? (
                          <CheckCircle className="h-5 w-5 text-gray-600 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 text-secondary">
                            <span className="font-medium">
                              {t(`${result.resourceType}.title`)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {result.resourceName}
                            </span>
                          </div>
                          {!result.success && result.error && (
                            <div className="text-sm text-red-700 mt-1">
                              <strong>
                                {t("components.yamlImport.errorLabel")}:
                              </strong>{" "}
                              {result.error}
                            </div>
                          )}
                          {result.success && !result.skipped && (
                            <div className="text-sm text-green-700">
                              {t("components.yamlImport.successfullyCreated")}
                            </div>
                          )}
                          {result.skipped && (
                            <div className="text-sm text-gray-500">
                              {t("components.yamlImport.skippedExisting")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={resetDialog}>
                  {t("components.yamlImport.importMore")}
                </Button>
                <Button
                  onClick={() => {
                    resetDialog();
                    setIsOpen(false);
                  }}
                >
                  {t("components.yamlImport.close")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
