import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";

// Lazy load the YamlExportDialog component
const YamlExportDialog = lazy(() =>
  import("./YamlExportDialog").then((module) => ({
    default: module.YamlExportDialog,
  })),
);

export const YamlExportButton = () => {
  const { t } = useTranslation();

  const trigger = (
    <Button variant="outline" size="sm" className="flex items-center gap-2">
      <Download className="h-4 w-4" />
      {t("components.yamlExport.exportYaml")}
    </Button>
  );

  return (
    <Suspense
      fallback={
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          disabled
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("components.yamlExport.exportYaml")}
        </Button>
      }
    >
      <YamlExportDialog trigger={trigger} />
    </Suspense>
  );
};
