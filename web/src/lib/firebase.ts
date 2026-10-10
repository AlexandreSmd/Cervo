// Firebase côté navigateur : uniquement l'authentification (émulateur en local).
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { AUTH_EMULATOR_URL, FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, USE_EMULATOR } from "./config";

// Le navigateur n'utilise Firebase que pour l'authentification :
// Firestore n'est accessible qu'à travers l'API.
const app = initializeApp({ apiKey: FIREBASE_API_KEY, authDomain: FIREBASE_AUTH_DOMAIN, projectId: FIREBASE_PROJECT_ID });
export const auth = getAuth(app);
auth.languageCode = "fr";
if (USE_EMULATOR) connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });

/** En local : récupère le dernier lien magique émis par l'émulateur Auth pour cet e-mail. */
export async function latestEmulatorLink(email: string): Promise<string | null> {
  const res = await fetch(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${FIREBASE_PROJECT_ID}/oobCodes`);
  if (!res.ok) return null;
  const data = (await res.json()) as { oobCodes: { email: string; requestType: string; oobLink: string }[] };
  const links = data.oobCodes.filter((c) => c.email.toLowerCase() === email.toLowerCase() && c.requestType === "EMAIL_SIGNIN");
  return links.length ? links[links.length - 1].oobLink : null;
}
