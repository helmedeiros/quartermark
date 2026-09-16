import { useEffect } from "react";
import { useMatch } from "react-router-dom";
import { useDefaultTeamSlug } from "./api/useDefaultTeamSlug";

const STORAGE_KEY = "dossier.currentTeamSlug";

// The team currently "in view," even on pages that aren't under
// /t/:teamSlug (e.g. /engineers) — remembered in localStorage so
// switching to Engineers and back doesn't silently drop you elsewhere.
//
// Returns "" when nothing is in view and the registry is empty or still
// loading. Callers must treat that as "no team yet" rather than passing
// it on as a slug.
export function useCurrentTeamSlug(): string {
  const teamMatch = useMatch("/t/:teamSlug/*");
  const matchedSlug = teamMatch?.params.teamSlug;
  const fallback = useDefaultTeamSlug();

  useEffect(() => {
    if (matchedSlug) localStorage.setItem(STORAGE_KEY, matchedSlug);
  }, [matchedSlug]);

  return matchedSlug ?? localStorage.getItem(STORAGE_KEY) ?? fallback;
}
