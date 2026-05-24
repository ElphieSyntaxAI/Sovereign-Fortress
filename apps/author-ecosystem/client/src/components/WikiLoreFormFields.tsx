import type { WikiFormFieldDef, WikiFormTier } from "../lib/wikiEntityForms";
import { getFieldsForTier, getWikiFormSchema } from "../lib/wikiEntityForms";
import type { OutlineLoreKind } from "../lib/outlineLoreKinds";

export function WikiLoreFormFields(props: {
  kind: OutlineLoreKind;
  tier: WikiFormTier;
  answers: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  onTrackEdit: (fieldId: string, value: string) => void;
}) {
  const schema = getWikiFormSchema(props.kind);
  const fields = getFieldsForTier(schema, props.tier);

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-500">
        Based on <span className="text-zinc-400">{schema.ragTemplate}</span>
      </p>
      {fields.map((field) => (
        <WikiFormField
          key={field.id}
          field={field}
          value={props.answers[field.id] ?? ""}
          onChange={(v) => {
            props.onChange(field.id, v);
            props.onTrackEdit(field.id, v);
          }}
        />
      ))}
    </div>
  );
}

function WikiFormField(props: {
  field: WikiFormFieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  const { field, value, onChange } = props;
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {field.label}
        {field.ragTag ? (
          <span className="ml-1 font-normal normal-case text-zinc-600">({field.ragTag})</span>
        ) : null}
      </span>
      {field.hint ? <span className="block text-[10px] text-zinc-600">{field.hint}</span> : null}
      {field.multiline ? (
        <textarea
          rows={field.rows ?? 3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        />
      )}
    </label>
  );
}
