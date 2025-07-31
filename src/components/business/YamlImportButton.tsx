import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";

// Lazy load the YamlImportDialog component
const YamlImportDialog = lazy(() =>
  import("./YamlImportDialog").then((module) => ({
    default: module.YamlImportDialog,
  })),
);

export const YamlImportButton = () => {
  const { t } = useTranslation();

  const trigger = (
    <Button variant="outline" size="sm" className="flex items-center gap-2">
      <Upload className="h-4 w-4" />
      {t("components.yamlImport.importYaml")}
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
          {t("components.yamlImport.importYaml")}
        </Button>
      }
    >
      <YamlImportDialog trigger={trigger} />
    </Suspense>
  );
};
