// Synthèse vocale du navigateur pour la dictée (aucun fichier audio : la voix du téléphone lit le texte).

/** Le texte de la dictée arrive encodé (base64) pour ne pas s'afficher en clair dans la page. */
export function decodeSpeech(speech?: string): string {
  if (!speech) return "";
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(speech), (c) => c.charCodeAt(0)));
  } catch {
    return "";
  }
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Meilleure voix française disponible (les voix arrivent parfois après le chargement de la page). */
function frenchVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "fr-FR" && v.localService) ?? voices.find((v) => v.lang.startsWith("fr"));
}

/** Lit `text` à la vitesse `rate` ; `onEnd` est appelé à la fin (ou à l'interruption). */
export function speak(text: string, rate: number, onEnd: () => void): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = rate;
  const voice = frenchVoice();
  if (voice) utterance.voice = voice;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
