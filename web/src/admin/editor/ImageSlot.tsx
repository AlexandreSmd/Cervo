// Photo d'une question : envoi (réduite à 1200 px), URL, description et crédit.
import { useState } from "react";
import { api } from "../../lib/api";
import type { ImageRef } from "../../lib/types";

/** Réduit une photo (1200 px max, JPEG) avant l'envoi. */
async function compress(file: File): Promise<string> {
  if (file.type === "image/svg+xml") {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(file);
    });
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ImageSlot({
  index,
  image,
  onChange,
  labelled,
}: {
  index: number;
  image: ImageRef;
  onChange: (i: ImageRef) => void;
  labelled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.admin.uploadMedia(await compress(file));
      onChange({ ...image, url });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const name = labelled ? `Photo ${String.fromCharCode(65 + index)}` : "Photo";
  return (
    <div className="space-y-2 rounded-2xl bg-ink/5 p-3">
      <div className="flex items-center gap-3">
        <label className="relative flex h-20 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-card text-xs font-semibold text-muted hover:ring-2 hover:ring-accent">
          {image.url ? <img src={image.url} alt="" className="h-full w-full object-cover" /> : busy ? "Envoi…" : "+ Photo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label={`${name} : choisir un fichier`}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
        <div className="flex-1 space-y-2">
          <input
            className="input py-2 text-sm"
            placeholder={`${name} : URL (ou envoie un fichier)`}
            aria-label={`${name} : URL`}
            value={image.url}
            onChange={(e) => onChange({ ...image, url: e.target.value })}
            required
          />
          <input
            className="input py-2 text-sm"
            placeholder="Description (accessibilité)"
            aria-label={`${name} : description`}
            value={image.alt}
            onChange={(e) => onChange({ ...image, alt: e.target.value })}
            required
          />
        </div>
      </div>
      <input
        className="input py-2 text-sm"
        placeholder="Crédit (auteur, licence)"
        aria-label={`${name} : crédit`}
        value={image.credit ?? ""}
        onChange={(e) => onChange({ ...image, credit: e.target.value })}
      />
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
