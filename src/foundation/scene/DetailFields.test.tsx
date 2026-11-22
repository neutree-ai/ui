import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./Table", () => ({
  DeleteAction: () => null,
  EditAction: () => null,
}));

import { type DetailField, DetailFields } from "./DetailFields";

type Sink = { url: string; enabled: boolean; kind: string };

const fields: DetailField<Sink>[] = [
  { key: "url", label: "sinks.fields.url", value: (sink) => sink.url },
  { key: "enabled", label: "sinks.fields.enabled", value: (s) => s.enabled },
  {
    key: "kind",
    label: "sinks.fields.kind",
    value: (sink, t) => t(`sinks.kinds.${sink.kind}`),
  },
  {
    key: "link",
    label: "sinks.fields.link",
    render: (sink) => <a href={sink.url}>open</a>,
  },
];
const record: Sink = { url: "https://logs.test", enabled: true, kind: "s3" };

describe("DetailFields", () => {
  it.each([
    { layout: "grid", inline: false },
    { layout: "inline", inline: true },
  ])("shows each field's label and value ($layout)", ({ inline }) => {
    render(<DetailFields fields={fields} record={record} inline={inline} />);

    screen.getByText("sinks.fields.url");
    screen.getByText("https://logs.test");
    screen.getByText("common.values.yes");
    screen.getByText("sinks.kinds.s3");
    expect(
      screen.getByRole("link", { name: "open" }).getAttribute("href"),
    ).toBe("https://logs.test");
  });
});
