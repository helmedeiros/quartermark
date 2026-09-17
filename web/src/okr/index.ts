// Public surface of the OKR module.
//
// A host application imports the section registration and, where its own
// pages happen to show OKR data or link to a ticket, these few helpers.
// Nothing outside this directory should reach past this file: what is
// exported here is what a package split has to keep working.
export { okrSection } from "./section";
export { type OkrConfig } from "./config";
export { OkrConfigProvider } from "./OkrConfigProvider";
// For a host supplying its own export format: the pieces its columns
// need in order to build the same cells the default ones do.
export {
  buildDetails,
  buildExportRows,
  DEFAULT_EXPORT_COLUMNS,
  formatKeyResults,
  resolveCluster,
  STATUS_META,
  type ExportColumn,
  type ExportContext,
} from "./okrExport";
export { DEFAULT_CLUSTERS } from "./okrTree/metadata";
export { jiraLabelSearchUrl, jiraTicketUrl } from "./jira";
export type { OkrNode, Quarter, TeamOkrsData } from "./components/types";
