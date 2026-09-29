import { useEffect, useState } from "react";
import { useTeamBlob } from "../../../api/useTeamBlob";
import { SidebarNavLink } from "../../../components/SidebarNavLink";
import { SidebarShell } from "../../../components/SidebarShell";
import type { TeamOkrsData } from "../../domain/model";

const COLLAPSED_KEY = "okrsSidebarCollapsed";
const EXPANDED_WIDTH = "280px";
const COLLAPSED_WIDTH = "40px";

export function OkrsSidebar({ teamSlug }: { teamSlug: string }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--layout-sidebar-width",
      collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
    );
    return () => {
      document.documentElement.style.removeProperty("--layout-sidebar-width");
    };
  }, [collapsed]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {}
  };

  const { data, isLoading, error } = useTeamBlob<TeamOkrsData>(
    teamSlug,
    "okrs",
  );

  const toggleButton = (
    <button
      type="button"
      className="okrs-sidebar-toggle"
      aria-label={collapsed ? "Expand quarter list" : "Collapse quarter list"}
      onClick={toggle}
    >
      {collapsed ? "▸" : "◂"}
    </button>
  );

  if (collapsed) {
    return <aside className="sidebar">{toggleButton}</aside>;
  }

  return (
    <SidebarShell
      isLoading={isLoading}
      error={error}
      label="OKRs"
      before={toggleButton}
    >
      {data?.quarters.map((q) => (
        <SidebarNavLink
          key={q.quarterId}
          to={`/t/${teamSlug}/okrs/${q.quarterId}`}
          name={q.label}
          detail={`${q.objectives.length} objective${q.objectives.length === 1 ? "" : "s"}`}
        />
      ))}
    </SidebarShell>
  );
}
