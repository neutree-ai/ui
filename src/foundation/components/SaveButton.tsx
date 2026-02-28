import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Slot } from "@radix-ui/react-slot";
import { CanAccess, useSaveButton } from "@refinedev/core";
import type {
  RefineButtonResourceProps,
  RefineButtonSingleProps,
  RefineSaveButtonProps,
} from "@refinedev/ui-types";
import { SaveIcon } from "lucide-react";
import type { FC } from "react";

type SaveButtonProps = ButtonProps &
  RefineSaveButtonProps &
  RefineButtonResourceProps &
  RefineButtonSingleProps & {
    loading?: boolean;
    access?: Omit<
      React.ComponentProps<typeof CanAccess>,
      "children" | "action" | "resource" | "params"
    >;
  };

export const SaveButton: FC<SaveButtonProps> = ({
  hideText = false,
  children,
  accessControl,
  access,
  resource,
  recordItemId,
  loading,
  ...props
}) => {
  const { label } = useSaveButton();
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
      action="save"
      {...access}
    >
      <Button {...props} disabled={loading}>
        <SaveIcon className="mr-2 w-4 h-4" />
        {!hideText && (children ?? label)}
      </Button>
    </Com>
  );
};

SaveButton.displayName = "SaveButton";
