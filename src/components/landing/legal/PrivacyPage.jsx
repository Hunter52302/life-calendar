import LegalPage, { LegalSection } from './LegalPage.jsx';
import { COMPANY_NAME, CONTACT_EMAIL, LEGAL_ENTITY, GOVERNING_LAW } from '../shared.jsx';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This Privacy Policy explains how {LEGAL_ENTITY} (“{COMPANY_NAME}”, “we”, “us”) handles
        information when you use the {COMPANY_NAME} website and applications (the “Service”).
      </p>

      <LegalSection heading="1. Our zero-knowledge model">
        <p>
          {COMPANY_NAME} is designed so that your calendar, tasks, habits, budgets, and related
          content are encrypted on your device before being sent to us. We store only encrypted
          data and cannot read its contents. As a result, we are unable to recover your content if
          you lose both your password and your recovery code.
        </p>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account data:</strong> the email address you register with and authentication verifiers (never your plaintext password).</li>
          <li><strong>Encrypted content:</strong> ciphertext blobs we cannot decrypt.</li>
          <li><strong>Technical data:</strong> [e.g. IP address, device/browser type, timestamps] used for security and reliability.</li>
          <li><strong>Optional integrations:</strong> tokens you provide to connect third-party calendars (e.g. Google, Outlook).</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. How we use information">
        <p>We use the information above to [provide and maintain the Service, authenticate you, prevent abuse, and communicate important notices]. We do not sell your personal information.</p>
      </LegalSection>

      <LegalSection heading="4. Sharing & third parties">
        <p>We may share limited data with service providers who help us operate the Service (e.g. [hosting, email delivery]). [List sub-processors here.] We may disclose information if required by law.</p>
      </LegalSection>

      <LegalSection heading="5. Data retention">
        <p>We retain account and encrypted data for as long as your account is active, and delete it [within X days] of account deletion, subject to legal requirements.</p>
      </LegalSection>

      <LegalSection heading="6. Your rights">
        <p>Depending on your location, you may have rights to access, correct, export, or delete your personal data (e.g. under GDPR/CCPA). To exercise these rights, contact us at <a className="text-indigo-500 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>

      <LegalSection heading="7. Children's privacy">
        <p>The Service is not directed to children under [13/16], and we do not knowingly collect their data.</p>
      </LegalSection>

      <LegalSection heading="8. International transfers & governing law">
        <p>Your information may be processed in [country/region]. This policy is governed by the laws of {GOVERNING_LAW}.</p>
      </LegalSection>

      <LegalSection heading="9. Changes & contact">
        <p>We may update this policy from time to time and will post the revised version here. Questions? Email <a className="text-indigo-500 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
