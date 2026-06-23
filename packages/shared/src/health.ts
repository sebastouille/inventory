export type ApiHealthStatus = "ok" | "degraded";

export interface ApiHealthResponse {
  status: ApiHealthStatus;
  api: "up";
  database: "up" | "down";
  timestamp: string;
}
