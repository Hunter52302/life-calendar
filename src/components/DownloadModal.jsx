import { useState } from 'react';

const GITHUB_RELEASES = 'https://github.com/your-username/life-calendar/releases/latest';

const PLATFORMS = [
  {
    name: 'Windows',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
      </svg>
    ),
    file: 'PLS-Calendar_x64-setup.exe',
    label: 'Windows Installer (.exe)',
    note: 'Windows 10/11 64-bit',
    color: 'text-blue-500',
  },
  {
    name: 'Linux',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10S2 17.514 2 12 6.486 2 12 2zm-1 5v6l5 3-.75 1.23L10 14V7h1z" />
      </svg>
    ),
    file: 'pls-calendar_amd64.deb',
    label: 'Linux Package (.deb)',
    note: 'Ubuntu / Debian 64-bit',
    altFile: 'pls-calendar_amd64.AppImage',
    altLabel: 'AppImage (universal)',
    color: 'text-orange-500',
  },
  {
    name: 'macOS',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
    file: 'PLS-Calendar_aarch64.dmg',
    label: 'macOS App (.dmg)',
    note: 'Apple Silicon (M1/M2/M3)',
    altFile: 'PLS-Calendar_x64.dmg',
    altLabel: 'Intel Mac (.dmg)',
    color: 'text-gray-500',
  },
];

export default function DownloadModal({ onClose }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(GITHUB_RELEASES).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Download PLS Calendar</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Native desktop app for Windows, Linux, and macOS</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Platform cards */}
        <div className="p-6 space-y-3">
          {PLATFORMS.map(p => (
            <div key={p.name} className="rounded-xl border border-gray-100 dark:border-gray-800 p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className={p.color}>{p.icon}</span>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{p.note}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`${GITHUB_RELEASES}/download/${p.file}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:opacity-90 transition-opacity"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {p.label}
                </a>
                {p.altFile && (
                  <a
                    href={`${GITHUB_RELEASES}/download/${p.altFile}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {p.altLabel}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>macOS:</strong> Right-click → Open the first time to bypass Gatekeeper (app is unsigned).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={GITHUB_RELEASES}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-sm text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
            >
              View all releases on GitHub →
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
