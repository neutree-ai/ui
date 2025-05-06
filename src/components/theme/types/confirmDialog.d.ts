import type { buttonVariants } from "@/components/ui/button";
import type { AlertDialogProps } from "@radix-ui/react-alert-dialog";
import type { DeleteButtonValues } from "@refinedev/core/dist/hooks/button/delete-button";
import type { VariantProps } from "class-variance-authority";
import type { ReactElement } from "react";

export type ConfirmDialogProps = AlertDialogProps & {
	title?: string;
	description?: string;
	okIcon?: ReactElement<SVGSVGElement>;
	okIconSide?: "left" | "right";
	cancelIconSide?: "left" | "right";
	cancelIcon?: ReactElement<SVGSVGElement>;
	okText?: string;
	cancelText?: string;
	loading?: boolean;
	onConfirm: DeleteButtonValues["onConfirm"];
	children?: ReactElement<SVGSVGElement>;
	okButtonVariant?: VariantProps<typeof buttonVariants>["variant"];
	cancelButtonVariant?: VariantProps<typeof buttonVariants>["variant"];
	okButtonSize?: VariantProps<typeof buttonVariants>["size"];
	cancelButtonSize?: VariantProps<typeof buttonVariants>["size"];
};
