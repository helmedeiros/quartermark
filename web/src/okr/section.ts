import type { SectionDefinition } from "../sections";
import { ClusterDetailPage } from "./components/ClusterDetailPage";
import { OkrDetailPage } from "./components/OkrDetailPage";
import { OkrsLanding } from "./components/OkrsLanding";
import { OkrsSidebar } from "./components/OkrsSidebar";
import { QuarterDetailPage } from "./components/QuarterDetailPage";
import { QuarterGanttPage } from "./components/QuarterGanttPage";

export const okrSection: SectionDefinition = {
  id: "okrs",
  navLabel: "OKRs",
  Sidebar: OkrsSidebar,
  index: { kind: "component", Component: OkrsLanding },
  routes: [
    { path: "clusters/:cluster", Component: ClusterDetailPage },
    { path: ":quarterId/gantt", Component: QuarterGanttPage },
    { path: ":quarterId/:okrId", Component: OkrDetailPage },
    { path: ":quarterId", Component: QuarterDetailPage },
  ],
};
