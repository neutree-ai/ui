import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Copy, FileDown } from "lucide-react";
import { useTranslation } from "react-i18next";

interface YamlOutputSectionProps {
  yamlContent: string;
  onCopyToClipboard: () => void;
  onDownloadFile: () => void;
  onBack?: () => void;
  onClose?: () => void;
  title?: string;
  showBackButton?: boolean;
}

export const YamlOutputSection = ({
  yamlContent,
  onCopyToClipboard,
  onDownloadFile,
  onBack,
  onClose,
  title,
  showBackButton = false,
}: YamlOutputSectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          {title || t("components.yamlExport.generatedYaml")}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCopyToClipboard}
            className="flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            {t("components.yamlExport.copyToClipboard")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadFile}
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
          placeholder={t("components.yamlExport.yamlContentPlaceholder")}
        />
      </div>

      {showBackButton && onBack && onClose && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            {t("components.yamlExport.backToSelection")}
          </Button>
          <Button onClick={onClose}>{t("components.yamlExport.close")}</Button>
        </div>
      )}
    </div>
  );
};
