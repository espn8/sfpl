import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Slack Prompts seed...");

  // Use the production team (salesforce.com) - fall back to demo-team for local dev
  let team = await prisma.team.findUnique({ where: { slug: "salesforce-com" } });
  if (!team) {
    team = await prisma.team.upsert({
      where: { slug: "demo-team" },
      create: {
        name: "Demo Team",
        slug: "demo-team",
      },
      update: {},
    });
  }
  console.log(`Using team: ${team.name} (${team.slug})`);

  const authors = [
    { email: "jesse.chase@salesforce.com", name: "Jesse Chase" },
    { email: "stewart.anderson@salesforce.com", name: "Stewart Anderson" },
    { email: "jessica.finkbeiner@salesforce.com", name: "Jessica Finkbeiner" },
    { email: "rachel.cowgill@salesforce.com", name: "Rachel Cowgill" },
  ];

  const usersByEmail = new Map<string, Awaited<ReturnType<typeof prisma.user.upsert>>>();
  for (const author of authors) {
    const user = await prisma.user.upsert({
      where: { email: author.email },
      create: {
        email: author.email,
        name: author.name,
        role: "MEMBER",
        teamId: team.id,
      },
      update: {
        name: author.name,
        teamId: team.id,
      },
    });
    usersByEmail.set(author.email, user);
    console.log(`Upserted user: ${user.name} (${user.email})`);
  }

  const jesseChase = usersByEmail.get("jesse.chase@salesforce.com")!;
  const stewartAnderson = usersByEmail.get("stewart.anderson@salesforce.com")!;
  const jessicaFinkbeiner = usersByEmail.get("jessica.finkbeiner@salesforce.com")!;
  const rachelCowgill = usersByEmail.get("rachel.cowgill@salesforce.com")!;

  type PromptSeed = {
    title: string;
    summary: string;
    body: string;
    ownerId: number;
  };

  const promptSeeds: PromptSeed[] = [
    {
      title: "AI Tool Advisor",
      summary: "Helps you quickly find the right AI tools for any workflow or job to be done.",
      body: `## Target Audience
SEs

## What It Does
Helps you quickly find the right AI tools for any workflow or job to be done. Get tool recommendations, add-on access info, and enablement resources organized by priority.

## Example Usage
Ask: "I'm an SE doing Demo Build. Which AI tool should I use?"

## Contributors
@Luigi Frascarelli @Theresa Hall`,
      ownerId: jesseChase.id,
    },

    {
      title: "Discovery Helper",
      summary: "Helps SEs understand what to position for a customer by pulling org62 opportunity/account data and Slack context.",
      body: `## Target Audience
SEs

## What It Does
Helps SEs understand what to position for a customer by pulling org62 opportunity/account data and Slack context, identifying pain points, and recommending Salesforce products and features. Delivers a conversational summary with an optional canvas output.

## Example Usage
Ask: "Tell me all you can about customer xyz"`,
      ownerId: jesseChase.id,
    },

    {
      title: "Demo Org Recommender",
      summary: "Not sure which org to use for your demo? This queries Q Branch data and gives you an opinionated, ranked recommendation.",
      body: `## Target Audience
SEs

## What It Does
Not sure which org to use for your demo? This queries Q Branch data and gives you an opinionated, ranked recommendation with links and context.

## Example Usage
Ask: "I'm building a demo org and need Slack and Data Cloud. Which Demo Orgs do you recommend?"`,
      ownerId: jesseChase.id,
    },

    {
      title: "Q Brix Recommender",
      summary: "Stop guessing what to install. Tell this what product, feature, or industry you're demoing and it finds the right Q Brix.",
      body: `## Target Audience
SEs

## What It Does
Stop guessing what to install. Tell this what product, feature, or industry you're demoing — and it queries the Q Labs Demo Store to surface exactly what to install, in what order, and why. It checks your org first so it never recommends something you already have, then splits the results into must-haves and nice-to-haves with opinionated guidance on each one. Q Brix are deployable assets built and vetted by the Solutions CoE — this finds the right ones for your scenario fast.

## Example Usage
Ask: "Find me Brix for Agentforce in Financial Services" or "What should I install to showcase Service Agents on my org storm.6269dbe2d00053@salesforce.com"`,
      ownerId: jesseChase.id,
    },

    {
      title: "My Demo Org Assistant",
      summary: "Understand your Q Labs demo org in plain English — what template it's on, what Q Brix are installed, what's ready to demo, and what to do next.",
      body: `## Target Audience
SEs

## What It Does
Understand your Q Labs demo org in plain English — what template it's on, what Q Brix are installed, what's ready to demo, and what to do next.

## Example Usage
Ask: "Tell me about my org with username storm.6269dbe2d00053@salesforce.com"

## Contributors
@Jessica (Louttit) Finkbeiner @Duncan McIntyre @Steve Ecker @Theresa Hall @Poole @Todd Sears`,
      ownerId: jesseChase.id,
    },

    {
      title: "What's New in the Demo Store",
      summary: "Stop browsing the Demo Store manually to find out what's new. Get a conversational changelog of every Q Brix added in the last 60 days.",
      body: `## Target Audience
SEs

## What It Does
Stop browsing the Demo Store manually to find out what's new. This queries Q Labs directly and gives you a conversational changelog of every Q Brix added in the last 60 days — grouped by product, with descriptions, compatibility details, license requirements, and direct links.

## Example Usage
Ask: "What's new in the Demo Store?"`,
      ownerId: jesseChase.id,
    },

    {
      title: "Solutions CoE Roadmap Advisor",
      summary: "Ask roadmap questions and get answers on what was recently delivered, what's in progress, and what's coming next.",
      body: `## Target Audience
SEs, Executives

## What It Does
Ask roadmap questions and get answers on what was recently delivered, what's in progress, and what's coming next — filtered to SE-relevant work.

## Example Usage
Ask: "What demo features have been released for Service Cloud and what is coming?"

## Contributors
@Rachel Nadel @Theresa Hall @Steve Ecker @Todd Sears @Jessica Martins @Duncan McIntyre @Avinash K @Tyler Rollings`,
      ownerId: jesseChase.id,
    },

    {
      title: "Demo Script Generator",
      summary: "Stop showing up to demos with a generic flow. Get a narrative-first demo script tailored to your actual installed Q Brix and products.",
      body: `## Target Audience
SEs

## What It Does
Stop showing up to demos with a generic flow. Give it your org username, target audience, industry, and how long you have — and this builds a narrative-first demo script tailored to your actual installed Q Brix and products. It reads your real demo guides, pulls deal context from org62 if you have an opportunity, and produces a ready-to-use canvas with scene-by-scene talking points, objection handles, and a close.

## Example Usage
Ask: "Generate a demo script for my org" or "Build me a 30-min demo flow for a VP of Service in Retail"`,
      ownerId: jesseChase.id,
    },

    {
      title: "Salesforce Error Detective",
      summary: "Takes your error message, explains it in plain English, and searches Slack to find how others fixed the same issue.",
      body: `## Target Audience
Solutions CoE Brix Builders & SEs

## What It Does
Takes your error message, explains it in plain English (no cryptic platform-speak), and goes one step further — it searches Slack to see if anyone else has already hit the same issue and, more importantly, how they fixed it. You get: a clear explanation, likely root cause, who else has seen it, and what actually worked.

## Example Usage
Ask: "I am getting the following error when running trialforce: You may try again or contact Support with this tracking ID: 1291298284-1072029 (868437323)"`,
      ownerId: stewartAnderson.id,
    },

    {
      title: "Q Brix Error Detective",
      summary: "Provides quick, friendly help diagnosing Salesforce and QBrix errors by summarizing root cause and checking Brix health.",
      body: `## Target Audience
Solutions CoE Brix Builders & SEs

## What It Does
Provides quick, friendly help diagnosing Salesforce and QBrix errors by summarizing the root cause, identifying the product area, and checking Brix health, ownership, and recent issues. It searches Slack for similar problems, highlights known fixes, surfaces affected users, and gives clear next steps and a "safe to use" recommendation.

## Example Usage
Ask: "I am getting the following error when deploying a brix: Exception: Unable to detect expected element button.slds-button:has-text('Deploy') as it was not visible or enabled. This can be for a number of reasons, anything from the page not loading correctly to missing features or licences. Try checking the page in the salesforce org first and if everything looks OK, then try the deployment again. Page URL: /lightning/o/DataStream/list?filterName=__Recent Current states: ['detached']"`,
      ownerId: stewartAnderson.id,
    },

    {
      title: "SE Peer Finder",
      summary: "Stop guessing who to call when you need demo help on a specific product. Find the top experts with direct links to reach out.",
      body: `## Target Audience
SEs

## What It Does
Stop guessing who to call when you need demo help on a specific product. This searches Slack profiles, org62 opportunity data, and Slack message activity to surface the top 3 people — designated specialists and hands-on practitioners — who know that product best, with a plain-English explanation of why each one made the list and a direct link to reach out.

## Example Usage
Ask: "Find me a Service Cloud expert" or "Who can help me with my Agentforce + FSC demo?"`,
      ownerId: jesseChase.id,
    },

    {
      title: "New Feature Intake Guide",
      summary: "Guides PMs and SEs through new demo feature/product intake. Gathers required docs, licensing, setup steps, and identifies the right Solutions CoE contact.",
      body: `## Target Audience
PMs

## What It Does
Guides PMs and SEs through new demo feature/product intake. Gathers required docs, licensing, setup steps, and identifies the right Solutions CoE contact.

## Example Usage
Ask: "I am a PM over Agentforce. We are releasing a new feature and I want to get it into the SDO. How do I do that?"

## Contributors
@Rachel Nadel @Duncan McIntyre`,
      ownerId: jesseChase.id,
    },

    {
      title: "Who's Brix is it anyway?",
      summary: "Ever wondered who actually owns a Brix, what it does, and whether it's causing any problems? Get ownership info and issue analysis.",
      body: `## Target Audience
Solutions CoE Brix Builders

## What It Does
Ever wondered who actually owns a Brix… what it does… and whether it's causing any problems? This pulls info from qlabs, checks recent deployments, and searches Slack to see if anything suspicious (or broken) is going on — even if it's just related platform issues. You will receive a plain-English explanation of what Brix does and who owns it, along with an analysis of its recent trends and known issues. This summary concludes with actionable workarounds and a clear recommendation on whether it is safe to use.`,
      ownerId: stewartAnderson.id,
    },

    {
      title: "CoE Demo Org Metrics",
      summary: "Stop guessing how the demo fleet is performing. Get an executive-grade dashboard with data and context in one shot.",
      body: `## Target Audience
CoE Leadership, PMs, Demo Managers

## What It Does
Stop guessing how the demo fleet is performing. This runs live against Q Labs to surface an executive-grade dashboard — total org spins, top templates by volume, industry vs. agnostic org trends, and Q Brix install momentum — all compared against the same window last month so the numbers are actually fair. It then searches Slack to explain the why behind every trend: is an org down because of a known issue? Is something surging because of a release? You get data and context in one shot, with action items flagged where needed.

## Example Usage
Ask: "Give me the CoE org metrics dashboard" or "What's trending in demo org usage this month?"`,
      ownerId: jesseChase.id,
    },

    {
      title: "CoE Duplicate Buster",
      summary: "Stop guessing if your team is reinventing the wheel. This acts as a Silo-Buster that scans every project board, sprint, and Slack request in Q Labs.",
      body: `## Target Audience
Product Owner, Developers, Engineers, Support, Qlabs Users

## What It Does
Stop guessing if your team is reinventing the wheel. This acts as a "Silo-Buster" that instantly scans every project board, sprint, and Slack request in Q Labs to ensure a new task isn't already being tackled elsewhere. It identifies engineering synergy to help our teams focus on the highest value items and save themselves from unintended duplicative work.

## Example Usage
Ask: "I'm about to start building a new Agentforce Service connector—has anyone done this?"`,
      ownerId: jessicaFinkbeiner.id,
    },

    {
      title: "Q Project Tasks Viewer",
      summary: "Shows active Q Project tasks for one or more team members in QLabs, grouped by person with parent project, status, priority, and due date.",
      body: `## Target Audience
Solutions CoE Team Members

## What It Does
Shows active Q Project tasks for one or more team members in QLabs, grouped by person with parent project, status, priority, and due date. Flags overdue items and summarizes workload.

## Example Usage
Ask: "Tell me what [person] is working on"

## Contributors
@Jory Dean`,
      ownerId: rachelCowgill.id,
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const seed of promptSeeds) {
    const existing = await prisma.prompt.findFirst({
      where: { teamId: team.id, title: seed.title },
    });

    if (existing) {
      console.log(`Prompt already exists: ${seed.title} (skipping)`);
      skipped++;
      continue;
    }

    const prompt = await prisma.prompt.create({
      data: {
        teamId: team.id,
        ownerId: seed.ownerId,
        title: seed.title,
        summary: seed.summary,
        body: seed.body,
        visibility: "PUBLIC",
        status: "PUBLISHED",
        tools: ["slackbot"],
        modality: "TEXT",
        versions: {
          create: {
            version: 1,
            body: seed.body,
            createdById: seed.ownerId,
            changelog: "Initial version",
          },
        },
      },
    });
    console.log(`Created prompt: ${prompt.title}`);
    created++;
  }

  console.log(`\nSlack Prompts seed completed!`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Total prompts in seed: ${promptSeeds.length}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
