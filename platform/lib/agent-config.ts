export interface AgentTarget {
  id: string;
  url: string;
  name: string;
  enabled: boolean;
}

export interface AgentConfig {
  targets: AgentTarget[];
  schedule: "disabled" | "hourly" | "daily" | "weekly";
  thresholds: {
    diffPercent: number;      // visual regression %, default 5
    minSeverity: "low" | "medium" | "high";
  };
  notifications: {
    github: boolean;
    slack: boolean;
  };
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  targets: [],
  schedule: "daily",
  thresholds: { diffPercent: 5, minSeverity: "medium" },
  notifications: { github: false, slack: false },
};

export const SCHEDULE_TO_CRON: Record<AgentConfig["schedule"], string | null> = {
  disabled: null,
  hourly: "0 * * * *",
  daily: "0 9 * * *",
  weekly: "0 9 * * 1",
};
