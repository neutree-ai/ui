import { useCustomMutation } from "@refinedev/core";
import { useCallback, useState } from "react";

export type TestConnectivityResult = {
  success: boolean;
  latency_ms?: number;
  models?: string[];
  error?: string;
};

type TestConnectivityParams =
  | { type: "external"; url: string; credential: string }
  | { type: "endpoint_ref"; endpoint_ref: string; workspace: string };

function buildPayload(params: TestConnectivityParams) {
  if (params.type === "external") {
    return {
      upstream: { url: params.url },
      auth: { type: "bearer", credential: params.credential },
    };
  }
  return {
    endpoint_ref: params.endpoint_ref,
    workspace: params.workspace,
  };
}

export function useTestConnectivity() {
  const { mutateAsync } = useCustomMutation();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestConnectivityResult | null>(null);

  const test = useCallback(
    async (params: TestConnectivityParams) => {
      setTesting(true);
      setResult(null);
      try {
        const res = await mutateAsync({
          url: "/external_endpoints/test_connectivity",
          method: "post",
          values: buildPayload(params),
          successNotification: false,
          errorNotification: false,
        });
        const data = res.data as TestConnectivityResult;
        setResult(data);
        return data;
      } catch (err) {
        const data: TestConnectivityResult = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
        setResult(data);
        return data;
      } finally {
        setTesting(false);
      }
    },
    [mutateAsync],
  );

  return { test, testing, result };
}
