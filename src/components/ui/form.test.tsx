import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";

function ErrorWithoutMessageForm() {
  const form = useForm<{ accelerator: string }>({
    defaultValues: { accelerator: "" },
  });

  useEffect(() => {
    form.setError("accelerator", { type: "manual" });
  }, [form]);

  return (
    <FormProvider {...form}>
      <FormField
        control={form.control}
        name="accelerator"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Accelerator</FormLabel>
            <FormControl>
              <input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormProvider>
  );
}

describe("FormMessage", () => {
  it("does not render undefined for errors without a message", async () => {
    render(<ErrorWithoutMessageForm />);

    await waitFor(() => {
      expect(screen.queryByText("undefined")).toBeNull();
    });
  });
});
