// Nom du produit et promesse : une seule constante à changer (côté API : api/cervo/__init__.py).
export const APP_NAME = "Aiguisé";
export const BASELINE = "Garde ton esprit affûté, vif et précis.";
export const MISSION = "Garder son esprit affûté, vif et précis.";

export const USE_EMULATOR = import.meta.env.VITE_USE_FIREBASE_EMULATOR !== "false";
export const DEV_TOOLS = import.meta.env.VITE_DEV_TOOLS === "true";
export const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-cervo-daily";
export const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key";
export const FIREBASE_AUTH_DOMAIN = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${FIREBASE_PROJECT_ID}.firebaseapp.com`;
// L'émulateur Auth est joint sur la même machine que le site : ça marche aussi depuis un téléphone sur le Wi-Fi local.
const EMULATOR_HOST = typeof window !== "undefined" && window.location.hostname !== "localhost" ? window.location.hostname : "127.0.0.1";
export const AUTH_EMULATOR_URL = `http://${EMULATOR_HOST}:9099`;
export const EMULATOR_UI_URL = `http://${EMULATOR_HOST}:4000`;
// Adresse publique du site, utilisée dans le message de partage (sinon l'adresse courante).
export const PUBLIC_URL: string = import.meta.env.VITE_PUBLIC_URL || "";
