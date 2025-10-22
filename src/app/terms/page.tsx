export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <h1 className="text-4xl font-bold">Terms of Service</h1>
      <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Acceptance of Terms</h2>
        <p>
          By accessing and using Facebook Bulk Messenger, you agree to be bound by 
          these Terms of Service and all applicable laws and regulations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Service Description</h2>
        <p>
          Facebook Bulk Messenger is a tool that allows you to send messages to your 
          Facebook page followers, manage conversations, and track engagement metrics.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Acceptable Use</h2>
        <p>You agree to:</p>
        <ul className="list-disc ml-6 space-y-2">
          <li>Use the service only for legitimate business communication</li>
          <li>Comply with Facebook&apos;s Platform Policies and Terms of Service</li>
          <li>Not send spam or unsolicited messages</li>
          <li>Respect the 24-hour messaging window policy</li>
          <li>Use message tags appropriately (if enabled)</li>
          <li>Not harass, abuse, or harm others</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Prohibited Uses</h2>
        <p>You may NOT use this service to:</p>
        <ul className="list-disc ml-6 space-y-2">
          <li>Send promotional spam</li>
          <li>Share adult or illegal content</li>
          <li>Harass or threaten individuals</li>
          <li>Violate Facebook&apos;s policies</li>
          <li>Abuse message tags for promotional content</li>
          <li>Attempt to circumvent platform restrictions</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Account Termination</h2>
        <p>
          We reserve the right to suspend or terminate your account if you violate 
          these terms or Facebook&apos;s policies. Violations may also result in your 
          Facebook pages being restricted by Facebook.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Limitation of Liability</h2>
        <p>
          We provide this service &quot;as is&quot; without warranties. We are not responsible 
          for Facebook API changes, downtime, or delivery failures beyond our control.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Contact</h2>
        <p>
          Questions about these terms? Contact us at:{' '}
          <a href="mailto:support@your-app.com" className="text-blue-600 hover:underline">
            support@your-app.com
          </a>
        </p>
      </section>
    </div>
  );
}

