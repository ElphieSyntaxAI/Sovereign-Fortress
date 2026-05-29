import * as vscode from "vscode";

/** Workspace-relative path only — rejects absolute paths and junk tab labels. */
export function isWorkspaceRelativePath(rel: string): boolean {
  const p = rel.replace(/\\/g, "/").trim();
  if (!p || p.startsWith("..")) return false;
  if (/^[a-zA-Z]:/.test(p)) return false;
  if (p.startsWith("/")) return false;
  if (p.includes("://")) return false;
  if (!p.includes("/")) {
    return /^(Gemfile|Rakefile|Dockerfile|package\.json|\.vscode\/)/.test(p);
  }
  return true;
}

export function relativePathInWorkspace(uri: vscode.Uri): string | null {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) return null;
  if (uri.scheme !== "file") return null;

  const rel = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, "/");
  return isWorkspaceRelativePath(rel) ? rel : null;
}

/** Active editor only — never all open tabs (avoids cross-repo noise). */
export function activeEditorScopePath(): string | null {
  const active = vscode.window.activeTextEditor;
  if (!active) return null;
  return relativePathInWorkspace(active.document.uri);
}

/** Guess likely files from intent (e.g. team + test → teams_controller_test.rb). */
export async function inferPathsFromIntent(intent: string): Promise<string[]> {
  const lower = intent.toLowerCase();
  const patterns = new Set<string>();

  if (/\bteam/.test(lower)) {
    patterns.add("**/teams_controller*.rb");
    patterns.add("**/team_membership*.rb");
    patterns.add("**/teams_controller*_test.rb");
  }
  if (/\bmembership/.test(lower)) {
    patterns.add("**/team_membership*.rb");
    patterns.add("**/memberships_controller*.rb");
    patterns.add("**/*membership*_test.rb");
  }
  if (/\bcontroller/.test(lower)) {
    patterns.add("**/controllers/**/*_controller.rb");
    patterns.add("**/test/controllers/**/*_test.rb");
    patterns.add("**/spec/controllers/**/*_spec.rb");
  }
  if (/\btest/.test(lower) || /\bspec/.test(lower)) {
    patterns.add("**/test/**/*_test.rb");
    patterns.add("**/spec/**/*_spec.rb");
  }

  const exclude = "**/{node_modules,vendor/bundle,.git,dist,tmp,coverage}/**";
  const found = new Set<string>();

  for (const pattern of [...patterns].slice(0, 8)) {
    const uris = await vscode.workspace.findFiles(pattern, exclude, 10);
    for (const uri of uris) {
      const rel = relativePathInWorkspace(uri);
      if (rel) found.add(rel);
    }
  }

  return [...found].slice(0, 12);
}

export async function collectOptimizerScopePaths(intent: string): Promise<string[]> {
  const paths = new Set<string>();
  const active = activeEditorScopePath();
  if (active) paths.add(active);

  const inferred = await inferPathsFromIntent(intent);
  for (const p of inferred) paths.add(p);

  return [...paths].slice(0, 16);
}
