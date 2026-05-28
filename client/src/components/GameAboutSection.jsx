// Below-the-fold "About this game" section.
//
// Exists for SEO, not UX: the in-game UI is mostly UI chrome + a guess grid,
// which Googlebot's rendered pass scores as ~100 chars of body text and
// rejects as "Soft 404." This section gives every game route ~500+ chars of
// descriptive, indexable copy explaining the mode, how it works, and the KST
// reset cycle. Real visitors who scroll past the game see a brief explainer;
// most never see it because the game fits in viewport.
export default function GameAboutSection({ title, eyebrow, paragraphs = [], howToPlay }) {
  return (
    <section
      aria-label={title}
      className="relative z-10 w-full max-w-2xl mx-auto px-4 pt-8 pb-12 sm:pt-12"
    >
      <div className="kp-pill-strong rounded-2xl p-6 sm:p-7 text-white/70">
        {eyebrow && (
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-white/45 mb-2">
            {eyebrow}
          </div>
        )}
        <h2 className="text-lg sm:text-xl font-extrabold text-white mb-3 tracking-tight">
          {title}
        </h2>
        {paragraphs.map((p, i) => (
          <p key={i} className="text-[13.5px] sm:text-[14.5px] leading-relaxed mb-3 last:mb-0 text-white/65">
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
    </section>
  )
}
