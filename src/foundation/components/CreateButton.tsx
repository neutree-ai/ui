import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { useCreateButton } from "@refinedev/core";
import type { RefineCreateButtonProps } from "@refinedev/ui-types";
import { SquarePlusIcon } from "lucide-react";
import type { FC } from "react";

type CreateButtonProps = ButtonProps &
  Pick<RefineCreateButtonProps, "resource" | "hideText" | "meta" | "onClick">;

export const CreateButton: FC<CreateButtonProps> = ({
  resource,
  hideText = false,
  meta,
  onClick,
  children,
  ...props
}) => {
  const { hidden, disabled, label, title, LinkComponent, to } = useCreateButton(
    {
      resource,
      meta,
    },
  );

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
        <SquarePlusIcon className="mr-2 w-4 h-4" />
        {!hideText && (children ?? label)}
      </Button>
    </LinkComponent>
  );
};

CreateButton.displayName = "CreateButton";
