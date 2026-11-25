import { describe, expect, it } from "vitest";
import { repositoryUrl } from "./detail-fields";

describe("repositoryUrl", () => {
  it.each([
    {
      url: "https://index.docker.io/v1/",
      repository: "/neutree",
      shown: "https://index.docker.io/v1/neutree",
    },
    {
      url: "https://registry.example.com",
      repository: "   ",
      shown: "https://registry.example.com",
    },
  ])("joins $url and '$repository'", ({ url, repository, shown }) => {
    expect(repositoryUrl({ url, repository, authconfig: {} })).toBe(shown);
  });
});
