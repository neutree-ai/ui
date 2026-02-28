import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/foundation/lib/utils";
import { type ReactElement, cloneElement, forwardRef } from "react";
import type {
  ControllerRenderProps,
  FieldPath,
  FieldValues,
  UseControllerProps,
} from "react-hook-form";

type FieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = UseControllerProps<TFieldValues, TName> & {
  label?: string;
  description?: string;
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
        render={({ field }: { field: any }) => {
          return (
            <FormItem
              data-testid={`field-${props.name}`}
              className={cn(
                props.className,
                props.isCheckbox
                  ? "flex flex-row items-center space-x-3 space-y-0"
                  : "",
              )}
            >
              {!props.isCheckbox && <FormLabel>{props.label}</FormLabel>}
              <FormControl>
                {cloneElement(props.children, {
                  ...field,
                  ...props.children.props,
                })}
              </FormControl>
              {props.isCheckbox && (
                <FormLabel className="text-sm font-normal">
                  {props.label}
                </FormLabel>
              )}
              {props.description && (
                <FormDescription>{props.description}</FormDescription>
              )}
              <FormMessage />
            </FormItem>
          );
        }}
      />
    );
  },
);
