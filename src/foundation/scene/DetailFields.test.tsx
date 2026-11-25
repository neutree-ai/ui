import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./Table", () => ({
  DeleteAction: () => null,
  EditAction: () => null,
}));

import { DetailFields } from "./DetailFields";
import { type DetailField, field } from "./detail-field";

type Sink = { url: string; enabled: boolean; kind: string };

const fields: DetailField<Sink>[] = [
  field("common.fields.name", (sink) => sink.url),
  field("common.fields.status", (sink) => sink.enabled),
  field("common.fields.type", (sink, t) => t(`sinks.kinds.${sink.kind}`)),
  field("common.fields.message", {
    render: (sink) => <a href={sink.url}>open</a>,
  }),
];
const record: Sink = { url: "https://logs.test", enabled: true, kind: "s3" };

describe("DetailFields", () => {
  it.each([
    { layout: "grid", inline: false },
    { layout: "inline", inline: true },
  ])("shows each field's label and value ($layout)", ({ inline }) => {
    render(<DetailFields fields={fields} record={record} inline={inline} />);

    screen.getByText("common.fields.name");
    screen.getByText("https://logs.test");
    screen.getByText("common.values.yes");
    screen.getByText("sinks.kinds.s3");
    expect(
      screen.getByRole("link", { name: "open" }).getAttribute("href"),
    ).toBe("https://logs.test");
  });
});
