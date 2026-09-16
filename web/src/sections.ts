import type { ComponentType } from "react";
import { okrSection } from "./okr";

// A section is a self-contained area of the app: its own sidebar, index
// page and routes, mounted under /t/:teamSlug/<id>/.
//
// The shape exists so a section can be written without knowing what else
// the application contains — which is what lets the OKR section here be
// the very same code a larger host application mounts beside its own.

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
