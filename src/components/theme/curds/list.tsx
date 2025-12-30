import { YamlOutputSection } from "@/components/business/YamlOutputSection";
import { CreateButton } from "@/components/theme/buttons";
import { Breadcrumbs, PageHeader } from "@/components/theme/components";
import type { ListProps } from "@/components/theme/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  copyYamlToClipboard,
  downloadYamlFile,
  generateEntityFilename,
  generateYamlContentFromEntity,
  getDefaultExportOptions,
} from "@/lib/yaml-utils";
import {
  useResource,
  useTranslate,
  useUserFriendlyName,
} from "@refinedev/core";
import { type FC, isValidElement, useEffect, useState } from "react";

export const ListPage: FC<ListProps> = ({
  title,
  resource: resourceFromProps,
  breadcrumb: breadcrumbFromProps,
  createButtonProps,
  className,
  canCreate = true,
  extra,
  children,
}) => {
  const translate = useTranslate();
  const getUserFriendlyName = useUserFriendlyName();

  const { resource, identifier } = useResource(resourceFromProps);

  // YAML export dialog state
  const [showYamlViewer, setShowYamlViewer] = useState(false);
  const [yamlContent, setYamlContent] = useState("");
  const [viewerTitle, setViewerTitle] = useState("");

  // Handle YAML export
  const handleExportEntity = async (entity: any, resourceName: string) => {
    try {
      const exportOptions = getDefaultExportOptions();
      const yamlContent = generateYamlContentFromEntity(entity, exportOptions);

      const title = translate("components.yamlExport.generatedYaml", {
        resource: resourceName,
        name: entity.metadata?.name || "Entity",
      });

      setYamlContent(yamlContent);
      setViewerTitle(title);
      setShowYamlViewer(true);
    } catch (error) {
      console.error("Failed to export entity:", error);
      // Error handling can be added here if needed
    }
  };

  // Handle copy to clipboard
  const handleCopyToClipboard = async () => {
    try {
      await copyYamlToClipboard(yamlContent, translate);
    } catch (error) {
      // Error handling is done in the utility function
    }
  };

  // Handle download file
  const handleDownloadFile = (resourceName: string) => {
    const filename = generateEntityFilename(resourceName);
    downloadYamlFile(yamlContent, filename, translate);
  };

  // Close YAML viewer
  const closeYamlViewer = () => {
    setShowYamlViewer(false);
    setYamlContent("");
    setViewerTitle("");
  };

  // Set up global export handler for table actions
  useEffect(() => {
    const handleExportEvent = (event: CustomEvent) => {
      const { entity, resource } = event.detail;
      handleExportEntity(entity, resource);
    };

    window.addEventListener(
      "list-export-yaml",
      handleExportEvent as EventListener,
    );

    return () => {
      window.removeEventListener(
        "list-export-yaml",
        handleExportEvent as EventListener,
      );
    };
  }, []);

  return (
    <>
      <PageHeader
        title={
          title ??
          translate(
            `${identifier}.title`,
            `List ${getUserFriendlyName(
              resource?.meta?.label ?? identifier,
              "plural",
            )}`,
          )
        }
        breadcrumb={null}
        extra={
          extra ?? (
            <div className="inline-flex flex-row gap-4">
              {canCreate && (
                <CreateButton
                  {...createButtonProps}
                  resource={createButtonProps?.resource ?? identifier}
                />
              )}
            </div>
          )
        }
      />
      <div className={cn("pt-2 sm:pt-4 !mt-0", className)}>{children}</div>

      {/* YAML Export Dialog */}
      <Dialog open={showYamlViewer} onOpenChange={closeYamlViewer}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {translate("components.yamlExport.title")}
            </DialogTitle>
            <DialogDescription>
              {translate("components.yamlExport.selectedResourceDescription")}
            </DialogDescription>
          </DialogHeader>

          <YamlOutputSection
            yamlContent={yamlContent}
            onCopyToClipboard={handleCopyToClipboard}
            onDownloadFile={() => handleDownloadFile("resource")}
            title={viewerTitle}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

ListPage.displayName = "ListPage";
