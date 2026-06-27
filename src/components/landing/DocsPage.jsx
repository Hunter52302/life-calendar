import { Link, useOutletContext } from 'react-router-dom';
import { GITHUB_PAGE } from './shared.jsx';

/**
 * DocsPage — /docs. A lightweight documentation/help page. Content is
 * intentionally simple Markdown-like prose; expand sections as the product
 * grows. A left "on this page" rail links to in-page anchors.
 */

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting started',
    body: [
      'Create a free account from the “Log in / Sign up” button. Your password does double duty: it signs you in and it derives the key that encrypts your data, so choose something strong and unique.',
      'Right after sign-up you’ll be shown a one-time recovery code. Save it somewhere safe — it’s the only way to regain access if you forget your password, and it cannot be shown again.',
    ],
  },
  {
    id: 'plan-vs-reality',
    title: 'Plan vs. reality',
    body: [
      'The Plan view is where you lay out the week you intend to live. The Live view is where you record what actually happened. The “See Your Life” view compares the two and shows you the gap by category.',
      'Use precision levels to block time roughly or to the minute, and pin the categories you use most for quick entry.',
    ],
  },
  {
    id: 'encryption',
    title: 'Encryption & privacy',
    body: [
      'PLS Calendar uses zero-knowledge encryption. Your calendar, tasks, habits, and budgets are encrypted in your browser before anything is sent to the server. The server only ever stores ciphertext.',
      'Because of this, nobody — including the operators of the service — can read your data. The trade-off is that losing both your password and your recovery code means the data cannot be recovered.',
    ],
  },
  {
    id: 'syncing',
    title: 'Syncing calendars',
    body: [
      'Import or subscribe to external calendars via iCal (.ics) URLs, or connect Google and Outlook to pull events in automatically. Subscribed calendars refresh shortly after login and periodically while the app is open.',
      'You can also publish your own outbound feed so other apps can subscribe to your PLS Calendar.',
    ],
  },
  {
    id: 'apps',
    title: 'Desktop & mobile apps',
    body: [
      'Native desktop builds for Windows and Linux are available on the Downloads page (macOS is coming soon). On phones and tablets, install the Progressive Web App via “Add to Home Screen”.',
      'The native and installed apps skip this website entirely and open straight into the calendar.',
    ],
  },
];

export default function DocsPage() {
  const { onEnter } = useOutletContext();

  return (
    <section className="max-w-5xl mx-auto px-5 pt-16 pb-20">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold">Documentation</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Everything you need to get up and running. This is a living document — see the{' '}
          <a href={GITHUB_PAGE} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">GitHub repository</a>{' '}
          for source and issues.
        </p>
      </div>

      <div className="grid md:grid-cols-[200px_1fr] gap-10">
        {/* On this page */}
        <nav className="hidden md:block">
          <div className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">On this page</p>
            <ul className="space-y-2">
              {SECTIONS.map(s => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-500 transition-colors">{s.title}</a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Content */}
        <div className="space-y-12">
          {SECTIONS.map(s => (
            <article key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-xl font-bold mb-3">{s.title}</h2>
              <div className="space-y-3">
                {s.body.map((p, i) => (
                  <p key={i} className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{p}</p>
                ))}
              </div>
            </article>
          ))}

          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 p-6">
            <h2 className="font-semibold">Ready to try it?</h2>
            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">Create a free, encrypted account in seconds.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={onEnter} className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors">
                Log in / Sign up
              </button>
              <Link to="/downloads" className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold hover:bg-white dark:hover:bg-gray-800 transition-colors">
                Download the app
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
