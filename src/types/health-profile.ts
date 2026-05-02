export const HEALTH_DOC_ID = "health";
export const PROFILE_COLLECTION = "profile" as const;

export interface SupplementEntry {
  id: string;
  label: string;
  suggestedTime: string;
  /** User override for intake time hint */
  userTime?: string;
}

export interface HealthProfileDoc {
  version: 1;
  setupCompletedAt: number | null;
  updatedAt: number;
  avoidFoodPresetIds: string[];
  customAvoidLabels: string[];
  nutritionGoal: string;
  supplements: SupplementEntry[];
  waterTargetLiters: number;
}
