import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldValue } from "@/foundation/type/FieldValue";

const shown = (value: unknown) =>
  render(<FieldValue value={value} />).container.textContent;

describe("FieldValue", () => {
  it.each([
    { name: "null", value: null },
    { name: "undefined", value: undefined },
    { name: "an empty string", value: "" },
    { name: "an empty array", value: [] },
    { name: "an empty object", value: {} },
  ])("shows the empty marker for $name", ({ value }) => {
    render(<FieldValue value={value} />);

    screen.getByTestId("empty-value");
  });

  it.each([
    { value: true, text: "common.values.yes" },
    { value: false, text: "common.values.no" },
    { value: 0, text: "0" },
    { value: 1234567.5, text: "1,234,567.5" },
    { value: "s3://bucket/prefix", text: "s3://bucket/prefix" },
    { value: ["openid", "email", 3], text: "openid, email, 3" },
    { value: { env: "prod", tier: 2 }, text: "env=prodtier=2" },
    { value: { nested: { a: 1 } }, text: 'nested={"a":1}' },
  ])("shows $value as $text", ({ value, text }) => {
    expect(shown(value)).toBe(text);
  });
});
