import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { GITHUB_PAGE, COMPANY_NAME } from './shared.jsx';
import { GithubIcon, CalendarMark } from './icons.jsx';

/**
 * LandingLayout — the chrome shared by every web-facing landing route: a sticky
 * top nav and a footer with product + legal links. The routed page renders in
 * the <Outlet/>. `onEnter` (handed control over to <App/>) is passed down to
 * pages via the outlet context so the in-page "log in / use in browser"
 * buttons can trigger it.
 */

const navLinkBase = 'text-sm font-medium transition-colors';
function topNavClass({ isActive }) {
  return `${navLinkBase} ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`;
}

const footerLink = 'text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors';

// Scroll back to the top whenever the route changes (SPA nav doesn't do this).
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function LandingLayout({ onEnter }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 pl-safe pr-safe">
      <ScrollToTop />

      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 backdrop-blur bg-white/80 dark:bg-gray-950/80 border-b border-gray-100 dark:border-gray-800">
        <nav className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center shadow">
              <CalendarMark />
            </span>
            <span className="text-base">{COMPANY_NAME}</span>
          </Link>

          <div className="hidden sm:flex items-center gap-6">
            <NavLink to="/" end className={topNavClass}>Home</NavLink>
            <NavLink to="/downloads" className={topNavClass}>Downloads</NavLink>
            <NavLink to="/docs" className={topNavClass}>Docs</NavLink>
            <a href={GITHUB_PAGE} target="_blank" rel="noopener noreferrer" className={`${navLinkBase} text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5`}>
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

      {/* ── Routed page ─────────────────────────────────────────────────── */}
      <main className="flex-1">
        <Outlet context={{ onEnter }} />
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 dark:border-gray-800 mt-8">
        <div className="max-w-5xl mx-auto px-5 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 font-bold">
              <span className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center shadow">
                <CalendarMark />
              </span>
              <span>{COMPANY_NAME}</span>
            </div>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              A private, encrypted weekly planner. Plan the life you want; see the life you live.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Product</h3>
            <ul className="space-y-2">
              <li><Link to="/" className={footerLink}>Home</Link></li>
              <li><Link to="/downloads" className={footerLink}>Downloads</Link></li>
              <li><Link to="/docs" className={footerLink}>Documentation</Link></li>
              <li>
                <a href={GITHUB_PAGE} target="_blank" rel="noopener noreferrer" className={footerLink}>GitHub</a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Legal</h3>
            <ul className="space-y-2">
              <li><Link to="/privacy" className={footerLink}>Privacy Policy</Link></li>
              <li><Link to="/terms" className={footerLink}>Terms of Service</Link></li>
              <li><Link to="/cookies" className={footerLink}>Cookie Policy</Link></li>
              <li><Link to="/license" className={footerLink}>License &amp; Open Source</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Get started</h3>
            <ul className="space-y-2">
              <li><button type="button" onClick={onEnter} className={footerLink}>Log in</button></li>
              <li><button type="button" onClick={onEnter} className={footerLink}>Create account</button></li>
              <li><Link to="/downloads" className={footerLink}>Install the app</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800">
          <div className="max-w-5xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Zero-knowledge encrypted · your data stays yours.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
