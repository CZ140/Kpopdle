// Below-the-fold "About this game" section.
//
// Exists primarily for SEO: the in-game UI is mostly UI chrome + a guess grid,
// which Googlebot's rendered pass scores as ~100 chars of body text and
// rejects as Soft 404. This section adds ~1500 chars of descriptive,
// indexable copy per route.
//
// Rendered as a default-collapsed <details> disclosure so real users see only
// a single quiet "About …" row and aren't distracted by walls of text. Google
// indexes <details> children regardless of the open state (the content is in
// the initial HTML — collapsed children are not the same as display:none from
// the crawler's perspective), so this is *not* cloaking and doesn't violate
// the spam policies. The compromise: visually minimal, fully indexable.
export default function GameAboutSection({ title, eyebrow, paragraphs = [], howToPlay }) {
  return (
    <section
      aria-label={title}
      className="relative z-10 w-full max-w-2xl mx-auto px-4 pt-6 pb-10 sm:pt-8"
    >
      <details className="group kp-pill rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
        <summary
          className="
            list-none cursor-pointer select-none
            flex items-center justify-between gap-3
            px-5 py-3.5 sm:py-4
            text-white/70 hover:text-white/90 transition-colors
          "
        >
          <span className="flex items-baseline gap-3 min-w-0">
            {eyebrow && (
              <span className="hidden sm:inline font-mono text-[10px] tracking-[0.18em] uppercase text-white/40 flex-shrink-0">
                {eyebrow}
              </span>
            )}
            <h2 className="m-0 text-[13px] sm:text-[14px] font-semibold tracking-tight truncate">
              {title}
            </h2>
          </span>
          <span
            aria-hidden="true"
            className="text-white/40 text-xs flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
          >
            ▾
          </span>
        </summary>
        <div className="px-5 pb-5 pt-2 border-t border-white/[0.06] text-white/65">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="text-[13.5px] sm:text-[14.5px] leading-relaxed mb-3 last:mb-0"
            >
              {p}
            </p>
          ))}
          {howToPlay && howToPlay.length > 0 && (
            <>
              <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45 mt-5 mb-2">
                How to play
              </h3>
              <ol className="list-decimal pl-5 space-y-1.5 text-[13.5px] sm:text-[14px] text-white/65 marker:text-white/35">
                {howToPlay.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      </details>
    </section>
  )
}
