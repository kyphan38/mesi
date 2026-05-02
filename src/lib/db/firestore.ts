import {
  type DocumentData,
  doc,
  getDoc,
  setDoc,
  collection,
  type CollectionReference,
  type DocumentReference,
} from "firebase/firestore";
import { getCurrentUidOrThrow, getFirebaseFirestore } from "@/lib/auth/firebase-client";
import {
  HEALTH_DOC_ID,
  PROFILE_COLLECTION,
  type HealthProfileDoc,
  type SupplementEntry,
} from "@/types/health-profile";
import { getSupplementPreset } from "@/lib/constants/health-presets";

export const MESI_COLLECTIONS = {
  profile: PROFILE_COLLECTION,
  meals: "meals",
  ingredients: "ingredients",
} as const;

export type MesiCollectionName = (typeof MESI_COLLECTIONS)[keyof typeof MESI_COLLECTIONS];

export function userCollectionRef<T extends DocumentData = DocumentData>(
  collectionName: MesiCollectionName,
): CollectionReference<T> {
  const uid = getCurrentUidOrThrow();
  return collection(getFirebaseFirestore(), "users", uid, collectionName) as CollectionReference<T>;
}

export function userDocRef<T extends DocumentData = DocumentData>(
  collectionName: MesiCollectionName,
  docId: string,
): DocumentReference<T> {
  const uid = getCurrentUidOrThrow();
  return doc(getFirebaseFirestore(), "users", uid, collectionName, docId) as DocumentReference<T>;
}

export async function getUserDoc<T extends DocumentData>(
  collectionName: MesiCollectionName,
  docId: string,
): Promise<{ exists: boolean; data: T | null }> {
  const ref = userDocRef<T>(collectionName, docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { exists: false, data: null };
  return { exists: true, data: snap.data() as T };
}

export async function setUserDoc<T extends DocumentData>(
  collectionName: MesiCollectionName,
  docId: string,
  data: Partial<T>,
  options?: { merge?: boolean },
): Promise<void> {
  const ref = userDocRef<T>(collectionName, docId);
  await setDoc(ref, data as DocumentData, { merge: options?.merge ?? true });
}

export function getDefaultHealthProfile(): HealthProfileDoc {
  const now = Date.now();
  const supplements: SupplementEntry[] = ["fish_oil", "vitamin_c"].map((id) => {
    const p = getSupplementPreset(id)!;
    return {
      id: p.id,
      label: p.label,
      suggestedTime: p.suggestedTime,
    };
  });
  return {
    version: 1,
    setupCompletedAt: null,
    updatedAt: now,
    avoidFoodPresetIds: ["refined_sugar", "dairy", "bad_fats"],
    customAvoidLabels: [],
    nutritionGoalIds: ["eat_clean_skin"],
    customNutritionLabels: [],
    supplements,
    waterTargetLiters: 2,
  };
}

function coerceHealthProfile(raw: Record<string, unknown> | undefined): HealthProfileDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const defaults = getDefaultHealthProfile();
  const setupCompletedAt =
    typeof raw.setupCompletedAt === "number"
      ? raw.setupCompletedAt
      : raw.setupCompletedAt === null
        ? null
        : defaults.setupCompletedAt;
  const updatedAt = typeof raw.updatedAt === "number" ? raw.updatedAt : defaults.updatedAt;
  const avoidFoodPresetIds = Array.isArray(raw.avoidFoodPresetIds)
    ? (raw.avoidFoodPresetIds as unknown[]).filter((x): x is string => typeof x === "string")
    : defaults.avoidFoodPresetIds;
  const customAvoidLabels = Array.isArray(raw.customAvoidLabels)
    ? (raw.customAvoidLabels as unknown[]).filter((x): x is string => typeof x === "string")
    : defaults.customAvoidLabels;

  let nutritionGoalIds = defaults.nutritionGoalIds;
  if (Array.isArray(raw.nutritionGoalIds)) {
    nutritionGoalIds = (raw.nutritionGoalIds as unknown[]).filter(
      (x): x is string => typeof x === "string",
    );
  } else if (typeof raw.nutritionGoal === "string" && raw.nutritionGoal.trim()) {
    nutritionGoalIds = [raw.nutritionGoal.trim()];
  }
  if (nutritionGoalIds.length === 0) nutritionGoalIds = defaults.nutritionGoalIds;

  const customNutritionLabels = Array.isArray(raw.customNutritionLabels)
    ? (raw.customNutritionLabels as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const waterTargetLiters =
    typeof raw.waterTargetLiters === "number" && Number.isFinite(raw.waterTargetLiters)
      ? raw.waterTargetLiters
      : defaults.waterTargetLiters;

  let supplements: SupplementEntry[] = defaults.supplements;
  if (Array.isArray(raw.supplements)) {
    supplements = (raw.supplements as unknown[])
      .map((item): SupplementEntry | null => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id : "";
        if (!id) return null;
        const preset = getSupplementPreset(id);
        const label =
          typeof o.label === "string" && o.label.trim()
            ? o.label.trim()
            : preset?.label ?? id;
        const suggestedTime =
          typeof o.suggestedTime === "string" && o.suggestedTime.trim()
            ? o.suggestedTime.trim()
            : preset?.suggestedTime ?? "";
        const userTime =
          typeof o.userTime === "string" && o.userTime.trim() ? o.userTime.trim() : undefined;
        const dosageNote =
          typeof o.dosageNote === "string" && o.dosageNote.trim() ? o.dosageNote.trim() : undefined;
        return {
          id,
          label,
          suggestedTime,
          ...(userTime ? { userTime } : {}),
          ...(dosageNote ? { dosageNote } : {}),
        };
      })
      .filter((x): x is SupplementEntry => x !== null);
  }

  return {
    version: 1,
    setupCompletedAt,
    updatedAt,
    avoidFoodPresetIds,
    customAvoidLabels,
    nutritionGoalIds,
    customNutritionLabels,
    supplements,
    waterTargetLiters,
  };
}

export async function getHealthProfile(): Promise<HealthProfileDoc | null> {
  const { exists, data } = await getUserDoc<Record<string, unknown>>(
    PROFILE_COLLECTION,
    HEALTH_DOC_ID,
  );
  if (!exists || !data) return null;
  return coerceHealthProfile(data);
}

export async function saveHealthProfile(
  profile: Omit<HealthProfileDoc, "updatedAt"> & { updatedAt?: number },
): Promise<void> {
  const payload: HealthProfileDoc = {
    ...profile,
    version: 1,
    updatedAt: profile.updatedAt ?? Date.now(),
  };
  await setUserDoc(PROFILE_COLLECTION, HEALTH_DOC_ID, payload as DocumentData, { merge: false });
}
