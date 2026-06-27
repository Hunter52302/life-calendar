import LegalPage, { LegalSection } from './LegalPage.jsx';
import { COMPANY_NAME, GITHUB_PAGE } from '../shared.jsx';

export default function LicensePage() {
  return (
    <LegalPage title="License & Open Source">
      <p>
        {COMPANY_NAME}’s source is available on{' '}
        <a className="text-indigo-500 hover:underline" href={GITHUB_PAGE} target="_blank" rel="noopener noreferrer">GitHub</a>.
        This page summarizes licensing for the project and its dependencies.
      </p>

      <LegalSection heading="1. Project license">
        <p>{COMPANY_NAME} is distributed under the [LICENSE NAME, e.g. MIT] license. See the <code>LICENSE</code> file in the repository for the full text and terms.</p>
      </LegalSection>

      <LegalSection heading="2. Third-party software">
        <p>This product includes open-source software developed by third parties. Notable dependencies include [React, Vite, Tailwind CSS, Tauri, Capacitor, …], each under its own license. Attributions and license texts are available in the repository and the distributed packages.</p>
      </LegalSection>

      <LegalSection heading="3. Trademarks">
        <p>“{COMPANY_NAME}” and associated logos are [trademarks of the project owner / describe trademark status]. The open-source license does not grant rights to use these marks.</p>
      </LegalSection>

      <LegalSection heading="4. Contributions">
        <p>Contributions are welcome via GitHub. By contributing, you agree your contributions are licensed under the project license. See the repository’s contributing guidelines for details.</p>
      </LegalSection>
    </LegalPage>
  );
}
