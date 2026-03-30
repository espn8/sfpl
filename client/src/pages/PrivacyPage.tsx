export function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-6 text-3xl font-bold">Privacy Policy</h1>
        
        <section className="space-y-4 text-sm leading-relaxed">
          <p className="text-slate-600">Last Updated: March 30, 2026</p>
          
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">1. Information We Collect</h2>
            <p>
              When you use the Prompt Library, we collect the following information:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Google account information (email, name, profile picture)</li>
              <li>Prompts and content you create or share</li>
              <li>Usage analytics (page views, interactions, feature usage)</li>
              <li>Session and authentication data</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">2. How We Use Your Information</h2>
            <p>
              We use the collected information to:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Authenticate and authorize access to the Service</li>
              <li>Provide and improve the Service functionality</li>
              <li>Analyze usage patterns and optimize user experience</li>
              <li>Enable team collaboration features</li>
              <li>Communicate important Service updates</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">3. Data Storage and Security</h2>
            <p>
              Your data is stored securely in our database hosted on Heroku. We implement industry-standard security measures including:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Encrypted data transmission (HTTPS)</li>
              <li>Secure session management with HttpOnly cookies</li>
              <li>Google OAuth 2.0 authentication</li>
              <li>Regular security updates and monitoring</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">4. Data Sharing</h2>
            <p>
              We do not sell or share your personal information with third parties except:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Within your team workspace as part of normal Service functionality</li>
              <li>With Google for authentication purposes</li>
              <li>With Google Analytics for aggregate usage metrics (no PII)</li>
              <li>When required by law or legal process</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">5. Analytics</h2>
            <p>
              We use Google Analytics 4 to collect anonymized usage data. This helps us understand how users interact with the Service and improve functionality. You can opt out of Google Analytics tracking through browser extensions or settings.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">6. Your Rights</h2>
            <p>
              You have the right to:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Export your prompts and content</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">7. Cookies</h2>
            <p>
              We use session cookies to maintain your authenticated session. These cookies are essential for the Service to function and are automatically deleted when you log out or your session expires.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">8. Changes to Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of any material changes by updating the "Last Updated" date at the top of this policy.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">9. Contact</h2>
            <p>
              If you have questions about this Privacy Policy or your data, please contact your team administrator.
            </p>
          </div>

          <div className="mt-8 space-y-2">
            <a href="/terms" className="text-blue-600 hover:underline">
              View Terms of Service
            </a>
            <br />
            <a href="/login" className="text-blue-600 hover:underline">
              Return to Login
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
