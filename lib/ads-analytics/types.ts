export type AnalyticsMode = "demo" | "live";
export type AnalyticsMetricKey = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "cpm";
export type CampaignStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

export type AnalyticsAccount = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
};

export type AnalyticsMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  reach?: number;
  ctr: number;
  cpc: number;
  cpm: number;
};

export type AnalyticsPoint = AnalyticsMetrics & { date: string };
export type PlatformPerformance = AnalyticsMetrics & { platform: string };
export type CampaignPerformance = AnalyticsMetrics & {
  id: string;
  name: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  daily: AnalyticsPoint[];
  platforms: PlatformPerformance[];
};

export type DrilldownLevel = "adset" | "ad";
export type DrilldownRow = AnalyticsMetrics & {
  id: string;
  name: string;
  status: CampaignStatus;
  level: DrilldownLevel;
  parentId: string;
  parentName: string;
  startDate: string;
  endDate: string;
  daily: AnalyticsPoint[];
  previewUrl?: string;
};

export type DrilldownReport = {
  mode: AnalyticsMode;
  level: DrilldownLevel;
  account: AnalyticsAccount;
  dateRange: { since: string; until: string };
  generatedAt: string;
  rows: DrilldownRow[];
  partialWarnings: string[];
};

export type AnalyticsReport = {
  mode: AnalyticsMode;
  account: AnalyticsAccount;
  dateRange: { since: string; until: string };
  generatedAt: string;
  summary: AnalyticsMetrics;
  previous?: AnalyticsMetrics;
  daily: AnalyticsPoint[];
  platforms: PlatformPerformance[];
  campaigns: CampaignPerformance[];
  partialWarnings: string[];
};

export type ConnectedAnalyticsAccount = AnalyticsAccount & {
  connectionId: string;
  status: "active" | "expired" | "revoked" | "error";
  lastSyncedAt?: string;
};
