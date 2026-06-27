/**
 * LegalPage — shared layout for the templated legal documents (Privacy, Terms,
 * Cookies, License). Renders a title, "last updated" date, a prominent
 * placeholder disclaimer, and the document body. The content here is a STARTING
 * TEMPLATE only — replace the bracketed [...] placeholders and have it reviewed
 * by a qualified professional before relying on it.
 */
export default function LegalPage({ title, lastUpdated = '[DATE]', children }) {
  return (
    <section className="max-w-3xl mx-auto px-5 pt-16 pb-20">
      <h1 className="text-3xl sm:text-4xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">Last updated: {lastUpdated}</p>

      <div className="mt-6 rounded-xl border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300">
        <strong className="font-semibold">Template — not legal advice.</strong>{' '}
        This document is a placeholder to be customized. Replace the bracketed fields and have it
        reviewed by a qualified legal professional before publishing.
      </div>

      <div className="legal-body mt-8 space-y-6 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

/** Section heading + body helper to keep the documents readable. */
export function LegalSection({ heading, children }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{heading}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
