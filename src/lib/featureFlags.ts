function enabled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export const featureFlags = {
  get continuousCapture(): boolean {
    return enabled(import.meta.env.VITE_FEATURE_CONTINUOUS_CAPTURE);
  },
  get photoNotes(): boolean {
    return enabled(import.meta.env.VITE_FEATURE_PHOTO_NOTES);
  },
};
