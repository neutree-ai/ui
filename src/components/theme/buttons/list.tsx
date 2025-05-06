import type { ListButtonProps } from "@/components/theme/types";
import { Button } from "@/components/ui/button";
import { useListButton } from "@refinedev/core";
import { ListIcon } from "lucide-react";
import type { FC } from "react";

export const ListButton: FC<ListButtonProps> = ({
  resource: resourceNameFromProps,
  hideText = false,
  accessControl,
  meta,
  children,
  onClick,
  ...props
}) => {
  const { hidden, disabled, label, title, LinkComponent, to } = useListButton({
    resource: resourceNameFromProps,
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
        <ListIcon className="mr-2 w-4 h-4" />
        {!hideText && (children ?? label)}
      </Button>
    </LinkComponent>
  );
};

ListButton.displayName = "ListButton";
