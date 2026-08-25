import { useCustomMutation } from "@refinedev/core";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useApiKeyProjects } from "@/domains/api-key/hooks/use-api-key-projects";
import { apiKeyActionErrorMessage } from "@/domains/api-key/lib/create-api-key-error";
import type { ApiKeyProject } from "@/domains/api-key/types";

// PostgREST surfaces the raised SQLSTATE as the error code. Matching on that
// rather than on the message text keeps this working when the backend wording
// changes or is localized.
const UNIQUE_VIOLATION = "23505";

const isDuplicateName = (cause: unknown) =>
  typeof cause === "object" &&
  cause !== null &&
  (cause as { code?: unknown }).code === UNIQUE_VIOLATION;

export function ProjectPicker({
  workspace,
  value,
  onChange,
  allowUngrouped = true,
}: {
  workspace: string;
  value: string;
  onChange: (id: string, project?: ApiKeyProject) => void;
  allowUngrouped?: boolean;
}) {
  const { t } = useTranslation();
  const {
    data: projects,
    isLoading,
    error: loadError,
    refetch,
  } = useApiKeyProjects(workspace);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync } = useCustomMutation();
  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);
  const create = async () => {
    setError("");
    setSaving(true);
    try {
      const { data: created } = await mutateAsync({
        url: "/rpc/create_api_key_project",
        method: "post",
        values: {
          p_workspace: workspace,
          p_name: name,
          p_description: description,
        },
      });
      const project = created as ApiKeyProject;
      await refetch();
      onChange(project.id, project);
      setCreating(false);
      setName("");
      setDescription("");
    } catch (e) {
      setError(
        isDuplicateName(e)
          ? t("api_keys.projects.duplicateName")
          : apiKeyActionErrorMessage(e, t("api_keys.messages.operationFailed")),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={!workspace || isLoading}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {projects.find((p) => p.id === value)?.metadata.name ??
                (allowUngrouped
                  ? t("api_keys.projects.ungrouped")
                  : t("api_keys.projects.select"))}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder={t("api_keys.placeholders.searchProjects")}
            />
            <CommandList>
              <CommandEmpty>{t("api_keys.projects.notFound")}</CommandEmpty>
              <CommandGroup>
                {allowUngrouped && (
                  <CommandItem
                    value={t("api_keys.projects.ungrouped")}
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${value ? "opacity-0" : "opacity-100"}`}
                    />
                    {t("api_keys.projects.ungrouped")}
                  </CommandItem>
                )}
                {projects.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.metadata.name} ${p.spec.description}`}
                    onSelect={() => {
                      onChange(p.id, p);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${value === p.id ? "opacity-100" : "opacity-0"}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{p.metadata.name}</span>
                      {p.spec.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.spec.description}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t p-1">
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("api_keys.projects.create")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {creating && (
        <div className="space-y-2 border bg-muted/40 p-3">
          <div className="flex items-center justify-between text-sm font-medium">
            {t("api_keys.projects.create")}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setCreating(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Input
            ref={inputRef}
            placeholder={t("api_keys.placeholders.projectName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            placeholder={t("api_keys.placeholders.projectDescription")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreating(false)}
            >
              {t("buttons.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!name.trim() || saving}
              onClick={() => void create()}
            >
              {saving
                ? t("api_keys.projects.creating")
                : t("api_keys.projects.createAndSelect")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
