import { useCustomMutation, useInvalidate } from "@refinedev/core";
import { Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Project } from "@/domains/api-key/types";
import { ListPage } from "@/foundation/components/ListPage";
import { RowAction, Table } from "@/foundation/components/Table";
import { useWorkspace } from "@/foundation/hooks/use-workspace";

type ProjectDraft = { name: string; description: string };
const emptyDraft: ProjectDraft = { name: "", description: "" };

export const ProjectsList = () => {
  const { current: workspace } = useWorkspace();
  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft);
  const [editing, setEditing] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);
  const refresh = () => invalidate({ resource: "projects", invalidates: ["list"] });
  const save = async () => {
    if (editing) await mutateAsync({ url: "/rpc/update_project", method: "post", values: { p_id: editing.id, p_name: draft.name, p_description: draft.description } });
    else await mutateAsync({ url: "/rpc/create_project", method: "post", values: { p_workspace: workspace, p_name: draft.name, p_description: draft.description } });
    setOpen(false); setEditing(null); setDraft(emptyDraft); refresh();
  };
  const update = async (project: Project, disabled: boolean) => { await mutateAsync({ url: "/rpc/update_project", method: "post", values: { p_id: project.id, p_disabled: disabled } }); refresh(); };
  const remove = async (project: Project) => { await mutateAsync({ url: "/rpc/delete_project", method: "post", values: { p_id: project.id } }); refresh(); };
  return <ListPage title="Projects" canCreate={false} extra={<Button onClick={() => { setEditing(null); setDraft(emptyDraft); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Create project</Button>}>
    <Table refineCoreProps={{ meta: { workspace, workspaced: true }, pagination: { mode: "off" } }}>
      <Table.Column id="name" accessorKey="metadata.name" header="Name" cell={({ row: { original } }) => <span className="font-medium">{original.metadata.name}</span>} />
      <Table.Column id="description" accessorKey="spec.description" header="Description" />
      <Table.Column id="status" accessorKey="spec.disabled" header="Status" cell={({ row: { original } }) => original.spec?.disabled ? "Disabled" : "Enabled"} />
      <Table.Column id="actions" accessorKey="id" header="" cell={({ row: { original } }) => <Table.Actions>
        <RowAction icon={<Pencil size={16} />} title="Edit" onClick={() => { setEditing(original); setDraft({ name: original.metadata.name, description: original.spec?.description ?? "" }); setOpen(true); }} />
        <RowAction icon={original.spec?.disabled ? <Power size={16} /> : <PowerOff size={16} />} title={original.spec?.disabled ? "Enable" : "Disable"} onClick={() => update(original, !original.spec?.disabled)} />
        {!original.spec?.default && <RowAction icon={<Trash2 size={16} />} title="Delete" variant="destructive" onClick={() => remove(original)} />}
      </Table.Actions>} />
    </Table>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? "Edit project" : "Create project"}</DialogTitle></DialogHeader><div className="space-y-3"><Input value={draft.name} placeholder="Name" onChange={(e) => setDraft({ ...draft, name: e.target.value })} /><Input value={draft.description} placeholder="Description" onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div><DialogFooter><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={!draft.name.trim()}>Save</Button></DialogFooter></DialogContent></Dialog>
  </ListPage>;
};
