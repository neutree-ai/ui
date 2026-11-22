import type { BaseRecord, HttpError } from "@refinedev/core";
import type { UseFormReturnType } from "@refinedev/react-hook-form";
import {
  type DetailedHTMLProps,
  type FormEventHandler,
  type FormHTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  useMemo,
  useRef,
} from "react";
import type { FieldErrors, FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form as FormUI } from "@/components/ui/form";
import { SaveButton } from "@/foundation/components/SaveButton";
import { useFormEnterSubmitGuard } from "@/foundation/hooks/use-form-enter-submit-guard";
import { useOnBack } from "@/foundation/hooks/use-on-back";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { InfoHint } from "./InfoHint";
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
    // Blocked forms normally disable the submit button. A wizard still needs
    // the click as a validation attempt so it can explain and navigate to the
    // problem instead of leaving the button inert.
    blockedSubmitMode?: "disabled" | "report";
    onBlockedSubmit?: () => void;
    onInvalid?: (errors: FieldErrors<TVariables>) => void;
    onSubmitError?: (error: unknown) => void;
    /** Hide the submit action when navigation owns the next step. */
    hideSubmit?: boolean;
    /** Route Cancel to a stable destination instead of browser history. */
    cancelHref?: string;
    submitLabel?: string;
    /** Explanation shown beside the primary submit action. */
    submitHint?: string;
    footerLeadingActions?: ReactNode;
    footerActions?: ReactNode;
    /** Let dense operational wizards use the available desktop width. */
    contentWidth?: "default" | "wide";
  };

const formActionButtonClassName = "h-8 min-w-[88px] px-3 py-1";

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
  blockedSubmitMode = "disabled",
  onBlockedSubmit,
  onInvalid,
  onSubmitError,
  hideSubmit = false,
  cancelHref,
  submitLabel,
  submitHint,
  footerLeadingActions,
  footerActions,
  contentWidth = "default",
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
  const onKeyDown = useFormEnterSubmitGuard();
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
      onBlockedSubmit?.();
      return;
    }
    for (const handler of beforeSubmitHandlers.current) {
      if (handler() === false) {
        event.preventDefault();
        return;
      }
    }
    props.handleSubmit(
      (data: TVariables) => {
        Promise.resolve(props.refineCore.onFinish(data)).catch((error) => {
          onSubmitError?.(error);
        });
      },
      (errors) => onInvalid?.(errors),
    )(event);
  };

  return (
    <FormUI {...props}>
      <ResourceFormSubmitContext.Provider value={submitContext}>
        <form
          {...formProps}
          onSubmit={onSubmit}
          onKeyDown={onKeyDown}
          data-testid="form"
        >
          <div
            className={cn(
              "mx-auto w-full",
              contentWidth === "wide" ? "max-w-[1680px]" : "max-w-[1280px]",
            )}
          >
            {title && (
              <div className="mb-4">
                <h1 className="text-2xl font-semibold leading-8 text-foreground">
                  {title}
                </h1>
              </div>
            )}

            <div className="space-y-4">{props.children}</div>

            <div className="sticky -bottom-2 z-10 mt-5 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t bg-background/90 px-1 py-4 backdrop-blur">
              {footerLeadingActions && (
                <div className="mr-auto flex items-center gap-3">
                  {footerLeadingActions}
                </div>
              )}
              {!props.hideCancel &&
                (cancelHref ? (
                  <Button
                    asChild
                    variant="outline"
                    className={formActionButtonClassName}
                  >
                    <a href={cancelHref} data-testid="form-cancel">
                      {t("buttons.cancel")}
                    </a>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={onBack}
                    disabled={props.refineCore.formLoading}
                    variant="outline"
                    className={formActionButtonClassName}
                    data-testid="form-cancel"
                  >
                    {t("buttons.cancel")}
                  </Button>
                ))}

              {footerActions}

              {!hideSubmit && (
                <>
                  <SaveButton
                    type="submit"
                    loading={props.refineCore.formLoading}
                    disabled={submitBlocked && blockedSubmitMode === "disabled"}
                    className={formActionButtonClassName}
                    data-testid="form-submit"
                  >
                    {submitLabel}
                  </SaveButton>
                  {submitHint && (
                    <span className="-ml-2 flex shrink-0 items-center">
                      <InfoHint label={submitHint} />
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </form>
      </ResourceFormSubmitContext.Provider>
    </FormUI>
  );
};
