import {
  copyYamlToClipboard,
  downloadYamlFile,
  generateEntityFilename,
  generateYamlContentFromEntity,
  getDefaultExportOptions,
} from "@/lib/yaml-utils";
import { useTranslation } from "@refinedev/core";
import React, { useState } from "react";
import { toast } from "sonner";

export interface YamlExportDialogState {
  showYamlViewer: boolean;
  yamlContent: string;
  viewerTitle: string;
}

// Global state for YAML export dialog - ensures only one instance
let globalDialogState: YamlExportDialogState = {
  showYamlViewer: false,
  yamlContent: "",
  viewerTitle: "",
};

let globalListeners: Array<(state: YamlExportDialogState) => void> = [];

const notifyListeners = () => {
  globalListeners.forEach((listener) => listener(globalDialogState));
};

const updateGlobalState = (updates: Partial<YamlExportDialogState>) => {
  globalDialogState = { ...globalDialogState, ...updates };
  notifyListeners();
};

export const useYamlExportDialog = () => {
  const { translate } = useTranslation();
  const [, forceUpdate] = useState({});

  // Subscribe to global state changes
  React.useEffect(() => {
    const listener = () => forceUpdate({});
    globalListeners.push(listener);
    return () => {
      globalListeners = globalListeners.filter((l) => l !== listener);
    };
  }, []);

  const exportEntity = async (entity: any, resource: string) => {
    try {
      const exportOptions = getDefaultExportOptions();
      const yamlContent = generateYamlContentFromEntity(entity, exportOptions);

      const title = translate("components.yamlExport.generatedYaml", {
        resource,
        name: entity.metadata?.name || "Entity",
      });

      updateGlobalState({
        yamlContent,
        viewerTitle: title,
        showYamlViewer: true,
      });
    } catch (error) {
      console.error("Failed to export entity:", error);
      toast.error(translate("components.yamlExport.errors.generateFailed"), {
        description:
          error instanceof Error
            ? error.message
            : translate("components.yamlExport.errors.unknownError"),
      });
    }
  };

  const closeDialog = () => {
    updateGlobalState({
      showYamlViewer: false,
      yamlContent: "",
      viewerTitle: "",
    });
  };

  const handleCopyToClipboard = async () => {
    try {
      await copyYamlToClipboard(globalDialogState.yamlContent, translate);
    } catch (error) {
      // Error handling is done in the utility function
    }
  };

  const handleDownloadFile = (resource: string) => {
    const filename = generateEntityFilename(resource);
    downloadYamlFile(globalDialogState.yamlContent, filename, translate);
  };

  return {
    state: globalDialogState,
    exportEntity,
    closeDialog,
    handleCopyToClipboard,
    handleDownloadFile,
  };
};
