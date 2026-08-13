import { useCustomMutation, useInvalidate, useList } from "@refinedev/core";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ApiKeyProject } from "@/domains/api-key/types";

export function useProjects(workspace?: string) {
  return useList<ApiKeyProject>({
    resource: "api_key_projects",
    pagination: { mode: "off" },
    filters: workspace ? [{ field: "workspace", operator: "eq", value: workspace }] : [],
    queryOptions: { enabled: Boolean(workspace) },
  });
}

export function ProjectPicker({ workspace, value, onChange }: { workspace: string; value: string; onChange: (id: string) => void }) {
  const { data, isLoading } = useProjects(workspace);
  const projects = data?.data ?? [];
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();
  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  const create = async () => {
    setError("");
    try {
      const { data: created } = await mutateAsync({ url: "/rpc/create_api_key_project", method: "post", values: { p_workspace: workspace, p_name: name, p_description: description } });
      const project = created as ApiKeyProject;
      await invalidate({ resource: "api_key_projects", invalidates: ["list"] });
      onChange(project.id); setCreating(false); setName(""); setDescription("");
    } catch (e) {
      setError(String((e as { message?: string }).message ?? e).includes("already exists") ? "Project name already exists. Choose another name." : String((e as { message?: string }).message ?? e));
    }
  };

  return <div className="space-y-2">
    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" disabled={!workspace || isLoading} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select a Project</option>
      {projects.map((p) => <option key={p.id} value={p.id} disabled={!p.enabled}>{p.name}{p.description ? ` - ${p.description}` : ""}{!p.enabled ? " (Disabled)" : ""}</option>)}
    </select>
    {!creating && <Button type="button" variant="ghost" size="sm" className="px-0" disabled={!workspace} onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" /> Create Project</Button>}
    {creating && <div className="space-y-2 border bg-muted/40 p-3">
      <div className="flex items-center justify-between text-sm font-medium">Create Project<Button type="button" variant="ghost" size="icon" onClick={() => setCreating(false)}><X className="h-4 w-4" /></Button></div>
      <Input ref={inputRef} placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button type="button" disabled={!name.trim()} onClick={() => void create()}>Create and select</Button></div>
    </div>}
  </div>;
}
