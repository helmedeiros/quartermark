import { useEffect } from "react";
import { useMatch } from "react-router-dom";
import { useDefaultTeamSlug } from "./api/useDefaultTeamSlug";

const STORAGE_KEY = "dossier.currentTeamSlug";

export function useCurrentTeamSlug(): string {
  const teamMatch = useMatch("/t/:teamSlug/*");
  const matchedSlug = teamMatch?.params.teamSlug;
  const fallback = useDefaultTeamSlug();

  useEffect(() => {
    if (matchedSlug) localStorage.setItem(STORAGE_KEY, matchedSlug);
  }, [matchedSlug]);

  return matchedSlug ?? localStorage.getItem(STORAGE_KEY) ?? fallback;
}
