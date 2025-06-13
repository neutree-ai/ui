import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { YamlExportDialog } from "./YamlExportDialog";
import { useTranslation } from "react-i18next";

export const YamlExportButton = () => {
  const { t } = useTranslation();

  return (
    <YamlExportDialog
      trigger={
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          {t("components.yamlExport.exportYaml")}
        </Button>
      }
    />
  );
};
