import type { UseFormReturnType } from "@refinedev/react-hook-form";
import { useRefineFieldArray } from "@/foundation/hooks/use-refine-field-array";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  isValidIPAddress,
  isValidPath,
  isValidStorageQuantity,
} from "@/foundation/lib/validate";
import { getCacheType as getCacheTypeFromObj } from "../lib/get-cache-type";
import type { Cluster, ModelCache } from "../types";

export type CacheType = "nfs" | "host_path" | "pvc";

type CacheFieldPath =
  | "name"
  | "nfs.server"
  | "nfs.path"
  | "host_path.path"
  | "pvc.resources.requests.storage"
  | "pvc.storageClassName";

const cacheDefaults: Record<CacheType, Omit<ModelCache, "name">> = {
  nfs: { nfs: { server: "", path: "" } },
  pvc: {
    pvc: {
      accessModes: ["ReadWriteMany"],
      resources: { requests: { storage: "500Gi" } },
    },
  },
  host_path: { host_path: { path: "" } },
};

const requiredField = (
  requiredMsg: string,
  check: (value: string) => boolean,
  invalidMsg: string,
) => ({
  required: { value: true as const, message: requiredMsg },
  validate: (value: string) => !value || check(value) || invalidMsg,
});

export function useModelCacheFields(form: UseFormReturnType<Cluster>) {
  const { t } = useTranslation();

  const { fields, append, remove } = useRefineFieldArray({
    control: form.control,
    name: "spec.config.model_caches",
    refineForm: form,
  });

  const caches: { name?: string }[] =
    form.watch("spec.config.model_caches") || [];

  const isKubernetes = form.watch("spec.type") === "kubernetes";

  const getCacheType = (index: number): CacheType => {
    const cache = form.watch(`spec.config.model_caches.${index}`);
    return getCacheTypeFromObj(cache || {});
  };

  const switchCacheType = (index: number, newType: CacheType) => {
    const name = form.watch(`spec.config.model_caches.${index}`)?.name || "";
    form.setValue(`spec.config.model_caches.${index}`, {
      name,
      ...cacheDefaults[newType],
    });
  };

  const addCache = () => {
    append({ name: "", host_path: { path: "" } });
  };

  const pathRules = requiredField(
    t("clusters.validation.cachePathRequired"),
    isValidPath,
    t("clusters.validation.invalidPath"),
  );

  const registerField = (index: number, field: CacheFieldPath) => {
    switch (field) {
      case "name":
        return form.register(`spec.config.model_caches.${index}.name`);
      case "nfs.server":
        return form.register(
          `spec.config.model_caches.${index}.nfs.server`,
          requiredField(
            t("clusters.validation.nfsServerRequired"),
            isValidIPAddress,
            t("clusters.validation.invalidIPAddress"),
          ),
        );
      case "nfs.path":
        return form.register(
          `spec.config.model_caches.${index}.nfs.path`,
          pathRules,
        );
      case "host_path.path":
        return form.register(
          `spec.config.model_caches.${index}.host_path.path`,
          pathRules,
        );
      case "pvc.resources.requests.storage":
        return form.register(
          `spec.config.model_caches.${index}.pvc.resources.requests.storage`,
          requiredField(
            t("clusters.validation.storageRequired"),
            isValidStorageQuantity,
            t("clusters.validation.invalidStorageFormat"),
          ),
        );
      case "pvc.storageClassName":
        return form.register(
          `spec.config.model_caches.${index}.pvc.storageClassName`,
        );
    }
  };

  const hasFieldError = (index: number, field: CacheFieldPath): boolean => {
    const { error } = form.getFieldState(
      `spec.config.model_caches.${index}.${field}`,
      form.formState,
    );
    return !!error;
  };

  return {
    fields,
    caches,
    isKubernetes,
    canAdd: caches.length < 1,
    getCacheType,
    switchCacheType,
    addCache,
    removeCache: remove,
    registerField,
    hasFieldError,
  };
}
