import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTeamBlob } from "../../api/useTeamBlob";
import type { TeamOkrsData } from "./types";

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

  if (isLoading)
    return (
      <aside className="sidebar">
        {toggleButton}
        Loading…
      </aside>
    );
  if (error)
    return (
      <aside className="sidebar">
        {toggleButton}
        Failed to load OKRs: {String(error)}
      </aside>
    );

  return (
    <aside className="sidebar">
      {toggleButton}
      {data?.quarters.map((q) => (
        <NavLink
          key={q.quarterId}
          to={`/t/${teamSlug}/okrs/${q.quarterId}`}
          className={({ isActive }) => `eng-card${isActive ? " active" : ""}`}
        >
          <div>
            <div className="name">{q.label}</div>
            <div className="role">
              {q.objectives.length} objective
              {q.objectives.length === 1 ? "" : "s"}
            </div>
          </div>
        </NavLink>
      ))}
    </aside>
  );
}
