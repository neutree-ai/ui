import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { Cluster } from "../types";
import { type CacheType, useModelCacheFields } from "./use-model-cache-fields";

function renderCacheFields(type: "ssh" | "kubernetes" = "ssh") {
  return renderHook(() => {
    const form = useForm<Cluster>({
      defaultValues: {
        spec: {
          type,
          config: { model_caches: [] },
        },
      } as unknown as Cluster,
    });
    // Subscribe to formState.errors so RHF tracks error updates
    void form.formState.errors;
    return { form, fields: useModelCacheFields(form as never) };
  });
}

const cacheAt = (form: { getValues: (name: never) => unknown }) =>
  form.getValues("spec.config.model_caches.0" as never);

describe("useModelCacheFields", () => {
  it("adds one host_path cache, then allows another only after removing it", () => {
    const { result } = renderCacheFields();
    expect(result.current.fields.canAdd).toBe(true);

    act(() => result.current.fields.addCache());
    expect(result.current.fields.getCacheType(0)).toBe("host_path");
    expect(result.current.fields.canAdd).toBe(false);

    act(() => result.current.fields.removeCache(0));
    expect(result.current.fields.caches).toHaveLength(0);
    expect(result.current.fields.canAdd).toBe(true);
  });

  it.each([
    { to: "nfs", expected: { nfs: { server: "", path: "" } } },
    {
      to: "pvc",
      expected: {
        pvc: {
          accessModes: ["ReadWriteMany"],
          resources: { requests: { storage: "500Gi" } },
        },
      },
    },
  ] as const)(
    "switches to $to with its defaults, preserving the name",
    ({ to, expected }) => {
      const { result } = renderCacheFields();
      act(() => result.current.fields.addCache());
      act(() =>
        result.current.form.setValue("spec.config.model_caches.0.name", "c1"),
      );

      act(() => result.current.fields.switchCacheType(0, to));

      expect(result.current.fields.getCacheType(0)).toBe(to);
      expect(cacheAt(result.current.form)).toEqual({ name: "c1", ...expected });
    },
  );

  it.each([
    ["ssh", false],
    ["kubernetes", true],
  ] as const)("isKubernetes for %s is %s", (type, expected) => {
    const { result } = renderCacheFields(type);
    expect(result.current.fields.isKubernetes).toBe(expected);
  });

  it.each([
    {
      type: "nfs",
      field: "nfs.server",
      value: "",
      error: "clusters.validation.nfsServerRequired",
    },
    {
      type: "nfs",
      field: "nfs.server",
      value: "not-an-ip",
      error: "clusters.validation.invalidIPAddress",
    },
    {
      type: "nfs",
      field: "nfs.path",
      value: "",
      error: "clusters.validation.cachePathRequired",
    },
    {
      type: "host_path",
      field: "host_path.path",
      value: "relative",
      error: "clusters.validation.invalidPath",
    },
    {
      type: "pvc",
      field: "pvc.resources.requests.storage",
      value: "lots",
      error: "clusters.validation.invalidStorageFormat",
    },
  ] as const)(
    "rejects $field '$value' with $error",
    async ({ type, field, value, error }) => {
      const { result } = renderCacheFields();
      act(() => result.current.fields.addCache());
      act(() => result.current.fields.switchCacheType(0, type as CacheType));
      const name = `spec.config.model_caches.0.${field}` as const;
      act(() => {
        result.current.fields
          .registerField(0, field)
          .ref(document.createElement("input"));
        result.current.form.setValue(name, value);
      });

      await act(async () => {
        await result.current.form.trigger(name);
      });

      expect(result.current.form.getFieldState(name).error?.message).toBe(
        error,
      );
      expect(result.current.fields.hasFieldError(0, field)).toBe(true);
    },
  );
});
