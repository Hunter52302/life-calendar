import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PLATFORMS, matchAsset, GITHUB_API, GITHUB_RELEASES_PAGE } from './shared.jsx';

/**
 * DownloadsPage — /downloads. Pulls the latest GitHub release and surfaces the
 * native installers (mirrors the in-app DownloadModal). Falls back gracefully
 * when no release is published yet.
 */
export default function DownloadsPage() {
  const { onEnter } = useOutletContext();
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

  const loading    = release === null;
  const hasRelease = release && release !== false;

  return (
    <section className="max-w-5xl mx-auto px-5 pt-16 pb-20">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold">Download for your device</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Prefer a native app? Install it on your desktop and keep your data off the browser.
        </p>
        {loading && (
          <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">Checking for the latest release…</p>
        )}
        {hasRelease && (
          <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">
            Latest release: {release.tag_name} · {new Date(release.published_at).toLocaleDateString()}
          </p>
        )}
        {release === false && !loading && (
          <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">
            No releases are published yet — desktop builds appear here once a version is tagged on GitHub.
          </p>
        )}
      </div>

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
                  <a href={altUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline">
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

      <div className="mt-12 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 p-6 sm:p-8 text-center">
        <h2 className="text-lg font-semibold">Mobile &amp; PWA</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
          On a phone or tablet? Open the app in your browser and choose “Add to Home Screen” to install
          it as a Progressive Web App — offline support and notifications included.
        </p>
        <button
          type="button"
          onClick={onEnter}
          className="mt-5 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
        >
          Open the web app
        </button>
      </div>

      <div className="mt-10 text-center">
        <a href={GITHUB_RELEASES_PAGE} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-500 hover:underline">
          View all releases on GitHub →
        </a>
      </div>
    </section>
  );
}
