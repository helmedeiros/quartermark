import type { SectionDefinition } from "../sections";
import { ClusterDetailPage } from "./adapters/inbound/ClusterDetailPage";
import { OkrDetailPage } from "./adapters/inbound/OkrDetailPage";
import { OkrsLanding } from "./adapters/inbound/OkrsLanding";
import { OkrsSidebar } from "./adapters/inbound/OkrsSidebar";
import { QuarterDetailPage } from "./adapters/inbound/QuarterDetailPage";
import { QuarterGanttPage } from "./adapters/inbound/QuarterGanttPage";

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
