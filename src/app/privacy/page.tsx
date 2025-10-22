export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <h1 className="text-4xl font-bold">Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Information We Collect</h2>
        <p>
          When you connect your Facebook account, we collect:
        </p>
        <ul className="list-disc ml-6 space-y-2">
          <li>Your Facebook user ID and name</li>
          <li>Your Facebook page information (name, ID, follower count)</li>
          <li>Page access tokens (stored securely)</li>
          <li>Conversations from your Facebook pages</li>
          <li>Messages you create and send through our platform</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">How We Use Your Information</h2>
        <p>We use the collected information to:</p>
        <ul className="list-disc ml-6 space-y-2">
          <li>Authenticate you and maintain your session</li>
          <li>Connect and manage your Facebook pages</li>
          <li>Send messages to your page followers on your behalf</li>
          <li>Display conversation history and analytics</li>
          <li>Improve our service</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Data Security</h2>
        <p>
          We take data security seriously:
        </p>
        <ul className="list-disc ml-6 space-y-2">
          <li>All data is stored securely using Supabase (PostgreSQL)</li>
          <li>Access tokens are stored server-side with httpOnly cookies</li>
          <li>All connections use HTTPS encryption</li>
          <li>We never share your data with third parties</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Your Rights</h2>
        <p>You have the right to:</p>
        <ul className="list-disc ml-6 space-y-2">
          <li>Access your data at any time</li>
          <li>Delete your account and all associated data</li>
          <li>Revoke Facebook access permissions</li>
          <li>Export your data</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Facebook Policies</h2>
        <p>
          Our app complies with Facebook&apos;s Platform Policies and Terms of Service. 
          We only send messages to users who have messaged your page first, and we 
          respect Facebook&apos;s 24-hour messaging window policies.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Contact Us</h2>
        <p>
          If you have questions about this privacy policy or our data practices, 
          please contact us at: <a href="mailto:support@your-app.com" className="text-blue-600 hover:underline">support@your-app.com</a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Changes to This Policy</h2>
        <p>
          We may update this privacy policy from time to time. We will notify you of 
          any changes by posting the new policy on this page and updating the 
          &quot;Last updated&quot; date.
        </p>
      </section>
    </div>
  );
}

