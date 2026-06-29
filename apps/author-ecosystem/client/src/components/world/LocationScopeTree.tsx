import {
  getRootKindForScope,
  kindLabel,
} from "../../lib/worldLocationTree";
import type { LocationKind, LocationNode, StoryScope } from "../../lib/worldBuildTypes";

function LocationTreeNode(props: {
  node: LocationNode;
  depth: number;
  activeId: string | null;
  scope: StoryScope;
  getChildren: (parentId: string) => LocationNode[];
  getChildKinds: (kind: LocationKind) => LocationKind[];
  onSelect: (id: string) => void;
  onAddChild: (parentId: string, kind: LocationKind) => void;
  onDelete: (id: string) => void;
}) {
  const children = props.getChildren(props.node.id);
  const childKinds = props.getChildKinds(props.node.kind);
  const active = props.activeId === props.node.id;

  return (
    <li className="space-y-0.5">
      <div className="flex items-center gap-0.5" style={{ paddingLeft: props.depth * 8 }}>
        <button
          type="button"
          onClick={() => props.onSelect(props.node.id)}
          className={[
            "min-w-0 flex-1 truncate rounded border px-2 py-1 text-left text-xs transition",
            active
              ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-100"
              : "border-zinc-800 text-zinc-500 hover:border-zinc-600",
          ].join(" ")}
        >
          {props.node.title}
          <span className="ml-1 text-[9px] text-zinc-600">{kindLabel(props.node.kind)}</span>
        </button>
        <button
          type="button"
          title="Remove location"
          onClick={() => props.onDelete(props.node.id)}
          className="shrink-0 px-1 text-[10px] text-zinc-600 hover:text-rose-400"
        >
          ×
        </button>
      </div>
      {childKinds.length > 0 ? (
        <button
          type="button"
          style={{ marginLeft: props.depth * 8 + 8 }}
          onClick={() => props.onAddChild(props.node.id, childKinds[0])}
          className="text-[10px] text-emerald-400/80 hover:text-emerald-300"
        >
          + Add {kindLabel(childKinds[0]).toLowerCase()}
        </button>
      ) : null}
      {children.length > 0 ? (
        <ul className="space-y-0.5">
          {children.map((child) => (
            <LocationTreeNode
              key={child.id}
              node={child}
              depth={props.depth + 1}
              activeId={props.activeId}
              scope={props.scope}
              getChildren={props.getChildren}
              getChildKinds={props.getChildKinds}
              onSelect={props.onSelect}
              onAddChild={props.onAddChild}
              onDelete={props.onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function LocationScopeTree(props: {
  scope: StoryScope;
  roots: LocationNode[];
  activeLocationId: string | null;
  getChildren: (parentId: string | null) => LocationNode[];
  getChildKinds: (kind: LocationKind) => LocationKind[];
  onSelect: (id: string) => void;
  onAddRootSibling: () => void;
  onAddChild: (parentId: string, kind: LocationKind) => void;
  onDelete: (id: string) => void;
}) {
  const rootKind = getRootKindForScope(props.scope);
  const rootLabel = kindLabel(rootKind).toLowerCase();
  const addRootLabel =
    props.roots.length === 0
      ? `+ Add ${rootLabel}`
      : `+ Add another ${rootLabel}`;

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-emerald-100">Locations</h2>
      <ul className="space-y-1">
        {props.roots.map((root) => (
          <LocationTreeNode
            key={root.id}
            node={root}
            depth={0}
            activeId={props.activeLocationId}
            scope={props.scope}
            getChildren={(id) => props.getChildren(id)}
            getChildKinds={props.getChildKinds}
            onSelect={props.onSelect}
            onAddChild={props.onAddChild}
            onDelete={props.onDelete}
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={props.onAddRootSibling}
        className="mt-2 w-full rounded border border-emerald-700/40 py-1 text-[10px] text-emerald-300"
      >
        {addRootLabel}
      </button>
      {props.roots.length > 1 ? (
        <p className="mt-1 text-[9px] text-zinc-600">
          {props.roots.length} {kindLabel(rootKind).toLowerCase()}s in this story
        </p>
      ) : null}
    </div>
  );
}
