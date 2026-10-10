// Nom du produit : une seule constante à changer.
export const APP_NAME = "Cervo Daily";
export const BASELINE = "Garde ton cervo affûté.";

export const USE_EMULATOR = import.meta.env.VITE_USE_FIREBASE_EMULATOR !== "false";
export const DEV_TOOLS = import.meta.env.VITE_DEV_TOOLS === "true";
export const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-cervo-daily";
export const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key";
export const FIREBASE_AUTH_DOMAIN = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${FIREBASE_PROJECT_ID}.firebaseapp.com`;
export const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
export const EMULATOR_UI_URL = "http://127.0.0.1:4000";
