import { Model } from "sequelize";

let currentUserId: string | null = null;

export const setCurrentUser = (userId: string | null): void => {
  currentUserId = userId;
};

export const getCurrentUser = (): string | null => {
  return currentUserId;
};

export const beforeSave = (record: Model) => {
  const now = Date.now();

  if (record.isNewRecord) {
    record.set("created_at", now);
    record.set("updated_at", now);

    if (currentUserId) {
      record.set("created_by", currentUserId);
      record.set("updated_by", currentUserId);
    }
  } else {
    console.log("Update record");
    record.set("updated_at", now);
    record.set("updated_on", now);

    if (currentUserId) {
      record.set("updated_by", currentUserId);
    }
  }
};
