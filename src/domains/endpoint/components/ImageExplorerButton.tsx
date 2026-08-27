import { FolderSearch } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageRegistryExplorerDialog } from "@/domains/endpoint/components/ImageRegistryExplorerDialog";
import { useTranslation } from "@/foundation/lib/i18n";

interface ImageExplorerButtonProps {
  workspace?: string | null;
  /** The registry the endpoint's cluster pulls with, if a cluster has been
   * picked. Only used to mark it in the explorer's registry list. */
  registry?: string | null;
  onApply: (value: string) => void;
  disabled?: boolean;
}

/**
 * Opens the registry explorer and hands back what it finds.
 *
 * Its own component because two unrelated controls need it: the engine
 * arguments table, where the image is a row, and the recipe feature picker,
 * where a catalog can expose the same image as a feature. Both keep their own
 * text input — this only ever sits beside one.
 */
export function ImageExplorerButton({
  workspace,
  registry,
  onApply,
  disabled,
}: ImageExplorerButtonProps) {
  const { t } = useTranslation();
  const [exploring, setExploring] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        disabled={disabled}
        onClick={() => setExploring(true)}
      >
        <FolderSearch className="mr-2 h-4 w-4" />
        {t("endpoints.imageExplorer.open")}
      </Button>

      <ImageRegistryExplorerDialog
        open={exploring}
        onOpenChange={setExploring}
        workspace={workspace}
        clusterRegistry={registry}
        onApply={onApply}
      />
    </>
  );
}
