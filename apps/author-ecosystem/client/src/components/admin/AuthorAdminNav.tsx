import { Link, useLocation } from "react-router-dom";

import { useAuthorRole } from "../../context/AuthorRoleContext";
import { AUTHOR_ADMIN_NAV, type AuthorAdminNavItem } from "../../lib/authorAdminNavConfig";

function isItemActive(pathname: string, item: AuthorAdminNavItem): boolean {
  if (!item.to) return false;
  if (item.id === "admin") {
    return pathname === "/admin" || pathname === "/admin/";
  }
  const prefix = item.matchPrefix ?? item.to;
  return pathname === item.to || (prefix !== "/admin" && pathname.startsWith(prefix));
}

function NavSection(props: { title: string; items: AuthorAdminNavItem[]; pathname: string }) {
  const { user } = useAuthorRole();
  const isOperator = Boolean(user?.is_platform_operator);

  return (
    <div className="space-y-0.5">
      <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {props.title}
      </p>
      <ul className="space-y-0.5">
        {props.items.map((item) => {
          if (item.id === "admin" && !isOperator) {
            return (
              <li key={item.id}>
                <Link
                  to="/admin/sign-in"
                  className="block rounded-lg px-2 py-2 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-violet-200"
                >
                  Admin (operator)
                </Link>
              </li>
            );
          }
          const active = item.to ? isItemActive(props.pathname, item) : false;
          const className = [
            "block rounded-lg px-2 py-2 text-xs font-medium transition",
            active
              ? "bg-violet-500/20 text-violet-100 ring-1 ring-violet-500/30"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
          ].join(" ");
          if (item.href) {
            return (
              <li key={item.id}>
                <a
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer noopener" : undefined}
                  className={className}
                >
                  {item.label}
                  {item.external ? <span className="ml-1 opacity-60">↗</span> : null}
                </a>
              </li>
            );
          }
          return (
            <li key={item.id}>
              <Link to={item.to!} className={className}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AuthorAdminNav() {
  const location = useLocation();
  const platform = AUTHOR_ADMIN_NAV.filter((i) => i.section === "platform");
  const roles = AUTHOR_ADMIN_NAV.filter((i) => i.section === "roles");
  const account = AUTHOR_ADMIN_NAV.filter((i) => i.section === "account");

  return (
    <aside
      className="hidden w-52 shrink-0 border-r border-zinc-800/80 pr-4 lg:block"
      aria-label="Platform admin navigation"
    >
      <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">
        Admin nav
      </p>
      <nav className="mt-4 space-y-5">
        <NavSection title="Platform" items={platform} pathname={location.pathname} />
        <NavSection title="Role dashboards" items={roles} pathname={location.pathname} />
        <NavSection title="Account" items={account} pathname={location.pathname} />
      </nav>
    </aside>
  );
}

/** Compact admin nav for mobile — horizontal strip under top nav. */
export function AuthorAdminNavMobile() {
  const location = useLocation();
  const { user } = useAuthorRole();
  const isOperator = Boolean(user?.is_platform_operator);
  const items = AUTHOR_ADMIN_NAV.filter((i) =>
    ["admin", "author", "editor", "settings", "notifications"].includes(i.id)
  );

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-zinc-800/80 pb-2 lg:hidden"
      aria-label="Admin navigation (mobile)"
    >
      {items.map((item) => {
        const to = item.id === "admin" && !isOperator ? "/admin/sign-in" : item.to!;
        const active = isItemActive(location.pathname, item);
        return (
          <Link
            key={item.id}
            to={to}
            className={[
              "whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium",
              active ? "bg-violet-500/25 text-violet-100" : "text-zinc-500 hover:text-zinc-200",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
