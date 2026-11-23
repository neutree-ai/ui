import {
  cloneElement,
  forwardRef,
  type ReactElement,
  type ReactNode,
} from "react";
import type {
  ControllerRenderProps,
  FieldPath,
  FieldValues,
  UseControllerProps,
} from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/foundation/lib/utils";

const formFieldLabelClassName =
  "text-sm font-normal leading-[22px] text-[var(--nt-text-neutral-secondary)]";

type FieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = UseControllerProps<TFieldValues, TName> & {
  label?: string;
  labelAccessory?: ReactNode;
  description?: string;
  required?: boolean;
  className?: string;
  isCheckbox?: boolean;
  children: ReactElement<{
    field: ControllerRenderProps<TFieldValues, TName>;
  }>;
};
export const FormFieldGroup = forwardRef<HTMLDivElement, FieldProps>(
  (props: FieldProps, _) => {
    return (
      <FormField
        control={props.control}
        name={props.name}
        rules={props.rules}
        render={({ field }: { field: ControllerRenderProps }) => {
          const control = (
            <FormControl>
              {cloneElement(props.children, {
                ...field,
                ...props.children.props,
              })}
            </FormControl>
          );
          const notes = (
            <>
              {props.description && (
                <FormDescription>{props.description}</FormDescription>
              )}
              <FormMessage />
            </>
          );
          const label = (
            <FormLabel className={formFieldLabelClassName}>
              {props.label}
              {props.required ? (
                <span className="ml-1 text-destructive" aria-hidden="true">
                  *
                </span>
              ) : null}
            </FormLabel>
          );
          return (
            <FormItem
              data-testid={`field-${props.name}`}
              data-form-option=""
              className={cn(
                props.className,
                props.isCheckbox
                  ? "flex flex-row items-center space-x-3 space-y-0"
                  : "",
              )}
            >
              {props.isCheckbox ? (
                <>
                  {control}
                  <FormLabel className={formFieldLabelClassName}>
                    {props.label}
                  </FormLabel>
                  {notes}
                </>
              ) : (
                <>
                  {props.labelAccessory ? (
                    <div className="flex min-w-0 items-center gap-1.5">
                      {label}
                      {props.labelAccessory}
                    </div>
                  ) : (
                    label
                  )}
                  {/* The description and error sit closer to the control than
                      FormItem's spacing puts the label. */}
                  <div className="space-y-1">
                    {control}
                    {notes}
                  </div>
                </>
              )}
            </FormItem>
          );
        }}
      />
    );
  },
);
