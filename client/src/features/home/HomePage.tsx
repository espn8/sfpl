export function HomePage() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-2xl space-y-4 text-center">
        <h1 className="text-3xl font-semibold">The AI Library is closed.</h1>
        <p>Please check out:</p>
        <ul className="space-y-2">
          <li>
            <a
              href="https://salesforce.enterprise.slack.com/archives/C0ATDUN340M"
              target="_blank"
              rel="noreferrer"
              className="text-(--color-primary) underline"
            >
              #slackbot-skills
            </a>
          </li>
          <li>
            <a
              href="https://qlabs-org.my.site.com/aisellerhub/"
              target="_blank"
              rel="noreferrer"
              className="text-(--color-primary) underline"
            >
              AI Hub for Solutions
            </a>
          </li>
          <li>
            <a
              href="https://github.com/forcedotcom/afv-library"
              target="_blank"
              rel="noreferrer"
              className="text-(--color-primary) underline"
            >
              Agentforce Vibes Skills Library
            </a>
          </li>
        </ul>
        <div className="pt-4 text-sm">
          <a href="/terms" className="text-(--color-primary) underline">
            Terms of Service
          </a>
          <span className="px-2 text-(--color-text-muted)">|</span>
          <a href="/privacy" className="text-(--color-primary) underline">
            Privacy Policy
          </a>
        </div>
      </div>
    </main>
  );
}
