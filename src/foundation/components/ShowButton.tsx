import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { cn } from "@/foundation/lib/utils";
import { useShowButton } from "@refinedev/core";
import type { RefineShowButtonProps } from "@refinedev/ui-types";
import type { FC } from "react";

type ShowButtonProps = ButtonProps & RefineShowButtonProps;

export const ShowButton: FC<
  ShowButtonProps & {
    recordItemId: Exclude<ShowButtonProps["recordItemId"], undefined>;
    meta: Exclude<ShowButtonProps["meta"], undefined>;
  }
> = ({
  resource: resourceNameFromProps,
  recordItemId,
  hideText = false,
  meta,
  children,
  onClick,
  ...props
}) => {
  const { to, label, title, hidden, disabled, LinkComponent } = useShowButton({
    resource: resourceNameFromProps,
    id: recordItemId,
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
      <Button
        title={title}
        disabled={disabled}
        className={cn("p-0", props.className)}
        {...props}
      >
        {!hideText && (children ?? label)}
      </Button>
    </LinkComponent>
  );
};

ShowButton.displayName = "ShowButton";
