export interface DashboardOverviewResponse {
  metrics: {
    openCampaignsCount: number;
    openAnomaliesCount: number;
    unreconciledImmobilizationsCount: number;
    staleInventoryCount: number;
  };
}
