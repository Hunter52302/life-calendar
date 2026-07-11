// Shared constants, icons, and small UI atoms for the web-facing landing pages.
// Kept separate so the layout, home, downloads, docs, and legal pages can all
// reuse them without duplication.

export const GITHUB_REPO          = 'Hunter52302/life-calendar';
export const GITHUB_PAGE          = `https://github.com/${GITHUB_REPO}`;
export const GITHUB_API           = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const GITHUB_RELEASES_PAGE = `${GITHUB_PAGE}/releases`;

// Contact / company placeholders — fill these in before going live. They feed
// the templated legal pages and the footer.
export const COMPANY_NAME   = 'PLS Calendar';
export const CONTACT_EMAIL  = 'support@example.com';
export const LEGAL_ENTITY   = '[Your legal entity / name]';
export const GOVERNING_LAW  = '[Your jurisdiction]';

// Mirrors DownloadModal's asset matching so the landing Downloads page surfaces
// the same native builds the in-app modal does.
export const PLATFORMS = [
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
    note: 'macOS 11+ · Apple Silicon / Intel',
    patterns: [/-macos-arm64\.dmg$/i, /aarch64\.dmg$/i, /arm64\.dmg$/i],
    altPatterns: [/-macos-x64\.dmg$/i, /macos-x64\.dmg$/i, /intel\.dmg$/i],
    label: 'Apple Silicon (.dmg)',
    altLabel: 'Intel (.dmg)',
    color: 'text-gray-700 dark:text-gray-200',
    icon: (
      <svg className="w-9 h-9" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
  },
];

export function matchAsset(assets, patterns) {
  if (!patterns) return null;
  for (const pattern of patterns) {
    const found = assets.find(a => pattern.test(a.name));
    if (found) return found.browser_download_url;
  }
  return null;
}
