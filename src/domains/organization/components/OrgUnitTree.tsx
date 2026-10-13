import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { InactiveBadge } from "@/domains/organization/components/InactiveBadge";
import type { OrgTreeNode } from "@/domains/organization/lib/org-tree";
import { cn } from "@/foundation/lib/utils";

type OrgUnitTreeProps = {
  roots: OrgTreeNode[];
  expanded: ReadonlySet<number>;
  onExpandedChange: (id: number, open: boolean) => void;
  selectedId?: number;
  onSelect: (id: number) => void;
};

/** A read-only department tree: expand with the chevron, select with the row. */
export function OrgUnitTree(props: OrgUnitTreeProps) {
  return (
    <ul className="space-y-0.5">
      {props.roots.map((node) => (
        <OrgUnitTreeItem key={node.unit.id} node={node} depth={0} {...props} />
      ))}
    </ul>
  );
}

function OrgUnitTreeItem({
  node,
  depth,
  ...props
}: OrgUnitTreeProps & { node: OrgTreeNode; depth: number }) {
  const { expanded, onExpandedChange, selectedId, onSelect } = props;
  const id = node.unit.id;
  const hasChildren = node.children.length > 0;
  const open = hasChildren && expanded.has(id);
  const selected = selectedId === id;

  return (
    <li>
      <Collapsible
        open={open}
        onOpenChange={(next) => onExpandedChange(id, next)}
      >
        <div
          className={cn(
            "flex items-center gap-1 rounded-md pr-2 text-sm",
            selected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
          )}
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
        >
          {hasChildren ? (
            <CollapsibleTrigger
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              data-testid={`org-unit-toggle-${id}`}
            >
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
          ) : (
            <span className="h-6 w-6 shrink-0" />
          )}
          <button
            type="button"
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left",
              node.inactive && "text-muted-foreground",
            )}
            title={node.pathLabel}
            aria-pressed={selected}
            onClick={() => onSelect(id)}
            data-testid={`org-unit-${id}`}
          >
            <span className="truncate">{node.label}</span>
            {node.inactive && <InactiveBadge />}
          </button>
        </div>
        {hasChildren && (
          <CollapsibleContent asChild>
            <ul className="space-y-0.5">
              {node.children.map((child) => (
                <OrgUnitTreeItem
                  key={child.unit.id}
                  node={child}
                  depth={depth + 1}
                  {...props}
                />
              ))}
            </ul>
          </CollapsibleContent>
        )}
      </Collapsible>
    </li>
  );
}
