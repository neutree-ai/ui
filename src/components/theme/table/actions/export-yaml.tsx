import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useTranslation } from "@refinedev/core";
import { Download } from "lucide-react";
import { RowAction } from "./index";

// Custom hook for export functionality
const useExportYaml = (
  entity: any,
  resource: string,
  onExport?: (entity: any, resource: string) => void,
) => {
  const { translate } = useTranslation();
  const handleExport = () => {
    if (onExport) {
      onExport(entity, resource);
    } else {
      // Emit custom event to trigger global dialog
      const event = new CustomEvent("export-yaml", {
        detail: { entity, resource },
      });
      window.dispatchEvent(event);
    }
  };
  return {
    handleExport,
    translate,
  };
};

// For dropdown menus (show pages)
export interface ExportYamlActionProps {
  entity: any;
  resource: string;
  onExport?: (entity: any, resource: string) => void;
}

export const ExportYamlAction = ({
  entity,
  resource,
  onExport,
}: ExportYamlActionProps) => {
  const { handleExport, translate } = useExportYaml(entity, resource, onExport);

  return (
    <DropdownMenuItem onClick={handleExport}>
      <Download size={16} className="mr-2" />
      {translate("buttons.exportYaml")}
    </DropdownMenuItem>
  );
};

// For table actions (list pages)
export interface ExportYamlTableActionProps {
  row: any;
  resource: string;
  icon?: React.ReactNode;
}

export const ExportYamlTableAction = ({
  row,
  resource,
  icon,
}: ExportYamlTableActionProps) => {
  const { handleExport, translate } = useExportYaml(row, resource);

  return (
    <RowAction
      title={translate("buttons.exportYaml")}
      icon={icon}
      onClick={handleExport}
    />
  );
};
