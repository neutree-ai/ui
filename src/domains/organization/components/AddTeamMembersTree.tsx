import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  groupCheckState,
  type MemberTreeNode,
  toggleGroup,
} from "@/domains/organization/lib/member-tree";
import type { MemberProfile } from "@/domains/organization/types";
import { useTranslation } from "@/foundation/lib/i18n";
import { profileDisplayName } from "@/foundation/lib/user-identity";

type AddTeamMembersTreeProps = {
  roots: MemberTreeNode<MemberProfile>[];
  unassigned: MemberProfile[];
  memberIds: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  onSelectedChange: (next: Set<string>) => void;
  /** While searching every department is open. */
  expandAll: boolean;
};

const UNASSIGNED = "unassigned";

/** Users grouped by department; a department checkbox picks its subtree. */
export function AddTeamMembersTree(props: AddTeamMembersTreeProps) {
  const { t } = useTranslation();
  // Top-level departments start open; a toggle flips a node from its default.
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const isOpen = (key: string, depth: number) =>
    props.expandAll || (depth === 0) !== flipped.has(key);
  const flip = (key: string) => {
    const next = new Set(flipped);
    if (!next.delete(key)) next.add(key);
    setFlipped(next);
  };
  const unassignedIds = props.unassigned.map((user) => user.id);

  return (
    <ul data-testid="add-members-tree">
      {props.roots.map((root) => (
        <DepartmentItem
          key={root.node.unit.id}
          item={root}
          depth={0}
          isOpen={isOpen}
          flip={flip}
          {...props}
        />
      ))}
      {unassignedIds.length > 0 && (
        <GroupRow
          groupKey={UNASSIGNED}
          label={t("organization.teams.noDepartment")}
          userIds={unassignedIds}
          depth={0}
          open={isOpen(UNASSIGNED, 0)}
          onFlip={() => flip(UNASSIGNED)}
          {...props}
        >
          {props.unassigned.map((user) => (
            <UserRow key={user.id} user={user} depth={1} {...props} />
          ))}
        </GroupRow>
      )}
    </ul>
  );
}

type SelectionProps = Pick<
  AddTeamMembersTreeProps,
  "memberIds" | "selected" | "onSelectedChange"
>;

function DepartmentItem({
  item,
  depth,
  isOpen,
  flip,
  ...props
}: SelectionProps & {
  item: MemberTreeNode<MemberProfile>;
  depth: number;
  isOpen: (key: string, depth: number) => boolean;
  flip: (key: string) => void;
}) {
  const key = String(item.node.unit.id);
  return (
    <GroupRow
      groupKey={key}
      label={item.node.label}
      title={item.node.pathLabel}
      userIds={item.subtreeUserIds}
      depth={depth}
      open={isOpen(key, depth)}
      onFlip={() => flip(key)}
      {...props}
    >
      {item.children.map((child) => (
        <DepartmentItem
          key={child.node.unit.id}
          item={child}
          depth={depth + 1}
          isOpen={isOpen}
          flip={flip}
          {...props}
        />
      ))}
      {item.users.map((user) => (
        <UserRow key={user.id} user={user} depth={depth + 1} {...props} />
      ))}
    </GroupRow>
  );
}

function GroupRow({
  groupKey,
  label,
  title,
  userIds,
  depth,
  open,
  onFlip,
  memberIds,
  selected,
  onSelectedChange,
  children,
}: SelectionProps & {
  groupKey: string;
  label: string;
  title?: string;
  userIds: string[];
  depth: number;
  open: boolean;
  onFlip: () => void;
  children: ReactNode;
}) {
  const state = groupCheckState(userIds, memberIds, selected);
  const allMembers = userIds.every((id) => memberIds.has(id));
  const id = `add-member-group-${groupKey}`;
  return (
    <li>
      <div
        className="flex items-center gap-1 rounded-md pr-2 text-sm hover:bg-muted"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          aria-expanded={open}
          onClick={onFlip}
          data-testid={`${id}-toggle`}
        >
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <Checkbox
          id={id}
          checked={state}
          disabled={allMembers}
          onCheckedChange={(on) =>
            onSelectedChange(
              toggleGroup(userIds, memberIds, selected, on === true),
            )
          }
          data-testid={id}
        />
        <label
          htmlFor={id}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 pl-2 font-medium"
          title={title}
        >
          <span className="truncate">{label}</span>
          <span className="shrink-0 text-xs font-normal text-muted-foreground">
            {userIds.length}
          </span>
        </label>
      </div>
      {open && <ul>{children}</ul>}
    </li>
  );
}

function UserRow({
  user,
  depth,
  memberIds,
  selected,
  onSelectedChange,
}: SelectionProps & { user: MemberProfile; depth: number }) {
  const { t } = useTranslation();
  const isMember = memberIds.has(user.id);
  const id = `add-member-${user.id}`;
  return (
    <li>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2 rounded-md py-1 pr-2 text-sm hover:bg-muted has-[:disabled]:cursor-default has-[:disabled]:opacity-60"
        style={{ paddingLeft: `${depth * 16 + 24}px` }}
      >
        <Checkbox
          id={id}
          checked={isMember || selected.has(user.id)}
          disabled={isMember}
          onCheckedChange={(on) =>
            onSelectedChange(
              toggleGroup([user.id], memberIds, selected, on === true),
            )
          }
          data-testid={id}
        />
        <span className="min-w-0 flex-1 truncate">
          {profileDisplayName(user.metadata)}
          <span className="ml-2 text-xs text-muted-foreground">
            {user.metadata.name}
          </span>
        </span>
        {isMember && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {t("organization.teams.alreadyMember")}
          </span>
        )}
      </label>
    </li>
  );
}
