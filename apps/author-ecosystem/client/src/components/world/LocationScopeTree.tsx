import {
  getRootKindForScope,
  kindLabel,
} from "../../lib/worldLocationTree";
import type { LocationKind, LocationNode, StoryScope } from "../../lib/worldBuildTypes";
import { isFocusableLocationKind } from "../../lib/worldBuildTypes";

function AddChildButton(props: {
  depth: number;
  label: string;
  onClick: () => void;
  borderTop?: boolean;
}) {
  return (
    <div
      className={[
        "mt-1 pt-1.5",
        props.borderTop !== false ? "border-t border-dashed border-zinc-800/80" : "",
      ].join(" ")}
      style={{ marginLeft: props.depth * 12 + 4 }}
    >
      <button
        type="button"
        onClick={props.onClick}
        className="w-full rounded border border-dashed border-emerald-700/40 bg-emerald-950/20 px-2 py-1 text-left text-[10px] text-emerald-300 hover:border-emerald-600/50 hover:bg-emerald-950/40"
      >
        {props.label}
      </button>
    </div>
  );
}

function LocationTreeNode(props: {
  node: LocationNode;
  depth: number;
  activeId: string | null;
  focusContextId: string | null;
  scope: StoryScope;
  getChildren: (parentId: string) => LocationNode[];
  getChildKinds: (kind: LocationKind) => LocationKind[];
  onSelect: (id: string) => void;
  onAddChild: (parentId: string, kind: LocationKind) => void;
  onAddSibling: (parentId: string | null, kind: LocationKind) => void;
  onDelete: (id: string) => void;
}) {
  const children = props.getChildren(props.node.id);
  const childKinds = props.getChildKinds(props.node.kind);
  const active = props.activeId === props.node.id;
  const inFocus = props.focusContextId === props.node.id;
  const focusable = isFocusableLocationKind(props.node.kind);
  const childKind = childKinds[0];

  return (
    <li className="list-none">
      <div
        className="relative flex items-center gap-0.5"
        style={{ paddingLeft: props.depth * 12 }}
      >
        {props.depth > 0 ? (
          <span
            className="pointer-events-none absolute bottom-0 top-0 w-px bg-zinc-700/80"
            style={{ left: props.depth * 12 - 6 }}
            aria-hidden
          />
        ) : null}
        <button
          type="button"
          onClick={() => props.onSelect(props.node.id)}
          className={[
            "min-w-0 flex-1 truncate rounded border px-2 py-1.5 text-left text-xs transition",
            inFocus
              ? "border-violet-500/50 bg-violet-950/30 text-violet-100"
              : active
                ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-100"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-600",
          ].join(" ")}
        >
          {focusable ? (
            <span
              className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/80"
              title="Opens focus panel"
            />
          ) : null}
          <span className="font-medium text-zinc-200">{props.node.title}</span>
          <span className="ml-1 text-[9px] text-zinc-600">{kindLabel(props.node.kind)}</span>
          {inFocus ? (
            <span className="ml-1 rounded bg-violet-900/50 px-1 text-[8px] text-violet-300">
              Focus
            </span>
          ) : null}
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

      {children.length > 0 ? (
        <ul className="mt-1 space-y-1 border-l border-zinc-800/90" style={{ marginLeft: props.depth * 12 + 10 }}>
          {children.map((child) => (
            <LocationTreeNode
              key={child.id}
              node={child}
              depth={props.depth + 1}
              activeId={props.activeId}
              focusContextId={props.focusContextId}
              scope={props.scope}
              getChildren={props.getChildren}
              getChildKinds={props.getChildKinds}
              onSelect={props.onSelect}
              onAddChild={props.onAddChild}
              onAddSibling={props.onAddSibling}
              onDelete={props.onDelete}
            />
          ))}
        </ul>
      ) : null}

      {childKind ? (
        <AddChildButton
          depth={props.depth}
          label={
            children.length > 0
              ? `+ Add another ${kindLabel(childKind).toLowerCase()}`
              : `+ Add ${kindLabel(childKind).toLowerCase()}`
          }
          onClick={() => props.onAddChild(props.node.id, childKind)}
        />
      ) : null}

      {props.node.kind === "galaxy" && props.node.parentId ? (
        <AddChildButton
          depth={props.depth}
          borderTop={false}
          label="+ Add another galaxy"
          onClick={() => props.onAddSibling(props.node.parentId, "galaxy")}
        />
      ) : null}

      {props.node.kind === "solar_system" && props.node.parentId ? (
        <AddChildButton
          depth={props.depth}
          borderTop={false}
          label="+ Add another solar system"
          onClick={() => props.onAddSibling(props.node.parentId, "solar_system")}
        />
      ) : null}
    </li>
  );
}

export function LocationScopeTree(props: {
  scope: StoryScope;
  roots: LocationNode[];
  activeLocationId: string | null;
  focusContextId: string | null;
  getChildren: (parentId: string | null) => LocationNode[];
  getChildKinds: (kind: LocationKind) => LocationKind[];
  onSelect: (id: string) => void;
  onAddRootSibling: () => void;
  onAddChild: (parentId: string, kind: LocationKind) => void;
  onAddSibling: (parentId: string | null, kind: LocationKind) => void;
  onDelete: (id: string) => void;
}) {
  const rootKind = getRootKindForScope(props.scope);
  const rootLabel = kindLabel(rootKind).toLowerCase();
  const addRootLabel =
    props.roots.length === 0
      ? `+ Add ${rootLabel}`
      : `+ Add another ${rootLabel}`;

  return (
    <div className="flex max-h-[min(70vh,32rem)] flex-col">
      <h2 className="mb-2 shrink-0 text-sm font-semibold text-emerald-100">Locations</h2>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {props.roots.length > 0 ? (
          <ul className="space-y-2">
            {props.roots.map((root, index) => (
              <li
                key={root.id}
                className={[
                  "rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-1.5",
                  index > 0 ? "mt-2" : "",
                ].join(" ")}
              >
                <p className="mb-1 px-1 text-[9px] uppercase tracking-wide text-zinc-600">
                  {rootLabel} {index + 1}
                </p>
                <ul>
                  <LocationTreeNode
                    node={root}
                    depth={0}
                    activeId={props.activeLocationId}
                    focusContextId={props.focusContextId}
                    scope={props.scope}
                    getChildren={(id) => props.getChildren(id)}
                    getChildKinds={props.getChildKinds}
                    onSelect={props.onSelect}
                    onAddChild={props.onAddChild}
                    onAddSibling={props.onAddSibling}
                    onDelete={props.onDelete}
                  />
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[10px] italic text-zinc-600">No locations yet.</p>
        )}
      </div>

      <div className="mt-2 shrink-0 rounded-lg border border-dashed border-emerald-700/50 bg-emerald-950/15 p-2">
        <button
          type="button"
          onClick={props.onAddRootSibling}
          className="w-full rounded border border-emerald-600/40 bg-emerald-950/30 py-1.5 text-[10px] font-medium text-emerald-200 hover:border-emerald-500/60 hover:bg-emerald-950/50"
        >
          {addRootLabel}
        </button>
        {props.roots.length > 1 ? (
          <p className="mt-1 text-center text-[9px] text-zinc-600">
            {props.roots.length} {rootLabel}s stacked at this level
          </p>
        ) : null}
      </div>
    </div>
  );
}
