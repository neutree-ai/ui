import { useCustomMutation } from "@refinedev/core";
import { useCallback, useState } from "react";

export type TestConnectivityResult = {
  success: boolean;
  latency_ms?: number;
  models?: string[];
  error?: string;
};

export function useTestConnectivity() {
  const { mutateAsync } = useCustomMutation();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestConnectivityResult | null>(null);

  const test = useCallback(
    async (url: string, credential: string) => {
      setTesting(true);
      setResult(null);
      try {
        const res = await mutateAsync({
          url: "/external_endpoints/test_connectivity",
          method: "post",
          values: {
            upstream: { url },
            auth: { type: "bearer", credential },
          },
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
