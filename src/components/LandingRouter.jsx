import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingLayout from './landing/LandingLayout.jsx';
import HomePage from './landing/HomePage.jsx';
import DownloadsPage from './landing/DownloadsPage.jsx';
import DocsPage from './landing/DocsPage.jsx';
import PrivacyPage from './landing/legal/PrivacyPage.jsx';
import TermsPage from './landing/legal/TermsPage.jsx';
import CookiePage from './landing/legal/CookiePage.jsx';
import LicensePage from './landing/legal/LicensePage.jsx';
import NotFoundPage from './landing/NotFoundPage.jsx';

/**
 * LandingRouter — the web-facing "front door". Owns the client-side routes for
 * the marketing/docs/legal pages (real shareable URLs like /downloads and
 * /docs). The PWA service worker's navigateFallback serves index.html for these
 * paths, so deep links resolve client-side once cached.
 *
 * `onEnter` hands control to <App/> (login). It's threaded through the layout
 * and exposed to pages via the router outlet context.
 */
export default function LandingRouter({ onEnter, theme = 'dark' }) {
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <BrowserRouter>
        <Routes>
          <Route element={<LandingLayout onEnter={onEnter} />}>
            <Route index element={<HomePage />} />
            <Route path="downloads" element={<DownloadsPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="cookies" element={<CookiePage />} />
            <Route path="license" element={<LicensePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}
