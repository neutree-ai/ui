import { describe, expect, it } from "vitest";
import {
  filterByTimestamp,
  getDefaultLogContainer,
  getLogUrls,
  type LogContainer,
} from "./log-helpers";

describe("getDefaultLogContainer", () => {
  const engineNames = new Set(["vllm", "sglang", "custom-engine"]);
  const inference: LogContainer = {
    name: "vllm",
    type: "container",
    restart_count: 0,
    started: true,
  };
  const downloader: LogContainer = {
    name: "model-downloader",
    type: "initContainer",
    restart_count: 0,
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
        [{ ...inference, started: false }, downloader],
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
    const custom = { ...inference, name: "custom-engine" };
    expect(getDefaultLogContainer([downloader, custom], engineNames)).toBe(
      custom,
    );
  });

  it("preserves API order when no container name is recognized", () => {
    const customInit = { ...downloader, name: "custom-init" };
    const customWorker = { ...inference, name: "custom-worker" };
    expect(
      getDefaultLogContainer([customInit, customWorker], engineNames),
    ).toBe(customInit);
  });

  it("falls back to the first container if no preferred source is available", () => {
    const waiting = { ...inference, started: false };
    expect(getDefaultLogContainer([waiting], engineNames)).toBe(waiting);
    expect(getDefaultLogContainer([], engineNames)).toBeUndefined();
  });

  it("supports older metadata without assuming an unstarted engine has logs", () => {
    const legacy = { ...inference, started: undefined };
    expect(getDefaultLogContainer([legacy, downloader], engineNames)).toBe(
      downloader,
    );
    const restarted = { ...legacy, restart_count: 1 };
    expect(getDefaultLogContainer([downloader, restarted], engineNames)).toBe(
      restarted,
    );
  });
});

describe("getLogUrls", () => {
  const source = {
    url: "/api/v1/endpoints/default/model/logs/pod/logs?tail=true",
    download_url:
      "/api/v1/endpoints/default/model/logs/pod/logs?download=true&tail=true",
  };

  it("keeps legacy and Ray downloads unchanged while appending the line limit safely", () => {
    expect(getLogUrls(source)).toEqual({
      url: "/endpoints/default/model/logs/pod/logs?tail=true&lines=1000",
      downloadUrl: source.download_url,
    });
  });

  it("selects the same container and previous run for viewing and downloading", () => {
    const urls = getLogUrls(source, "engine", true);
    const view = new URL(urls.url, "http://localhost");
    const download = new URL(urls.downloadUrl, "http://localhost");

    for (const parsed of [view, download]) {
      expect(parsed.searchParams.get("container")).toBe("engine");
      expect(parsed.searchParams.get("previous")).toBe("true");
      expect(parsed.searchParams.get("tail")).toBe("true");
    }
    expect(view.searchParams.get("lines")).toBe("1000");
    expect(download.searchParams.get("download")).toBe("true");
  });

  it("removes an inherited previous flag for current and encodes names", () => {
    const urls = getLogUrls(
      {
        url: "/logs/pod/logs?previous=true&lines=20#fragment",
        download_url: "/logs/pod/logs?previous=true",
      },
      "engine+worker/name",
    );
    const view = new URL(urls.url, "http://localhost");
    const download = new URL(urls.downloadUrl, "http://localhost");

    expect(view.searchParams.get("container")).toBe("engine+worker/name");
    expect(view.searchParams.has("previous")).toBe(false);
    expect(view.searchParams.getAll("lines")).toEqual(["1000"]);
    expect(view.hash).toBe("#fragment");
    expect(download.searchParams.has("previous")).toBe(false);
    expect(download.searchParams.get("download")).toBe("true");
  });

  it("handles URLs without a query and does not strip similar API prefixes", () => {
    expect(
      getLogUrls({ url: "/api/v10/logs", download_url: "/download" }),
    ).toEqual({ url: "/api/v10/logs?lines=1000", downloadUrl: "/download" });
  });

  it("preserves question marks inside existing query values and the whole fragment", () => {
    const { url } = getLogUrls({
      url: "/logs?filename=/tmp/worker?old.log#part#two",
      download_url: "/download",
    });
    const parsed = new URL(url, "http://localhost");

    expect(parsed.searchParams.get("filename")).toBe("/tmp/worker?old.log");
    expect(parsed.searchParams.get("lines")).toBe("1000");
    expect(parsed.hash).toBe("#part#two");
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
