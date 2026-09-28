import type { ComponentType } from "react";
import { okrSection } from "./okr";

export interface SectionPageProps {
  teamSlug: string;
}

export interface SectionRoute {
  path: string;
  Component: ComponentType<SectionPageProps>;
}

export type SectionIndex =
  | { kind: "component"; Component: ComponentType<SectionPageProps> }
  | { kind: "redirect"; to: string };

export interface SectionDefinition {
  id: string;
  navLabel: string;
  Sidebar: ComponentType<SectionPageProps>;
  index: SectionIndex;
  routes: SectionRoute[];
}

export const SECTIONS: SectionDefinition[] = [okrSection];

export const DEFAULT_SECTION_ID = SECTIONS[0].id;
