export function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-6 text-3xl font-bold">Terms of Service</h1>
        
        <section className="space-y-4 text-sm leading-relaxed">
          <p className="text-slate-600">Last Updated: March 30, 2026</p>
          
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p>
              By accessing and using the Prompt Library application ("Service"), you accept and agree to be bound by the terms and provision of this agreement.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">2. Use License</h2>
            <p>
              Permission is granted to access and use this Service for internal business purposes only. This license shall automatically terminate if you violate any of these restrictions.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">3. User Accounts</h2>
            <p>
              You must authenticate via Google Single Sign-On to access this Service. You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">4. Content</h2>
            <p>
              Users retain ownership of prompts and content they create. By submitting content to the Service, you grant the team permission to use, display, and share that content within the team workspace.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">5. Prohibited Uses</h2>
            <p>
              You may not use the Service to store or share content that is illegal, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">6. Limitation of Liability</h2>
            <p>
              The Service is provided "as is" without warranty of any kind. We shall not be liable for any damages arising from the use or inability to use the Service.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">7. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the Service following any changes constitutes acceptance of those changes.
            </p>
          </div>

          <div className="mt-8 space-y-2">
            <a href="/privacy" className="link hover:underline">
              View Privacy Policy
            </a>
            <br />
            <a href="/login" className="link hover:underline">
              Return to Login
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
