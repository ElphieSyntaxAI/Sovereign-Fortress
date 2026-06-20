import { Fragment, type ReactNode } from "react";

function formatInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={idx} className="font-semibold text-zinc-900 dark:text-zinc-100">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
          return (
            <em key={idx} className="text-zinc-600 dark:text-zinc-400">
              {part.slice(1, -1)}
            </em>
          );
        }
        return <Fragment key={idx}>{part}</Fragment>;
      })}
    </>
  );
}

type WikiArticleBodyProps = {
  markdown: string;
  onHeadings?: (headings: { id: string; title: string; level: 2 | 3 }[]) => void;
  selectable?: boolean;
};

/** Wiki article markdown — headings, lists, paragraphs (Fandom-style body). */
export function WikiArticleBody({ markdown, onHeadings, selectable }: WikiArticleBodyProps) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  const headings: { id: string; title: string; level: 2 | 3 }[] = [];
  let i = 0;

  const slug = (title: string, level: number) =>
    `${level}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (t === "") {
      i++;
      continue;
    }
    if (t === "---") {
      nodes.push(<hr key={`hr-${i}`} className="my-6 border-zinc-200 dark:border-zinc-700" />);
      i++;
      continue;
    }
    if (t.startsWith("## ")) {
      const title = t.slice(3).trim();
      const id = slug(title, 2);
      headings.push({ id, title, level: 2 });
      nodes.push(
        <h2
          key={`h2-${i}`}
          id={id}
          className="wiki-section-heading mt-8 border-b border-amber-500/40 pb-1 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          {formatInline(title)}
        </h2>
      );
      i++;
      continue;
    }
    if (t.startsWith("### ")) {
      const title = t.slice(4).trim();
      const id = slug(title, 3);
      headings.push({ id, title, level: 3 });
      nodes.push(
        <h3
          key={`h3-${i}`}
          id={id}
          className="wiki-section-heading mt-6 text-base font-semibold text-zinc-800 dark:text-zinc-100"
        >
          {formatInline(title)}
        </h3>
      );
      i++;
      continue;
    }
    if (t.startsWith("- ")) {
      const items: ReactNode[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        const raw = lines[i].trim().slice(2);
        items.push(
          <li key={`li-${i}`} className="leading-relaxed">
            {formatInline(raw)}
          </li>
        );
        i++;
      }
      nodes.push(
        <ul
          key={`ul-${i}`}
          className="my-3 list-disc space-y-1.5 pl-6 text-[15px] text-zinc-700 dark:text-zinc-300"
        >
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
      <p
        key={`p-${i}-${nodes.length}`}
        className="my-3 text-[15px] leading-7 text-zinc-700 dark:text-zinc-300"
      >
        {formatInline(joined)}
      </p>
    );
  }

  if (onHeadings) onHeadings(headings);

  return (
    <div
      className={[
        "wiki-article-prose",
        selectable ? "select-text cursor-text selection:bg-violet-300/40 dark:selection:bg-violet-500/30" : "",
      ].join(" ")}
    >
      {nodes}
    </div>
  );
}
