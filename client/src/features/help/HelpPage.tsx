import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../../api/client";

type AiSearchResponse = {
  data: {
    answer: string;
    source: "ai";
  };
};

async function searchHelpAi(question: string): Promise<AiSearchResponse["data"]> {
  const response = await apiClient.post<AiSearchResponse>("/api/help/search", { q: question });
  return response.data.data;
}

type HelpArticle = {
  question: string;
  answer: string;
};

type HelpSection = {
  id: string;
  title: string;
  articles: HelpArticle[];
};

const helpContent: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    articles: [
      {
        question: "What is SF AI Library?",
        answer:
          "SF AI Library is your personal toolkit for AI. It's a place where you can discover, save, and share prompts, skills, and context documents that make working with AI tools faster and more effective. Think of it as a recipe book for AI—except the recipes are AI assets, and you get to use (and contribute) the best ones.",
      },
      {
        question: "Who is this for?",
        answer:
          "You, if you use AI tools like Slackbot, Claude, Gemini, Cursor, or NotebookLM. Whether you're writing emails, generating code, analyzing data, or brainstorming ideas—if you use AI, this library is for you.",
      },
      {
        question: "How do I sign in?",
        answer:
          'Click "Continue with Google" on the login page using your Salesforce Google account. That\'s it—no separate password needed.',
      },
      {
        question: "What should I do first?",
        answer:
          '1. Complete your profile (you\'ll be prompted when you first sign in)\n2. Browse the homepage to see featured AI assets\n3. Try using a prompt by clicking "Use prompt" on any card\n4. Save AI assets you like by clicking the heart icon',
      },
    ],
  },
  {
    id: "prompts",
    title: "Prompts",
    articles: [
      {
        question: "What is a prompt?",
        answer:
          "A prompt is a set of instructions you give to an AI tool. A good prompt tells the AI exactly what you need, in what format, and with what context. SF AI Library stores prompts that have been tested and proven to work well.",
      },
      {
        question: "How do I find prompts?",
        answer:
          "Use the search bar to find prompts by keyword, topic, or author. Filter by tool (Slackbot, Claude, Gemini, etc.), generated output type (text, code, image), or tag. Sort by most recent, top rated, or most used. Browse featured prompts on the homepage for popular options.",
      },
      {
        question: "How do I use a prompt?",
        answer:
          '1. Click on any prompt card to view its details\n2. If the prompt has variables (shown as [VARIABLE] or {{VARIABLE}}), fill in the fields provided\n3. Click "Use prompt" to open it directly in your chosen AI tool, or click the copy icon to copy it to your clipboard',
      },
      {
        question: "What are variables?",
        answer:
          "Variables are customizable placeholders in a prompt. For example, a prompt might include [COMPANY_NAME] or {{TOPIC}}. When you use the prompt, you fill in these fields with your specific information, and the prompt automatically updates.",
      },
      {
        question: "How do I create a prompt?",
        answer:
          '1. Click "New Prompt" in the top navigation\n2. Give your prompt a title and summary\n3. Write your prompt in the body field\n4. Add variables if needed—click "Insert" to add [KEY] placeholders to your prompt, or type them manually\n5. Select the tools and generated output type it works with\n6. Choose visibility (Public for all users, Team for your OU only, or Private for just you)\n7. Save as Draft or Publish immediately',
      },
      {
        question: "How do I edit or update a prompt?",
        answer:
          'Click "Edit prompt" on any prompt you own. Changes are saved as new versions, so you can always restore a previous version if needed.',
      },
      {
        question: "What do the ratings mean?",
        answer:
          "Users can rate prompts from 1-5 stars based on how helpful they found them. Higher-rated prompts appear more prominently in search results and featured sections.",
      },
      {
        question: "How do I favorite an AI asset?",
        answer:
          "Click the heart icon on any prompt, skill, or context detail page. Favorited AI assets are easier to find later and help us understand what content is most valuable.",
      },
    ],
  },
  {
    id: "skills",
    title: "Skills",
    articles: [
      {
        question: "What is a skill?",
        answer:
          "A skill is a reusable set of instructions that tells an AI tool how to behave for a specific task. Unlike prompts (which are one-time instructions), skills are meant to be loaded into AI tools as ongoing context or capabilities. Think of a skill as giving your AI a specialty.",
      },
      {
        question: "What are some examples of skills?",
        answer:
          '"Code Reviewer" — Instructs the AI to review code for best practices, security issues, and performance\n"Meeting Summarizer" — Tells the AI how to format and structure meeting notes\n"Salesforce Tone" — Guides the AI to write in Salesforce brand voice',
      },
      {
        question: "How do I use a skill?",
        answer:
          "Copy the skill's markdown content and paste it into your AI tool's system prompt, custom instructions, or context window. Many AI tools (like Slackbot, Cursor, and Claude) have dedicated places for this.",
      },
      {
        question: "How do I create a skill?",
        answer:
          '1. Go to Skills in the navigation\n2. Click "Create Skill"\n3. Write your skill instructions in markdown format\n4. Save it—and share it if you\'d like others to benefit',
      },
      {
        question: "How do I edit or update a skill?",
        answer:
          'Click "Edit skill" on any skill you own. You can update the title, description, and content at any time.',
      },
      {
        question: "How do I rate a skill?",
        answer:
          "On any skill detail page or in the skill list, you'll see a star rating control. Click the stars (1-5) to rate how helpful the skill was. Your rating helps others discover the most useful skills.",
      },
      {
        question: "How do I add a skill to a collection?",
        answer:
          "On the skill detail page, click the bookmark icon in the action toolbar. A menu will appear showing your collections—click any collection to add the skill to it, or click again to remove it.",
      },
    ],
  },
  {
    id: "context",
    title: "Context",
    articles: [
      {
        question: "What is context?",
        answer:
          "Context documents are reference materials that help AI tools understand your specific situation, rules, or domain knowledge. These are typically longer documents like style guides, product documentation, company policies, or technical references.",
      },
      {
        question: "When should I use context vs. a skill?",
        answer:
          "Use Context for reference information the AI should know about (facts, rules, documentation). Use Skills for behavioral instructions on how the AI should act.",
      },
      {
        question: "How do I add context?",
        answer:
          '1. Go to Context in the navigation\n2. Click "Add Context"\n3. Paste or write your reference document in markdown\n4. Save it—and share it if it might help others',
      },
      {
        question: "How do I edit or update context?",
        answer:
          'Click "Edit context" on any context document you own. You can update the title, description, and content at any time.',
      },
      {
        question: "How do I rate a context document?",
        answer:
          "On any context detail page or in the context list, you'll see a star rating control. Click the stars (1-5) to rate how helpful the context was. Your rating helps others discover the most useful context documents.",
      },
      {
        question: "How do I add context to a collection?",
        answer:
          "On the context detail page, click the bookmark icon in the action toolbar. A menu will appear showing your collections—click any collection to add the context document to it, or click again to remove it.",
      },
    ],
  },
  {
    id: "collections",
    title: "Collections",
    articles: [
      {
        question: "What are collections?",
        answer:
          "Collections are personal folders for organizing AI assets. Use them to group related prompts, skills, and context by project, use case, or workflow.",
      },
      {
        question: "How do I create a collection?",
        answer:
          '1. Go to Collections in the navigation\n2. Enter a name and optional description\n3. Click "Create Collection"',
      },
      {
        question: "How do I add AI assets to a collection?",
        answer:
          "On any prompt, skill, or context detail page, click the bookmark icon in the action toolbar. A dropdown menu will show your collections—click any collection to add the asset to it. Click again to remove it from that collection.",
      },
      {
        question: "What types of assets can I add to collections?",
        answer:
          "You can add all three asset types to collections: Prompts, Skills, and Context Documents. This lets you organize related assets together regardless of type—for example, grouping a code review prompt with a code review skill and relevant coding standards context.",
      },
    ],
  },
  {
    id: "ai-tools",
    title: "Using AI Tools",
    articles: [
      {
        question: "Which AI tools does SF AI Library support?",
        answer:
          "We support direct launch into:\n• Slackbot (Salesforce's AI assistant in Slack)\n• Claude (Anthropic)\n• Gemini (Google)\n• Cursor (for code-focused work)\n• NotebookLM (Google)",
      },
      {
        question: 'How does "Use prompt" work?',
        answer:
          'When you click "Use prompt," we open a new tab with your chosen AI tool and pre-fill your prompt. For some tools, you may need to paste the prompt manually.',
      },
      {
        question: "Can I use prompts with other tools?",
        answer:
          "Yes. Click the copy icon to copy the prompt to your clipboard, then paste it into any AI tool you prefer.",
      },
    ],
  },
  {
    id: "profile",
    title: "Your Profile",
    articles: [
      {
        question: "How do I update my profile?",
        answer:
          "Click your profile photo in the top-right corner to open profile settings. You can update your display name, region, OU, title, and profile photo.",
      },
      {
        question: "How do I change my profile photo?",
        answer:
          "Click your profile photo in the top-right corner, then click 'Change Photo' to upload a new headshot. Supported formats are JPEG, PNG, GIF, and WebP (max 5MB).",
      },
      {
        question: "What are Region and OU?",
        answer:
          "These help us understand how different parts of the organization use the library. Select the region and operating unit that matches your role.",
      },
    ],
  },
  {
    id: "my-content",
    title: "Your Content & Analytics",
    articles: [
      {
        question: "Where can I see the prompts, skills, and context I've created?",
        answer:
          'Go to Settings and click "My Content" to see all the prompts, skills, and context documents you\'ve created. From there you can view, edit, or manage any of your assets.',
      },
      {
        question: "How do I edit or update something I created?",
        answer:
          'There are two ways:\n1. Go to Settings > My Content to see all your created assets, then click "Edit" on any item\n2. Navigate directly to the prompt, skill, or context detail page and click the "Edit" button (only visible if you\'re the owner)',
      },
      {
        question: "Where can I see analytics for my created content?",
        answer:
          'Go to Settings and click "My Analytics" to see performance metrics for all your created assets. You\'ll see a sortable table with view counts, usage statistics, ratings, and favorites for each prompt, skill, or context document you\'ve published.',
      },
      {
        question: "What metrics are tracked for my content?",
        answer:
          "For each asset you create, we track:\n• Views: How many people have viewed your content\n• Uses: How many times someone has copied or launched your asset\n• Ratings: The number of ratings and average star rating from users\n• Favorites: How many people have saved your content to their favorites",
      },
      {
        question: "Can I export my analytics data?",
        answer:
          'Yes! In the My Analytics view, click the "Export CSV" button to download a spreadsheet with all your analytics data. You can customize which columns to include using the "Columns" dropdown before exporting.',
      },
      {
        question: "Can I see who is using my content?",
        answer:
          "For privacy reasons, you can see aggregate metrics (total views, uses, ratings) but not the specific users who viewed or used your content.",
      },
    ],
  },
  {
    id: "tips",
    title: "Tips & Best Practices",
    articles: [
      {
        question: "How do I write effective prompts?",
        answer:
          "• Be specific about what you want\n• Include context the AI needs to know\n• Specify the format you want (bullet points, paragraph, code, etc.)\n• Use variables for anything that changes between uses\n• Test your prompt before publishing",
      },
      {
        question: "How can I get more from AI tools?",
        answer:
          "• Load relevant skills into your AI's system instructions\n• Provide context documents for domain-specific work\n• Iterate on prompts—small changes can make big differences\n• Share what works so others can benefit too",
      },
      {
        question: "How can I contribute to the library?",
        answer:
          "• Publish prompts that have worked well for you\n• Rate prompts you use so others know what's valuable\n• Create skills for tasks you do frequently\n• Add context documents that help AI understand your domain",
      },
    ],
  },
];

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      className={`${className} transition-transform ${expanded ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

type HelpArticleItemProps = {
  article: HelpArticle;
  searchQuery: string;
  defaultExpanded?: boolean;
};

function HelpArticleItem({ article, searchQuery, defaultExpanded = false }: HelpArticleItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-(--color-border) last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-inset"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="font-medium">{highlightMatch(article.question, searchQuery)}</span>
        <ChevronIcon className="h-5 w-5 shrink-0 text-(--color-text-muted)" expanded={expanded} />
      </button>
      {expanded ? (
        <div className="px-4 pb-4 text-sm text-(--color-text-muted) whitespace-pre-line">
          {highlightMatch(article.answer, searchQuery)}
        </div>
      ) : null}
    </div>
  );
}

type HelpSectionCardProps = {
  section: HelpSection;
  searchQuery: string;
  expandAll?: boolean;
};

function HelpSectionCard({ section, searchQuery, expandAll = false }: HelpSectionCardProps) {
  return (
    <section id={section.id} className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
      <h2 className="border-b border-(--color-border) bg-(--color-surface-muted) px-4 py-3 text-lg font-semibold">
        {section.title}
      </h2>
      <div>
        {section.articles.map((article, index) => (
          <HelpArticleItem
            key={index}
            article={article}
            searchQuery={searchQuery}
            defaultExpanded={expandAll}
          />
        ))}
      </div>
    </section>
  );
}

type AiAnswerCardProps = {
  answer: string;
  onClear: () => void;
};

function AiAnswerCard({ answer, onClear }: AiAnswerCardProps) {
  return (
    <div className="rounded-xl border-2 border-(--color-primary)/30 bg-linear-to-br from-(--color-primary)/5 to-transparent p-5">
      <div className="mb-3 flex items-center gap-2">
        <SparklesIcon className="h-5 w-5 text-(--color-primary)" />
        <span className="text-sm font-semibold text-(--color-primary)">AI Answer</span>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none text-(--color-text) whitespace-pre-line">
        {answer}
      </div>
      <div className="mt-4 flex items-center gap-4 border-t border-(--color-border) pt-3">
        <span className="text-xs text-(--color-text-muted)">
          This answer was generated by AI based on our help documentation.
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-(--color-primary) hover:underline"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");

  const aiSearchMutation = useMutation({
    mutationFn: searchHelpAi,
  });

  const handleAiSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (aiQuestion.trim()) {
      aiSearchMutation.mutate(aiQuestion.trim());
    }
  };

  const clearAiAnswer = () => {
    aiSearchMutation.reset();
    setAiQuestion("");
  };

  const filteredContent = useMemo(() => {
    if (!searchQuery.trim()) return helpContent;
    const query = searchQuery.toLowerCase();
    return helpContent
      .map((section) => ({
        ...section,
        articles: section.articles.filter(
          (article) =>
            article.question.toLowerCase().includes(query) || article.answer.toLowerCase().includes(query),
        ),
      }))
      .filter((section) => section.articles.length > 0);
  }, [searchQuery]);

  const hasResults = filteredContent.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Help</h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Everything you need to know about using SF AI Library.
          </p>
        </div>
        <a
          href="https://salesforce.enterprise.slack.com/archives/C0ATAP14WEQ"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
          </svg>
          <span>Get help in #help-ailibrary</span>
        </a>
      </div>

      <div className="rounded-xl border border-(--color-primary)/30 bg-linear-to-r from-(--color-primary)/5 via-transparent to-(--color-primary)/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-(--color-primary)" />
          <span className="font-semibold">Ask AI</span>
          <span className="rounded-full bg-(--color-primary)/10 px-2 py-0.5 text-xs font-medium text-(--color-primary)">
            Beta
          </span>
        </div>
        <p className="mb-3 text-sm text-(--color-text-muted)">
          Have a question? Ask in your own words and get an instant answer.
        </p>
        <form onSubmit={handleAiSearch} className="flex gap-2">
          <input
            type="text"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            placeholder="How do I create a prompt with variables?"
            disabled={aiSearchMutation.isPending}
            className="flex-1 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2.5 focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!aiQuestion.trim() || aiSearchMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-(--color-primary) px-4 py-2.5 font-medium text-white hover:bg-(--color-primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiSearchMutation.isPending ? (
              <>
                <LoadingSpinner className="h-4 w-4" />
                <span>Thinking...</span>
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4" />
                <span>Ask</span>
              </>
            )}
          </button>
        </form>
        {aiSearchMutation.isError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {aiSearchMutation.error instanceof Error
              ? aiSearchMutation.error.message
              : "Something went wrong. Please try again or browse the topics below."}
          </p>
        ) : null}
      </div>

      {aiSearchMutation.isSuccess && aiSearchMutation.data ? (
        <AiAnswerCard answer={aiSearchMutation.data.answer} onClear={clearAiAnswer} />
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="lg:sticky lg:top-8 lg:w-56 shrink-0">
          <nav className="rounded-xl border border-(--color-border) bg-(--color-surface) p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">Topics</p>
            <ul className="space-y-1">
              {helpContent.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block rounded-lg px-3 py-1.5 text-sm hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="flex-1 space-y-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-(--color-text-muted)" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter help articles..."
              className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) py-3 pl-10 pr-4 focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
            />
          </div>

          {hasResults ? (
            filteredContent.map((section) => (
              <HelpSectionCard
                key={section.id}
                section={section}
                searchQuery={searchQuery}
                expandAll={searchQuery.trim().length > 0}
              />
            ))
          ) : (
            <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-8 text-center">
              <p className="text-(--color-text-muted)">
                No results found for "{searchQuery}". Try a different search term or ask AI above.
              </p>
              <button
                type="button"
                className="mt-3 text-sm text-(--color-primary) hover:underline"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
