import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingIcon } from "@/components/ui/loading";
import { useDeleteRegistryModel } from "@/domains/model-registry/hooks/use-registry-model";
import type { RegistryModelRef } from "@/foundation/lib/api/registry-models";
import {
  MODEL_REFERENCED_CODE,
  RegistryModelError,
} from "@/foundation/lib/api/registry-models";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ModelReference } from "@/foundation/types/model-types";

/**
 * Deletes a model version, and when the server refuses because something still
 * points at it, lists what.
 *
 * The list is the whole point: a count tells a user they are blocked, the names
 * tell them what to go and change. An endpoint's phase is shown alongside it,
 * because "this is mid-deployment" is a different problem from "this is serving
 * traffic" and the server distinguishes the two.
 */

/**
 * The one phase in which an endpoint is serving traffic. Everything else —
 * coming up, paused, failed, on its way out — is marked, and marking is decided
 * by what a phase is *not*, so a phase added on the server shows up as worth a
 * second look rather than silently reading as "in service".
 *
 * Nothing here interprets what the other phases mean; the server's own word for
 * the phase is what gets rendered.
 */
const SERVING_PHASE = "Running";

export const referencePhaseClassName = (phase: string) =>
  phase === SERVING_PHASE
    ? "ml-2 text-muted-foreground"
    : "ml-2 text-amber-600 dark:text-amber-500";

export const ReferenceList = ({
  references,
}: {
  references: ModelReference[];
}) => {
  const { t } = useTranslation();

  return (
    <ul className="mt-2 space-y-2" data-testid="model-delete-references">
      {references.map((reference) => (
        <li
          key={`${reference.kind}/${reference.workspace}/${reference.name}/${
            reference.variant ?? ""
          }`}
          className="rounded-[var(--nt-radius-input)] bg-[var(--nt-fill-neutral-opaque-1)] px-3 py-2 text-sm"
        >
          <span className="font-medium">{reference.kind}</span>
          <span className="mx-1 text-muted-foreground">/</span>
          <span>{reference.workspace}</span>
          <span className="mx-1 text-muted-foreground">/</span>
          <span>{reference.name}</span>
          {reference.variant ? (
            <span className="ml-2 text-muted-foreground">
              {t("model_registries.models.delete.variant", {
                variant: reference.variant,
              })}
            </span>
          ) : null}
          {reference.phase ? (
            <span
              className={referencePhaseClassName(reference.phase)}
              data-testid={`model-delete-reference-phase-${reference.phase}`}
            >
              {reference.phase}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelRef: RegistryModelRef;
  modelName: string;
  onDeleted?: () => void;
};

export const ModelDeleteDialog = ({
  open,
  onOpenChange,
  modelRef,
  modelName,
  onDeleted,
}: Props) => {
  const { t } = useTranslation();
  const remove = useDeleteRegistryModel();
  const [references, setReferences] = useState<ModelReference[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const reset = (nextOpen: boolean) => {
    if (nextOpen) {
      setReferences(null);
      setFailure(null);
    }

    onOpenChange(nextOpen);
  };

  const submit = () => {
    setReferences(null);
    setFailure(null);

    remove.mutate(modelRef, {
      onSuccess: () => {
        toast.success(t("model_registries.models.delete.success"));
        reset(false);
        onDeleted?.();
      },
      onError: (error) => {
        if (
          error instanceof RegistryModelError &&
          error.body.code === MODEL_REFERENCED_CODE &&
          error.body.references?.length
        ) {
          setReferences(error.body.references);

          return;
        }

        setFailure(error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("model_registries.models.delete.title")}</DialogTitle>
          <DialogDescription>
            {t("model_registries.models.delete.description", {
              name: modelName,
              version: modelRef.version ?? "",
            })}
          </DialogDescription>
        </DialogHeader>

        {references ? (
          <div data-testid="model-delete-blocked">
            <p className="text-sm text-destructive">
              {t("model_registries.models.delete.blocked")}
            </p>
            <ReferenceList references={references} />
          </div>
        ) : null}

        {failure ? (
          <p
            className="text-sm text-destructive"
            data-testid="model-delete-error"
          >
            {failure}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => reset(false)}>
            {t("buttons.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={remove.isLoading}
            data-testid="model-delete-submit"
          >
            {remove.isLoading ? <LoadingIcon className="mr-2" /> : null}
            {t("buttons.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
