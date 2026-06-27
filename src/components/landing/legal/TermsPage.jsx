import LegalPage, { LegalSection } from './LegalPage.jsx';
import { COMPANY_NAME, CONTACT_EMAIL, LEGAL_ENTITY, GOVERNING_LAW } from '../shared.jsx';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These Terms of Service (“Terms”) govern your use of the {COMPANY_NAME} website and
        applications (the “Service”) provided by {LEGAL_ENTITY}. By using the Service you agree to
        these Terms.
      </p>

      <LegalSection heading="1. Eligibility & accounts">
        <p>You must be at least [13/16/18] years old to use the Service. You are responsible for your account credentials and for all activity under your account. Keep your password and recovery code secure.</p>
      </LegalSection>

      <LegalSection heading="2. Acceptable use">
        <p>You agree not to misuse the Service, including by [attempting to breach security, disrupting the Service, infringing others’ rights, or using it for unlawful purposes].</p>
      </LegalSection>

      <LegalSection heading="3. Your content">
        <p>You retain all rights to the content you create. Because content is end-to-end encrypted, you are solely responsible for it and for safeguarding the means to decrypt it. We cannot recover content if you lose your password and recovery code.</p>
      </LegalSection>

      <LegalSection heading="4. Service availability">
        <p>The Service is provided on an “as is” and “as available” basis. We may modify, suspend, or discontinue features at any time. [Describe any uptime commitments or that none are made.]</p>
      </LegalSection>

      <LegalSection heading="5. Fees">
        <p>[The Service is currently free / Describe paid plans, billing, and refunds here.]</p>
      </LegalSection>

      <LegalSection heading="6. Third-party services">
        <p>The Service may integrate with third-party providers (e.g. Google, Outlook). Your use of those services is subject to their terms, and we are not responsible for them.</p>
      </LegalSection>

      <LegalSection heading="7. Disclaimers & limitation of liability">
        <p>To the fullest extent permitted by law, {COMPANY_NAME} disclaims all warranties and is not liable for indirect, incidental, or consequential damages, or for loss of data arising from your use of the Service.</p>
      </LegalSection>

      <LegalSection heading="8. Termination">
        <p>You may stop using the Service and delete your account at any time. We may suspend or terminate access for violations of these Terms.</p>
      </LegalSection>

      <LegalSection heading="9. Governing law & changes">
        <p>These Terms are governed by the laws of {GOVERNING_LAW}. We may update these Terms and will post the revised version here. Continued use constitutes acceptance.</p>
      </LegalSection>

      <LegalSection heading="10. Contact">
        <p>Questions about these Terms? Email <a className="text-indigo-500 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
