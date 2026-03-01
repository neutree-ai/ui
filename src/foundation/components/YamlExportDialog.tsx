import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import {
  type ExportableResource,
  useYamlExport,
} from "@/foundation/hooks/use-yaml-export";
import {
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileDown,
  Loader2,
  Package,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface YamlExportDialogProps {
  trigger?: React.ReactNode;
  className?: string;
}

export const YamlExportDialog = ({
  trigger,
  className,
}: YamlExportDialogProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [yamlContent, setYamlContent] = useState("");
  const [showYamlOutput, setShowYamlOutput] = useState(false);
  const [expandedResourceTypes, setExpandedResourceTypes] = useState<
    Set<ExportableResource>
  >(new Set());

  const {
    resourceTypes,
    exportOptions,
    isExporting,
    exportProgress,
    statistics,
    areAllResourcesSelected,
    isSelectingAll,
    loadingResources,
    setResourceTypes,
    toggleResourceType,
    toggleEntity,
    loadEntities,
    setExportOptions,
    generateYamlContent,
    resetSelections,
    selectAllResources,
    resetCredentialResources,
  } = useYamlExport();

  useEffect(() => {
    if (isOpen) {
      setResourceTypes((prevResourceTypes) => {
        const updatedResourceTypes = { ...prevResourceTypes };
        Object.entries(updatedResourceTypes).forEach(([_, resourceType]) => {
          resourceType.loaded = false;
        });
        return updatedResourceTypes;
      });
    }
  }, [isOpen, setResourceTypes]);

  const handleResourceTypeToggle = async (type: ExportableResource) => {
    // Load entities if not loaded yet
    await loadEntities(type);
    toggleResourceType(type);
  };

  const handleResourceTypeExpand = async (type: ExportableResource) => {
    const newExpanded = new Set(expandedResourceTypes);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
      // Load entities when expanding
      await loadEntities(type);
    }
    setExpandedResourceTypes(newExpanded);
  };

  const handleExport = async () => {
    try {
      const content = await generateYamlContent();
      setYamlContent(content);
      setShowYamlOutput(true);
    } catch (error) {
      console.error("Failed to generate YAML:", error);
      toast.error(t("components.yamlExport.errors.generateFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("components.yamlExport.errors.unknownError"),
      });
    }
  };

  const { copy, copied: yamlCopied } = useCopyToClipboard();

  const handleCopyToClipboard = () =>
    copy(yamlContent, {
      successMessage: t("components.yamlExport.copySuccess"),
      successDescription: t("components.yamlExport.copySuccessDescription"),
      errorMessage: t("components.yamlExport.errors.copyFailed"),
    });

  const handleDownloadFile = () => {
    const blob = new Blob([yamlContent], { type: "application/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resources-${new Date().toISOString().split("T")[0]}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(t("components.yamlExport.downloadSuccess"), {
      description: t("components.yamlExport.downloadSuccessDescription"),
    });
  };

  const resetDialog = () => {
    setYamlContent("");
    setShowYamlOutput(false);
    resetSelections();
    setExpandedResourceTypes(new Set());
  };

  const progressPercentage =
    exportProgress.total > 0
      ? Math.round((exportProgress.completed / exportProgress.total) * 100)
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
            <Download className="mr-2 h-4 w-4" />
            {t("components.yamlExport.exportYaml")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("components.yamlExport.title")}</DialogTitle>
          <DialogDescription>
            {t("components.yamlExport.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {!showYamlOutput ? (
            <div className="space-y-6">
              {/* Resource Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t("components.yamlExport.resourceSelection")}
                  </h3>

                  <div className="flex items-center gap-2">
                    {/* Select All / Deselect All Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={
                        areAllResourcesSelected
                          ? resetSelections
                          : selectAllResources
                      }
                      disabled={isSelectingAll}
                      className="h-8 text-xs"
                    >
                      {isSelectingAll ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-1 h-3 w-3" />
                      )}
                      {isSelectingAll
                        ? t("components.yamlExport.loadingAll")
                        : areAllResourcesSelected
                          ? t("components.yamlExport.deselectAll")
                          : t("components.yamlExport.selectAll")}
                    </Button>

                    {/* Settings Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                          {t("components.yamlExport.exportOptions")}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="p-2 space-y-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="remove-status"
                              checked={exportOptions.removeStatus}
                              onCheckedChange={(checked) =>
                                setExportOptions((prev) => ({
                                  ...prev,
                                  removeStatus: !!checked,
                                }))
                              }
                            />
                            <Label htmlFor="remove-status" className="text-sm">
                              {t("components.yamlExport.options.removeStatus")}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="remove-ids"
                              checked={exportOptions.removeIds}
                              onCheckedChange={(checked) =>
                                setExportOptions((prev) => ({
                                  ...prev,
                                  removeIds: !!checked,
                                }))
                              }
                            />
                            <Label htmlFor="remove-ids" className="text-sm">
                              {t("components.yamlExport.options.removeIds")}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="remove-timestamps"
                              checked={exportOptions.removeTimestamps}
                              onCheckedChange={(checked) =>
                                setExportOptions((prev) => ({
                                  ...prev,
                                  removeTimestamps: !!checked,
                                }))
                              }
                            />
                            <Label
                              htmlFor="remove-timestamps"
                              className="text-sm"
                            >
                              {t(
                                "components.yamlExport.options.removeTimestamps",
                              )}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="include-credentials"
                              checked={exportOptions.includeCredentials}
                              onCheckedChange={(checked) => {
                                setExportOptions((prev) => ({
                                  ...prev,
                                  includeCredentials: !!checked,
                                }));
                                resetCredentialResources();
                              }}
                            />
                            <Label
                              htmlFor="include-credentials"
                              className="text-sm"
                            >
                              {t(
                                "components.yamlExport.options.includeCredentials",
                              )}
                            </Label>
                          </div>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <ScrollArea className="h-96 rounded-md p-2">
                  <div className="space-y-2">
                    {Object.values(resourceTypes).map((resourceType) => (
                      <div
                        key={resourceType.type}
                        className="border rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={resourceType.selected}
                              onCheckedChange={() =>
                                handleResourceTypeToggle(resourceType.type)
                              }
                              disabled={loadingResources.has(resourceType.type)}
                            />
                            <Label className="font-medium flex items-center gap-2">
                              {resourceType.label}
                              {loadingResources.has(resourceType.type) &&
                                !resourceType.selected && (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                )}
                            </Label>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleResourceTypeExpand(resourceType.type)
                            }
                            className="h-8 w-8 p-0"
                            disabled={loadingResources.has(resourceType.type)}
                          >
                            {expandedResourceTypes.has(resourceType.type) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        <Collapsible
                          open={expandedResourceTypes.has(resourceType.type)}
                        >
                          <CollapsibleContent className="mt-3">
                            {resourceType.loaded ? (
                              resourceType.entities.length > 0 ? (
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {resourceType.entities.map((entity) => (
                                    <div
                                      key={entity.id}
                                      className="flex items-center gap-2 pl-4"
                                    >
                                      <Checkbox
                                        checked={resourceType.selectedEntities.has(
                                          String(entity.id),
                                        )}
                                        onCheckedChange={() =>
                                          toggleEntity(
                                            resourceType.type,
                                            String(entity.id),
                                          )
                                        }
                                      />
                                      <Label className="text-sm text-muted-foreground">
                                        {entity.metadata.name}
                                        {entity.metadata.workspace && (
                                          <span className="text-xs ml-2 text-gray-500">
                                            ({entity.metadata.workspace})
                                          </span>
                                        )}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground pl-4">
                                  {t("components.yamlExport.noEntitiesFound")}
                                </div>
                              )
                            ) : loadingResources.has(resourceType.type) ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-4">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t("components.yamlExport.loading")}...
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground pl-4">
                                {t("components.yamlExport.loading")}...
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Export Progress */}
              {isExporting && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {t("components.yamlExport.exportingResources")}
                      {exportProgress.currentResource &&
                        ` - ${exportProgress.currentResource}`}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {exportProgress.completed} / {exportProgress.total}
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="w-full" />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={resetDialog}>
                  {t("components.yamlExport.reset")}
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={
                    statistics.totalSelectedEntities === 0 || isExporting
                  }
                  size="lg"
                >
                  {isExporting
                    ? t("components.yamlExport.exporting")
                    : t("components.yamlExport.generateYaml")}
                </Button>
              </div>
            </div>
          ) : (
            /* YAML Output Section */
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  {t("components.yamlExport.generatedYaml")}
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyToClipboard}
                    className="flex items-center gap-2"
                  >
                    {yamlCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {yamlCopied
                      ? t("components.yamlExport.copied")
                      : t("components.yamlExport.copyToClipboard")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadFile}
                    className="flex items-center gap-2"
                  >
                    <FileDown className="h-4 w-4" />
                    {t("components.yamlExport.downloadFile")}
                  </Button>
                </div>
              </div>

              <div className="flex-1 border rounded-md">
                <Textarea
                  value={yamlContent}
                  readOnly
                  className="h-full min-h-[500px] font-mono text-sm resize-none"
                  placeholder={t(
                    "components.yamlExport.yamlContentPlaceholder",
                  )}
                />
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setShowYamlOutput(false)}
                >
                  {t("components.yamlExport.backToSelection")}
                </Button>
                <Button onClick={() => setIsOpen(false)}>
                  {t("buttons.close")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
