import { YamlOutputSection } from "@/components/business/YamlOutputSection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useYamlExportDialog } from "@/hooks/use-yaml-export-dialog";
import { useTranslation } from "@refinedev/core";
import { useEffect } from "react";

export const GlobalYamlExportDialog = () => {
  const { translate } = useTranslation();
  const {
    state: yamlState,
    closeDialog,
    handleCopyToClipboard,
    handleDownloadFile,
    exportEntity,
  } = useYamlExportDialog();

  // Listen for export events from table columns
  useEffect(() => {
    const handleExportEvent = (event: CustomEvent) => {
      const { entity, resource } = event.detail;
      exportEntity(entity, resource);
    };

    window.addEventListener("export-yaml", handleExportEvent as EventListener);

    return () => {
      window.removeEventListener(
        "export-yaml",
        handleExportEvent as EventListener,
      );
    };
  }, [exportEntity]);

  return (
    <Dialog
      open={yamlState.showYamlViewer}
      onOpenChange={closeDialog}
      modal={true}
    >
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{translate("components.yamlExport.title")}</DialogTitle>
          <DialogDescription>
            {translate("components.yamlExport.selectedResourceDescription")}
          </DialogDescription>
        </DialogHeader>

        <YamlOutputSection
          yamlContent={yamlState.yamlContent}
          onCopyToClipboard={handleCopyToClipboard}
          onDownloadFile={() => handleDownloadFile("resource")}
          title={yamlState.viewerTitle}
        />
      </DialogContent>
    </Dialog>
  );
};
