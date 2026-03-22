import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { config } from "../config";

interface TestRailResult {
  case_id: number;
  status_id: TestRailStatus;
  elapsed: string;
  comment?: string;
}

interface CollectedResult extends TestRailResult {
  attachments: { name: string; path: string; uploadName: string }[];
}

enum TestRailStatus {
  Passed = 1,
  Blocked = 2,
  Untested = 3,
  Retest = 4,
  Failed = 5,
}

const STATUS_MAP: Record<string, TestRailStatus> = {
  passed: TestRailStatus.Passed,
  failed: TestRailStatus.Failed,
  timedOut: TestRailStatus.Failed,
  skipped: TestRailStatus.Blocked,
  interrupted: TestRailStatus.Failed,
};

function shouldUploadAttachment(a: {
  name?: string;
  path?: string;
  contentType?: string;
}): boolean {
  if (!a.path) return false;

  const contentType = a.contentType || "";
  if (contentType.startsWith("image/")) return true;
  if (contentType === "application/zip") return true;

  const name = (a.name || "").toLowerCase();
  if (name === "trace" || name === "screenshot" || name === "video")
    return true;

  const ext = extname(a.path).toLowerCase();
  return [
    ".zip",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".mp4",
    ".webm",
  ].includes(ext);
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

function extractCaseIds(test: TestCase): number[] {
  const ids: number[] = [];
  for (const tag of test.tags) {
    const match = tag.match(/@C(\d+)/);
    if (match) ids.push(Number.parseInt(match[1], 10));
  }
  return ids;
}

class TestRailReporter implements Reporter {
  private runId: string | undefined;
  private baseUrl: string;
  private user: string;
  private password: string;
  private results = new Map<number, CollectedResult>();

  constructor() {
    this.runId = config.testrail.runId || undefined;
    this.baseUrl = config.testrail.url;
    this.user = config.testrail.user;
    this.password = config.testrail.password;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.runId) return;

    const caseIds = extractCaseIds(test);
    if (caseIds.length === 0) return;

    const statusId = STATUS_MAP[result.status] ?? TestRailStatus.Failed;
    const isFailed = statusId === TestRailStatus.Failed;

    const attachments: { name: string; path: string; uploadName: string }[] =
      [];
    if (isFailed) {
      for (const a of result.attachments) {
        if (shouldUploadAttachment(a)) {
          const path = a.path;
          if (!path) continue;
          const fallbackName = a.name || "attachment";
          const fileNameFromPath = basename(path);
          const uploadName = fileNameFromPath || fallbackName;
          attachments.push({ name: fallbackName, path, uploadName });
        }
      }
    }

    for (const caseId of caseIds) {
      const entry: CollectedResult = {
        case_id: caseId,
        status_id: statusId,
        elapsed: formatElapsed(result.duration),
        attachments,
      };

      if (isFailed) {
        entry.comment = result.error?.message || "Test failed";
      }

      // Overwrite on retry — only last result matters
      this.results.set(caseId, entry);
    }
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (!this.runId || this.results.size === 0) return;

    const collected = Array.from(this.results.values());
    const passed = collected.filter(
      (r) => r.status_id === TestRailStatus.Passed,
    ).length;
    const failed = collected.filter(
      (r) => r.status_id === TestRailStatus.Failed,
    ).length;
    const blocked = collected.filter(
      (r) => r.status_id === TestRailStatus.Blocked,
    ).length;

    console.log(
      `\nTestRail: Reporting ${collected.length} result(s) to run ${this.runId} (${passed} passed, ${failed} failed, ${blocked} blocked)`,
    );

    const auth = Buffer.from(`${this.user}:${this.password}`).toString(
      "base64",
    );
    const apiUrl = (path: string) =>
      `${this.baseUrl}/index.php?/api/v2/${path}`;
    const headers = { Authorization: `Basic ${auth}` };

    // Step 1: bulk report results
    const payload: TestRailResult[] = collected.map(
      ({ attachments: _, ...rest }) => rest,
    );

    let resultIds: Map<number, number> | undefined;
    try {
      const response = await fetch(
        apiUrl(`add_results_for_cases/${this.runId}`),
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ results: payload }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        console.error(
          `TestRail: Failed to report results (${response.status}): ${body}`,
        );
        return;
      }

      console.log("TestRail: Results reported successfully");

      // Map case_id → result_id from response
      const data = (await response.json()) as { id: number; test_id: number }[];
      // Response order matches request order
      resultIds = new Map<number, number>();
      for (let i = 0; i < data.length; i++) {
        resultIds.set(payload[i].case_id, data[i].id);
      }
    } catch (error) {
      console.error(`TestRail: Error reporting results: ${error}`);
      return;
    }

    // Step 2: upload attachments for failed tests
    const withAttachments = collected.filter((r) => r.attachments.length > 0);
    if (withAttachments.length === 0 || !resultIds) return;

    let uploaded = 0;
    for (const r of withAttachments) {
      const resultId = resultIds.get(r.case_id);
      if (!resultId) continue;

      for (const a of r.attachments) {
        try {
          const fileData = readFileSync(a.path);
          const blob = new Blob([fileData]);
          const form = new FormData();
          form.append("attachment", blob, a.uploadName);

          const response = await fetch(
            apiUrl(`add_attachment_to_result/${resultId}`),
            { method: "POST", headers, body: form },
          );

          if (response.ok) {
            uploaded++;
          } else {
            const body = await response.text();
            console.error(
              `TestRail: Failed to upload ${a.name} for C${r.case_id} (${response.status}): ${body}`,
            );
          }
        } catch (error) {
          console.error(
            `TestRail: Error uploading ${a.name} for C${r.case_id}: ${error}`,
          );
        }
      }
    }

    if (uploaded > 0) {
      console.log(`TestRail: Uploaded ${uploaded} attachment(s)`);
    }
  }
}

export default TestRailReporter;
