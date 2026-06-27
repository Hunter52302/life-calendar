import { useState, useEffect } from 'react';

/**
 * LandingPage — the web-facing "front door".
 *
 * Shown only in a normal browser (see src/lib/platform.js), before the
 * calendar app itself is mounted. Its whole purpose is to let a first-time
 * visitor read about the product, download a native build, or jump to GitHub
 * WITHOUT the app booting up, hitting the API, or touching their data. Nothing
 * loads or syncs until they press "Log in / Sign up", which calls `onEnter()`
 * to hand control to <App/> (and its AuthGate).
 *
 * Sections: Home (hero), Features, Downloads (live GitHub release assets),
 * plus a top nav with a GitHub link and the login button.
 */

const GITHUB_REPO          = 'Hunter52302/life-calendar';
const GITHUB_PAGE          = `https://github.com/${GITHUB_REPO}`;
const GITHUB_API           = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASES_PAGE = `${GITHUB_PAGE}/releases`;

// Mirrors DownloadModal's asset matching so the landing "Downloads" section
// surfaces the same native builds the in-app modal does.
const PLATFORMS = [
  {
    name: 'Windows',
    note: 'Windows 10/11 · 64-bit',
    patterns: [/setup\.exe$/i, /x64.*\.exe$/i, /\.exe$/i],
    label: 'Download (.exe)',
    color: 'text-blue-500',
    icon: (
      <svg className="w-9 h-9" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
      </svg>
    ),
  },
  {
    name: 'Linux',
    note: 'Ubuntu / Debian · 64-bit',
    patterns: [/\.deb$/i],
    altPatterns: [/\.AppImage$/i],
    label: 'Download (.deb)',
    altLabel: 'AppImage',
    color: 'text-orange-500',
    icon: (
      <svg className="w-9 h-9" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10S2 17.514 2 12 6.486 2 12 2zm-1 5v6l5 3-.75 1.23L10 14V7h1z" />
      </svg>
    ),
  },
  {
    name: 'macOS',
    note: 'Coming soon',
    comingSoon: true,
    color: 'text-gray-400 dark:text-gray-500',
    icon: (
      <svg className="w-9 h-9" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
  },
];

const FEATURES = [
  {
    title: 'Plan vs. reality',
    body: 'Lay out the week you intend to live, log what actually happened, then see the gap. The "See Your Life" view turns the difference into something you can act on.',
    icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2',
  },
  {
    title: 'Zero-knowledge by default',
    body: 'Your password encrypts everything client-side. The server only ever stores ciphertext — nobody but you can read your calendar, not even us.',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    title: 'Habits, budgets & to-dos',
    body: 'Track streaks, set weekly time budgets per category, and manage tasks on a list or kanban board — all in one place, all encrypted.',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  },
  {
    title: 'Yours on every device',
    body: 'Use it in the browser, install the PWA, or download the native desktop and mobile apps. Connect Google, Outlook, or any iCal feed to keep it in sync.',
    icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
];

function matchAsset(assets, patterns) {
  if (!patterns) return null;
  for (const pattern of patterns) {
    const found = assets.find(a => pattern.test(a.name));
    if (found) return found.browser_download_url;
  }
  return null;
}

function GithubIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.52 11.52 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export default function LandingPage({ onEnter, theme = 'dark' }) {
  const [release, setRelease] = useState(null);  // null = loading, false = none
  const [assets,  setAssets]  = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch(GITHUB_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => { if (!cancelled) { setRelease(data); setAssets(data.assets ?? []); } })
      .catch(() => { if (!cancelled) setRelease(false); });
    return () => { cancelled = true; };
  }, []);

  const hasRelease = release && release !== false;

  const navLink = 'text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors';

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-[100dvh] bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 pl-safe pr-safe">
        {/* ── Top nav ───────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 backdrop-blur bg-white/80 dark:bg-gray-950/80 border-b border-gray-100 dark:border-gray-800">
          <nav className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
            <a href="#home" className="flex items-center gap-2 font-bold">
              <span className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center shadow">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
              </span>
              <span className="text-base">PLS Calendar</span>
            </a>

            <div className="hidden sm:flex items-center gap-6">
              <a href="#home" className={navLink}>Home</a>
              <a href="#features" className={navLink}>Features</a>
              <a href="#downloads" className={navLink}>Downloads</a>
              <a href={GITHUB_PAGE} target="_blank" rel="noopener noreferrer" className={`${navLink} flex items-center gap-1.5`}>
                <GithubIcon className="w-4 h-4" /> GitHub
              </a>
            </div>

            <button
              type="button"
              onClick={onEnter}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              Log in / Sign up
            </button>
          </nav>
        </header>

        {/* ── Hero / Home ───────────────────────────────────────────────── */}
        <section id="home" className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Private by design · zero-knowledge encryption
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Plan the life you want.
            <br />
            <span className="text-indigo-500">See the life you live.</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            PLS Calendar is a private, encrypted weekly planner that compares the week you
            intended to live with the one you actually lived — then helps you close the gap.
            Nothing loads or syncs until you sign in.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onEnter}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition-colors shadow-sm"
            >
              Get started — it's free
            </button>
            <a
              href="#downloads"
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              Download the app
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            No browser data is stored until you log in — read the docs and download freely first.
          </p>
        </section>

        {/* ── Features / Docs ───────────────────────────────────────────── */}
        <section id="features" className="max-w-5xl mx-auto px-5 py-16 border-t border-gray-100 dark:border-gray-800">
          <h2 className="text-2xl sm:text-3xl font-bold text-center">Everything in one private place</h2>
          <p className="mt-3 text-center text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            A planner, a habit tracker, time budgets, and a to-do board — all end-to-end encrypted.
          </p>
          <div className="mt-12 grid sm:grid-cols-2 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6 bg-gray-50/50 dark:bg-gray-900/40">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Downloads ─────────────────────────────────────────────────── */}
        <section id="downloads" className="max-w-5xl mx-auto px-5 py-16 border-t border-gray-100 dark:border-gray-800">
          <h2 className="text-2xl sm:text-3xl font-bold text-center">Download for your device</h2>
          <p className="mt-3 text-center text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Prefer a native app? Install it on your desktop and keep your data off the browser.
            {hasRelease && (
              <span className="block mt-1 text-sm text-gray-400 dark:text-gray-500">
                Latest release: {release.tag_name} · {new Date(release.published_at).toLocaleDateString()}
              </span>
            )}
          </p>

          <div className="mt-12 grid sm:grid-cols-3 gap-5">
            {PLATFORMS.map(p => {
              const url    = !p.comingSoon ? matchAsset(assets, p.patterns)    : null;
              const altUrl = !p.comingSoon ? matchAsset(assets, p.altPatterns) : null;
              const unavailable = !p.comingSoon && hasRelease && !url;
              return (
                <div
                  key={p.name}
                  className={`rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center text-center ${p.comingSoon || unavailable ? 'opacity-60' : ''}`}
                >
                  <span className={p.color}>{p.icon}</span>
                  <p className="mt-3 font-semibold">{p.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                    {unavailable ? 'Not in this release' : p.note}
                  </p>
                  <div className="mt-auto flex flex-col items-center gap-2 w-full">
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        {p.label}
                      </a>
                    )}
                    {altUrl && (
                      <a
                        href={altUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-500 hover:underline"
                      >
                        {p.altLabel}
                      </a>
                    )}
                    {p.comingSoon && (
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Coming soon</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <a href={GITHUB_RELEASES_PAGE} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-500 hover:underline">
              View all releases on GitHub →
            </a>
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              Or skip the install —{' '}
              <button type="button" onClick={onEnter} className="text-indigo-500 hover:underline font-medium">
                use it in your browser
              </button>
              .
            </p>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="border-t border-gray-100 dark:border-gray-800">
          <div className="max-w-5xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400 dark:text-gray-500">© {new Date().getFullYear()} PLS Calendar</p>
            <div className="flex items-center gap-6">
              <a href="#downloads" className={navLink}>Downloads</a>
              <a href={GITHUB_PAGE} target="_blank" rel="noopener noreferrer" className={`${navLink} flex items-center gap-1.5`}>
                <GithubIcon className="w-4 h-4" /> GitHub
              </a>
              <button type="button" onClick={onEnter} className={navLink}>Log in</button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
