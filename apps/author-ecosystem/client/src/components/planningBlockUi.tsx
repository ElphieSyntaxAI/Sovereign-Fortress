import { useMemo, useState } from "react";

import { WikiEntityPicker } from "./wiki/WikiEntityPicker";
import {
  RAG_OUTLINE_PANEL_SCHEMA,
  buildPanelRagLineFromSchema,
  firstIncompleteSectionPath,
  sectionProgress,
  type RagOutlineField,
  type RagOutlinePanelSchema,
  type RagOutlineSection,
} from "../lib/plotEngineRagOutlineSchema";
import type { BlockInputMode, GlobalToken, PanelKey } from "../lib/plotEngineTypes";

export function sceneInputMode(scene: { blockInputMode?: BlockInputMode }): BlockInputMode {
  return scene.blockInputMode ?? "freestyle";
}

function RagFieldInput(props: {
  field: RagOutlineField;
  value: string;
  manuscriptId?: string;
  onChange: (value: string) => void;
}) {
  const { field, value, onChange, manuscriptId } = props;
  const label = (
    <span className="text-[11px] font-medium text-zinc-300">{field.label}</span>
  );
  const hint = field.hint ? (
    <p className="text-[10px] leading-snug text-zinc-500">{field.hint}</p>
  ) : null;

  if (field.fieldType === "wikiLink" && manuscriptId) {
    return (
      <div className="block space-y-0.5">
        {label}
        {hint}
        <WikiEntityPicker
          manuscriptId={manuscriptId}
          kindFilter={field.wikiKind}
          value={value}
          onChange={(v) => onChange(v)}
          label={field.label}
          placeholder={field.placeholder ?? "Pick from wiki…"}
        />
      </div>
    );
  }

  if (field.fieldType === "select" && field.selectOptions?.length) {
    return (
      <label className="block space-y-0.5">
        {label}
        {hint}
        <select
          value={value || field.selectOptions[0]}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        >
          {field.selectOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.multiline || field.fieldType === "textarea") {
    return (
      <label className="block space-y-0.5">
        {label}
        {hint}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={field.key.includes("backstory") ? 3 : 2}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
        />
      </label>
    );
  }

  return (
    <label className="block space-y-0.5">
      {label}
      {hint}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
      />
    </label>
  );
}

function RagSectionGroup(props: {
  section: RagOutlineSection;
  fields: Record<string, string>;
  accent: "emerald" | "violet";
  manuscriptId?: string;
  defaultOpen?: boolean;
  depth?: number;
  onFieldChange: (key: string, value: string) => void;
  showRagPreview?: boolean;
  schema: RagOutlinePanelSchema;
}) {
  const depth = props.depth ?? 0;
  const [open, setOpen] = useState(props.defaultOpen ?? depth < 2);
  const [showWhy, setShowWhy] = useState(false);
  const progress = sectionProgress(props.section, props.fields);
  const hasFields = (props.section.fields?.length ?? 0) > 0;
  const hasChildren = (props.section.sections?.length ?? 0) > 0;
  const isBanner = !hasFields && !hasChildren && Boolean(props.section.aiInstruction);

  const sectionPreview = useMemo(() => {
    if (!props.showRagPreview || !hasFields) return "";
    const subset: Record<string, string> = {};
    for (const f of props.section.fields ?? []) {
      if (props.fields[f.key]) subset[f.key] = props.fields[f.key];
    }
    if (!Object.keys(subset).length) return "";
    return buildPanelRagLineFromSchema(props.schema, subset);
  }, [props.showRagPreview, props.section.fields, props.fields, props.schema, hasFields]);

  const border =
    props.accent === "emerald"
      ? "border-emerald-800/30"
      : "border-violet-800/30";

  if (isBanner) {
    return (
      <div className={`rounded-lg border ${border} bg-zinc-950/40 px-2 py-2`}>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] text-zinc-600">{props.section.sectionPath}</span>
          <span className="text-xs font-medium text-zinc-300">{props.section.title}</span>
        </div>
        {props.section.guidingQuestion ? (
          <p className="mt-1 text-[10px] italic text-zinc-500">{props.section.guidingQuestion}</p>
        ) : null}
        {props.section.aiInstruction ? (
          <button
            type="button"
            onClick={() => setShowWhy((v) => !v)}
            className="mt-1 text-[10px] text-amber-200/70 hover:text-amber-100"
          >
            {showWhy ? "Hide" : "Why this section?"}
          </button>
        ) : null}
        {showWhy && props.section.aiInstruction ? (
          <p className="mt-1 text-[10px] italic leading-snug text-zinc-500">
            {props.section.aiInstruction}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${border} bg-zinc-950/40`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="mr-2 text-[10px] text-zinc-600">{props.section.sectionPath}</span>
          <span className="text-xs font-medium text-zinc-200">{props.section.title}</span>
          {props.section.guidingQuestion && open ? null : props.section.guidingQuestion ? (
            <span className="ml-2 text-[10px] italic text-zinc-500">
              — {props.section.guidingQuestion}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-[10px] text-zinc-500">
          {progress.total > 0 ? `${progress.filled} of ${progress.total}` : ""}
          <span className="ml-1">{open ? "▾" : "▸"}</span>
        </span>
      </button>

      {open ? (
        <div className="space-y-2 border-t border-zinc-800/80 px-2 pb-2 pt-2">
          {props.section.guidingQuestion ? (
            <p className="text-[10px] italic leading-snug text-zinc-500">
              {props.section.guidingQuestion}
            </p>
          ) : null}
          {props.section.aiInstruction ? (
            <>
              <button
                type="button"
                onClick={() => setShowWhy((v) => !v)}
                className="text-[10px] text-amber-200/70 hover:text-amber-100"
              >
                {showWhy ? "Hide" : "Why this section?"}
              </button>
              {showWhy ? (
                <p className="text-[10px] italic leading-snug text-zinc-500">
                  {props.section.aiInstruction}
                </p>
              ) : null}
            </>
          ) : null}
          {(props.section.fields ?? []).map((field) => (
            <RagFieldInput
              key={field.key}
              field={field}
              value={props.fields[field.key] ?? ""}
              manuscriptId={props.manuscriptId}
              onChange={(v) => props.onFieldChange(field.key, v)}
            />
          ))}
          {(props.section.sections ?? []).map((child) => (
            <RagSectionGroup
              key={child.sectionPath}
              section={child}
              fields={props.fields}
              accent={props.accent}
              manuscriptId={props.manuscriptId}
              depth={depth + 1}
              defaultOpen={depth < 1}
              onFieldChange={props.onFieldChange}
              showRagPreview={props.showRagPreview}
              schema={props.schema}
            />
          ))}
          {sectionPreview ? (
            <p className="font-mono text-[9px] leading-snug text-zinc-600">{sectionPreview}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AuthorTagInput(props: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const addTag = () => {
    const tag = draft.trim();
    if (!tag) return;
    if (props.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    props.onChange([...props.tags, tag]);
    setDraft("");
  };

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium text-zinc-300">Your tags</span>
      <p className="text-[10px] text-zinc-500">
        Optional labels to help you find this entry later.
      </p>
      <div className="flex flex-wrap gap-1">
        {props.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300"
          >
            {tag}
            <button
              type="button"
              className="text-zinc-500 hover:text-rose-400"
              onClick={() => props.onChange(props.tags.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Add a tag (e.g. found family, slow burn)"
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={!draft.trim()}
          className="rounded border border-zinc-600 px-2 py-1 text-[10px] text-zinc-400 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function OutlineRagPanel(props: {
  panel?: PanelKey;
  schema?: RagOutlinePanelSchema;
  fields: Record<string, string>;
  accent: "emerald" | "violet";
  manuscriptId?: string;
  onFieldChange: (key: string, value: string) => void;
}) {
  const schema = props.schema ?? (props.panel ? RAG_OUTLINE_PANEL_SCHEMA[props.panel] : null);
  const [showRagPreview, setShowRagPreview] = useState(false);

  const defaultOpenPath = useMemo(
    () => (schema ? firstIncompleteSectionPath(schema, props.fields) : null),
    [schema, props.fields]
  );

  if (!schema) return null;

  const border =
    props.accent === "emerald" ? "border-emerald-800/40" : "border-violet-800/40";

  const fullPreview = buildPanelRagLineFromSchema(schema, props.fields);

  return (
    <div className={`space-y-2 rounded-lg border ${border} bg-zinc-950/60 p-2`}>
      {schema.ledgerTitle ? (
        <p className="text-xs font-medium text-zinc-300">{schema.ledgerTitle}</p>
      ) : null}
      <p className="text-[10px] italic leading-snug text-zinc-500">{schema.guidingQuestion}</p>

      <div className="space-y-2">
        {schema.sections?.length
          ? schema.sections.map((sec) => (
              <RagSectionGroup
                key={sec.sectionPath}
                section={sec}
                fields={props.fields}
                accent={props.accent}
                manuscriptId={props.manuscriptId}
                defaultOpen={
                  defaultOpenPath === sec.sectionPath ||
                  sec.sectionPath === schema.sections?.[0]?.sectionPath
                }
                onFieldChange={props.onFieldChange}
                showRagPreview={showRagPreview}
                schema={schema}
              />
            ))
          : (schema.fields ?? []).map((field) => (
              <RagFieldInput
                key={field.key}
                field={field}
                value={props.fields[field.key] ?? ""}
                manuscriptId={props.manuscriptId}
                onChange={(v) => props.onFieldChange(field.key, v)}
              />
            ))}
      </div>

      {schema.supportsSpoiler ? (
        <label className="flex items-center gap-1.5 text-[10px] text-amber-200/80">
          <input
            type="checkbox"
            checked={props.fields.containsSpoiler === "true"}
            onChange={(e) =>
              props.onFieldChange("containsSpoiler", e.target.checked ? "true" : "")
            }
          />
          Contains spoiler
        </label>
      ) : null}

      <button
        type="button"
        onClick={() => setShowRagPreview((v) => !v)}
        className="text-[10px] text-zinc-500 hover:text-zinc-400"
      >
        {showRagPreview ? "Hide sync preview" : "Show sync preview"}
      </button>
      {showRagPreview && fullPreview ? (
        <p className="font-mono text-[9px] leading-snug text-zinc-600">{fullPreview}</p>
      ) : null}
    </div>
  );
}

export function BlockInputModeToggle(props: {
  mode: BlockInputMode;
  onChange: (mode: BlockInputMode) => void;
  accent?: "emerald" | "violet";
}) {
  const active =
    props.accent === "violet" ? "bg-violet-900/60 text-violet-100" : "bg-emerald-900/60 text-emerald-100";
  return (
    <div
      className="mb-3 flex rounded-lg border border-zinc-700 bg-zinc-950 p-0.5"
      role="group"
      aria-label="Building block input mode"
    >
      {(["freestyle", "outline"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => props.onChange(m)}
          className={[
            "flex-1 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition",
            props.mode === m ? active : "text-zinc-500 hover:text-zinc-300",
          ].join(" ")}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

export function FreestyleBlockForm(props: {
  title: string;
  details: string;
  containsSpoiler: boolean;
  titlePlaceholder?: string;
  detailsPlaceholder?: string;
  onTitleChange: (v: string) => void;
  onDetailsChange: (v: string) => void;
  onSpoilerChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2">
      <input
        value={props.title}
        onChange={(e) => props.onTitleChange(e.target.value)}
        placeholder={props.titlePlaceholder ?? "Name"}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
      />
      {props.title.trim() ? (
        <>
          <textarea
            value={props.details}
            onChange={(e) => props.onDetailsChange(e.target.value)}
            placeholder={props.detailsPlaceholder ?? "Details, lore, notes…"}
            rows={4}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
          />
          <label className="flex items-center gap-1.5 text-[10px] text-amber-200/80">
            <input
              type="checkbox"
              checked={props.containsSpoiler}
              onChange={(e) => props.onSpoilerChange(e.target.checked)}
            />
            Contains spoiler
          </label>
        </>
      ) : (
        <p className="text-[10px] text-zinc-600">Type a name to add details.</p>
      )}
    </div>
  );
}

const PANEL_NAME_PLACEHOLDERS: Partial<Record<PanelKey, string>> = {
  character: "Character name",
  settings: "Setting name",
  environmental: "Environment / biome",
  senses: "Sense or sensation",
  breadcrumbs: "Breadcrumb / clue",
  theme: "Theme",
  mood: "Mood",
};

const PANEL_DETAILS_PLACEHOLDERS: Partial<Record<PanelKey, string>> = {
  character: "Appearance, motivation, secrets, relationships…",
  settings: "Location details, rules, atmosphere…",
  environmental: "Weather, terrain, ecology, hazards…",
  senses: "What the POV notices (sound, smell, texture)…",
  breadcrumbs: "Clue planted for later payoff…",
};

export function TokenPool(props: {
  panel: PanelKey;
  tokens: GlobalToken[];
  boundIds: string[];
  active: boolean;
  accent: "emerald" | "violet";
  onAdd: (token: { label: string; details?: string; containsSpoiler?: boolean }) => void;
  onUpdate: (
    tokenId: string,
    patch: Partial<Pick<GlobalToken, "label" | "details" | "containsSpoiler">>
  ) => void;
  onDelete: (tokenId: string) => void;
  onToggle: (tokenId: string) => void;
}) {
  const [draftName, setDraftName] = useState("");
  const [draftDetails, setDraftDetails] = useState("");
  const [draftSpoiler, setDraftSpoiler] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editSpoiler, setEditSpoiler] = useState(false);

  const ring = props.accent === "emerald" ? "ring-emerald-400/70" : "ring-violet-400/70";
  const chipOn =
    props.accent === "emerald"
      ? "border-emerald-500/60 bg-emerald-950/50 text-emerald-100"
      : "border-violet-500/60 bg-violet-950/50 text-violet-100";
  const chipOff = "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600";

  const namePlaceholder = PANEL_NAME_PLACEHOLDERS[props.panel] ?? "Name";
  const detailsPlaceholder = PANEL_DETAILS_PLACEHOLDERS[props.panel] ?? "Additional lore or notes…";

  const resetDraft = () => {
    setDraftName("");
    setDraftDetails("");
    setDraftSpoiler(false);
  };

  const submitDraft = () => {
    const label = draftName.trim();
    if (!label) return;
    props.onAdd({
      label,
      details: draftDetails.trim() || undefined,
      containsSpoiler: draftSpoiler || undefined,
    });
    resetDraft();
  };

  const startEdit = (t: GlobalToken) => {
    setEditingId(t.id);
    setEditName(t.label);
    setEditDetails(t.details ?? "");
    setEditSpoiler(Boolean(t.containsSpoiler));
  };

  const saveEdit = () => {
    if (!editingId) return;
    const label = editName.trim();
    if (!label) return;
    props.onUpdate(editingId, {
      label,
      details: editDetails.trim() || undefined,
      containsSpoiler: editSpoiler || undefined,
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {props.tokens.map((t) => {
          const bound = props.boundIds.includes(t.id);
          const hasDetails = Boolean(t.details?.trim());
          return (
            <span key={t.id} className="inline-flex max-w-full flex-col gap-1">
              <span className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  disabled={!props.active}
                  onClick={() => props.onToggle(t.id)}
                  className={[
                    "rounded-full border px-2 py-0.5 text-xs transition",
                    bound ? `${chipOn} ${props.active ? ring : ""}` : chipOff,
                    !props.active ? "cursor-default opacity-60" : "",
                  ].join(" ")}
                  title={hasDetails ? t.details : undefined}
                >
                  {t.label}
                  {t.containsSpoiler ? (
                    <span className="ml-1 text-[9px] uppercase text-amber-300/90">spoiler</span>
                  ) : null}
                  {hasDetails ? <span className="ml-0.5 text-zinc-500">…</span> : null}
                </button>
                <button
                  type="button"
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                  title="Edit details"
                  onClick={() => startEdit(t)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="text-[10px] text-zinc-500 hover:text-rose-400"
                  title="Remove from pool"
                  onClick={() => props.onDelete(t.id)}
                >
                  ×
                </button>
              </span>
              {editingId === t.id ? (
                <div className="w-full min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-xs">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mb-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                  />
                  <textarea
                    value={editDetails}
                    onChange={(e) => setEditDetails(e.target.value)}
                    placeholder={detailsPlaceholder}
                    rows={3}
                    className="mb-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
                  />
                  <label className="mb-2 flex items-center gap-1.5 text-[10px] text-amber-200/80">
                    <input
                      type="checkbox"
                      checked={editSpoiler}
                      onChange={(e) => setEditSpoiler(e.target.checked)}
                    />
                    Contains spoiler
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded border border-emerald-600/50 px-2 py-0.5 text-[10px] text-emerald-200"
                      onClick={saveEdit}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] text-zinc-400"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </span>
          );
        })}
      </div>
      <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2">
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder={namePlaceholder}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        />
        {draftName.trim() ? (
          <>
            <textarea
              value={draftDetails}
              onChange={(e) => setDraftDetails(e.target.value)}
              placeholder={detailsPlaceholder}
              rows={3}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
            />
            <label className="flex items-center gap-1.5 text-[10px] text-amber-200/80">
              <input
                type="checkbox"
                checked={draftSpoiler}
                onChange={(e) => setDraftSpoiler(e.target.checked)}
              />
              Contains spoiler
            </label>
          </>
        ) : (
          <p className="text-[10px] text-zinc-600">Type a name to add details and spoiler flag.</p>
        )}
        <button
          type="button"
          disabled={!draftName.trim()}
          className="w-full rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 disabled:opacity-40"
          onClick={submitDraft}
        >
          Add to pool
        </button>
      </div>
    </div>
  );
}
