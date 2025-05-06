import type { EditButtonProps } from "@/components/theme/types";
import { Button } from "@/components/ui/button";
import { useEditButton } from "@refinedev/core";
import { SquarePenIcon } from "lucide-react";
import type { FC } from "react";

export const EditButton: FC<EditButtonProps> = ({
  resource,
  recordItemId,
  hideText = false,
  accessControl,
  meta,
  onClick,
  children,
  ...props
}) => {
  const { hidden, disabled, label, title, LinkComponent, to } = useEditButton({
    resource,
    id: recordItemId,
    accessControl,
    meta,
  });

  if (hidden) return null;

  return (
    <LinkComponent
      to={to}
      replace={false}
      onClick={(e: React.PointerEvent<HTMLButtonElement>) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        if (onClick) {
          e.preventDefault();
          onClick(e);
        }
      }}
    >
      <Button disabled={disabled} title={title} {...props}>
        <SquarePenIcon className="mr-2 w-4 h-4" />
        {!hideText && (children ?? label)}
      </Button>
    </LinkComponent>
  );
};

EditButton.displayName = "EditButton";
