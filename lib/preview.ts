import "server-only";

export const isPreviewMode = process.env.DEV_BYPASS_AUTH === "true";
