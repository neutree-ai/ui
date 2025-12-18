import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useTranslation } from "@refinedev/core";
import { Download } from "lucide-react";

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
  const { translate } = useTranslation();

  const handleExportEntity = async () => {
    if (onExport) {
      onExport(entity, resource);
    }
  };

  return (
    <DropdownMenuItem onClick={handleExportEntity}>
      <Download size={16} className="mr-2" />
      {translate("buttons.exportYaml")}
    </DropdownMenuItem>
  );
};
