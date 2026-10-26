import { describe, expect, it } from "vitest";
import type { LogSource } from "@/domains/endpoint/hooks/use-endpoint-log-sources";
import {
  filterByTimestamp,
  getDefaultLogContainer,
  getLogUrls,
} from "./log-helpers";

describe("getDefaultLogContainer", () => {
  const engineNames = new Set(["vllm", "sglang", "custom-engine"]);
  const inference: LogSource = {
    type: "logs",
    url: "/logs?container=vllm",
    download_url: "/logs?container=vllm&download=true",
    container_name: "vllm",
    started: true,
  };
  const downloader: LogSource = {
    type: "logs",
    url: "/logs?container=model-downloader",
    download_url: "/logs?container=model-downloader&download=true",
    container_name: "model-downloader",
    started: true,
  };

  it("prioritizes a started registered engine regardless of container order", () => {
    expect(getDefaultLogContainer([downloader, inference], engineNames)).toBe(
      inference,
    );
  });

  it("defaults to the downloader before inference has started", () => {
    expect(
      getDefaultLogContainer(
        [{ ...inference, started: undefined }, downloader],
        engineNames,
      ),
    ).toBe(downloader);
  });

  it("keeps a crashed inference container available during a restart", () => {
    const crashed = { ...inference, started: false, restart_count: 1 };
    expect(getDefaultLogContainer([downloader, crashed], engineNames)).toBe(
      crashed,
    );
  });

  it("supports custom registered engines instead of a fixed built-in list", () => {
    const custom = { ...inference, container_name: "custom-engine" };
    expect(getDefaultLogContainer([downloader, custom], engineNames)).toBe(
      custom,
    );
  });

  it("preserves API order when no container name is recognized", () => {
    const customInit = { ...downloader, container_name: "custom-init" };
    const customWorker = { ...inference, container_name: "custom-worker" };
    expect(
      getDefaultLogContainer([customInit, customWorker], engineNames),
    ).toBe(customInit);
  });
});

describe("getLogUrls", () => {
  const source = {
    url: "/api/v1/endpoints/default/model/logs/pod/logs",
    download_url: "/api/v1/endpoints/default/model/logs/pod/logs?download=true",
  };

  it("selects the same container and previous run for viewing and downloading", () => {
    const urls = getLogUrls(
      {
        url: `${source.url}?container=engine`,
        download_url: `${source.download_url}&container=engine`,
      },
      "engine",
      true,
    );
    const view = new URL(urls.url, "http://localhost");
    const download = new URL(urls.downloadUrl, "http://localhost");

    for (const parsed of [view, download]) {
      expect(parsed.searchParams.getAll("container")).toEqual(["engine"]);
      expect(parsed.searchParams.get("previous")).toBe("true");
    }
    expect(view.searchParams.get("lines")).toBe("1000");
    expect(download.searchParams.get("download")).toBe("true");
  });
});

describe("filterByTimestamp", () => {
  it("includes lines without a timestamp", () => {
    expect(filterByTimestamp("plain log line with no date")).toBe(true);
  });

  it("includes a timestamp within the range", () => {
    const line = "2024-01-15T10:30:00 INFO something";
    expect(
      filterByTimestamp(line, "2024-01-15T10:00:00", "2024-01-15T11:00:00"),
    ).toBe(true);
  });

  it("excludes a timestamp before startTime", () => {
    const line = "2024-01-15T09:00:00 INFO too early";
    expect(filterByTimestamp(line, "2024-01-15T10:00:00")).toBe(false);
  });

  it("excludes a timestamp after endTime", () => {
    const line = "2024-01-15T12:00:00 INFO too late";
    expect(filterByTimestamp(line, undefined, "2024-01-15T11:00:00")).toBe(
      false,
    );
  });

  it("includes when only startTime is set and timestamp is after it", () => {
    const line = "2024-01-15T11:00:00 INFO ok";
    expect(filterByTimestamp(line, "2024-01-15T10:00:00")).toBe(true);
  });

  it("includes when only endTime is set and timestamp is before it", () => {
    const line = "2024-01-15T09:00:00 INFO ok";
    expect(filterByTimestamp(line, undefined, "2024-01-15T10:00:00")).toBe(
      true,
    );
  });

  it("includes lines with unparseable dates", () => {
    // The regex matches but Date.parse returns NaN
    const line = "9999-99-99T99:99:99 broken";
    expect(filterByTimestamp(line, "2024-01-01T00:00:00")).toBe(true);
  });

  it("handles ISO format timestamps (T separator)", () => {
    const line = "2024-01-15T10:30:00 INFO iso";
    expect(
      filterByTimestamp(line, "2024-01-15T10:00:00", "2024-01-15T11:00:00"),
    ).toBe(true);
  });

  it("handles space-separated timestamps", () => {
    const line = "2024-01-15 10:30:00 INFO space";
    expect(
      filterByTimestamp(line, "2024-01-15T10:00:00", "2024-01-15T11:00:00"),
    ).toBe(true);
  });

  it("includes when no time boundaries are provided", () => {
    const line = "2024-01-15T10:30:00 INFO no bounds";
    expect(filterByTimestamp(line)).toBe(true);
  });
});
