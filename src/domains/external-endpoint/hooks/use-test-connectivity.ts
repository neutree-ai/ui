import { useCustomMutation } from "@refinedev/core";
import { useCallback, useState } from "react";

export type TestConnectivityResult = {
  success: boolean;
  latency_ms?: number;
  models?: string[];
  error?: string;
};

type TestConnectivityParams =
  | {
      type: "external";
      url: string;
      credential: string;
      name?: string;
      workspace?: string;
      stored_upstream_url?: string;
    }
  | { type: "endpoint_ref"; endpoint_ref: string; workspace: string };

function buildPayload(params: TestConnectivityParams) {
  if (params.type === "external") {
    return {
      upstream: { url: params.url },
      auth: { type: "bearer", credential: params.credential },
      ...(params.name ? { name: params.name } : {}),
      ...(params.workspace ? { workspace: params.workspace } : {}),
      ...(params.stored_upstream_url
        ? { stored_upstream_url: params.stored_upstream_url }
        : {}),
    };
  }
  return {
    endpoint_ref: params.endpoint_ref,
    workspace: params.workspace,
  };
}

export function useTestConnectivity() {
  const { mutateAsync } = useCustomMutation();
  const [testingMap, setTestingMap] = useState<Record<number, boolean>>({});
  const [resultMap, setResultMap] = useState<
    Record<number, TestConnectivityResult | null>
  >({});

  const test = useCallback(
    async (key: number, params: TestConnectivityParams) => {
      setTestingMap((prev) => ({ ...prev, [key]: true }));
      setResultMap((prev) => ({ ...prev, [key]: null }));
      try {
        const res = await mutateAsync({
          url: "/external_endpoints/test_connectivity",
          method: "post",
          values: buildPayload(params),
          successNotification: false,
          errorNotification: false,
        });
        const data = res.data as TestConnectivityResult;
        setResultMap((prev) => ({ ...prev, [key]: data }));
        return data;
      } catch (err) {
        const data: TestConnectivityResult = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
        setResultMap((prev) => ({ ...prev, [key]: data }));
        return data;
      } finally {
        setTestingMap((prev) => ({ ...prev, [key]: false }));
      }
    },
    [mutateAsync],
  );

  return { test, testingMap, resultMap };
}
