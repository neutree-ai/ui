import type { ExportButtonProps } from "@/components/theme/types";
import { Button } from "@/components/ui/button";
import { Slot } from "@radix-ui/react-slot";
import { CanAccess, useExportButton } from "@refinedev/core";
import { ShareIcon } from "lucide-react";

import type { FC } from "react";

export const ExportButton: FC<ExportButtonProps> = ({
  hideText = false,
  resource,
  recordItemId,
  accessControl,
  access,
  children,
  ...props
}) => {
  const { label } = useExportButton();
  const Com = !accessControl?.enabled ? Slot : CanAccess;

  if (accessControl?.hideIfUnauthorized && accessControl.enabled) {
    return null;
  }

  return (
    <Com
      params={{
        id: recordItemId,
      }}
      resource={resource}
      action="export"
      {...access}
    >
      <Button {...props}>
        <ShareIcon className="mr-2 w-4 h-4" />
        {!hideText && (children ?? label)}
      </Button>
    </Com>
  );
};

ExportButton.displayName = "ExportButton";
