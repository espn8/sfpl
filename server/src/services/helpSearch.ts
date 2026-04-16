import { env } from "../config/env";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const HELP_CONTENT = `
# SF AI Library Help Documentation

## Getting Started

### What is SF AI Library?
SF AI Library is your personal toolkit for AI. It's a place where you can discover, save, and share prompts, skills, and context documents that make working with AI tools faster and more effective. Think of it as a recipe book for AI—except the recipes are AI assets, and you get to use (and contribute) the best ones.

### Who is this for?
You, if you use AI tools like Slackbot, Claude, Gemini, Cursor, or NotebookLM. Whether you're writing emails, generating code, analyzing data, or brainstorming ideas—if you use AI, this library is for you.

### How do I sign in?
Click "Continue with Google" on the login page using your Salesforce Google account. That's it—no separate password needed.

### What should I do first?
1. Complete your profile (you'll be prompted when you first sign in)
2. Browse the homepage to see featured AI assets
3. Try using a prompt by clicking "Use prompt" on any card
4. Save AI assets you like by clicking the heart icon

## Prompts

### What is a prompt?
A prompt is a set of instructions you give to an AI tool. A good prompt tells the AI exactly what you need, in what format, and with what context. SF AI Library stores prompts that have been tested and proven to work well.

### How do I find prompts?
Use the search bar to find prompts by keyword, topic, or author. Filter by tool (Slackbot, Claude, Gemini, etc.), generated output type (text, code, image), or tag. Sort by most recent, top rated, or most used. Browse featured prompts on the homepage for popular options.

### How do I use a prompt?
1. Click on any prompt card to view its details
2. If the prompt has variables (shown as [VARIABLE] or {{VARIABLE}}), fill in the fields provided
3. Click "Use prompt" to open it directly in your chosen AI tool, or click the copy icon to copy it to your clipboard

### What are variables?
Variables are customizable placeholders in a prompt. For example, a prompt might include [COMPANY_NAME] or {{TOPIC}}. When you use the prompt, you fill in these fields with your specific information, and the prompt automatically updates.

### How do I create a prompt?
1. Click "New Prompt" in the top navigation
2. Give your prompt a title and summary
3. Write your prompt in the body field (use [KEY] or {{KEY}} for any variables)
4. Add variables if needed (define the key, label, and default value)
5. Select the tools and generated output type it works with
6. Choose visibility (Public for everyone, Private for just you)
7. Save as Draft or Publish immediately

### How do I edit or update a prompt?
Click "Edit prompt" on any prompt you own. Changes are saved as new versions, so you can always restore a previous version if needed.

### What do the ratings mean?
Users can rate prompts from 1-5 stars based on how helpful they found them. Higher-rated prompts appear more prominently in search results and featured sections.

### How do I favorite an AI asset?
Click the heart icon on any prompt, skill, or context detail page. Favorited AI assets are easier to find later and help us understand what content is most valuable.

## Skills

### What is a skill?
A skill is a reusable set of instructions that tells an AI tool how to behave for a specific task. Unlike prompts (which are one-time instructions), skills are meant to be loaded into AI tools as ongoing context or capabilities. Think of a skill as giving your AI a specialty.

### Examples of skills:
- "Code Reviewer" — Instructs the AI to review code for best practices, security issues, and performance
- "Meeting Summarizer" — Tells the AI how to format and structure meeting notes
- "Salesforce Tone" — Guides the AI to write in Salesforce brand voice

### How do I use a skill?
Copy the skill's markdown content and paste it into your AI tool's system prompt, custom instructions, or context window. Many AI tools (like Slackbot, Cursor, and Claude) have dedicated places for this.

### How do I create a skill?
1. Go to Skills in the navigation
2. Click "Create Skill"
3. Write your skill instructions in markdown format
4. Save it—and share it if you'd like others to benefit

## Context

### What is context?
Context documents are reference materials that help AI tools understand your specific situation, rules, or domain knowledge. These are typically longer documents like style guides, product documentation, company policies, or technical references.

### When should I use context vs. a skill?
Use Context for reference information the AI should know about (facts, rules, documentation). Use Skills for behavioral instructions on how the AI should act.

### How do I add context?
1. Go to Context in the navigation
2. Click "Add Context"
3. Paste or write your reference document in markdown
4. Save it—and share it if it might help others

## Collections

### What are collections?
Collections are personal folders for organizing AI assets. Use them to group related prompts, skills, and context by project, use case, or workflow.

### How do I create a collection?
1. Go to Collections in the navigation
2. Enter a name and optional description
3. Click "Create Collection"

### How do I add AI assets to a collection?
On any prompt, skill, or context detail page, click the folder icon and select the collection you want to add it to.

## Using AI Tools

### Which AI tools does SF AI Library support?
We support direct launch into:
- Slackbot (Salesforce's AI assistant in Slack)
- Claude (Anthropic)
- Gemini (Google)
- Cursor (for code-focused work)
- NotebookLM (Google)

### How does "Use prompt" work?
When you click "Use prompt," we open a new tab with your chosen AI tool and pre-fill your prompt. For some tools, you may need to paste the prompt manually.

### Can I use prompts with other tools?
Yes. Click the copy icon to copy the prompt to your clipboard, then paste it into any AI tool you prefer.

## Your Profile

### How do I update my profile?
Click your avatar in the top-right corner to open profile settings. You can update your display name, region, OU, and title.

### Where does my avatar come from?
Your avatar is pulled from your Google profile photo. To change it, update your Google account photo.

### What are Region and OU?
These help us understand how different parts of the organization use the library. Select the region and operating unit that matches your role.

## Tips & Best Practices

### Writing effective prompts:
- Be specific about what you want
- Include context the AI needs to know
- Specify the format you want (bullet points, paragraph, code, etc.)
- Use variables for anything that changes between uses
- Test your prompt before publishing

### Getting more from AI tools:
- Load relevant skills into your AI's system instructions
- Provide context documents for domain-specific work
- Iterate on prompts—small changes can make big differences
- Share what works so others can benefit too

### Contributing to the library:
- Publish prompts that have worked well for you
- Rate prompts you use so others know what's valuable
- Create skills for tasks you do frequently
- Add context documents that help AI understand your domain
`;

function buildHelpSearchPrompt(question: string): string {
  return `You are a helpful assistant for SF AI Library, an internal Salesforce tool for sharing AI prompts, skills, and context documents.

Answer the user's question based ONLY on the help documentation provided below. Be concise, friendly, and direct. If the question cannot be answered from the documentation, say so and suggest they contact support.

Format your response in a clear, readable way. Use bullet points or numbered lists when appropriate. Keep your answer focused and practical.

---
HELP DOCUMENTATION:
${HELP_CONTENT}
---

USER QUESTION: ${question}

ANSWER:`;
}

export type HelpSearchResult = {
  answer: string;
  source: "ai";
};

export async function searchHelp(question: string): Promise<HelpSearchResult> {
  const apiKey = env.nanoBananaApiKey;
  if (!apiKey) {
    throw new Error("AI search is not configured. Please use the regular search.");
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: buildHelpSearchPrompt(question),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI search failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  const answer = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!answer) {
    throw new Error("AI search did not return an answer.");
  }

  return {
    answer: answer.trim(),
    source: "ai",
  };
}
