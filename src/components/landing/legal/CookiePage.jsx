import LegalPage, { LegalSection } from './LegalPage.jsx';
import { COMPANY_NAME, CONTACT_EMAIL } from '../shared.jsx';

export default function CookiePage() {
  return (
    <LegalPage title="Cookie & Local Storage Policy">
      <p>
        This page explains how {COMPANY_NAME} uses cookies and similar local-storage technologies.
      </p>

      <LegalSection heading="1. What we use">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Essential storage:</strong> we use browser <code>localStorage</code> and <code>sessionStorage</code> to keep you signed in, remember your settings (theme, preferences), and cache encrypted data for offline use.</li>
          <li><strong>Service worker cache:</strong> the Progressive Web App caches assets so it works offline.</li>
          <li><strong>Analytics/marketing cookies:</strong> [None currently / Describe any analytics such as ... and how to opt out].</li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. Why these are used">
        <p>The essential storage above is required for the Service to function — without it you could not stay logged in or keep your preferences. These are not used to track you across other sites.</p>
      </LegalSection>

      <LegalSection heading="3. Managing storage">
        <p>You can clear cookies and local storage at any time through your browser settings. Doing so will sign you out and remove cached data on that device.</p>
      </LegalSection>

      <LegalSection heading="4. Consent">
        <p>[If you operate in a region requiring cookie consent (e.g. the EU/UK), describe your consent mechanism here.]</p>
      </LegalSection>

      <LegalSection heading="5. Contact">
        <p>Questions? Email <a className="text-indigo-500 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
