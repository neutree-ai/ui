import { YamlOutputSection } from "@/components/business/YamlOutputSection";
import { Breadcrumbs, PageHeader } from "@/components/theme/components";
import type { ShowProps } from "@/components/theme/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EXPORTABLE_RESOURCES } from "@/hooks/use-yaml-export";
import {
  copyYamlToClipboard,
  downloadYamlFile,
  generateEntityFilename,
  generateYamlContentFromEntity,
  getDefaultExportOptions,
} from "@/lib/yaml-utils";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import {
  useNavigation,
  useRefineContext,
  useResource,
  useTranslate,
} from "@refinedev/core";
import { Edit, Trash2 } from "lucide-react";
import { type FC, isValidElement, useState } from "react";
import { DeleteProvider } from "../../providers";
import { DeleteAction } from "../../table/actions/delete";
import { EditAction } from "../../table/actions/edit";
import { ExportYamlAction } from "../../table/actions/export-yaml";
import { Row } from "./row";

export const ShowPage: FC<ShowProps> & {
  Row: typeof Row;
} = ({
  title,
  resource: resourceFromProps,
  breadcrumb: breadcrumbFromProps = null,
  canDelete = true,
  canEdit = true,
  extra,
  extraActions,
  record,
  children,
}) => {
  const translate = useTranslate();
  const {
    options: { breadcrumb: globalBreadcrumb } = {},
  } = useRefineContext();

  const { resource, identifier } = useResource(resourceFromProps);

  const { list } = useNavigation();

  const breadcrumb =
    typeof breadcrumbFromProps === "undefined"
      ? globalBreadcrumb
      : breadcrumbFromProps;

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

  return (
    <DeleteProvider>
      <PageHeader
        className="h-auto"
        breadcrumb={
          isValidElement(breadcrumb) ? (
            breadcrumb
          ) : (
            <div className="flex w-full justify-between items-center min-h-9">
              <Breadcrumbs record={record} />
              {extra ? (
                extra
              ) : !canDelete &&
                !canEdit &&
                !extraActions &&
                !(
                  resource?.name &&
                  EXPORTABLE_RESOURCES.includes(resource.name as any)
                ) ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <DotsHorizontalIcon className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-[160px]"
                    forceMount
                  >
                    {extraActions?.(record)}
                    {resource?.name &&
                      EXPORTABLE_RESOURCES.includes(resource.name as any) && (
                        <ExportYamlAction
                          entity={record}
                          resource={resource.name}
                          onExport={handleExportEntity}
                        />
                      )}
                    {canEdit && (
                      <EditAction
                        title={translate("buttons.edit")}
                        row={record}
                        resource={resource?.name || ""}
                        icon={<Edit size={16} />}
                      />
                    )}
                    {canDelete && (
                      <DeleteAction
                        row={record}
                        resource={resource?.name ?? ""}
                        title={translate("buttons.delete")}
                        icon={<Trash2 size={16} />}
                      />
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )
        }
        isBack
      />
      <div className="relative pt-4 !mt-0 grow overflow-auto">{children} </div>

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
            onDownloadFile={() => handleDownloadFile(resource?.name || "")}
            title={viewerTitle}
          />
        </DialogContent>
      </Dialog>
    </DeleteProvider>
  );
};

ShowPage.Row = Row;
ShowPage.displayName = "ShowPage";
