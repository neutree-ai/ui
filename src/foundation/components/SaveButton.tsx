import { useSaveButton } from "@refinedev/core";
import type {
  RefineButtonResourceProps,
  RefineButtonSingleProps,
  RefineSaveButtonProps,
} from "@refinedev/ui-types";
import { SaveIcon } from "lucide-react";
import type { FC } from "react";
import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";

type SaveButtonProps = ButtonProps &
  RefineSaveButtonProps &
  RefineButtonResourceProps &
  RefineButtonSingleProps & {
    loading?: boolean;
  };

export const SaveButton: FC<SaveButtonProps> = ({
  hideText = false,
  children,
  loading,
  ...props
}) => {
  const { label } = useSaveButton();

  return (
    <Button {...props} disabled={loading || props.disabled}>
      <SaveIcon className="h-4 w-4" />
      {!hideText && (children ?? label)}
    </Button>
  );
};

SaveButton.displayName = "SaveButton";
