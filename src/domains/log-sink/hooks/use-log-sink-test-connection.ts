import { useCustomMutation } from "@refinedev/core";
import { useCallback, useState } from "react";
import {
  buildTestConnectionRequest,
  readTestConnectionError,
  type TestConnectionResult,
  type TestConnectionTarget,
} from "@/domains/log-sink/lib/test-connection";
import { useTranslation } from "@/foundation/lib/i18n";

export function useLogSinkTestConnection() {
  const { t } = useTranslation();
  const { mutateAsync } = useCustomMutation();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestConnectionResult | null>(null);

  const test = useCallback(
    async (target: TestConnectionTarget) => {
      setTesting(true);
      setResult(null);
      try {
        const res = await mutateAsync({
          url: "/log_sinks/test_connection",
          method: "post",
          values: buildTestConnectionRequest(target),
          successNotification: false,
          errorNotification: false,
        });
        setResult(res.data as TestConnectionResult);
      } catch (err) {
        setResult({
          ok: false,
          message: readTestConnectionError(err, t("common.errors.unknown")),
        });
      } finally {
        setTesting(false);
      }
    },
    [mutateAsync, t],
  );

  const reset = useCallback(() => setResult(null), []);

  return { test, testing, result, reset };
}
