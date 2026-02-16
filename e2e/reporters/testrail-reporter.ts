import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

interface TestRailResult {
  case_id: number;
  status_id: number;
  elapsed: string;
  comment?: string;
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

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

function extractCaseId(test: TestCase): number | null {
  for (const tag of test.tags) {
    const match = tag.match(/@C(\d+)/);
    if (match) return Number.parseInt(match[1], 10);
  }
  return null;
}

class TestRailReporter implements Reporter {
  private runId: string | undefined;
  private baseUrl: string;
  private user: string;
  private password: string;
  private results = new Map<number, TestRailResult>();

  constructor() {
    this.runId = process.env.TESTRAIL_RUN_ID;
    this.baseUrl = process.env.TESTRAIL_URL || "";
    this.user = process.env.TESTRAIL_USER || "";
    this.password = process.env.TESTRAIL_PASSWORD || "";
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.runId) return;

    const caseId = extractCaseId(test);
    if (!caseId) return;

    const statusId = STATUS_MAP[result.status] ?? TestRailStatus.Failed;
    const entry: TestRailResult = {
      case_id: caseId,
      status_id: statusId,
      elapsed: formatElapsed(result.duration),
    };

    if (result.status === "failed" || result.status === "timedOut") {
      entry.comment = result.error?.message || "Test failed";
    }

    // Overwrite on retry — only last result matters
    this.results.set(caseId, entry);
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (!this.runId || this.results.size === 0) return;

    const results = Array.from(this.results.values());
    const passed = results.filter(
      (r) => r.status_id === TestRailStatus.Passed,
    ).length;
    const failed = results.filter(
      (r) => r.status_id === TestRailStatus.Failed,
    ).length;
    const blocked = results.filter(
      (r) => r.status_id === TestRailStatus.Blocked,
    ).length;

    console.log(
      `\nTestRail: Reporting ${results.length} result(s) to run ${this.runId} (${passed} passed, ${failed} failed, ${blocked} blocked)`,
    );

    const url = `${this.baseUrl}/index.php?/api/v2/add_results_for_cases/${this.runId}`;
    const auth = Buffer.from(`${this.user}:${this.password}`).toString(
      "base64",
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({ results }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(
          `TestRail: Failed to report results (${response.status}): ${body}`,
        );
      } else {
        console.log("TestRail: Results reported successfully");
      }
    } catch (error) {
      console.error(`TestRail: Error reporting results: ${error}`);
    }
  }
}

export default TestRailReporter;
