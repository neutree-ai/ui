import type { BaseRecord, HttpError } from "@refinedev/core";
import type { UseFormReturnType } from "@refinedev/react-hook-form";
import {
  type DetailedHTMLProps,
  type FormEventHandler,
  type FormHTMLAttributes,
  type PropsWithChildren,
  useMemo,
  useRef,
} from "react";
import type { FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form as FormUI } from "@/components/ui/form";
import { SaveButton } from "@/foundation/components/SaveButton";
import { useOnBack } from "@/foundation/hooks/use-on-back";
import { useTranslation } from "@/foundation/lib/i18n";
import { ResourceFormSubmitContext } from "./resource-form-submit-context";

type NativeFormProps = Omit<
  DetailedHTMLProps<FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>,
  "onSubmit"
>;

type FormProps<
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
    // When true, the submit button is greyed out and submit attempts (incl.
    // Enter key) are refused. Owners compute this from their own state — e.g.
    // the endpoint form blocks deploy while a requested resource exceeds
    // cluster capacity — so no upward effect/context plumbing is needed.
    submitBlocked?: boolean;
  };

export const ResourceForm = <
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
  submitBlocked = false,
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
  const beforeSubmitHandlers = useRef(new Set<() => boolean | undefined>());
  const onBack = useOnBack();
  const { t } = useTranslation();

  if (isWatchable && !watchable.current) {
    watchable.current = true;
    props.watch();
  }

  const submitContext = useMemo(
    () => ({
      registerBeforeSubmit: (handler: () => boolean | undefined) => {
        beforeSubmitHandlers.current.add(handler);
        return () => {
          beforeSubmitHandlers.current.delete(handler);
        };
      },
    }),
    [],
  );

  const onSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    if (submitBlocked) {
      event.preventDefault();
      return;
    }
    for (const handler of beforeSubmitHandlers.current) {
      if (handler() === false) {
        event.preventDefault();
        return;
      }
    }
    props.handleSubmit((data: TVariables) => {
      props.refineCore.onFinish(data).then();
    })(event);
  };

  return (
    <FormUI {...props}>
      <ResourceFormSubmitContext.Provider value={submitContext}>
        <form {...formProps} onSubmit={onSubmit} data-testid="form">
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
                  data-testid="form-cancel"
                >
                  {t("buttons.cancel")}
                </Button>
              )}

              <SaveButton
                type="submit"
                loading={props.refineCore.formLoading}
                disabled={submitBlocked}
                data-testid="form-submit"
              />
            </div>
          </div>
        </form>
      </ResourceFormSubmitContext.Provider>
    </FormUI>
  );
};
