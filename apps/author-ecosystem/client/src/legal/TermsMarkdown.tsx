import { Fragment, type ReactNode } from "react";

function formatBold(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={idx} className="font-semibold text-zinc-100">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <Fragment key={idx}>{part}</Fragment>;
      })}
    </>
  );
}

/** Minimal markdown (headings, `---`, paragraphs, `-` lists, `**bold**`) for bundled legal copy. */
export function TermsMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (t === "") {
      i++;
      continue;
    }
    if (t === "---") {
      nodes.push(<hr key={`hr-${i}`} className="my-8 border-zinc-800" />);
      i++;
      continue;
    }
    if (t.startsWith("# ")) {
      nodes.push(
        <h1 key={`h1-${i}`} className="text-2xl font-bold tracking-tight text-white">
          {formatBold(t.slice(2))}
        </h1>
      );
      i++;
      continue;
    }
    if (t.startsWith("## ")) {
      nodes.push(
        <h2 key={`h2-${i}`} className="mt-8 text-xl font-semibold text-zinc-100">
          {formatBold(t.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (t.startsWith("- ")) {
      const items: ReactNode[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        const raw = lines[i].trim().slice(2);
        items.push(<li key={`li-${i}`}>{formatBold(raw)}</li>);
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-3 list-disc space-y-1 pl-6 text-zinc-300">
          {items}
        </ul>
      );
      continue;
    }
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("-") &&
      lines[i].trim() !== "---"
    ) {
      para.push(lines[i]);
      i++;
    }
    const joined = para.join(" ").trim();
    nodes.push(
      <p key={`p-${i}-${nodes.length}`} className="leading-relaxed text-zinc-300">
        {formatBold(joined)}
      </p>
    );
  }
  return <div className="space-y-1">{nodes}</div>;
}
