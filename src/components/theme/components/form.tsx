import type { SaveButtonProps } from "@/components/theme/types";
import { Form as FormUI } from "@/components/ui/form";
import {
  useBack,
  useNavigation,
  useParsed,
  useRouterType,
  type BaseRecord,
  type HttpError,
} from "@refinedev/core";
import type { UseFormReturnType } from "@refinedev/react-hook-form";
import {
  FC,
  useRef,
  type DetailedHTMLProps,
  type FormHTMLAttributes,
  type PropsWithChildren,
} from "react";
import type { FieldValues } from "react-hook-form";
import { SaveButton } from "../buttons";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type NativeFormProps = Omit<
  DetailedHTMLProps<FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>,
  "onSubmit"
>;

export type FormProps<
  TQueryFnData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
  TVariables extends FieldValues = FieldValues,
  TContext extends object = object,
  TData extends BaseRecord = TQueryFnData,
  TResponse extends BaseRecord = TData,
  TResponseError extends HttpError = TError,
> = PropsWithChildren &
  UseFormReturnType<
    TQueryFnData,
    TError,
    TVariables,
    TContext,
    TData,
    TResponse,
    TResponseError
  > & {
    formProps?: NativeFormProps;
    isWatchable?: boolean;
    hideCancel?: boolean;
    title?: string;
  };

export const Form = <
  TQueryFnData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
  TVariables extends FieldValues = FieldValues,
  TContext extends object = object,
  TData extends BaseRecord = TQueryFnData,
  TResponse extends BaseRecord = TData,
  TResponseError extends HttpError = TError,
>({
  formProps,
  isWatchable,
  saveButtonProps,
  title,
  ...props
}: FormProps<
  TQueryFnData,
  TError,
  TVariables,
  TContext,
  TData,
  TResponse,
  TResponseError
>) => {
  const watchable = useRef<boolean>(false);
  const { resource: _resource, action } = useParsed();
  const routerType = useRouterType();
  const back = useBack();
  const { goBack } = useNavigation();

  const onBack =
    action !== "list" || typeof action !== "undefined"
      ? routerType === "legacy"
        ? goBack
        : back
      : undefined;

  if (isWatchable && !watchable.current) {
    watchable.current = true;
    props.watch();
  }

  const onSubmit = props.handleSubmit((_data: TVariables) => {
    props.refineCore.onFinish(props.getValues()).then();
  });

  return (
    <FormUI {...props}>
      <form {...formProps} onSubmit={onSubmit}>
        <div>
          {title && (
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {title}
            </h2>
          )}

          <div className="pt-6 space-y-4">{props.children}</div>

          <div className="flex justify-end gap-x-4 mt-4">
            {!props.hideCancel && (
              <Button
                type="button"
                onClick={onBack}
                disabled={props.refineCore.formLoading}
                variant="outline"
              >
                Cancel
              </Button>
            )}

            <SaveButton
              type="submit"
              loading={props.refineCore.formLoading}
              {...saveButtonProps}
            />
          </div>
        </div>
      </form>
    </FormUI>
  );
};
