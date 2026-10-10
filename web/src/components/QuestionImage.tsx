export function QuestionImage({ src, alt, credit, eager = true }: { src: string; alt: string | null; credit: string | null; eager?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-bg">
      <img src={src} alt={alt ?? ""} width={600} height={400} loading={eager ? "eager" : "lazy"} decoding="async" className="h-auto w-full" />
      {credit && <figcaption className="px-3 py-1.5 text-[11px] text-muted">{credit.toLowerCase().includes("illustration") ? credit : `Illustration · ${credit}`}</figcaption>}
    </figure>
  );
}
