import { Link } from "react-router-dom";

export function PostMvpPlaceholder(props: { title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-zinc-100">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300/80">
        After MVP
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{props.title}</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">
        {props.body ??
          "This surface is deferred until after the Author three-seat launch (author, editor, publisher). The code stays in the repo."}
      </p>
      <Link
        to="/home"
        className="mt-8 inline-flex rounded-full border border-violet-500/40 px-4 py-2 text-sm text-violet-100 hover:bg-violet-500/10"
      >
        Back to author home
      </Link>
    </div>
  );
}

export default PostMvpPlaceholder;
