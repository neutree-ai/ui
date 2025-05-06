import type { ShowButtonProps } from "@/components/theme/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useShowButton } from "@refinedev/core";
import type { FC } from "react";

export const ShowButton: FC<
	ShowButtonProps & {
		recordItemId: Exclude<ShowButtonProps["recordItemId"], undefined>;
		meta: Exclude<ShowButtonProps["meta"], undefined>;
	}
> = ({
	resource: resourceNameFromProps,
	recordItemId,
	hideText = false,
	accessControl,
	meta,
	children,
	onClick,
	...props
}) => {
	const { to, label, title, hidden, disabled, LinkComponent } = useShowButton({
		resource: resourceNameFromProps,
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
