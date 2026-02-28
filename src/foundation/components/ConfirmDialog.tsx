import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { buttonVariants } from "@/components/ui/button";
import { LoadingIcon } from "@/components/ui/loading";
import type { AlertDialogProps } from "@radix-ui/react-alert-dialog";
import type { DeleteButtonValues } from "@refinedev/core/dist/hooks/button/delete-button";
import type { VariantProps } from "class-variance-authority";
import { CheckIcon, XIcon } from "lucide-react";
import {
  type FC,
  type ReactElement,
  type ReactNode,
  isValidElement,
  useMemo,
} from "react";

type ConfirmDialogProps = AlertDialogProps & {
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
  content?: ReactNode;
  okButtonVariant?: VariantProps<typeof buttonVariants>["variant"];
  cancelButtonVariant?: VariantProps<typeof buttonVariants>["variant"];
  okButtonSize?: VariantProps<typeof buttonVariants>["size"];
  cancelButtonSize?: VariantProps<typeof buttonVariants>["size"];
};

export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  children,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  okText = "Ok",
  cancelText = "Cancel",
  okButtonSize = "default",
  cancelButtonSize = "default",
  okButtonVariant = "default",
  cancelButtonVariant = "outline",
  loading = false,
  okIconSide = "left",
  cancelIconSide = "left",
  onConfirm,
  okIcon,
  cancelIcon,
  open,
  onOpenChange,
  defaultOpen,
  content,
}) => {
  const CancelIcon = useMemo(() => {
    if (isValidElement(cancelIcon)) {
      return cancelIcon;
    }

    return <XIcon className="mr-2 h-4 w-4" />;
  }, [cancelIcon]);

  const OkIcon = useMemo(() => {
    if (loading) {
      return <LoadingIcon className="mr-2" />;
    }
    if (isValidElement(okIcon)) {
      return okIcon;
    }

    return <CheckIcon className="mr-2 h-4 w-4" />;
  }, [okIcon, loading]);

  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={defaultOpen}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {content && (
          <div className="py-2 max-h-60 overflow-auto">{content}</div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel
            variant={cancelButtonVariant}
            size={cancelButtonSize}
            disabled={loading}
          >
            {cancelIconSide === "left" && CancelIcon}
            {cancelText}
            {cancelIconSide === "right" && CancelIcon}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={okButtonVariant}
            size={okButtonSize}
            disabled={loading}
            onClick={onConfirm}
          >
            {okIconSide === "left" && OkIcon}
            {okText}
            {okIconSide === "right" && OkIcon}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

ConfirmDialog.displayName = "ConfirmDialog";
