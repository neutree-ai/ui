import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import type { Cluster } from "../types";
import { useModelCacheFields } from "./use-model-cache-fields";

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
    return useModelCacheFields(form as never);
  });
}

describe("useModelCacheFields", () => {
  describe("addCache / canAdd", () => {
    it("starts with canAdd true and empty caches", () => {
      const { result } = renderCacheFields();
      expect(result.current.canAdd).toBe(true);
      expect(result.current.caches).toHaveLength(0);
    });

    it("adds a host_path cache by default", () => {
      const { result } = renderCacheFields();

      act(() => {
        result.current.addCache();
      });

      expect(result.current.caches).toHaveLength(1);
      expect(result.current.getCacheType(0)).toBe("host_path");
      expect(result.current.canAdd).toBe(false);
    });
  });

  describe("switchCacheType", () => {
    it("switches from host_path to nfs, preserving name", () => {
      const { result } = renderCacheFields();

      act(() => {
        result.current.addCache();
      });

      act(() => {
        result.current.switchCacheType(0, "nfs");
      });

      expect(result.current.getCacheType(0)).toBe("nfs");
    });

    it("switches to pvc with default storage", () => {
      const { result } = renderCacheFields();

      act(() => {
        result.current.addCache();
      });

      act(() => {
        result.current.switchCacheType(0, "pvc");
      });

      expect(result.current.getCacheType(0)).toBe("pvc");
    });
  });

  describe("removeCache", () => {
    it("removes a cache and restores canAdd", () => {
      const { result } = renderCacheFields();

      act(() => {
        result.current.addCache();
      });
      expect(result.current.canAdd).toBe(false);

      act(() => {
        result.current.removeCache(0);
      });

      expect(result.current.caches).toHaveLength(0);
      expect(result.current.canAdd).toBe(true);
    });
  });

  describe("isKubernetes", () => {
    it("returns false for SSH type", () => {
      const { result } = renderCacheFields("ssh");
      expect(result.current.isKubernetes).toBe(false);
    });

    it("returns true for kubernetes type", () => {
      const { result } = renderCacheFields("kubernetes");
      expect(result.current.isKubernetes).toBe(true);
    });
  });

  describe("registerField validation", () => {
    it("registers nfs.server with IP validation", () => {
      const { result } = renderCacheFields();

      act(() => {
        result.current.addCache();
        result.current.switchCacheType(0, "nfs");
      });

      const registration = result.current.registerField(0, "nfs.server");
      expect(registration.name).toBe("spec.config.model_caches.0.nfs.server");
    });

    it("registers nfs.path with path validation", () => {
      const { result } = renderCacheFields();

      act(() => {
        result.current.addCache();
        result.current.switchCacheType(0, "nfs");
      });

      const registration = result.current.registerField(0, "nfs.path");
      expect(registration.name).toBe("spec.config.model_caches.0.nfs.path");
    });

    it("registers host_path.path with path validation", () => {
      const { result } = renderCacheFields();

      act(() => {
        result.current.addCache();
      });

      const registration = result.current.registerField(0, "host_path.path");
      expect(registration.name).toBe(
        "spec.config.model_caches.0.host_path.path",
      );
    });

    it("registers pvc storage with quantity validation", () => {
      const { result } = renderCacheFields();

      act(() => {
        result.current.addCache();
        result.current.switchCacheType(0, "pvc");
      });

      const registration = result.current.registerField(
        0,
        "pvc.resources.requests.storage",
      );
      expect(registration.name).toBe(
        "spec.config.model_caches.0.pvc.resources.requests.storage",
      );
    });

    it("registers name without validation rules", () => {
      const { result } = renderCacheFields();

      act(() => {
        result.current.addCache();
      });

      const registration = result.current.registerField(0, "name");
      expect(registration.name).toBe("spec.config.model_caches.0.name");
    });
  });
});
