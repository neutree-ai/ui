import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { useSaveButton } from "@refinedev/core";
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
  };

export const SaveButton: FC<SaveButtonProps> = ({
  hideText = false,
  children,
  loading,
  ...props
}) => {
  const { label } = useSaveButton();

  return (
    <Button {...props} disabled={loading}>
      <SaveIcon className="mr-2 w-4 h-4" />
      {!hideText && (children ?? label)}
    </Button>
  );
};

SaveButton.displayName = "SaveButton";
