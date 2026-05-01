# AI Library - Technical Summary

Last Updated: Friday, May 1, 2026 — 12:06 CDT
Build Version: `7ac7503`
App Version: see production footer after deploy (root `package.json` 1.3.5 in repo; Heroku `version-bump.js` on postbuild)
Production URL: https://ail.mysalesforcedemo.com (canonical live site — never use the `*.herokuapp.com` hostname when referring to the live site)

## Recent Changes

### Session: Catalog free-text search — token AND matching (May 1, 2026 — 12:06 CDT)

- **Problem:** Multi-word queries used a single **`ILIKE`** / Prisma **`contains`** on the full string (e.g. **`%keep my job%`**). Stored titles with **irregular whitespace** (double spaces, etc.) no longer contained that exact substring, so exact-looking titles returned **no hits** even when every word was present.
- **Server —** [server/src/lib/assetSearch.ts](server/src/lib/assetSearch.ts): **`splitSearchTokens`**, **`promptFreeTextWhere`**, **`skillFreeTextWhere`**, **`contextFreeTextWhere`**, **`catalogBuildFreeTextWhere`** — for multiple tokens, **each** token must match **title / summary / body** (plus owner name; skills also **skillUrl** / **skillUrlNormalized**; builds title/summary/owner only) via per-token **`OR`**, and tokens are **`AND`**ed. Single-token queries keep the prior flat **`OR`** shape.
- **Routes —** Unified catalog and list/search endpoints now call these helpers: [server/src/routes/assets.ts](server/src/routes/assets.ts), [server/src/routes/prompts.ts](server/src/routes/prompts.ts), [server/src/routes/skills.ts](server/src/routes/skills.ts), [server/src/routes/context.ts](server/src/routes/context.ts), [server/src/routes/builds.ts](server/src/routes/builds.ts), [server/src/routes/search.ts](server/src/routes/search.ts) (suggestions). Skills list route now aligns with unified search by including URL fields in free-text match.
- **Tests —** [server/test/asset-search.test.ts](server/test/asset-search.test.ts): multi-token **`AND`** shape and **`splitSearchTokens`** whitespace collapse.
- **Prisma:** none. **Deploy:** **`git push origin main`**, **`git push heroku main`** (no migration → no production Postgres backup required). **Verify:** https://ail.mysalesforcedemo.com — multi-word title search (e.g. **keep my job**) finds assets despite spacing in stored titles.

### Session: Unified catalog search — per-type fetch cap, relevance order, skill URL match (April 30, 2026 — 11:26 CDT)

- **Problem:** Text search on **`GET /api/assets`** used **`take: pageSize * 3`** per asset type, then merged types, globally sorted, and **`slice`** paginated. **`count()`** reflected the full DB, so matches beyond that window never entered the merged list — exact title queries (e.g. **“keep my job”**) could disappear when many rows shared the same substring (e.g. in bodies). Suggestions did not search prompt/context **body**; skills did not search **install URL** fields.
- **Server —** [server/src/routes/assets.ts](server/src/routes/assets.ts): When **`q`** is non-empty, **`perTypeListTake = min(2500, max(pageSize * 3, page * pageSize))`** so deeper pages and merge windows include real hits (capped for safety). When **`q`** is set, post-merge sort adds a **relevance** tier (exact title → title prefix → title substring → summary) before the existing sort (**recent** / **mostUsed** / **name** / **updatedAt** / **topRated**). Skill search **`OR`** adds **`skillUrl`** and **`skillUrlNormalized`**. [server/src/routes/search.ts](server/src/routes/search.ts): Suggestions use per-type **`OR`** — prompts and context include **body**; skills include **URL** fields (no **`body`** on **`Skill`**).
- **Tests —** [server/test/assets-list.test.ts](server/test/assets-list.test.ts): asserts scaled **`take`** with **`q`** and **`page`**, and unchanged **`pageSize * 3`** without **`q`**.
- **Help —** [client/src/features/help/HelpPage.tsx](client/src/features/help/HelpPage.tsx), [server/src/services/helpSearch.ts](server/src/services/helpSearch.ts): Smart Search copy notes skill install URL matching and catalog title-first ranking when searching.
- **Prisma:** none. **Deploy:** **`git push origin main`**, **`git push heroku main`** (no migration → no production DB backup required for this push). **Verify:** https://ail.mysalesforcedemo.com — search for a known exact title across pages; skills findable by URL substring in suggestions and catalog.

### Session: Global leaderboards, publishedAt, home leaderboards API, Top Assets This Week (April 30, 2026 — 10:20 CDT)

- **Prisma** — [server/prisma/schema.prisma](server/prisma/schema.prisma): optional **`publishedAt`** on **`Prompt`**, **`Skill`**, **`ContextDocument`**, **`Build`** (first transition to **PUBLISHED**); composite indexes **`(status, publishedAt)`**. Junctions **`CollectionPrompt`**, **`CollectionSkill`**, **`CollectionContext`**, **`CollectionBuild`**: **`createdAt`**, **`addedById`** → **`User`**. **Migration:** [20260430140000_global_leaderboards_published_at_collections](server/prisma/migrations/20260430140000_global_leaderboards_published_at_collections/migration.sql) — backfill **`publishedAt`** from **`createdAt`** for existing **PUBLISHED** rows; backfill **`addedById`** from **`Collection.createdById`**. **Production:** capture **`heroku pg:backups:capture -a aosfail`** immediately before **`git push heroku main`** (release runs **`prisma migrate deploy`**).
- **Write paths** — [server/src/lib/firstPublishedAt.ts](server/src/lib/firstPublishedAt.ts); publish transitions in [prompts.ts](server/src/routes/prompts.ts), [skills.ts](server/src/routes/skills.ts), [context.ts](server/src/routes/context.ts), [builds.ts](server/src/routes/builds.ts); [governanceOps.ts](server/src/services/governanceOps.ts) unarchive first-publish. Collection **`addedById`** in [collections.ts](server/src/routes/collections.ts), skill/context/build routes; [systemCollections.ts](server/src/services/systemCollections.ts) uses collection creator; [seed.ts](server/prisma/seed.ts); [collections-membership.test.ts](server/test/collections-membership.test.ts).
- **Services** — [rollingSevenDays.ts](server/src/lib/rollingSevenDays.ts); [weekViewUseScores.ts](server/src/services/weekViewUseScores.ts) (**`getGlobalWeekViewUseScores`**); [globalContributorsThisWeek.ts](server/src/services/globalContributorsThisWeek.ts); [globalMostActiveThisWeek.ts](server/src/services/globalMostActiveThisWeek.ts); [mostUsedThisWeekAssetList.ts](server/src/services/mostUsedThisWeekAssetList.ts); [weekTopAssets.ts](server/src/services/weekTopAssets.ts) (team week keys = view+use only).
- **API** — **`GET /api/home/leaderboards`** ([home.ts](server/src/routes/home.ts), mounted in [app.ts](server/src/app.ts)): **`requireAuth`** + **`requireOnboardingComplete`**; returns **`{ contributors, mostActive }`** (global rolling 7 days). **`GET /api/assets?sort=mostUsedThisWeek`** ([assets.ts](server/src/routes/assets.ts)) — **PUBLIC** + **PUBLISHED** week view+use ranking; restricted query shape (no search/facet filters). **`GET /api/analytics/overview`** ([analytics.ts](server/src/routes/analytics.ts)) — still **ADMIN/OWNER**; **Top Contributors** and **`userEngagementLeaderboard`** reuse the same global services (**`userEngagementLeaderboard`** shape = **`MostActiveRow`**: breakdown fields + **`score`**).
- **Client** — [client/src/features/home/api.ts](client/src/features/home/api.ts) **`fetchHomeLeaderboards`**; [HomePage.tsx](client/src/features/home/HomePage.tsx): leaderboards for all signed-in users, **`Link`** to **`/users/:id`**, **`sort: mostUsedThisWeek`** for top grid; [useHomePerfMarks.ts](client/src/features/home/useHomePerfMarks.ts). [assets/api.ts](client/src/features/assets/api.ts) sort union. [AnalyticsPage.tsx](client/src/features/analytics/AnalyticsPage.tsx) + [analytics/api.ts](client/src/features/analytics/api.ts) aligned types. [HomePage.test.tsx](client/src/features/home/HomePage.test.tsx).
- **Help** — [adminHelpContent.ts](client/src/features/admin/adminHelpContent.ts), [HelpPage.tsx](client/src/features/help/HelpPage.tsx), [helpSearch.ts](server/src/services/helpSearch.ts).
- **Deploy:** **`git push origin main`**, **`heroku pg:backups:capture -a aosfail`** (before Heroku push when migration ships), **`git push heroku main`**. **Verify:** https://ail.mysalesforcedemo.com — home leaderboards (non-admin), profile links, Top Assets This Week, Admin → Insights.

### Session: Smart Search — plain title queries skip Gemini; preserve q on submit (April 30, 2026 — 09:55 CDT)

- **Problem:** Plain searches such as an asset title (**“keep my job”**) returned nothing because **Gemini** parse could invent filters or empty **`searchTerms`**, and the client omitted **`q`** when **`searchTerms`** was empty—breaking substring matches on titles.
- **Server** — [server/src/services/searchParser.ts](server/src/services/searchParser.ts): After **`tryLocalParse`**, call **Gemini** only when **`queryLooksLikeGeminiFacetedParse`** (regex hints for tools, prompt/skill/context/build, modalities). Otherwise return **`searchTerms`** as the full trimmed query (no model round-trip).
- **Client** — [client/src/features/search/hooks/useSearchState.ts](client/src/features/search/hooks/useSearchState.ts): **`applyParsedQuery`** sets **`q`** to **`searchTerms`**, or if there are **no** structured filters and terms are empty, **falls back to the original input**. [client/src/features/home/HomePage.tsx](client/src/features/home/HomePage.tsx): home search submit builds **`q`** the same way for **`/search`** navigation.
- **Tests** — [server/test/search-parser-gemini-skip.test.ts](server/test/search-parser-gemini-skip.test.ts): with API key mocked present, **“keep my job”** does not **`fetch`** Gemini and preserves full **`searchTerms`**.
- **Help** — [client/src/features/help/HelpPage.tsx](client/src/features/help/HelpPage.tsx), [server/src/services/helpSearch.ts](server/src/services/helpSearch.ts): Smart Search copy documents literal keyword/title search vs facet-hint natural language.
- **Prisma:** none. **Deploy:** **`git push origin main`**, **`git push heroku main`**. **Backup:** not required (no migration). **Verify:** https://ail.mysalesforcedemo.com — search for a known prompt title and a facet query (e.g. **cursor prompts for code review**).

### Session: Search NL local parse — “code review” vs modality, Gemini empty terms (April 30, 2026 — 15:05 CDT)

- **Problem:** Queries such as **“cursor prompts for code review”** could be misparsed: the word after **`for`** was treated as a modality cue, and **`code`** before **`review`** could be taken as a **code** output modality. **Gemini** could return an empty **`searchTerms`** string, losing the user’s text.
- **Server** — [server/src/services/searchParser.ts](server/src/services/searchParser.ts): In **`tryLocalParse`**, treat **“code review”** as a task phrase (do not map **`code`** to a modality in that case). **Modality heuristics** no longer use **`prevWord === "for"`** (keeps **generate** / **create** / next-token cues only). In **`parseSearchQuery`**, when the model path yields empty trimmed terms, **fall back to the full original query** for **`searchTerms`**.
- **Tests** — [server/test/search-parser.test.ts](server/test/search-parser.test.ts): regression for **cursor** + **code review** style input.
- **Prisma:** none. **Deploy:** **`git push origin main`**, **`git push heroku main`**. **Verify:** https://ail.mysalesforcedemo.com — Smart Search with natural-language queries like the home help example.

### Session: Production deploy — Heroku Postgres backup b002 (April 30, 2026 — 14:52 CDT)

- **Heroku Postgres:** Logical backup **`b002`** captured with **`heroku pg:backups:capture -a aosfail`** immediately before **`git push heroku main`** so production **`prisma migrate deploy`** (release phase; modality on **`Skill`** / **`ContextDocument`** / **`Build`**) has a restore point.
- **Deploy:** **`git push origin main`**, **`git push heroku main`**. **Verify:** https://ail.mysalesforcedemo.com

### Session: Modality on skills/context/builds, OG link previews, list thumbnails, unified “Most Used” analytics (April 30, 2026 — 08:45 CDT)

- **Prisma** — [server/prisma/schema.prisma](server/prisma/schema.prisma): **`PromptModality`** column **`modality`** on **`Skill`**, **`ContextDocument`**, and **`Build`** (default **`TEXT`**). **Migration:** [20260430120000_add_modality_skill_context_build](server/prisma/migrations/20260430120000_add_modality_skill_context_build/migration.sql) (single migration; a duplicate sibling folder was removed before ship). **Production:** capture Postgres backup immediately before deploy, then release applies **`prisma migrate deploy`**.
- **API** — [server/src/routes/skills.ts](server/src/routes/skills.ts), [context.ts](server/src/routes/context.ts), [builds.ts](server/src/routes/builds.ts): create/update/list/detail carry **`modality`** (Zod + serialization) aligned with prompts. **List thumbnails:** list handlers no longer select raw **`thumbnailUrl`** from the DB; responses use **`thumbnailRefFor`** (`/api/thumbnails/...`) like [server/src/routes/assets.ts](server/src/routes/assets.ts) — avoids huge **`data:`** payloads and fixes landing-list image behavior. [server/src/routes/prompts.ts](server/src/routes/prompts.ts): prompt list uses **`thumbnailRefFor`** and omits DB **`thumbnailUrl`** from the list select.
- **Unified assets** — [server/src/routes/assets.ts](server/src/routes/assets.ts), [client/src/features/assets/api.ts](client/src/features/assets/api.ts): **`UnifiedAsset.modality`** for all asset types; search/detail consumers updated ([SearchResultsPage.tsx](client/src/features/search/SearchResultsPage.tsx), list/detail/editor pages, tests).
- **Analytics** — [server/src/routes/analytics.ts](server/src/routes/analytics.ts): **`GET /api/analytics/overview`** returns **`topUsedAssets`** (merged top ten: prompts by COPY+LAUNCH, skills/context/builds by COPY) with **`assetType`** for correct admin links. **Client** — [client/src/features/analytics/api.ts](client/src/features/analytics/api.ts), [AnalyticsPage.tsx](client/src/features/analytics/AnalyticsPage.tsx). **Breaking for any external consumer:** replaces **`topUsedPrompts`**.
- **Home** — [client/src/features/home/HomePage.tsx](client/src/features/home/HomePage.tsx): Top Performers no longer drops prompts whose **`thumbnailStatus`** is **`FAILED`** (cards still render placeholder/regenerate UI). [HomePage.test.tsx](client/src/features/home/HomePage.test.tsx): mock uses **`topUsedAssets`**.
- **Open Graph** — [server/src/lib/publicAssetOgHtml.ts](server/src/lib/publicAssetOgHtml.ts): for **published + PUBLIC** prompts/skills/context/builds, **`GET`** document paths inject title/description/OG image into the Vite **`index.html`** shell so crawlers see rich previews ([server/src/app.ts](server/src/app.ts)).
- **MCP** — [mcp-server/src/client.ts](mcp-server/src/client.ts), [mcp-server/src/index.ts](mcp-server/src/index.ts): **`tools`** and **`modality`** required on **`add_prompt`**, **`add_skill`**, and **`add_context`**; **`add_build`** unchanged (no tool/modality in schema).
- **REST v1** — [server/src/routes/v1/index.ts](server/src/routes/v1/index.ts): create body for prompts, skills, and context requires explicit **`tools`** (enum, min 1) and **`modality`**; no implicit defaults to `cursor`/`text`.
- **Help** — [client/src/features/help/HelpPage.tsx](client/src/features/help/HelpPage.tsx), [server/src/services/helpSearch.ts](server/src/services/helpSearch.ts) (Ask AI), [client/src/features/admin/adminHelpContent.ts](client/src/features/admin/adminHelpContent.ts) (Analytics dashboard copy: Most Used merge, Top Rated prompts-only note, contributor/engagement labels).
- **Deploy:** `heroku pg:backups:capture -a aosfail` immediately before **`git push heroku main`** (and **`git push origin main`**). **Verify:** https://ail.mysalesforcedemo.com — create/edit skill, context, build with modality; list thumbnails; Admin → Insights; public OG fetch for a public asset URL.

### Session: Analytics overview rolling 7-day leaderboards; “This Week” UI and help (April 28, 2026 — 14:56 CDT)

- **Behavior:** **`GET /api/analytics/overview`** now drives **rolling 7-day** (not calendar-week) **Top Contributors** and **User Engagement / Most Active** metrics, still **workspace-catalog-only** via **`teamCatalogWhere`** (`{ teamId: auth.teamId }`).
- **Server** — [server/src/routes/analytics.ts](server/src/routes/analytics.ts): **`rollingSevenDaysAgo`**; engagement **`groupBy`** filters add **`createdAt`** (usage, favorites) or **`updatedAt`** (ratings, for upserts) ≥ window; contributor **`groupBy`** uses **`publishedAssetThisWeekWhere`** — **`PUBLISHED`** assets whose **`createdAt`** falls in the window (counts new catalog rows, not a separate **`publishedAt`**).
- **Client** — [client/src/features/home/HomePage.tsx](client/src/features/home/HomePage.tsx): titles **Top Contributors This Week** / **Most Active This Week**, subtitles for the 7-day definitions, empty-state copy; **Most Active** row remains **Score N** only (from prior change).
- **Admin analytics** — [client/src/features/analytics/AnalyticsPage.tsx](client/src/features/analytics/AnalyticsPage.tsx): matching section titles and empty messages.
- **Admin help** — [client/src/features/admin/adminHelpContent.ts](client/src/features/admin/adminHelpContent.ts): **User Engagement** answer documents both leaderboards and rolling-7-day rules.
- **Prisma:** none. **Deploy:** **`git push heroku main`** (and **`git push origin main`**). **Verify:** https://ail.mysalesforcedemo.com — home (admin) leaderboard cards and **Analytics** admin sections vs expectations.

### Session: User Engagement leaderboard scoped to workspace assets; home score UI (April 28, 2026 — 13:48 CDT)

- **Problem:** **User Engagement** on **`GET /api/analytics/overview`** aggregated favorites and ratings (and related per-user usage splits) by **`user.teamId`** only, so activity on assets **outside** the current workspace still inflated scores—misaligned with **Top Contributors** (published assets in the workspace).
- **Server** — [server/src/routes/analytics.ts](server/src/routes/analytics.ts): Introduces **`teamCatalogWhere`** (`{ teamId: auth.teamId }`). Extends **`usageEvent`**, **`skillUsageEvent`**, **`contextUsageEvent`**, **`buildUsageEvent`** user **`groupBy`** filters so the related asset (**`prompt`**, **`skill`**, **`context`**, **`build`**) must belong to the workspace; same for **`favorite`** / **`skillFavorite`** / **`contextFavorite`** / **`buildFavorite`** and all **`rating`** / **`skillRating`** / **`contextRating`** / **`buildRating`** user aggregates.
- **Client** — [client/src/features/home/HomePage.tsx](client/src/features/home/HomePage.tsx): User Engagement row shows **Score N** only (removes inline breakdown of uses / favorites / ratings counts).
- **Admin help** — [client/src/features/admin/adminHelpContent.ts](client/src/features/admin/adminHelpContent.ts): **User Engagement** answer clarifies metrics are **only for assets in the current workspace**, aligned with Top Contributors.
- **Prisma:** none. **Tests:** `npm --prefix server test` (124). **Deploy:** **`git push heroku main:master`**. **Verify:** https://ail.mysalesforcedemo.com — Analytics → User Engagement vs Top Contributors.

### Session: Department/OU profile taxonomy, Other, admin custom values, legacy ` - Sales` migration (April 28, 2026 — 13:16 CDT)

- **Problem:** Profile “OU” was a geographic list; product needs **Department/OU** (14 canonical departments), an **Other** free-text path, **Region** unchanged and explicitly **not** tied to TEAM visibility, legacy geographic `User.ou` values migrated with **` - Sales`** for TEAM string continuity, and an **admin** view of non-canonical `ou` strings in use.
- **Constants** — [client/src/constants/ous.ts](client/src/constants/ous.ts): **`OU_OPTIONS`** (14 plain department names), **`LEGACY_GEO_OU_VALUES`** (frozen pre-change geographic strings), **`isCanonicalDepartmentOu`**, **`DEPARTMENT_OU_OTHER_SENTINEL`**, **`departmentOuSubmitValue`**. Mirror: [server/src/constants/departmentOuOptions.ts](server/src/constants/departmentOuOptions.ts) (**`CANONICAL_DEPARTMENT_OU_VALUES`**, **`LEGACY_GEO_OU_VALUES`**, **`isCanonicalDepartmentOu`**) — **must stay in sync** with client.
- **Profile UI** — [client/src/components/DepartmentOuFields.tsx](client/src/components/DepartmentOuFields.tsx): select + **Other…** + custom text; ref skips one sync when transitioning to Other with empty API value. [client/src/components/AppShell.tsx](client/src/components/AppShell.tsx) welcome modal + [client/src/features/settings/SettingsPage.tsx](client/src/features/settings/SettingsPage.tsx): Region helper (“reporting and administration only”), **Department/OU** labels, trimmed **`ou`** on submit, validation when Other is empty. Asset editors: TEAM option label **“Team (same Department/OU)”** (prompts, skills, context, builds edit/create pages).
- **API** — [server/src/routes/auth.ts](server/src/routes/auth.ts): **`ou`** Zod **`.max(120)`**; **`OU_REQUIRED`** message references Department/OU. [server/src/routes/admin.ts](server/src/routes/admin.ts): **`GET /api/admin/department-ous/custom-in-use`** — `user.groupBy(ou)` for caller’s **`teamId`**, filter out canonical departments, sort by count.
- **Admin app** — [client/src/features/admin/DepartmentOuAdminPage.tsx](client/src/features/admin/DepartmentOuAdminPage.tsx), [client/src/features/admin/api.ts](client/src/features/admin/api.ts) **`listCustomDepartmentOusInUse`**, route **`/admin/department-ous`**, [client/src/app/router.tsx](client/src/app/router.tsx), [AdminDashboardPage.tsx](client/src/features/admin/AdminDashboardPage.tsx) tile. **Tests:** [server/test/admin-custom-department-ous.test.ts](server/test/admin-custom-department-ous.test.ts) (mocks **`user.findUnique`** for **`refreshSessionRoleFromDb`** + **`groupBy`**).
- **Legacy data** — [server/scripts/appendLegacyOuSalesSuffix.ts](server/scripts/appendLegacyOuSalesSuffix.ts): dry-run by default; **`--apply`** runs **`UPDATE`**-style **`updateMany`** per legacy string (`ou` → `ou + " - Sales"`). **Run on production after deploy:** `heroku run npm --prefix server run migrate:legacy-ou-sales -- --apply -a aosfail` (or equivalent with app name). **Idempotent** once no row matches exact legacy strings.
- **Docs / copy** — [client/src/features/help/HelpPage.tsx](client/src/features/help/HelpPage.tsx), [server/src/services/helpSearch.ts](server/src/services/helpSearch.ts), [client/src/features/admin/adminHelpContent.ts](client/src/features/admin/adminHelpContent.ts), [client/src/features/assets/VisibilityBadge.tsx](client/src/features/assets/VisibilityBadge.tsx), [client/src/data/changelog.ts](client/src/data/changelog.ts) **1.3.5** entry. **Versions:** root / **client** / **server** `package.json` → **1.3.5**.
- **Prisma:** none (data-only migration script). **Deploy:** `git push origin main`, **`git push heroku main:master`**. **Verify:** https://ail.mysalesforcedemo.com — then run legacy migration on Heroku Postgres as above; re-check admin **Department/OU (custom values)** and profile flows.

### Session: global asset tags, tag requests, owner-only assignment (April 28, 2026 — 11:45 CDT)

- **Invariant:** Single **global** tag vocabulary (`Tag` without `teamId`); **`@@unique([name])`** with lowercase storage via **`normalizeTagNameForStorage`**. Junctions **`PromptTag`**, **`SkillTag`**, **`ContextTag`**, **`BuildTag`**. **`TagRequest`** is global (no team); approve creates one **`Tag`**.
- **Migrations:** [20260428140000_asset_tags_and_tag_requests](server/prisma/migrations/20260428140000_asset_tags_and_tag_requests/migration.sql) (junctions + requests); [20260429100000_global_tags](server/prisma/migrations/20260429100000_global_tags/migration.sql) (merge duplicate tags by name, repoint junctions, drop `Tag.teamId` / `TagRequest.teamId`).
- **Lib:** [server/src/lib/assetTags.ts](server/src/lib/assetTags.ts) — normalize, **`validateTagIdsExist`**, **`promptTaggedWithWhere`** / **`skillTaggedWithWhere`** / **`contextTaggedWithWhere`** / **`buildTaggedWithWhere`**.
- **API**
  - **`GET /api/tags`** — optional **`q`**, **`limit`**; usage counts across asset types. **`POST /api/tags`** — **`Role.ADMIN`** only.
  - **`/api/tag-requests`** — **`POST`** (`requireWriteAccess`) submit; **`GET`** / **`PATCH /:id`** **`ADMIN`**; approve creates **`Tag`** in transaction; **[server/src/services/email.ts](server/src/services/email.ts)** **`sendTagRequestNotification`** → notify inbox; CTA **`/admin/tag-requests`** on **https://ail.mysalesforcedemo.com**.
  - **Prompts / skills / context / builds:** **`tagIds`** on create; **PATCH** owner-only gate for **`tagIds`** (403 if non-owner); list **`tag`** query param; detail/list responses include **`tags`** (names).
  - **`GET /api/assets`** — **`tag`** filter; unified rows include **`tags`**.
  - **`GET /api/search/suggestions`** — filter suggestions with **`filterKey: "tag"`** for matching global tag names.
- **App:** [server/src/app.ts](server/src/app.ts) mounts **`/api/tag-requests`**.
- **Seed:** [server/prisma/seed.ts](server/prisma/seed.ts) — global **`tag.upsert`** by **`name`**; reset path no longer **`tag.deleteMany({ teamId })`** (tags are global).
- **Client:** **`tag`** on **`SearchFilters`** + URL sync; **`listAssets`** / Home / Search Results; **`AssetCard`** tag chips; **`AssetTagsField`**, **`TagRequestModal`**, **`TagRequestsPage`**, route **`/admin/tag-requests`**, Admin dashboard tile + pending badge; create/edit flows for prompts, skills, context, builds with owner-only tag editing on edits.
- **Tests / API hardening:** List and detail handlers use **`(junction ?? []).map`** so Prisma rows without included tag relations (or test mocks) do not throw. Search suggestions tests include **`prisma.tag.findMany`**; flow tests mock post-create **`findUnique`** and tag junction arrays where responses include **`tags`**.
- **Apply migrations:** local **`cd server && npx prisma migrate deploy`**; production **`heroku run npx prisma migrate deploy`** on the Heroku app behind **https://ail.mysalesforcedemo.com** (dyno **`aosfail`**). **Deploy:** **`git push origin main`**, **`git push heroku main:master`**. Verify only on **https://ail.mysalesforcedemo.com**.

### Session: user profiles, team member favorites, `ownerId` assets, deploy-only verification rule (April 28, 2026 — 10:33 CDT)

- **Prisma** ([server/prisma/schema.prisma](server/prisma/schema.prisma), migration [20260428120000_user_profile_favorite/migration.sql](server/prisma/migrations/20260428120000_user_profile_favorite/migration.sql)): **`UserProfileFavorite`** model (`fanUserId`, `targetUserId`, `@@unique([fanUserId, targetUserId])`, cascade FKs to `User`) for per-user “favorited by teammates” stats. **Production:** apply with `heroku run npx prisma migrate deploy` (or release-phase equivalent) so the new table exists before relying on profile favorites.
- **API** — [server/src/routes/users.ts](server/src/routes/users.ts) mounted at **`/api/users`** in [server/src/app.ts](server/src/app.ts):
  - **`GET /api/users/:id`**: Same-team user only; returns `id`, `name`, `avatarUrl`, `ou`, `region`, `title`, **`collectionAddsCount`** (memberships in collections on the team), **`favoriteCount`** (rows where `targetUserId` = id), **`favoritedByMe`**. Loads the user first; **404** without running aggregate queries for missing users.
  - **`POST /api/users/:id/favorite`**: Idempotent toggle; **400** if `id ===` session user; same-team check.
- **Assets list** ([server/src/routes/assets.ts](server/src/routes/assets.ts)): Query **`ownerId`** (optional int, mutually exclusive with **`mine`**). Resolves user in `auth.teamId` or **404**; applies existing catalog visibility + **PUBLISHED** filters and **`ownerId`** on prompts, skills, context, builds. **`Cache-Control: private, no-store`** when `ownerId` or `mine` is set; short `max-age` only for anonymous team catalog lists without those flags.
- **Client**
  - Route **`/users/:id`** → lazy **[UserProfilePage](client/src/features/users/UserProfilePage.tsx)** ([router.tsx](client/src/app/router.tsx)); **[client/src/features/users/api.ts](client/src/features/users/api.ts)** (`fetchUserProfile`, `toggleUserFavorite`).
  - **[UserCollectionMenu](client/src/components/UserCollectionMenu.tsx)**: Add/remove person via **`POST/DELETE /api/collections/:collectionId/users/:userId`**; optimistic updates against **`["collections"]`** query cache.
  - **[collections/api.ts](client/src/features/collections/api.ts)**: `Collection.users`, **`addUserToCollection`**, **`removeUserFromCollection`**.
  - **[CollectionDetailPage](client/src/features/collections/CollectionDetailPage.tsx)**: **People** section (avatar, link to `/users/:id`, remove).
  - **[ListAssetsFilters](client/src/features/assets/api.ts)**: **`ownerId`** passed through to **`GET /api/assets`** for profile asset grids.
  - **Owner → profile links**: [AssetCard.tsx](client/src/features/assets/AssetCard.tsx) (title/summary vs owner row; **Build** detail path `[Build]`); [PromptDetailPage](client/src/features/prompts/PromptDetailPage.tsx), [SkillDetailPage](client/src/features/skills/SkillDetailPage.tsx), [ContextDetailPage](client/src/features/context/ContextDetailPage.tsx), [BuildDetailPage](client/src/features/builds/BuildDetailPage.tsx) — owner name links to **`/users/:id`**. List cards updated in the same release line (see commit history for prompt/skill/context/build list splits).
- **Tests**: [server/test/users-routes.test.ts](server/test/users-routes.test.ts); [server/test/assets-list.test.ts](server/test/assets-list.test.ts) — `ownerId` behavior, cache header, **`mine`+`ownerId`** **400**, missing user **404**.
- **Cursor / workflow rules**
  - **[.cursor/rules/deploy-only-verification.mdc](.cursor/rules/deploy-only-verification.mdc)** (**alwaysApply**): Routine verification is **deploy then check https://ail.mysalesforcedemo.com**; do **not** use local `npm run build`, `tsc`, or test suites as the default proof loop unless the user explicitly asks.
  - **[.cursor/rules/production-only-workflow.mdc](.cursor/rules/production-only-workflow.mdc)**, **[.cursor/rules/test-and-deploy-production.mdc](.cursor/rules/test-and-deploy-production.mdc)**: Adjusted so default verification matches deploy-only (no mandatory local build/test step in the written workflow).
  - **[.cursor/rules/commit-deploy-update-summary.mdc](.cursor/rules/commit-deploy-update-summary.mdc)**, **[.cursor/rules/summary-build-version-head.mdc](.cursor/rules/summary-build-version-head.mdc)**: Kept **Build Version** ↔ **`git rev-parse --short HEAD`** invariant on clean trees; clarified verify-before-push applies to that hash check (not a substitute for the user’s deploy-only preference).
- **Deploy:** `git push origin main`, **`git push heroku main:master`**; ensure Prisma migration applied on Heroku Postgres. **Verify** product behavior only on **https://ail.mysalesforcedemo.com** per **deploy-only-verification.mdc**.

### Session: skill install URL — Slack `/docs/` prefix, no archive links, Slackbot Skill Canvas copy (April 28, 2026 — 09:05 CDT)

- **Problem:** Slack skill install links still documented and validated against the legacy **`/skills/`** path; canonical Slackbot skill pages use **`/docs/`**; URLs containing **`archive`** (e.g. channel archive paths) must not pass validation.
- **Validation** ([server/src/lib/skillUrl.ts](server/src/lib/skillUrl.ts), [client/src/features/skills/api.ts](client/src/features/skills/api.ts)): **`SLACK_ENTERPRISE_SKILL_DOCS_URL_PREFIX`** is **`https://salesforce.enterprise.slack.com/docs/`**. **`isValidSlackEnterpriseSkillUrl`** requires that prefix, a parseable URL, and rejects the full string when **`archive`** appears (case-insensitive). **`/skills/`** URLs are no longer accepted.
- **API messages** ([server/src/routes/skills.ts](server/src/routes/skills.ts), [server/src/routes/v1/index.ts](server/src/routes/v1/index.ts)): **`skillUrl`** validation errors refer to a Slack **skill docs** URL and the same prefix constant.
- **Forms** ([SkillEditorPage.tsx](client/src/features/skills/SkillEditorPage.tsx), [SkillEditPage.tsx](client/src/features/skills/SkillEditPage.tsx)): Helper text opens with **Link to the skill package file or Slackbot Skill Canvas.**; still lists supported archive extensions, the docs URL prefix, and that links containing **`archive`** are not accepted; placeholders and inline validation messages match server rules.
- **Tests** ([server/test/skillUrl.test.ts](server/test/skillUrl.test.ts), [server/test/skills-flow.test.ts](server/test/skills-flow.test.ts)): **`/docs/…`** acceptance, **`/skills/`** and **`archive`** rejection, flow test Slack fixture updated to **`/docs/`** shape.
- **Prisma:** none. **Pre-deploy:** `npx vitest run test/skillUrl.test.ts test/skills-flow.test.ts` (server), `npm --prefix client run build`. **Deploy:** **`git push origin main`**, **`git push heroku main:master`**. Production: https://ail.mysalesforcedemo.com

### Session: collections menu UX — cards, create inline, popover polish (April 24, 2026 — 19:24 CDT)

- **Problem:** The bookmark **Add to collection** `<details>` panel looked clipped or inert because list cards used **`overflow-hidden`** on the whole shell, which clipped the absolutely positioned dropdown. The menu only listed existing collections (no create path) and did not match newer surface styling.
- **Overflow** ([AssetCard.tsx](client/src/features/assets/AssetCard.tsx), [PromptListCard.tsx](client/src/features/prompts/PromptListCard.tsx), [SkillListCard.tsx](client/src/features/skills/SkillListCard.tsx), [ContextListCard.tsx](client/src/features/context/ContextListCard.tsx), [BuildListCard.tsx](client/src/features/builds/BuildListCard.tsx)): Removed outer **`overflow-hidden`**; confine clipping to the thumbnail block (**`overflow-hidden rounded-t-xl`**) and **`max-md:rounded-t-xl rounded-b-xl`** on the body where the hero is `hidden md:block` so dropdowns can extend below the card.
- **Parity** ([AssetCard.tsx](client/src/features/assets/AssetCard.tsx)): **`AssetCollectionMenu`** for every **`assetType`** (prompt, skill, context, build), not prompt-only. List cards for skills, context, and builds gained the same menu after Share ([SkillListCard.tsx](client/src/features/skills/SkillListCard.tsx), [ContextListCard.tsx](client/src/features/context/ContextListCard.tsx), [BuildListCard.tsx](client/src/features/builds/BuildListCard.tsx)); prompts use **`AssetCollectionMenu`** from [PromptListCard.tsx](client/src/features/prompts/PromptListCard.tsx) (replacing **`PromptCollectionMenu`** at those call sites). [AssetCard.test.tsx](client/src/features/assets/AssetCard.test.tsx) mocks **`AssetCollectionMenu`**.
- **Create collection** ([CollectionCreateInline.tsx](client/src/components/CollectionCreateInline.tsx)): Shared inline form (**`createCollection`**, React Query) with **`variant`** **`default`** vs **`popoverFooter`**. [AssetCollectionMenu.tsx](client/src/components/AssetCollectionMenu.tsx) and [AssetDetailCollectionsDisclosure.tsx](client/src/components/AssetDetailCollectionsDisclosure.tsx) mount it; on success the current asset is **added** to the new collection via existing add mutations.
- **Popover UI** ([AssetCollectionMenu.tsx](client/src/components/AssetCollectionMenu.tsx)): Structured header (icon tile, title, helper line), scrollable list with skeleton loading, empty state copy, row hover and **Add / Added** pills, **`z-50`**, **`rounded-xl`** panel, **`group-open:`** summary styling and focus ring. Footer uses **`CollectionCreateInline`** **`variant="popoverFooter"`** with launch-style **Create** control and improved input focus ring.
- **Prisma:** none. **Pre-deploy:** `npm --prefix client run build`, client tests as needed. **Deploy:** **`git push origin main`**, **`git push heroku main:master`**. Production: https://ail.mysalesforcedemo.com

### Session: team catalog — published-only lists; owner-only drafts in shared surfaces (April 24, 2026 — 19:12 CDT)

- **Problem:** Team-wide asset lists and unified **`/api/assets`** could return **DRAFT** / **ARCHIVED** rows when no `status` query was sent; nested collection payloads exposed other users’ non-published assets.
- **New helper** ([server/src/lib/catalogAsset.ts](server/src/lib/catalogAsset.ts)): **`canViewAssetInTeamCatalog`** (published for everyone, else owner-only) and Prisma fragments **`catalogVisible*Where`** for collection junction filters.
- **List routes** ([server/src/routes/prompts.ts](server/src/routes/prompts.ts), [skills.ts](server/src/routes/skills.ts), [context.ts](server/src/routes/context.ts), [builds.ts](server/src/routes/builds.ts), [assets.ts](server/src/routes/assets.ts)): When **`mine`** is not true, **`status`** is forced to **`PUBLISHED`**; optional **`status`** filter applies only for **`mine=true`** (caller’s own content).
- **Collections** ([server/src/routes/collections.ts](server/src/routes/collections.ts)): **`GET /api/collections`** and **`GET /api/collections/:id`** include only member assets that are **published** or **owned by the viewer** (so owners still see their drafts inside their collections).
- **Engagement / detail APIs (non-owners):** **`GET …/:id`**, **`GET …/:id/versions`**, and **favorite / rating / usage** handlers for prompts, skills, context, and builds return **404** when the asset is not published and the caller is not the owner (after visibility checks), so deep links and side-channel APIs do not surface others’ drafts.
- **Prisma:** none. **Pre-deploy:** `npm --prefix server test`, `npm --prefix client run build`. **Deploy:** **`git push origin main`**, **`git push heroku main:master`**. Production: https://ail.mysalesforcedemo.com

### Session: summary metadata sync to HEAD (April 24, 2026 — 19:03 CDT)

- **Docs:** Root [summary.md](summary.md) **`Build Version`** / **`Last Updated`** aligned with **`git rev-parse --short HEAD`** per [.cursor/rules/summary-build-version-head.mdc](.cursor/rules/summary-build-version-head.mdc).

### Session: SPA static fallback — missing Vite chunks (April 24, 2026 — 19:02 CDT)

- **Problem:** After deploys (or cached shell), a request for a removed lazy chunk under **`/assets/*.js`** could fall through **`express.static`**; the SPA catch-all sent **`index.html`**, so the browser loaded **`text/html`** as a module (MIME error, blank screen on routes like prompt edit).
- **Server** ([server/src/app.ts](server/src/app.ts)): **`isSpaDocumentPath`** — SPA fallback only for document-like paths; **`/assets/`** and common static file extensions get **404** `text/plain` instead of HTML. **`Cache-Control: no-cache, must-revalidate`** on **`index.html`** so clients revalidate the shell across deploys.
- **Tests** ([server/test/spa-fallback.test.ts](server/test/spa-fallback.test.ts)): Missing **`/assets/…`** and **`*.css`** requests return **404**, not the HTML shell.
- **Docs / workflow:** [.cursor/rules/summary-build-version-head.mdc](.cursor/rules/summary-build-version-head.mdc) — **`summary.md`** **`Build Version`** must track **`git rev-parse --short HEAD`** (with follow-up sync when the tip advances). [.cursor/rules/commit-deploy-update-summary.mdc](.cursor/rules/commit-deploy-update-summary.mdc) references that rule.
- **Prisma:** none. **Pre-deploy:** `npm --prefix server test`, `npm --prefix client run build`. **Deploy:** **`git push origin main`**, **`git push heroku main:master`**. Production: https://ail.mysalesforcedemo.com

### Session: client permanent-delete UI aligned with server ACLs (April 24, 2026 — 18:47 CDT)

- **Roles** ([client/src/features/auth/roles.ts](client/src/features/auth/roles.ts)): New **`canPermanentlyDeleteAsset`** — workspace **ADMIN** / **OWNER** may permanently delete any asset in the UI; other roles only when they are the **owner** and **`canCreateContent`** applies (matches server **`isOwnerOrWorkspaceAdmin`** for `DELETE`/`/permanent` routes).
- **Confirm delete copy** ([client/src/components/ConfirmDeleteModal.tsx](client/src/components/ConfirmDeleteModal.tsx)): Warning states that **all** data for the asset is removed—content, version history, metadata, and analytics—and cannot be restored.
- **Detail pages** ([BuildDetailPage.tsx](client/src/features/builds/BuildDetailPage.tsx), [ContextDetailPage.tsx](client/src/features/context/ContextDetailPage.tsx), [SkillDetailPage.tsx](client/src/features/skills/SkillDetailPage.tsx), [PromptDetailPage.tsx](client/src/features/prompts/PromptDetailPage.tsx)): Permanent-delete affordance uses **`canPermanentlyDeleteAsset`**; shared **`me`** local; TypeScript-safe checks use **`me != null &&`** before reading **`me.role` / `me.id`**.
- **Edit pages** ([BuildEditPage.tsx](client/src/features/builds/BuildEditPage.tsx), [ContextEditPage.tsx](client/src/features/context/ContextEditPage.tsx), [PromptEditPage.tsx](client/src/features/prompts/PromptEditPage.tsx), [SkillEditPage.tsx](client/src/features/skills/SkillEditPage.tsx)): **Delete** button + **`ConfirmDeleteModal`**, permanent-delete API mutations, list query invalidation, analytics **`trackEvent`** (`build_delete`, `context_delete`, `prompt_delete`, `skill_delete`), **`navigate("/")`** on success; prompt edit resolves owner via **`prompt.owner?.id`** or **`prompt.ownerId`** for permission parity.
- **Tests** ([PromptEditPage.test.tsx](client/src/features/prompts/PromptEditPage.test.tsx)): **`vi.mock`** includes **`deletePromptPermanently`**; direct import removed (was unused).
- **Prisma / server:** none in this changeset (client-only). **Deploy:** `npm --prefix client run build`, **`git push origin main`**, **`git push heroku main:master`**.

### Session: workspace ADMIN/OWNER full asset mutations (April 24, 2026 — 18:32 CDT)

- **Visibility / mutations** ([server/src/lib/visibility.ts](server/src/lib/visibility.ts)): **`canMutateTeamScopedAsset`** now treats **`ADMIN`** / **`OWNER`** like reads — they may **PATCH** / archive / restore / regenerate thumbnails for **any** asset (`teamId` no longer has to match the session). **`isOwnerOrWorkspaceAdmin`** centralizes “asset owner or workspace admin/owner” for governance-only routes.
- **Permanent delete** ([server/src/routes/prompts.ts](server/src/routes/prompts.ts), [skills.ts](server/src/routes/skills.ts), [context.ts](server/src/routes/context.ts), [builds.ts](server/src/routes/builds.ts)): Allowed for **`isOwnerOrWorkspaceAdmin`** (admins were previously owner-only).
- **Verify / unarchive** (prompts, skills, context): Same **`isOwnerOrWorkspaceAdmin`** gate so admins can verify or unarchive cross-team assets.
- **Transfer ownership** (prompts, skills, context): Drop **`existing.teamId === auth.teamId`** for lookup; require **`newOwner.teamId === existing.teamId`** so the new owner is always on the **asset’s** team when an admin’s session team differs.
- **Tests**: Server Vitest suite unchanged count (111); no Prisma migration.
- **Deploy:** `npm --prefix client run build`, **`git push origin main`**, **`git push heroku main:master`**. Production: https://ail.mysalesforcedemo.com

### Session: governance sweep clock, Vitest Prisma mocks, Smart Picks system collection (April 24, 2026 — 18:17 CDT)

- **Prisma migrations (PROFILE_INCOMPLETE)**: Split into two transactions — [20260425120000_archive_reason_profile_incomplete/migration.sql](server/prisma/migrations/20260425120000_archive_reason_profile_incomplete/migration.sql) contains only **`ALTER TYPE "ArchiveReason" ADD VALUE`**, and [20260425120001_profile_incomplete_backfill/migration.sql](server/prisma/migrations/20260425120001_profile_incomplete_backfill/migration.sql) runs the archive + **`AssetVerification`** backfill (PostgreSQL **55P04**: new enum values cannot be used in the same transaction as **`ADD VALUE`**). If a deploy previously failed on the combined migration, mark it rolled back then redeploy, e.g. `heroku run -a aosfail -- npx prisma migrate resolve --rolled-back 20260425120000_archive_reason_profile_incomplete` (from `server/` with `DATABASE_URL` set).
- **Governance job** ([server/src/jobs/governance.ts](server/src/jobs/governance.ts)): Warn-path Prisma filters use a shared **`governanceSweepClock`** set from sweep / `recomputeSmartPicks` options `now` (fixes deterministic tests vs wall-clock `new Date()`). **`findLowRated`** tolerates rows missing `ratings` in tests (`row.ratings ?? []`). Archive email **`reasonLabel`** includes **`PROFILE_INCOMPLETE`** (satisfies `Record<ArchiveReason, string>` after Prisma enum extension).
- **Vitest** ([server/test/pagination.test.ts](server/test/pagination.test.ts), [server/test/helpers/mockPrisma.ts](server/test/helpers/mockPrisma.ts)): Pagination tests use **`buildPrismaMock`** with `usageEvent` / `*UsageEvent` **`groupBy`** stubs (supports prompt list **week-top** aggregation). Base mock adds **`$queryRaw`** / **`$executeRaw`** for `createApp` health check.
- **Governance sweep test** ([server/test/governance-sweep.test.ts](server/test/governance-sweep.test.ts)): **`recomputeSmartPicks`** “flips” case calls **`vi.resetModules()`** and **`mockReset`** on prompt `findMany` / `updateMany` so prior `mockResolvedValueOnce` queues do not leak across cases under **`restoreMocks`**.
- **System collections** ([server/src/services/systemCollections.ts](server/src/services/systemCollections.ts)): New **Smart Picks** system collection per team; **`refreshSmartPicksCollection(teamId)`** syncs membership to published assets with **`isSmartPick: true`** (prompts, skills, context, builds).
- **Admin API** ([server/src/routes/admin.ts](server/src/routes/admin.ts)): **`PATCH /api/admin/smart-picks`** toggles `isSmartPick` for a team-scoped asset and triggers **`refreshSmartPicksCollection`**.
- **Related route hooks** (assets, builds, collections, context, prompts, skills): After mutations that affect smart-pick state, **`refreshSmartPicksCollection(auth.teamId)`** runs where wired in this commit.

### Session: profile onboarding gate, skill Slack URLs, mutate ACLs, prompt detail (April 24, 2026 — 18:06 CDT)

- **Prisma migration** ([server/prisma/migrations/20260425120000_archive_reason_profile_incomplete/migration.sql](server/prisma/migrations/20260425120000_archive_reason_profile_incomplete/migration.sql)): Adds `ArchiveReason.PROFILE_INCOMPLETE`; backfills archive of all **PUBLISHED** prompts, skills, context documents, and builds owned by users with `onboardingCompleted = false`, plus `AssetVerification` audit rows.
- **Profile gate service** ([server/src/services/profileGateArchive.ts](server/src/services/profileGateArchive.ts)): `archivePublishedAssetsForProfileGate(ownerId)` performs the same archive pattern at runtime (transaction per asset type).
- **Auth & session** ([server/src/routes/auth.ts](server/src/routes/auth.ts), [server/src/middleware/auth.ts](server/src/middleware/auth.ts), [server/src/types/express-session.d.ts](server/src/types/express-session.d.ts)): Session carries `onboardingCompleted`; DB refresh keeps it in sync; `requireOnboardingComplete` returns **403** `PROFILE_SETUP_REQUIRED` when the user has not finished profile setup (dev whitelist bypass unchanged). `GET /api/auth/me` runs the profile-gate archiver once per session (`profileGateArchiveDone`) for incomplete users so stray published rows are not left live.
- **Authenticated API routes**: Routers that previously stopped at `requireAuth` now chain **`requireOnboardingComplete`** after it (prompts, skills, context, builds, collections, assets, search, tags, thumbnails, tool-requests, help, me, AI, analytics, admin, API keys, v1 surface as applicable). Vitest route mocks set `onboardingCompleted: true` on `req.session.auth` where needed ([server/test/auth-session.test.ts](server/test/auth-session.test.ts), flow tests).
- **Visibility / mutations** ([server/src/lib/visibility.ts](server/src/lib/visibility.ts)): **`canMutateTeamScopedAsset`** — asset **owner** may always mutate; **ADMIN** / **OWNER** may mutate **any** asset (cross-tenant, same as admin read scope). *Earlier iteration restricted admins to `asset.teamId === auth.teamId`; superseded April 24, 2026 — 18:32 CDT.* Adopted on prompt/skill/context/build mutation handlers.
- **Client — AppShell** ([client/src/components/AppShell.tsx](client/src/components/AppShell.tsx)): Blocks the shell with a **welcome / complete profile** modal when `onboardingCompleted` is false; [AppShell.test.tsx](client/src/components/AppShell.test.tsx) covers the gate.
- **Client — Prompt detail** ([client/src/features/prompts/PromptDetailPage.tsx](client/src/features/prompts/PromptDetailPage.tsx)): Validates `promptId > 0`; clearer loading vs missing/error states; **archive** mutation + navigation; **`AssetCollectionMenu`** instead of prompt-only collection menu; share uses shared **`buildShareUrl` / `shareOrCopyLink`**; edit/delete eligibility uses `me` + owner id alignment with **`canCreateContent`**.
- **Client — usage analytics on secondary actions** ([BuildDetailPage.tsx](client/src/features/builds/BuildDetailPage.tsx), [SkillDetailPage.tsx](client/src/features/skills/SkillDetailPage.tsx), [ContextDetailPage.tsx](client/src/features/context/ContextDetailPage.tsx)): **Open Link** (build docs / skill help) and **Download** (context) now record **COPY** usage plus the existing `trackEvent` names (`build_documentation_open`, `skill_help_open`, `context_download`).
- **Skill install URLs** (*superseded April 28, 2026 — see Recent Changes*): Earlier release used **`/skills/`** prefix only. Current behavior: **`https://salesforce.enterprise.slack.com/docs/`**, no **`archive`** substring, plus archive file extensions — same file list as [server/src/lib/skillUrl.ts](server/src/lib/skillUrl.ts).
- **Types & governance copy**: `PROFILE_INCOMPLETE` added to archive-reason unions ([client/src/features/assets/api.ts](client/src/features/assets/api.ts), prompts/skills/context/builds/admin APIs, [governance.ts](client/src/features/assets/governance.ts)).
- **New detail page tests** (client): [BuildDetailPage.test.tsx](client/src/features/builds/BuildDetailPage.test.tsx), [ContextDetailPage.test.tsx](client/src/features/context/ContextDetailPage.test.tsx), [SkillDetailPage.test.tsx](client/src/features/skills/SkillDetailPage.test.tsx).
- **Docs** ([AUTH_PROTECTION.md](AUTH_PROTECTION.md)): Session shape and onboarding/profile completion flow documented.
- **Deploy:** `npm --prefix client run build`, `npx vitest run` (server + client as usual for your workflow), **`git push origin main`** and **`git push heroku main:master`**. Heroku **release** runs `prisma migrate deploy` — applies the new enum/backfill migration.

### Session: detail CTAs — launch green primaries, Open Link for docs only (April 24, 2026 — 17:45 CDT)

- **Skill detail** ([SkillDetailPage.tsx](client/src/features/skills/SkillDetailPage.tsx)): **Get the Skill** uses Salesforce launch green (`bg-(--color-launch)` / `hover:bg-(--color-launch-hover)`). Toolbar secondary is **Open Link** (purple, external) only when **Documentation URL** (`supportUrl`) is set and **differs** from the skill install URL (`skillUrl`) after [normalizeUrl](client/src/lib/normalizeUrl.ts); no **Copy link** in the action bar (page share remains on the share icon).
- **Build detail** ([BuildDetailPage.tsx](client/src/features/builds/BuildDetailPage.tsx)): Same pattern — **Open Link** only when `supportUrl` ≠ normalized `buildUrl`; removed purple **Copy link** fallback.
- **Context detail** ([ContextDetailPage.tsx](client/src/features/context/ContextDetailPage.tsx)): Primary CTA label **Download** (was **Download Context**) with launch green styling; purple **Copy** (body) unchanged.
- **Deploy:** `git push origin main` and **`git push heroku main:master`** after `npm --prefix client run build` and client tests. Prisma: no schema change.

### Session: commit, deploy, summary (April 24, 2026 — 17:33 CDT)

- **Workflow:** [.cursor/rules/commit-deploy-update-summary.mdc](.cursor/rules/commit-deploy-update-summary.mdc) — update this file, `git add`, `git commit`, `git push origin main`, **`git push heroku main:master`**. **Build Version** above points at feature commit **e4a6a3a** (unified [AssetDetailActionBar](client/src/components/AssetDetailActionBar.tsx) + card/collection work); documentation commits (e.g. `4f3330f`) stack on top without changing that anchor.
- **Pre-push:** `npm --prefix client run build` (no local dev server). **Prisma:** no new migration. **Align Heroku** with `main` if `heroku/HEAD` lags behind local `main`.

### Release: Asset card CTAs, collections index, shared detail action bar (April 24, 2026 — 17:28 CDT)

- **Search / unified cards** ([AssetCard.tsx](client/src/features/assets/AssetCard.tsx)): **View details** uses Salesforce green via theme `bg-(--color-launch)` / `hover:bg-(--color-launch-hover)` (same tokens as [theme.css](client/src/styles/theme.css), `#2e844a`). The second control (**Get the Skill** or **Use**) uses Salesforce purple `bg-[#5A1BA9]` / `hover:bg-[#4A1589]`. This reverses the prior purple-first / green-**Use** pairing on mixed-type search cards.
- **Build list cards** ([BuildListCard.tsx](client/src/features/builds/BuildListCard.tsx)): **View details** uses the same launch green (replacing muted surface styling). **Open Build** uses the purple treatment (replacing `--color-launch`), so build browse cards match the global rule: green primary detail link, purple secondary external action.
- **Collections index** ([CollectionsPage.tsx](client/src/features/collections/CollectionsPage.tsx)): Responsive **grid** (`1` / `sm:2` / `lg:3` columns). **Load more** reveals six cards at a time (`COLLECTIONS_PAGE_SIZE`). **All collections** vs **My collections** toggle resets the visible window; list query key includes `{ mine }` and fetches up to **`COLLECTIONS_FETCH_PAGE_SIZE` (100)** per scope via [listCollections](client/src/features/collections/api.ts) query params.
- **Collections list API** ([server/src/routes/collections.ts](server/src/routes/collections.ts)): `GET /api/collections` accepts optional **`mine=true`** (restrict to `createdById` = caller) in addition to existing **`page`** / **`pageSize`** (max 100).
- **Shared detail toolbar** ([AssetDetailActionBar.tsx](client/src/components/AssetDetailActionBar.tsx)): Bordered row with **left** icon cluster, optional **`openIn`** slot, **primary** and **secondary** CTAs. Adopted on [PromptDetailPage.tsx](client/src/features/prompts/PromptDetailPage.tsx) (Open-in select, green **Use prompt**, purple **Copy**), [SkillDetailPage.tsx](client/src/features/skills/SkillDetailPage.tsx) (green **Get the Skill**, purple **Copy link** + toast), [BuildDetailPage.tsx](client/src/features/builds/BuildDetailPage.tsx) (green **Open Build**, secondary = **View Documentation** when `supportUrl` differs from build URL, else purple **Copy link**), [ContextDetailPage.tsx](client/src/features/context/ContextDetailPage.tsx) (primary **Download Context**, purple **Copy** body + toast on success; removes the duplicate full-width “Use this context” section in favor of one bar), and [CollectionDetailPage.tsx](client/src/features/collections/CollectionDetailPage.tsx) (share + purple **Copy link** + **All collections** link).
- **React Query + `listCollections`**: Call sites use `queryFn: () => listCollections()` ([AssetCollectionMenu.tsx](client/src/components/AssetCollectionMenu.tsx), [PromptCollectionMenu.tsx](client/src/features/prompts/PromptCollectionMenu.tsx), [AssetDetailCollectionsDisclosure.tsx](client/src/components/AssetDetailCollectionsDisclosure.tsx), [PromptsListPage.tsx](client/src/features/prompts/PromptsListPage.tsx)) because `listCollections` now accepts optional query params; avoids passing a function reference that no longer matches the zero-arg `queryFn` signature.
- **Deploy:** `git push origin main` and `git push heroku main:master` after `npm --prefix client run build` and pre-push server + client tests. Prisma: no schema change in this release.

### Release: Detail page chrome reduction — no Metadata block, no stats strip, no Collections disclosure (April 24, 2026 — 17:22 CDT)

- **Prompt detail** ([PromptDetailPage.tsx](client/src/features/prompts/PromptDetailPage.tsx)): Removed the **Metadata** `<section>` (status, visibility, tools, modality, tags, views, ratings count, usage events) and the **`pluralize`** helper plus unused **`getToolLabel`** import.
- **Skill, context, build detail** ([SkillDetailPage.tsx](client/src/features/skills/SkillDetailPage.tsx), [ContextDetailPage.tsx](client/src/features/context/ContextDetailPage.tsx), [BuildDetailPage.tsx](client/src/features/builds/BuildDetailPage.tsx)): Removed the four-cell **Views / Downloads|Copies|Opens / Favorites / Ratings** grid and unused count locals. Status line, stars, and rating row unchanged.
- **Collections UI on detail:** Removed `<AssetDetailCollectionsDisclosure />` from all four detail pages. **[AssetDetailCollectionsDisclosure.tsx](client/src/components/AssetDetailCollectionsDisclosure.tsx)** and **[AssetDetailCollectionsDisclosure.test.tsx](client/src/components/AssetDetailCollectionsDisclosure.test.tsx)** remain in the repo for possible reuse. Per-asset **`AssetCollectionMenu`** in each page’s action toolbar still supports add/remove collections.
- **Deploy:** `git push origin main` and `git push heroku main:master` (pre-push tests). `npm --prefix client run build` verified before push. **Heroku v211**; Prisma release: no pending migrations.

### Release: Skill / build / context detail & card copy — Get the Skill, Help URL dedup, context CTAs (April 24, 2026 — 17:12 CDT)

- **Shared URL normalization** ([client/src/lib/normalizeUrl.ts](client/src/lib/normalizeUrl.ts)): Client helper mirrors server `normalizeUrl` in [server/src/services/dedup.ts](server/src/services/dedup.ts) so primary vs support links compare consistently.
- **Skill detail** ([SkillDetailPage.tsx](client/src/features/skills/SkillDetailPage.tsx)): Section title and primary CTA use **Get the Skill** with shared **ExternalLinkIcon** ([promptActionIcons.tsx](client/src/features/prompts/promptActionIcons.tsx)). Optional **View Documentation** and **Help URL:** line render only when `supportUrl` is set and **differs** from `skillUrl` (no duplicate Slack/doc link when URLs match).
- **Skill list & unified cards** ([SkillListCard.tsx](client/src/features/skills/SkillListCard.tsx), [AssetCard.tsx](client/src/features/assets/AssetCard.tsx)): Same **Get the Skill** label and external-link icon; `AssetCard` for `assetType === "skill"` now **opens** `skillUrl` in a new tab via `getSkill` (replacing green **Use** + clipboard copy). [AssetCard.test.tsx](client/src/features/assets/AssetCard.test.tsx) covers the skill path.
- **Build detail** ([BuildDetailPage.tsx](client/src/features/builds/BuildDetailPage.tsx)): **Open Build** unchanged. **View Documentation** and footer **Help URL:** only when `supportUrl` ≠ normalized `buildUrl`; removed redundant **Build URL:** prose line.
- **Context detail** ([ContextDetailPage.tsx](client/src/features/context/ContextDetailPage.tsx)): New **Use this context** section with primary **Download Context** and secondary **Copy** (skill-style layout); copy/download icon-only duplicates removed from the bookmark row; successful clipboard copy logs `logContextUsage(…, "COPY")`.
- **Deploy:** `git push origin main` and `git push heroku main:master` (pre-push: server + client tests). Production Heroku **v210** ships the feature commits through **3f545fa**. Client build verified before push.

### Release: Asset detail collections UX — shared collapsible disclosure (April 24, 2026 — 16:55 CDT)

- **Problem:** On prompt detail pages, a full-height inline **Collections** list sat above the template/body and pushed primary content down. Context, Skill, and Build detail pages only had the compact bookmark toolbar menu, so bulk Add/Remove lived in different places per asset type.
- **Shared component** ([client/src/components/AssetDetailCollectionsDisclosure.tsx](client/src/components/AssetDetailCollectionsDisclosure.tsx)): Default-closed `<details>` (aligned with History-style disclosure), `listCollections` on `["collections"]`, Add/Remove rows using **`hasAssetInCollection`** + **`useAssetCollectionMutations`** (same optimistic cache updates as the toolbar menus). Expanded panel includes `role="region"` `aria-label="Collections"`, a horizontal chip row of **member** collection links to `/collections/:id`, and muted surface styling (`bg-(--color-surface-muted)`) so collections read as organization chrome.
- **Exports** ([client/src/components/AssetCollectionMenu.tsx](client/src/components/AssetCollectionMenu.tsx)): **`hasAssetInCollection`** and **`useAssetCollectionMutations`** are exported for reuse by the disclosure (no duplicate mutation logic).
- **Detail pages (historical):** At one point all four detail pages mounted `<AssetDetailCollectionsDisclosure />` after stats/rating and before the toolbar. **As of April 24, 2026 (17:22 CDT release)** that disclosure is **removed** from detail routes again; see **Recent Changes** above.
- **Prompt toolbar** ([client/src/features/prompts/PromptCollectionMenu.tsx](client/src/features/prompts/PromptCollectionMenu.tsx)): Uses **`useAssetCollectionMutations`** with `assetType: "prompt"` (Phase **3B** dual path: disclosure + menu share one mutation implementation). Removed [client/src/features/prompts/usePromptCollectionMutations.ts](client/src/features/prompts/usePromptCollectionMutations.ts).
- **Tests:** [client/src/components/AssetDetailCollectionsDisclosure.test.tsx](client/src/components/AssetDetailCollectionsDisclosure.test.tsx) covers summary count, “In N” hint, and expanded region + member link.
- **Deploy:** Push `main` to origin (and `git push heroku main:master` when you are ready for production smoke on all four asset types).

### Release: Homepage Smart Search bar wired to `/search` (April 24, 2026 — 16:02 CDT)

- **Bug**: On the default homepage (not “My Content”), the top **Smart Search** `SearchBar` used **no-op** `onFilterChange` / `onFilterRemove` / `onClearAll` handlers and static `filters` / empty `activeFilters`, so sort, asset type, tool, filter chips, and Clear did nothing useful (only natural-language submit navigated).
- **Fix** ([client/src/features/home/HomePage.tsx](client/src/features/home/HomePage.tsx)): Local state `homeBrowseFilters` plus `getActiveFilters` for chips; changing facets schedules `navigate(\`/search?${filtersToParams(...)}\`)` with a `setTimeout(0)` so the sequence **filter suggestion → clear input** still serializes the URL with an empty `q`. Input uses `handleHomeSearchInputChange` so refs stay aligned for that deferred navigation.
- **“Works Where You Work” tool pills**: `onClick` now **`navigate` to `/search?tool=...`** (merged with current `homeBrowseFiltersRef`) instead of `setFilter`, which only updated the homepage URL’s query params and did not open results.
- **Prerequisite helpers** (already on `main` from prior commit): `filtersToParams` and `getActiveFilters` exported from [client/src/features/search/hooks/useSearchState.ts](client/src/features/search/hooks/useSearchState.ts) and [client/src/features/search/index.ts](client/src/features/search/index.ts).
- **Deploy**: `git push heroku main:master`. Feature `5be03be` first reached production in **v204**; subsequent doc-only pushes advanced the Heroku release counter through **v207** (`6986656` on `main`). Postbuild `version-bump.js` sets client/server patch to **1.3.4** (production footer).

### Release: Homepage UX, analytics leaderboard accuracy, Top Assets label (April 24, 2026 — 15:49 CDT)

- **Top Assets branding**: Homepage featured grid heading renamed from "Top Performers This Week" to **"Top Assets This Week"** ([client/src/features/home/HomePage.tsx](client/src/features/home/HomePage.tsx), [client/src/features/home/HomePage.test.tsx](client/src/features/home/HomePage.test.tsx)).
- **Stat counters**: Hero snapshot numbers use ease-out quart, subtle opacity/`translateY` tied to count progress, shared `prefersReducedMotion()` helper, and `CSSProperties` typing on the animated span ([HomePage.tsx](client/src/features/home/HomePage.tsx)).
- **How AI Library Works**: Scroll-triggered staggered reveal (LTR on desktop, sequential on mobile) via `data-revealed`, `useRevealWhenInView` + `IntersectionObserver`, and `@keyframes` in [client/src/index.css](client/src/index.css); respects `prefers-reduced-motion`; `@media print` keeps step content visible.
- **`GET /api/analytics/overview` correctness** ([server/src/routes/analytics.ts](server/src/routes/analytics.ts)):
  - **Contributors** (`contributors`): ranks owners by total **published** prompts, skills, context documents, and builds. Response field **`assetCount`** replaces **`promptCount`**.
  - **User engagement** (`userEngagementLeaderboard`): **uses** = prompt COPY+LAUNCH plus skill/context/build **COPY** only (no VIEW inflation); **favorites** and **ratings** aggregated across all four asset types. Response field **`ratingCount`** replaces **`feedbackCount`** (these are star ratings submitted, not generic “feedback”). [client/src/features/analytics/api.ts](client/src/features/analytics/api.ts), [AnalyticsPage.tsx](client/src/features/analytics/AnalyticsPage.tsx), [HomePage.tsx](client/src/features/home/HomePage.tsx); admin help copy in [adminHelpContent.ts](client/src/features/admin/adminHelpContent.ts).
- **Vitest / jsdom**: [client/src/test/setup.ts](client/src/test/setup.ts) provides an `IntersectionObserver` stub (fires `isIntersecting` on a microtask) and avoids TypeScript constructor parameter properties so `pnpm run build` (`erasableSyntaxOnly`) stays green.
- **Search helpers**: [client/src/features/search/hooks/useSearchState.ts](client/src/features/search/hooks/useSearchState.ts) exports **`getActiveFilters`** (same chip logic as the hook’s `activeFilters` memo, including **Builds** asset label) and **`filtersToParams`**; [client/src/features/search/index.ts](client/src/features/search/index.ts) re-exports them for callers that need URL/filter chips without duplicating label maps.

### Release: Asset governance, verification lifecycle, and hybrid rating feedback (April 24, 2026 — 15:40 CDT; Heroku v201, footer 1.3.4)

- **Database (Prisma migration `20260424200000_add_governance_and_rating_flags`)**:
  - **Per-asset lifecycle fields** on `Prompt`, `Skill`, `ContextDocument`, and `Build`: `lastVerifiedAt`, `verificationDueAt`, `warningSentAt`, `archivedAt`, `archiveReason` (enum `ArchiveReason`: MANUAL, UNVERIFIED, INACTIVE, LOW_RATING, PROFILE_INCOMPLETE). Backfill sets `lastVerifiedAt` / `verificationDueAt` from `updatedAt` for published assets so the first nightly sweep does not mass-archive.
  - **Hybrid ratings**: `feedbackFlags` (`FeedbackFlag` enum) and optional `comment` on `Rating`, `SkillRating`, `ContextRating`, and `BuildRating` for structured feedback (e.g. worked well, inaccurate, outdated).
  - **`AssetVerification` audit log** and enums `AssetType`, `VerificationAction`. Composite indexes on `(status, verificationDueAt)` support efficient governance sweeps.
- **Governance job** ([server/src/jobs/governance.ts](server/src/jobs/governance.ts), [server/src/jobs/runGovernance.ts](server/src/jobs/runGovernance.ts)): scheduled/manual sweep (warnings, due dates, auto-archive per scoring rules in [server/src/services/scoring.ts](server/src/services/scoring.ts)); [server/src/lib/flagCounts.ts](server/src/lib/flagCounts.ts) aggregates low-rating signal. Admin can trigger `POST /api/admin/governance/run` ([server/src/routes/admin.ts](server/src/routes/admin.ts)).
- **Admin API** ([server/src/routes/admin.ts](server/src/routes/admin.ts)): `GET /api/admin/users` (team user search), `GET /api/admin/users/:userId/assets`, `POST /api/admin/users/:userId/transfer-assets` (bulk ownership transfer via [server/src/services/governanceOps.ts](server/src/services/governanceOps.ts)), plus governance run above. Gated to `OWNER` and `ADMIN`.
- **User-scoped API** ([server/src/routes/me.ts](server/src/routes/me.ts)): `GET /api/me/assets/needs-verification?window=7` lists the caller’s published assets with verification due within the window; powers Settings “My Assets” and reminder UX.
- **Client — admin**: [client/src/features/admin/GovernancePage.tsx](client/src/features/admin/GovernancePage.tsx) and [client/src/features/admin/OwnershipTransferPage.tsx](client/src/features/admin/OwnershipTransferPage.tsx) are linked from [AdminDashboardPage](client/src/features/admin/AdminDashboardPage.tsx) (Asset Governance, Ownership Transfer now “ready”). Routes in [client/src/app/router.tsx](client/src/app/router.tsx): `/admin/governance`, `/admin/ownership-transfer`.
- **Client — Settings**: [client/src/features/settings/MyAssetsSection.tsx](client/src/features/settings/MyAssetsSection.tsx) surfaces assets needing verification; [SettingsPage](client/src/features/settings/SettingsPage.tsx) integrates the section.
- **Client — assets & ratings**: [client/src/features/assets/VerificationControls.tsx](client/src/features/assets/VerificationControls.tsx), [client/src/features/assets/governance.ts](client/src/features/assets/governance.ts), [AssetCard](client/src/features/assets/AssetCard.tsx) updates; star controls ([PromptStars](client/src/features/prompts/PromptStars.tsx), parallel patterns on skills/context/builds) support optional feedback flags/comment. Feature `api.ts` files updated for new list/detail fields.
- **Config**: [.env.example](.env.example) and [server/src/config/env.ts](server/src/config/env.ts) document governance-related env. [server/package.json](server/package.json) adds `governance:sweep` and `governance:sweep:dry` (run compiled `runGovernance.js` after build).
- **Tests**: New/updated server tests: `governance-ops`, `governance-scoring`, `governance-sweep`, plus [server/test/context-flow.test.ts](server/test/context-flow.test.ts) adjustments.
- **Version bump**: Root `package.json` remains `1.3.3` in git; each Heroku deploy runs `version-bump.js` so the **production footer** reflects the new patch (this release: **v1.3.4** on Heroku v201).
- **Migrations on deploy**: Root [Procfile](Procfile) `release:` runs `npm --prefix server run prisma:deploy`, so Heroku applies new migrations before the web dyno restarts.

### Release: v1.3.7 (April 24, 2026 — 14:09 CDT) — List card thumbnails on Prompts, Skills, Context, and Builds

- **Homepage-style thumbnail now renders at the top of every list card** on the Prompts, Skills, Context, and Builds index pages. Previously, only the homepage [`AssetCard`](client/src/features/assets/AssetCard.tsx) displayed a thumbnail; the four per-type list cards (`PromptListCard`, `SkillListCard`, `ContextListCard`, `BuildListCard`) rendered title/metadata only. This closes the visual gap so the browse experience on each asset type mirrors the homepage "Top Performers" grid.
- **Responsive visibility**: the thumbnail is wrapped in a `<div className="hidden md:block">` wrapper so it appears on medium (`md`, ≥768px) and large (`xl`, ≥1280px) screens — where the grid is 2- and 3-wide respectively — and is entirely omitted on small screens where the grid collapses to a single column. This keeps the mobile card dense and text-first while giving desktop users the richer preview they already see on the homepage.
- **Rendering pattern** (same in all four cards): `<PromptThumbnail title={...} thumbnailUrl={...} thumbnailStatus={...} className="h-40 w-full object-cover" />` is inserted as the first child of the shell `<div className={shellClass}>`, directly before the existing `<div className="p-4">` text block. Because the shell already uses `overflow-hidden rounded-xl ... p-0`, the image flows cleanly to the rounded edges, matching the homepage layout.
- **Fallback behavior is unchanged**: `PromptThumbnail` ([client/src/features/prompts/PromptThumbnail.tsx](client/src/features/prompts/PromptThumbnail.tsx)) renders the `<img>` when `thumbnailUrl` is present, and otherwise shows the gradient placeholder with its status text ("Generating…", "Failed", or the "Regenerate" button when provided). The list cards do not pass `onRegenerate`, so pending/failed states simply display the status pill — regeneration remains handled on the detail pages.
- **No API, schema, or type changes**: all four summary shapes (`PromptSummary`, `Skill`, `ContextDocument`, `Build`) already expose `thumbnailUrl` and `thumbnailStatus` (verified in each feature's `api.ts`). The responsive grid on the four list pages (`grid gap-3 md:grid-cols-2 xl:grid-cols-3`) was not modified — it already matches the requested 1/2/3 column layout.
- **Files changed**: [client/src/features/prompts/PromptListCard.tsx](client/src/features/prompts/PromptListCard.tsx), [client/src/features/skills/SkillListCard.tsx](client/src/features/skills/SkillListCard.tsx), [client/src/features/context/ContextListCard.tsx](client/src/features/context/ContextListCard.tsx), [client/src/features/builds/BuildListCard.tsx](client/src/features/builds/BuildListCard.tsx) — each adds a single `import { PromptThumbnail } from "…/PromptThumbnail"` and a 7-line `<div className="hidden md:block">…</div>` block. `+36 / -0` lines total across the four files. No lint errors.
- **Version bump**: root, client, server `package.json` remain `1.3.3` locally; `heroku-postbuild` / `scripts/version-bump.js` will bump on deploy, so the production footer will display `v1.3.7` after this release.

### Release: v1.3.6 (April 24, 2026 — 13:46 CDT) — Fix broken logout flow

- **Logout no longer leaves the user on a broken page** (`client/src/features/settings/SettingsPage.tsx`). The previous implementation called `await queryClient.invalidateQueries({ queryKey: ["auth", "me"] })` immediately after `logout()` and before `navigate("/login")`. Because `invalidateQueries` triggers an eager refetch of all active subscribers to that query key, both `AppShell` and `SettingsPage` (each of which mount `useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe })`) would refetch `/api/auth/me`, which now returned `401 Unauthorized` since the session cookie had just been cleared server-side. The 401 response propagated into `meQuery.error` / `meQuery.data === undefined` in both components, causing them to render error/empty states in the middle of the logout handler — before React Router's `navigate("/login")` could transition the route — producing the "broken page" flash the user reported.
- **New `handleLogout` implementation**: (1) calls `await logout()` inside a `try/catch` so a flaky server still logs the user out locally, (2) calls `queryClient.clear()` which drops every cached query without triggering any refetches (unlike `invalidateQueries`, which eagerly refetches active queries), and (3) does a hard redirect via `window.location.replace("/login")` instead of `navigate("/login")`. `window.location.replace` unmounts the entire React tree, guaranteeing no stale component using `["auth", "me"]` can render against a dead session, and it also replaces the current history entry so the back button does not return the user to the authenticated Settings page.
- **Cleanup**: removed the now-unused `useNavigate` import and the `const navigate = useNavigate();` local from `SettingsPage.tsx` since navigation is handled via `window.location.replace`.
- **No server-side change, no schema change, no other client code changed**. The existing `POST /api/auth/logout` endpoint (which clears the session cookie) is unchanged. The `ProtectedRoute` guard (`client/src/components/ProtectedRoute.tsx`) continues to redirect to `/login` on `AxiosError.response?.status === 401`, and the hard redirect means that path is taken cleanly on the very next render in the fresh React tree rather than mid-transition.
- **Version bump**: root, client, server `package.json` remain `1.3.3` locally; `heroku-postbuild` / `scripts/version-bump.js` will bump on deploy, so the production footer will display `v1.3.6` after this release.

### Release: v1.3.5 (April 24, 2026 — 13:45 CDT) — Homepage performance + route-level code splitting

- **Route-level code splitting** (`client/src/app/router.tsx`): All major feature pages are now lazy-loaded via `React.lazy()` with dynamic imports. This dramatically reduces the initial bundle size and speeds up first load. Lazy routes include: HomePage, PromptsListPage, PromptDetailPage, PromptEditorPage, PromptEditPage, SkillListPage, SkillDetailPage, SkillEditorPage, SkillEditPage, ContextListPage, ContextDetailPage, ContextEditorPage, ContextEditPage, BuildListPage, BuildDetailPage, BuildEditorPage, BuildEditPage, CollectionsPage, CollectionDetailPage, SearchResultsPage, AnalyticsPage, AdminDashboardPage, AdminHelpPage, ToolRequestsPage, HelpPage, SettingsPage, ChangelogPage. Static/public pages (LoginPage, TermsPage, PrivacyPage) remain eagerly loaded.
- **Lazy thumbnail loading** (`server/src/routes/thumbnails.ts`): New `/api/thumbnails/:assetType/:id` endpoint returns thumbnail URL, status, and error for any asset type (prompt, skill, context, build). The assets list API now omits `thumbnailUrl` from responses, and clients fetch thumbnails on-demand via `PromptThumbnail`'s new `lazyLoad` mode. This shaves significant payload from list responses and parallelizes image fetching.
- **QueryClient caching tuning** (`client/src/app/queryClient.ts`): Centralized QueryClient config with `staleTime: 30_000` (30s) and `gcTime: 5 * 60_000` (5 min) to reduce redundant API calls during navigation.
- **Non-blocking homepage render**: Homepage now renders shell immediately with loading skeletons while data fetches in background. `useHomePerfMarks.ts` adds opt-in performance instrumentation via `VITE_ENABLE_PERF_MARKS` env var.
- **Assets list API body omission**: The unified `/api/assets` endpoint no longer returns `body` field in list responses (only in single-asset detail responses), reducing payload size.
- **Settings page layout refinement**: Appearance card placed to the right of Profile; Account Information card removed; API Keys moved to last position; Your Content and Your Analytics cards placed side by side.

### Release: v1.3.4 (April 24, 2026 — 12:12 CDT) — Custom Build thumbnail upload

- **Creators can now upload their own thumbnail image for Builds**, at create time or any time afterwards, instead of (or replacing) the AI-generated image. This feature is scoped only to the `Build` asset type — Prompts, Skills, and Context Documents continue to use AI-generated thumbnails exclusively.
- **New upload endpoint** `POST /api/builds/:id/thumbnail` ([server/src/routes/builds.ts](server/src/routes/builds.ts)): owner/admin-guarded multipart endpoint that accepts a single `thumbnail` field, enforces a 5 MB cap and `image/jpeg|png|gif|webp` MIME filter, writes the file to `server/public/uploads/` with a `build-<timestamp>-<random><ext>` name, and updates the row with `thumbnailUrl: "/uploads/<filename>"`, `thumbnailStatus: "READY"`, `thumbnailError: null`. On overwrite, best-effort deletes the previous `/uploads/build-*` file so we don't leak disk space. Storage pattern mirrors the existing profile-photo upload in [server/src/routes/auth.ts](server/src/routes/auth.ts).
- **AI generation skipped when user brings their own image**: `createBuildBodySchema` in `builds.ts` gained an optional `skipThumbnailGeneration: boolean` flag. When true, the create handler does not call `queueBuildThumbnailGeneration`, so no Gemini API call is made and no cost is incurred. The client sets this flag automatically whenever a file is attached to the create form.
- **BuildEditorPage (create flow)** ([client/src/features/builds/BuildEditorPage.tsx](client/src/features/builds/BuildEditorPage.tsx)): new optional "Thumbnail image" section with a file input, client-side MIME/size validation (JPEG/PNG/GIF/WebP, 5 MB), live `URL.createObjectURL` preview, and a "Remove" button. On submit, if a file is selected, `createBuild` is called with `skipThumbnailGeneration: true` and the upload is chained via `uploadBuildThumbnail(buildId, file)` before navigation. If no file is attached, behavior is unchanged (AI generation runs as before).
- **BuildEditPage (edit flow)** ([client/src/features/builds/BuildEditPage.tsx](client/src/features/builds/BuildEditPage.tsx)): new independent "Thumbnail image" section shown above the main edit form, decoupled from text-field saves so users can swap an image without re-saving anything else. Includes the current thumbnail preview, file picker, an "Upload image" button wired to `uploadBuildThumbnail`, a "Cancel" button, and a "Use AI-generated image instead" button that calls the existing `regenerateBuildThumbnail` endpoint. All three flows share React Query cache invalidation (`["build", id]`, `["builds"]`) so the UI refreshes immediately.
- **Client API additions** ([client/src/features/builds/api.ts](client/src/features/builds/api.ts)): `CreateBuildInput.skipThumbnailGeneration?: boolean` and new `uploadBuildThumbnail(id: number, file: File): Promise<Build>` that posts `multipart/form-data` with field name `thumbnail`, following the same pattern as `uploadProfilePhoto` in the auth client.
- **No Prisma schema change**: the existing `Build.thumbnailUrl String?` column already accepts either an AI-generated data-URI or a `/uploads/...` path, and `ThumbnailStatus.READY` is reused. No migration was run.
- **Test coverage** (new `server/test/builds-thumbnail.test.ts`, 6 tests, all passing): (1) AI generation is skipped when `skipThumbnailGeneration: true`, (2) AI generation still runs when the flag is omitted, (3) happy-path upload returns 200 and persists `/uploads/build-*` with `thumbnailStatus: READY`, (4) non-image upload is rejected without touching the DB, (5) non-owner, non-admin users get a 403, (6) empty multipart request returns 400. Full server suite: 57/57 passing. Client `tsc --noEmit`: clean.
- **Version bump**: root, client, server `package.json` now `1.3.3`; `heroku-postbuild` / `scripts/version-bump.js` increments the patch on deploy, so the production footer will display `v1.3.4` after this release.

### Release: v1.3.3 (April 24, 2026 — 11:45 CDT) — Admin Dashboard and admin-only Help

- **New Admin Dashboard** (`client/src/features/admin/AdminDashboardPage.tsx`): Central hub for every admin surface, mounted at `/admin` and gated by `AdminRoute`. Renders a grid of tool cards (Analytics, Tool Requests, Asset Governance, Ownership Transfer, System Collections) with "Ready" / "Coming soon" badges, a live pending-tool-requests count fetched via `listToolRequests({ status: "pending" })` (using `select: (result) => result.meta.total` to extract the count from the paginated response), and a "Refresh System Collections" quick action backed by a `useMutation` against `POST /api/collections/system/refresh` with toast feedback. Icons are inline SVGs to keep the page dependency-free; tool cards render as `<Link>` when `to` is set and as plain cards when the feature is still flagged `coming_soon` (Governance, Ownership Transfer).
- **Admin-only Help page** (`client/src/features/admin/AdminHelpPage.tsx` + `client/src/features/admin/adminHelpContent.ts`): Dedicated admin knowledge base at `/admin/help`, also gated by `AdminRoute`. Content lives in a typed `adminHelpContent` array (`AdminHelpSection` / `AdminHelpArticle`) covering the Analytics dashboard, Tool Request review workflow, System Collections refresh, and Admin roles & access. The page reuses the visual pattern from the user Help page (filter input, sticky sidebar nav, expandable articles) and includes a "← Admin Dashboard" back link.
- **Router wiring** (`client/src/app/router.tsx`): Added two new routes — `/admin` → `AdminDashboardPage` and `/admin/help` → `AdminHelpPage` — both wrapped in `AdminRoute` so only admins can reach them. Existing admin-only routes (`/analytics`, `/admin/tool-requests`) stay in place and are now linked from the dashboard.
- **Nav consolidation** (`client/src/components/AppShell.tsx`): Replaced the two separate "Analytics" and "Tool Requests" top-nav links (and their mobile menu equivalents) with a single "Admin" link that points to `/admin`. Cleans up the top bar and makes the dashboard the canonical entry point for admin work.
- **Back-links from admin surfaces**: `client/src/features/analytics/AnalyticsPage.tsx` and `client/src/features/admin/ToolRequestsPage.tsx` each gain a "← Admin Dashboard" `<Link>` at the top of the page for fast return navigation.
- **User Help scrubbed of admin content** (`client/src/features/help/HelpPage.tsx`): Removed the entire `id: "admin"` section (admin analytics, `/admin/tool-requests` URL, system collection refresh endpoint) so general users no longer see admin-only URLs or workflows. The "What user roles exist?" article now describes `ADMIN` as "full access, including admin tools and visibility into all assets" without enumerating admin-specific endpoints.
- **Ask-AI knowledge base scrubbed** (`server/src/services/helpSearch.ts`): The `HELP_CONTENT` string fed to Gemini for the Ask-AI beta no longer contains a `## For Admins` block, and the "How do I request a new tool?" answer no longer exposes the `/admin/tool-requests` URL to general users. The `ADMIN` role description in the Roles section was updated to match the Help page copy.
- **Version bump**: root, client, server `package.json` now `1.3.2`; `heroku-postbuild` / `scripts/version-bump.js` increments the patch on deploy, so the production footer will display `v1.3.3` after this release.

### Release: v1.3.2 (April 24, 2026 — 11:17 CDT) — Branded email template and slackbot skills import

- **Branded transactional email template** (new `server/src/lib/emailTemplate.ts`, 218 lines): introduces a shared, mobile-responsive, dark-mode-aware HTML wrapper used by every outgoing email. The template renders a site-branded header with the AI Library logo/wordmark, a centered content card, and a footer with the `#help-ailibrary` Slack channel link and a copyright line. It generates both the HTML document (with `<style>` rules for `@media (max-width: 600px)` and `@media (prefers-color-scheme: dark)`) and a plain-text wrapper with a matching header/footer, consumed automatically by callers.
- **`sendBrandedEmail` wrapper** (new export in `server/src/lib/email.ts`): new high-level API that takes `{ to, subject, html, text, preheader }` and passes them through `wrapEmailHtml` / `wrapEmailText` before invoking the existing nodemailer transport. `sendEmail` is now considered a low-level primitive and should not be called directly by feature code.
- **Tool-request notification refactor** (`server/src/services/email.ts`): replaces the old ad-hoc HTML (generic `#0070d2` button, hand-rolled tables) with the branded template, using the Salesforce-inspired palette documented in the new rule (`#032d60` text, `#51678d` muted, `#d7dfea` borders, `#0176d3` links, `#2e844a` CTA). Adds a preheader ("New tool submitted: &lt;name&gt; — review in the admin panel."), normalizes `appBaseUrl` (strips trailing slash), reuses a precomputed `submitterName`, and renders a rounded pill "Review in Admin Panel" button.
- **New always-apply rule** (`.cursor/rules/email-template.mdc`): mandates `sendBrandedEmail` for **all** outgoing email — current and future. Prohibits calling `sendEmail` directly from services/routes, importing `nodemailer` outside `server/src/lib/email.ts`, inlining full HTML documents, and skipping the plain-text body. Documents the required palette for inline styles so manually-authored markup stays on-brand.
- **Slackbot skills import script** (new `server/scripts/importSlackbotSkills.ts`, 314 lines): one-shot CSV-driven importer that (1) deletes every Prompt whose `tools` array contains `"slackbot"` (cascades via existing `onDelete: Cascade` to `PromptVersion`, `Favorite`, `Rating`, `UsageEvent`, `PromptTag`, `CollectionPrompt`, `PromptVariable`) and (2) upserts each CSV row as a Skill keyed on `skillUrlNormalized`. Supports a default dry-run mode (reports what would happen, no writes) and an explicit `--apply` mode. Usage documented inline, including a pattern for running against the Heroku prod DB via `DATABASE_URL="$(heroku config:get DATABASE_URL -a aosfail)"`.
- **Initial slackbot skills seed data** (new `slackbot-skills-2026-04-24.csv`, 117 lines): source CSV consumed by the importer (columns: Skill Name, Description, Skill Link, Creator Email).
- **Version bump**: root, client, server `package.json` now `1.3.1`; `heroku-postbuild` / `scripts/version-bump.js` increments the patch on deploy, so the production footer will display `v1.3.2` after this release.

### Release: v1.3.1 (April 24, 2026 — 11:11 CDT) — OU taxonomy refresh

- **Canonical OU list updated** to the 2026 taxonomy. The dropdown values, previously hard-coded in two places, now live in a single shared constant at `client/src/constants/ous.ts` exporting `OU_OPTIONS` (and an `OuOption` type). The 15 canonical OUs, in display order, are: `AMER TMT & CBS`, `AMER REG`, `AMER PACE & AFD360 OU`, `Global SMB (incl. EBOU)`, `UKI (incl. PE)`, `EMEA Central`, `EMEA North`, `EMEA South`, `France`, `LATAM`, `ANZ`, `North Asia`, `South Asia`, `GPS .Org`, `Data Foundation`.
- **UI consumers refactored** to map over `OU_OPTIONS`:
  - `client/src/components/AppShell.tsx` — first-sign-in onboarding modal OU `<select>`.
  - `client/src/features/settings/SettingsPage.tsx` — Settings page OU `<select>`.
- **One-time Prisma data migration** (`server/prisma/migrations/20260424120000_rename_ou_values/migration.sql`) remaps legacy `User.ou` values to the new canonical list. Confirmed mapping:
  - `AMER ACC` → `AMER TMT & CBS`
  - `AMER PACE` → `AMER PACE & AFD360 OU`
  - `EMEA CENTRAL` → `EMEA Central`
  - `EMEA NORTH` → `EMEA North`
  - `EMEA SOUTH` → `EMEA South`
  - `FRANCE` → `France`
  - `GLOBAL PUBSEC` → `GPS .Org`
  - `GLOBAL SMB` → `Global SMB (incl. EBOU)`
  - `NEXTGEN PLATFORM` → `Data Foundation`
  - `SOUTH ASIA` → `South Asia`
  - `JAPAN / KOREA / TAIWAN` → `NULL` (affected users hit the existing `OU_REQUIRED` gate on next action and are re-prompted to pick an OU)
  - `AMER REG`, `ANZ`, `LATAM` already match the new list exactly — untouched.
- **Regions dropdown unchanged** (still `AMER | JAPAC | LATAM | EMEA`). Regions have a 1:many relationship with OUs per product requirement, so no coupling was added.
- **Session-cached `userOu`** refreshes naturally from the DB on the next `/auth/me` request via the existing auth flow in `server/src/routes/auth.ts` — no session migration required.

### Release: v1.3.0 (April 23, 2026 — 16:45 CDT)

- **Comprehensive Help page rewrite** (`client/src/features/help/HelpPage.tsx`): The in-app help documentation now covers every feature delivered since the previous help update. New sections:
  - **Builds** — complete asset-type section explaining what a Build is, how to use one (Build URL / Support URL), how to create one, and Build versioning.
  - **Skills (URL-based)** — rewritten to reflect the v1.2 migration from text-body skills to URL-based skill archives (Skill URL + Support URL fields), with guidance on where to host skill archives and how to install into each target tool.
  - **Visibility & Roles** — explains PUBLIC (global), TEAM (OU-scoped), PRIVATE visibility plus ADMIN / OWNER / MEMBER / VIEWER roles including the `@meshmesh.io` auto-VIEWER rule.
  - **Search & Discovery** — documents Smart Search, natural-language query parsing (Gemini), ⌘K shortcut, faceted filters with live counts, and the Ask-AI beta.
  - **API Keys & MCP Integration** — how to generate `alib_xxx…` keys in Settings, the `/api/v1/*` endpoints, the `@ailibrary/mcp-server` tools (`add_prompt`, `add_skill`, `add_context`, `add_build`, `whoami`), and 409-Conflict duplicate behavior over the API.
  - **Duplicate Detection** — body-hash, normalized-title, Levenshtein 85% fuzzy match, and URL-normalization duplicate checks with Duplicate Warning modal semantics.
  - **Compliance & Policies** — explains the 96-hour SAM/Data Classification acknowledgment modal (`promptlibrary.compliance.acknowledged` localStorage), the "Nope, get me out of here" exit path, and what content not to upload.
  - **For Admins** — `/analytics` dashboard, `/admin/tool-requests` review, and `POST /api/collections/system/refresh`.
  - Existing sections (Getting Started, Prompts, Context, Collections, AI Tools, Your Profile, Your Content & Analytics, Tips) updated with: Agentforce Vibes and Claude Cowork / ChatGPT tool support, asset badges (Smart Pick / New / Updated / Popular), changelog link in footer, versioning with optional changelog notes, permanent-delete cascade, tool request flow, My Content filters (Status, Sort variants, List view toggle, inline Show Analytics), CSV export column controls, and rename from "SF AI Library" to "AI Library".

- **Help AI knowledge base refresh** (`server/src/services/helpSearch.ts`): The `HELP_CONTENT` string fed to Gemini for the Ask-AI beta was rewritten to match the new Help page content so AI answers reference Builds, URL-based Skills, MCP, visibility/roles, duplicate detection, compliance, and all current tool options. System prompt updated to reference "AI Library" (not "SF AI Library") and to include Builds as a first-class asset type.

- **Prompts list page cleanup** (`client/src/features/prompts/PromptsListPage.tsx`): Removed the duplicate inline "Create Prompt" pill/button from the prompts list header. The unified header "Create" menu is now the single entry point for creating prompts, skills, context, and builds — avoids confusion when a writer sees two Create affordances on the same page.

- **Version bump to 1.3.0**: Root, `client`, `server`, and `mcp-server` `package.json` files all set to `1.3.0`. Changelog entry added to `client/src/data/changelog.ts`. Note: `heroku-postbuild` runs `scripts/version-bump.js` which auto-increments the patch on deploy, so the production footer will display `v1.3.1` after this release.

### Previous Release: v1.25.0 (April 23, 2026 — 15:45 CDT)

- **Asset Deduplication System**: Implemented comprehensive duplicate detection to prevent creation of duplicate assets across all four asset types (Prompts, Skills, ContextDocuments, Builds):
  - **New deduplication service** (`server/src/services/dedup.ts`): Core logic for duplicate detection including:
    - `normalizeTitle()` / `normalizeBody()` — Text normalization (lowercase, trim, collapse whitespace)
    - `computeBodyHash()` — SHA-256 hash of normalized body content for exact content matching
    - `normalizeUrl()` — URL normalization for Skills and Builds
    - `levenshteinDistance()` / `titleSimilarity()` — Fuzzy matching with configurable 85% threshold
    - Per-asset-type duplicate checkers: `checkPromptDuplicates()`, `checkSkillDuplicates()`, `checkContextDuplicates()`, `checkBuildDuplicates()`
  - **Schema additions** (migration `20260423200000_add_dedup_fields`):
    - `Prompt`: `titleNormalized`, `bodyHash` fields with unique constraint on `bodyHash`
    - `Skill`: `skillUrlNormalized` field with unique constraint
    - `ContextDocument`: `titleNormalized`, `bodyHash` fields with unique constraint on `bodyHash`
    - `Build`: `buildUrlNormalized` field with unique constraint
  - **Route integration**: All create (POST) and update (PATCH) endpoints now check for duplicates and return HTTP 409 Conflict with detailed match information when duplicates are detected
  - **Frontend modal** (`client/src/components/DuplicateWarningModal.tsx`): User-friendly modal that shows detected duplicates with:
    - Match type badges (exact_body, exact_title, similar_title, exact_url)
    - Similarity percentage for fuzzy matches
    - Direct links to view existing duplicate assets
    - Owner attribution
  - **Form integrations**: All editor pages (PromptEditorPage, PromptEditPage, SkillEditorPage, ContextEditorPage, BuildEditorPage) now handle 409 responses and display the duplicate warning modal
  - **Backfill script** (`server/prisma/backfill-dedup-fields.ts`): Utility script to populate dedup fields for existing records after migration

### Previous Release: v1.2.0 (April 23, 2026 — 14:03 CDT)

- **Version bump to 1.2.0**: Promoted the AI Library to the 1.2 release line, marking the milestone that includes Builds, API Keys/MCP integration, and cross-asset versioning. Root, `client`, `server`, and `mcp-server` `package.json` files all updated to `1.2.0`. Changelog entry added to `client/src/data/changelog.ts` summarizing the 1.2 feature set. Note: `heroku-postbuild` runs `scripts/version-bump.js` which auto-increments the patch on deploy, so the production footer will display `v1.2.1` after this release.

- **Context detail page — documentation link**: `ContextDetailPage.tsx` now renders a documentation icon (next to the favorite button) and a "View Documentation" text link when `doc.supportUrl` is set. New inline `DocumentIcon` SVG component. Both links open in a new tab with `rel="noopener noreferrer"`.

- **HomePage top performers refactor**: Replaced the four parallel per-asset-type `listAssets` queries with a single unified query using `assetType: "all"`, `sort: "mostUsed"`, `pageSize: 12`. Added `showAllTopPerformers` state and a "Show N more / Show less" toggle below the grid so users can reveal up to 12 top performers instead of the previous fixed 6. Failed-thumbnail prompts are still filtered out. Removed the old `featuredAssets` memo and replaced it with `topPerformers` (filtered) and `visibleTopPerformers` (sliced).

- **Builds permanent delete — version cascade**: `DELETE /api/builds/:id/permanent` now also deletes related `buildVersion` rows inside the transaction, alongside usage events, favorites, ratings, and collection memberships. This prevents foreign-key violations after the 1.1 versioning migration.

- **Dev whitelist bypass header**: Added `X-Dev-Whitelist-Token` header-based authentication bypass for automated tooling and MCP clients:
  - Server: `authRouter.get("/me")` now calls a new `checkWhitelistBypass(req)` helper before returning 401. When the request includes a valid `X-Dev-Whitelist-Token` header matching `env.devWhitelistToken`, the helper loads the user at `env.devWhitelistUserId` and populates `req.session.auth` so downstream middleware treats the request as authenticated. Returns `false` silently if the token is missing/invalid or the user is not found.
  - Client: `client/src/api/client.ts` reads `VITE_DEV_WHITELIST_TOKEN` from build-time env and, when present, attaches `X-Dev-Whitelist-Token` as a default header on the shared `apiClient` axios instance. The header is only sent when the env var is set (production builds omit it).

- **Prompt seed utility**: New `server/prisma/seed-prompts-from-skills.ts` script that converts the legacy skill backup JSON into prompt rows, stripping "skill" terminology from titles/bodies. Paired with the `skills-backup-2026-04-23-full.json` and `.csv` backup files in the repo root.

### Previous Changes

- **Versioning support for Builds**: Added version tracking to Builds asset type (matching existing Prompt versioning pattern):
  - New `BuildVersion` Prisma model with version number, title, summary, buildUrl, supportUrl, changelog, and creator tracking
  - Database migration `20260423182733_add_versioning_to_skills_context_builds` adds the versioning schema
  - Initial version automatically created when a Build is created (version 1 with "Initial version" changelog)
  - Update endpoint accepts optional `changelog` field for version notes
  - Skills and Context also received versioning schema in the same migration

- **Build type added to search types**: Extended `AssetTypeFilter`, `SearchSuggestion.assetType`, and `ParsedSearchQuery.assetType` to include `"build"` for complete search integration

### Previous Session Changes (April 23, 2026 — 13:20 CDT)

- **Builds integrated into unified assets API**: Extended the `/api/assets` endpoint and search system to include Builds as a fourth asset type:
  - Server-side: Added `includeBuilds` logic to assets route, fetches builds with visibility/status filtering, includes in facets and snapshot counts
  - Client-side: Added `build` to `AssetType`, `AssetTypeFilter`, `ListAssetsFacets`, and `ListAssetsSnapshot` types
  - FacetedFilters now shows Builds count and filter button alongside Prompts, Skills, and Context
  - AssetAnalyticsTable and AssetListView now include build detail/edit paths in switch statements

### Previous Session Changes (April 23, 2026 — 21:30 CDT)

- **API Keys and MCP Integration**: Added programmatic API access for external tools to create content in the AI Library:
  - New `ApiKey` database model with secure SHA-256 hash storage, expiration dates, and revocation support
  - API key management UI in Settings page: generate keys (shown once with click-to-reveal and copy), view existing keys (prefix only), revoke keys with confirmation
  - API key authentication middleware that validates `Authorization: Bearer alib_xxx` headers
  - New public API v1 endpoints (`/api/v1/prompts`, `/api/v1/skills`, `/api/v1/context`, `/api/v1/builds`, `/api/v1/me`) for programmatic content creation
  - MCP server package (`mcp-server/`) with tools: `add_prompt`, `add_skill`, `add_context`, `add_build`, `whoami`
  - Users can now say "MeshMesh, add this [prompt/skill/context/build] to the AI Library" from Cursor or other MCP clients

### Previous Session Changes (April 23, 2026 — 19:15 CDT)

- **Skills URL migration**: Converted Skills from text body-based assets to URL-based assets (matching Builds pattern):
  - Removed `body` field and `SkillVariable` model from Skill
  - Added `skillUrl` (required) and `supportUrl` (optional) fields to Skill model
  - Migration deletes existing skills (must be recreated with URLs)
  - Updated client API types and server routes for URL-based skills
  - Added `isValidArchiveUrl()` helper for validating skill archive URLs

- **Filter dropdown styling fix**: Fixed filter dropdown visibility issues in dark mode:
  - Added explicit text color (`text-(--color-text)`) to all select elements in SearchBar
  - Added `cursor-pointer` styling for better UX
  - Added global CSS rules for native `<select>` and `<option>` elements to ensure proper colors in dark theme
  - Added `color-scheme: dark light` for proper browser theme awareness

### Previous Session Changes (April 23, 2026 — 18:15 CDT)

- **Build card in homepage hero**: Added a fourth navigation card for "Builds" in the homepage hero section alongside Prompts, Skills, and Context. Updated grid layout from 3 columns to responsive 2/4 columns (`sm:grid-cols-2 lg:grid-cols-4`) for better display of all four asset types. Build card includes cube/package icon and links to `/builds`.

### Previous Session Changes (April 23, 2026 — 17:30 CDT)

- **Compliance Modal**: Added `ComplianceModal` component that displays a compliance notice requiring users to acknowledge Salesforce SAM Team policies and Data Classification Policy:
  - Modal appears on app load and requires acknowledgment every 96 hours
  - Stores acknowledgment timestamp in localStorage (`promptlibrary.compliance.acknowledged`)
  - Two options: "I Understand" (dismisses and stores timestamp) or "Nope, get me out of here" (redirects to salesforce.com)
  - Links to SAM Policy and Data Classification Policy on Basecamp
  - Warning about unauthorized tool usage and improper data handling
  - Integrated into `AppShell.tsx` to display on all authenticated pages

- **Procfile release phase**: Added Prisma deploy command to Heroku release phase for automatic database migrations on deploy

### Previous Session Changes (April 23, 2026 — earlier)

- **Builds asset type**: Introduced a new "Build" asset type for sharing pre-built solutions and tools:
  - New `Build` Prisma model with `title`, `summary`, `buildUrl`, `supportUrl`, visibility, status, thumbnails, and engagement tracking
  - Complete API routes: CRUD, favorites, ratings, usage events, collection membership, thumbnail regeneration
  - Frontend pages: `BuildListPage`, `BuildDetailPage`, `BuildEditorPage`, `BuildEditPage`, `BuildListCard`
  - Added `/builds`, `/builds/new`, `/builds/:id`, `/builds/:id/edit` routes to router
  - Navigation updated: "Builds" link in header, "New Build" in create dropdown
  - Related models: `BuildFavorite`, `BuildUsageEvent`, `BuildRating`, `CollectionBuild`
  - Database migration `20260423144128_add_builds` creates all Build-related tables

- **isSmartPick field for featured assets**: Added `isSmartPick` boolean field to Prompt, Skill, ContextDocument, and Build models:
  - Enables curated "Smart Picks" feature for highlighting recommended assets
  - Database migration `20260423150018_add_is_smart_pick_field` adds the column to all asset tables

- **Help icon in header**: Added a help circle icon button in the header navigation that links to `/help` page for quick access to documentation

- **AssetCollectionMenu enhancement**: Extended to support Builds in collection management

- **AssetBadges component**: New unified badge system for assets showing SmartPick, New, Updated, and Popular badges:
  - SmartPick badge (pink star) for curated featured assets
  - New badge (green) for assets created in the last 7 days
  - Updated badge (blue) for assets modified in the last 7 days but created earlier
  - Popular badge (orange flame) for assets with 10+ favorites
  - Integrated into PromptListCard, SkillListCard, ContextListCard, PromptDetailPage, SkillDetailPage

### Previous Session Changes (April 23, 2026 — earlier)

- **VIEWER role access control**: Introduced read-only VIEWER role with comprehensive access restrictions:
  - Added `canCreateContent()` role helper that allows ADMIN, OWNER, and MEMBER but excludes VIEWER
  - Created `WriterRoute` component that redirects VIEWER users away from create/edit routes
  - Added `requireWriteAccess` server middleware that blocks write operations for VIEWER role
  - Protected all create, update, delete, and regenerate endpoints with write access middleware
  - Hide "Create" button in header navigation for VIEWER users
  - Hide create/edit CTAs in empty states and list pages for VIEWER users
  - Domain-based automatic VIEWER assignment for `@meshmesh.io` users on sign-in
  - Updated 6 test files to mock `requireWriteAccess` middleware

- **Collection user membership**: Added ability to add users to collections:
  - New `CollectionUser` Prisma model with collectionId/userId unique constraint and sortOrder
  - New API endpoints: `POST /api/collections/:id/users/:userId` and `DELETE /api/collections/:id/users/:userId`
  - Collections API returns `users` array with member details in list and detail responses

- **Thumbnail generation retry with exponential backoff**: Enhanced `nanoBanana.ts` with automatic retry logic:
  - Up to 5 retry attempts with exponential backoff (1s, 2s, 4s, 8s, 16s delays)
  - Cleaner logging that reports success/failure per attempt
  - Refactored into `attemptGeneration()` helper for cleaner retry loop

### Previous Session Changes (April 23, 2026 — earlier)

- **Expanded Slack Skills seed script**: Significantly expanded `seed-slack-skills.ts` with 7 new authors (Ilya Pevzner, Chandrahas Aroori, Daniel Morrison, Viktor Sperling, Daniel Martin, David O Dowd, Jonathan Arteaga) and many new skill seeds including SE/AE SFR prompts, Gemini prompts, and other Slackbot skills. Added optional `tools` field to skill seeds for specifying target tools (e.g., `slackbot`).

### Previous Session Changes (April 22, 2026)

- **Login page redirect for authenticated users**: Updated `LoginPage` to check authentication status and automatically redirect logged-in users to the homepage. Previously, authenticated users could navigate to `/login` and see the login form unnecessarily. Now uses `useQuery` to check `/api/auth/me` and renders `<Navigate to="/" replace />` if already authenticated.

- **Avatar URL validation relaxed**: Updated the profile update validation schema in `auth.ts` to accept server upload paths (starting with `/uploads/`) in addition to HTTP/HTTPS URLs. This fixes profile save errors when users have uploaded custom profile photos stored on the server.

- **Slack Skills seed script**: Added `seed-slack-skills.ts` script for bulk importing Slack-related skills with predefined authors (Jesse Chase, Stewart Anderson, Jessica Finkbeiner, Rachel Cowgill). Added `seed:slack-skills` npm script to `server/package.json`.

### Previous Session Changes (April 21, 2026)

- **Ratings for Skills and Context**: Extended the rating system (previously prompts only) to Skills and Context Documents:
  - Added `SkillRating` and `ContextRating` Prisma models with userId/assetId unique constraint
  - New API endpoints: `POST /api/skills/:id/rating` and `POST /api/context/:id/rating` (1-5 star values)
  - Skill and Context detail pages now show average rating display and interactive rate stars
  - Skill and Context list cards now show average ratings and inline rate controls
  - Assets API returns `ratingCount`, `averageRating`, and `myRating` for all asset types
  - Analytics table displays rating counts and averages for all asset types (not just prompts)

- **Collections support for Skills and Context**: Extended the collections system to support all asset types:
  - Added `CollectionSkill` and `CollectionContext` Prisma junction models
  - New API endpoints: `POST/DELETE /api/skills/:id/collections/:collectionId` and `POST/DELETE /api/context/:id/collections/:collectionId`
  - Created reusable `AssetCollectionMenu` component with bookmark icon for adding/removing assets from collections
  - Collections API now returns `skills` and `contexts` arrays alongside `prompts`
  - Skill and Context detail pages include collection menu in action toolbar

- **CSV export for analytics**: Added export functionality to the analytics table:
  - "Export CSV" button downloads visible columns as a CSV file
  - Respects column visibility settings (hidden columns excluded from export)
  - Filename includes current date (e.g., `analytics-export-2026-04-21.csv`)

- **Compact list view for My Content**: Added simplified table view for browsing owned assets:
  - Created `AssetListView` component with Name, Status, and Edit columns
  - Used in homepage when not showing analytics mode
  - Links to detail and edit pages for each asset

- **Help documentation updates**: Updated help content to reflect new features:
  - Added questions about rating skills and context
  - Added questions about adding skills and context to collections
  - Updated collections section to mention all asset types
  - Added question about CSV export in analytics

### Previous Session Changes (April 21, 2026)

- **Fixed user analytics display**: Fixed the "My Analytics" view so the analytics panel (Views, Uses, Avg Rating, Favorited) now properly displays on each asset card when viewing `/?mine=true&showAnalytics=true`. The `showAnalytics` prop was being read from URL params but not passed to the `AssetCard` component.
  - Updated `client/src/features/home/HomePage.tsx` to pass `showAnalytics={showAnalytics}` to `AssetCard`

- **Consolidated Settings analytics links**: Replaced the three separate analytics links in Settings (My Prompt Analytics, My Skill Analytics, My Context Analytics) with a single "My Analytics" button that shows all asset types together in one unified view.
  - Updated `client/src/features/settings/SettingsPage.tsx` to use single link to `/?mine=true&showAnalytics=true`

### Previous Session Changes (April 21, 2026 — earlier)

- **AssetCard button redesign** (April 21, 2026; CTA palette revised **April 24, 2026**): Renamed "Copy" to **Use** on non-skill cards. An intermediate layout used purple **View details** and green **Use**; **as of April 24, 2026 (17:24 CDT)** the app standard is **View details** = `bg-(--color-launch)` (Salesforce green in [theme.css](client/src/styles/theme.css)) and **second CTA** = purple `#5A1BA9` / `#4A1589` on [AssetCard](client/src/features/assets/AssetCard.tsx) and [BuildListCard](client/src/features/builds/BuildListCard.tsx) (see **Recent Changes**).

- **Removed faceted filters from Top Performers section**: Removed the Type/Tool filter row from the "Top Performers This Week" section on the homepage for a cleaner presentation. Filters are still available in the main search bar.

- **Tool pills on asset detail pages**: Added target tool indicator pills to Skill and Context detail pages. Previously, the tool (e.g., Slackbot, Gemini, Cursor) was only visible on the homepage/index cards and could be filtered, but once navigating to an individual skill or context document, the tool information was not displayed. Now all three asset types (Prompts, Skills, Context) consistently show tool pills below the title/summary on their detail pages.
  - Updated `client/src/features/skills/SkillDetailPage.tsx` to import `getSkillToolLabel` and render tool chips
  - Updated `client/src/features/context/ContextDetailPage.tsx` to import `getContextToolLabel` and render tool chips
  - Styling matches the existing tool chips on AssetCard (`rounded-full bg-(--color-text-inverse) px-2.5 py-0.5 text-xs font-medium text-(--color-bg)`)

### Previous Session Changes (April 20, 2026)

- **Thumbnail retry background service**: Added automatic retry mechanism for stuck thumbnail generation jobs. Items stuck in PENDING status for more than 2 minutes are automatically retried. If retry fails, status is set to FAILED so users can manually regenerate. Service runs on server startup and every 5 minutes thereafter.
  - Created `server/src/services/thumbnailRetry.ts` with `startThumbnailRetryService()` function
  - Service processes up to 10 stuck items per pass for prompts, skills, and context documents
  - Prevents thumbnails from staying stuck forever after server restarts or API timeouts

- **Regenerate button for PENDING thumbnails**: Updated `PromptThumbnail` component to show the "Regenerate" button for items stuck in PENDING status, not just FAILED. Previously, users with stuck PENDING items had no way to manually retry.

- **Admin bootstrap configuration**: Set `BOOTSTRAP_ADMIN_EMAILS` environment variable to automatically grant ADMIN role to designated users on sign-in.

### Previous Session Changes (April 20, 2026)

- **Publish/Draft status modal for new assets**: Added a modal dialog that prompts users to choose between "Draft" and "Published" status when creating a new asset (Prompt, Skill, or Context Document). Previously, the status dropdown was pre-filled with "DRAFT" and users could change it, but there was no explicit prompt asking them to make a deliberate choice. Now when users click Create/Save on a new asset:
  - The form validates as before
  - A modal appears with two card-style options: "Save as Draft" (amber icon) or "Publish Now" (green icon)
  - User makes their choice, and the asset is created with that status
  - Cancel or Escape closes the modal without creating the asset
  - Created new reusable `PublishStatusModal` component in `client/src/components/PublishStatusModal.tsx`
  - Removed status dropdown from all three editor pages (PromptEditorPage, SkillEditorPage, ContextEditorPage) and integrated the modal

### Previous Session Changes (April 20, 2026 — earlier)

- **Skill detail page React hooks fix**: Fixed React Error #310 ("Rendered fewer hooks than expected") that caused a blank page when viewing skill detail pages. The `useMemo` hook was being called after conditional early returns, violating React's Rules of Hooks. Moved `useMemo` before all conditional returns to ensure hooks are called in the same order on every render. This is the same fix pattern previously applied to ContextDetailPage.

- **Thumbnail generation for Skills and Context**: Extended thumbnail generation (previously only for Prompts) to Skills and Context documents:
  - Added `thumbnailUrl`, `thumbnailStatus`, `thumbnailError` fields to Skill and ContextDocument database models
  - Thumbnails are automatically generated when creating new Skills/Context using the Gemini image API
  - Added regenerate-thumbnail API endpoints for both asset types
  - AssetCard now displays thumbnails for all asset types
  - Skill and Context detail pages show thumbnails with regenerate button for owners/admins

- **Context detail page React hooks fix**: Fixed React Error #310 ("Rendered more hooks than during the previous render") that caused a blank page after creating a new context asset. The `useMemo` hook was being called after conditional early returns, violating React's Rules of Hooks. Moved `useMemo` before all conditional returns to ensure hooks are called in the same order on every render.

- **Profile save validation fix**: Fixed "Unable to save your profile" error that occurred when users attempted to save their profile without filling in all optional fields (region, OU, title). The server-side validation schema was requiring all fields to be non-empty, but existing users often had null values for these fields added later. Changed server validation to make `region`, `ou`, and `title` fields optional with empty string defaults. Updated client-side validation to only require name and profile photo.

- **Test fix**: Updated `useSearchState.test.tsx` to include the `status` field in expected default filters object.

### Previous Session Changes (April 17, 2026)

- **Sort option type alignment fix**: Removed `"topRated"` from all sort-related types to align with the UI which no longer offers this option:
  - `SortOption` type in `types.ts`
  - `isValidSort()` validator in `useSearchState.ts`
  - `ListPromptsFilters["sort"]` in `prompts/api.ts`
  - Sort mapping logic in `PromptsListPage.tsx`
  
  Previously, selecting "Top rated" would silently fall back to "recent" without user indication.

- **Home link navigation fix**: Clicking the "AI Library" logo in the header now properly resets the page to its default state by using `useNavigate("/")` instead of a simple Link, ensuring URL search params (like `?mine=true`) are cleared.

- **Sort option cleanup**: Removed unsupported "Top rated" sort option from SearchBar dropdown since it wasn't implemented in the backend API.

- **Unified My Content Page**: Complete redesign of the "My Content" experience with enhanced filtering and sorting capabilities.
  - **Dedicated My Content section**: Accessing `/?mine=true` now shows a full-featured content management interface with search, filters, and pagination.
  - **Status filtering**: Filter assets by status (Draft, Published, Archived) with new `showStatus` prop on SearchBar and backend support.
  - **Extended sort options**: Added "Name" (alphabetical) and "Updated At" sort options in addition to existing "Recent" and "Most Used".
  - **Unified settings link**: Settings page "Your Content" section now has a single "My Content" link instead of separate links per asset type.
  - **SearchEmptyState improvements**: Better empty state messaging for filtered vs unfiltered results with CTAs to create new assets.
  - **Pagination controls**: Full Previous/Next pagination in My Content view with page count display.
  - **API enhancements**: Assets API now supports `status` filter parameter and `name`/`updatedAt` sort options.

- **Collections API fix**: Fixed response parsing in `listCollections()` to correctly extract the data array from the API response structure.

### Previous Session Changes (April 17, 2026)

- **Smart AI Search System**: Comprehensive search overhaul with unified search bar, natural language parsing, auto-suggestions, and relevance highlighting.
  - **Unified SearchBar component**: Single search input with removable filter chips, keyboard shortcut (⌘K), debounced input (300ms), and URL state sync.
  - **Auto-suggestions dropdown**: Categorized suggestions showing matching assets and filter shortcuts with full keyboard navigation (arrow keys, Enter, Escape).
  - **Natural language query parsing**: Gemini-powered parser that converts queries like "cursor prompts for code review" into structured filters (tool: cursor, assetType: prompt, searchTerms: "code review"). Local parsing with fallback to AI for complex queries.
  - **Relevance highlighting**: Search terms highlighted in titles and summaries using `highlightMatches()` and `truncateWithHighlight()` utilities.
  - **Faceted filters**: Clickable result counts per asset type and tool displayed below search bar. Counts update dynamically with search results.
  - **SearchEmptyState component**: Helpful empty states for no results, no assets, and error conditions with clear CTAs.
  - **New API endpoints**: `GET /api/search/suggestions` (asset/filter suggestions), `GET /api/search/parse` (NL query parsing).
  - **Backend facet counts**: Assets API now returns `meta.facets` with counts by `assetType` and `tool`.

### Previous Session Changes (April 17, 2026 — earlier)

- **Unified HomePage with Asset Cards**: Refactored the homepage to display all asset types (Prompts, Skills, Context) in a unified view. New `HomePage.tsx` component with hero section, "Top Performers This Week" featured assets, "How AI Library Works" steps, tool integration cards, and optional admin leaderboards.
- **New Assets API**: Added `/api/assets` endpoint that returns unified paginated list of all asset types with filtering by type, tool, search, and sort options. Includes snapshot stats (assetsPublished, activeUsers, promptsUsed).
- **AssetCard component**: New unified card component (`AssetCard.tsx`) that renders prompts, skills, and context documents with consistent styling, actions (share, favorite, copy), and analytics display.
- **Refactored list pages**: Simplified `PromptsListPage`, `SkillListPage`, and `ContextListPage` to use dedicated card components (`PromptListCard`, `SkillListCard`, `ContextListCard`) with cleaner filter UIs.
- **Skills/Context usage tracking**: Added `logSkillUsage` and `logContextUsage` API functions for COPY event tracking from list cards.
- **Test fixes**: Updated pagination test to expect `promptsUsed` instead of `promptsViewed`, fixed collections test with `isSystem` field, updated AppShell test for new UI text, added missing mock exports to PromptEditPage test.
- **Production-only workflow rule**: Added `.cursor/rules/production-only-workflow.mdc` to enforce testing directly in production rather than local dev servers.

### Previous Session Changes (April 17, 2026)

- **Explore results hidden by default**: The prompt list cards below the "Explore AI Assets" filter section now only appear after the user applies at least one filter (search text, tag, tool, modality, or collection). This reduces visual clutter on the homepage and encourages users to actively search/filter for content.
- **Hero card icon color consistency**: Updated Prompts, Skills, and Context navigation card icons to use `text-(--color-text)` instead of `text-(--color-primary)`, matching the style of the HeroStatIcon components in the stats section below.
- **New tool options: ChatGPT and Claude Cowork**: Added `chatgpt` and `claude_cowork` to the tool options across all asset types (Prompts, Skills, Context Documents). Updated tool labels, launch provider logic, system collections, and legacy model hint mapping.
- **Usage metrics refactored to COPY/LAUNCH only**: Changed "AI Assets Viewed" metric to "AI Assets Used" — now counts only COPY and LAUNCH events, not VIEW events. This provides a more accurate measure of actual asset usage. Updated hero stats, prompt list cards, analytics overview, and OU analytics endpoints.
- **Toast notification system**: Added new `ToastProvider` context with `useToast` hook for showing success/error/info toast notifications. Integrated into app providers and used for copy confirmation feedback.
- **Copy button redesign on prompt cards**: Moved copy button from left action toolbar to right side next to launch button. Restyled with Salesforce purple (#5A1BA9) background, rounded-xl styling, and "Copy" label. Now shows toast confirmation on copy.
- **Multiple tool chips support**: Prompt cards now display chips for all selected tools instead of just the first one. Updated `toolChipsFromPrompt` to return array of labels.
- **Hero navigation cards with SVG icons**: Replaced emoji icons (📝, ⚡, 📄) with proper SVG stroke icons for Prompts, Skills, and Context cards on the homepage.
- **Context Document tools migration**: Added database migration to add `tools` column to ContextDocument table (existing rows default to empty array).
- **Test and deploy rule**: Added workspace rule for production deployment workflow including schema migration reminders.

### Previous Session Changes (April 17, 2026)

- **Improved error messages for create operations**: Updated `PromptEditorPage`, `SkillEditorPage`, and `ContextEditorPage` to display actual server error messages instead of generic "Could not create..." messages. Added `onError` handlers that log errors to console for debugging. When creation fails, users now see the real error (e.g., "Authentication required." if not logged in, or validation details if fields are invalid).

- **Mutation handler cleanup**: Converted async `onSuccess` handlers in mutation hooks to properly await `invalidateQueries` calls before navigation. Removed unnecessary `void` prefixes from `navigate()` calls in `CollectionDetailPage`, `ContextDetailPage`, `PromptDetailPage`, and `SkillDetailPage`. Fixed PromptDetailPage to navigate to `/` after deletion instead of `/prompts`.
- **Collections page loading states**: Added loading, error, and empty state handling to `CollectionsPage`. Displays "Loading collections..." during fetch, error message with refresh prompt on failure, and helpful empty state message when no collections exist.
- **Changelog page redesign**: Redesigned `ChangelogPage` to group entries by date with collapsible sections. Added chevron icons for expand/collapse, entry and change counts per date group, and improved visual hierarchy. Uses `useMemo` for efficient date grouping.

### Previous Session Changes (April 17, 2026)

- **Copy button redesign**: Moved the Copy button from the left action toolbar to the right side, placing it next to the "Use prompt" button. Updated styling to match the launch button (rounded-xl, px-4 py-2.5, text-sm font-semibold, shadow-sm) with Salesforce purple background (#5A1BA9) and added "Copy" text label for improved clarity.

- **Thumbnail regenerate button fix**: Fixed the "Regenerate me" text on failed prompt thumbnails to be an actual clickable button. Added `onRegenerate` and `isRegenerating` props to `PromptThumbnail` component. The regenerate button now appears for users with edit permissions (admins, owners, prompt authors) when thumbnail generation has failed. Calls `POST /api/prompts/:id/regenerate-thumbnail` endpoint.
- **Permanent asset deletion**: Users can now permanently delete their own created Prompts, Skills, and Context Documents. Added `ConfirmDeleteModal` component with clear warning that deletion cannot be undone and all analytics will be lost. Backend endpoints cascade-delete all related data (usage events, ratings, favorites, tags, variables, versions, collection memberships). Only the asset owner can permanently delete (not admins).
- **Delete button styling**: Added red "Delete" button to detail pages for asset owners. Archive button now uses amber/yellow styling to differentiate from the more destructive delete action.
- **New API endpoints**: `DELETE /api/prompts/:id/permanent`, `DELETE /api/skills/:id/permanent`, `DELETE /api/context/:id/permanent` for permanent asset removal with full cascade.

### Previous Session Changes (April 16, 2026)

- **Image generation config fix**: Added `responseModalities: ["IMAGE"]` to Gemini API request config in `nanoBanana.ts` to explicitly request image output, fixing thumbnail generation reliability.

- **Template variables for Skills and Context**: Extended the variable system from Prompts to Skills and Context Documents. Users can define `[KEY]` and `{{KEY}}` placeholders with labels, default values, and required flags. Added `SkillVariable` and `ContextVariable` Prisma models with full CRUD support.
- **Variable interpolation system**: Created centralized `client/src/lib/interpolate.ts` module with `interpolateBody()` function for placeholder replacement. Refactored `interpolatePrompt.ts` to use shared utility.
- **VariableEditor component**: New reusable `client/src/components/VariableEditor.tsx` for managing template variables across all asset types with add/edit/remove/insert functionality.
- **VariableInputs component**: New `client/src/components/VariableInputs.tsx` for runtime variable value entry on detail pages.
- **Skills/Context favorites**: Added `SkillFavorite` and `ContextFavorite` Prisma models with toggle endpoints (`POST /api/skills/:id/favorite`, `POST /api/context/:id/favorite`) and UI integration on detail pages.
- **Variables API endpoints**: Added `PUT /api/skills/:id/variables` and `PUT /api/context/:id/variables` for bulk variable replacement.
- **Editor pages variable support**: Updated `SkillEditorPage`, `SkillEditPage`, `ContextEditorPage`, and `ContextEditPage` to include VariableEditor with insert-to-body functionality.
- **Detail pages variable support**: Updated `SkillDetailPage` and `ContextDetailPage` to display variable inputs, interpolate body content, and show favorite toggle with count.
- **Changelog system**: Added `/changelog` route with `ChangelogPage` component displaying version history. Created `client/src/data/changelog.ts` data file with structured version entries.
- **Version bump automation**: Added `scripts/version-bump.js` for automatic patch version increment during Heroku builds. Syncs version across root, client, and server `package.json` files.
- **Footer version display**: AppShell footer now displays current app version with link to changelog page.
- **Vite environment injection**: Added `VITE_APP_VERSION` environment variable injection from `package.json` version during build.
- **Gemini model update**: Updated `nanoBanana.ts` to use `gemini-2.5-flash-image` model for thumbnail generation.
- **Help search refinements**: Minor improvements to help search service.

### Previous Session Changes (carried forward from April 16)

- **Tool Request System**: Added complete tool request submission and admin review workflow. Users can request new tools via a modal form accessible from prompt editor pages. Requests capture tool name, Salesforce approval status, details URL, and description. Admins can review, approve, decline, or put requests on hold via a dedicated admin page.
- **ToolRequest data model**: Added `ToolRequest` Prisma model with fields for submission data (name, salesforceApproved, detailsUrl, description, submitter info), review state (status, reviewedAt, reviewedById, reviewNotes), and timestamps. Added `ToolRequestStatus` enum (PENDING, APPROVED, DECLINED, ON_HOLD).
- **Tool Requests API**: New `/api/tool-requests` endpoints: `GET /approved-tools` (public, returns approved tool names), `POST /` (create request), `GET /` (admin list with filters/pagination), `PATCH /:id` (admin review).
- **Title sanitization utility**: Added `sanitizeTitle()` helper in `client/src/lib/sanitizeTitle.ts` that strips common asset type words (prompt, skill, context, rule, document, doc, file) from user-entered titles. Applied to all editor pages to prevent redundant naming like "My Prompt Prompt".
- **Asset type badges on detail pages**: Added `[Prompt]`, `[Skill]`, and `[Context]` suffix badges to detail page titles for clearer asset type identification.
- **Edit button visibility fix**: PromptDetailPage now only shows the Edit button when the current user has edit permissions (owner, admin, or content author).
- **TEAM visibility level**: Added new `TEAM` visibility option to Prompts, Skills, and Context Documents with OU-based access control.
- **Profile photo upload feature**: Added ability for users to upload custom profile photos via `POST /api/auth/me/profile-photo`.

### Earlier Session Changes

- **Settings link moved to user menu**: Moved Settings link from main navigation bar to user profile modal for cleaner navigation. Profile modal now includes Quick Links section with My Content, My Analytics, and Settings buttons.
- **Personalized hero greeting**: Homepage hero section now displays personalized greeting using user's first name. First-time visitors see "Your AI Awesomeness Starts Here, {firstName}!" and returning visitors see "Welcome Back to AI Awesomeness, {firstName}!". Uses localStorage to track first visit state. Falls back to generic "Your AI Advantage Starts Here" when user data is loading.
- **Hero navigation cards**: Added three navigation cards to homepage hero section providing quick access to Prompts, Skills, and Context sections with descriptions of each asset type and hover effects.
- **Dedicated Settings page**: Created full-page `/settings` route with organized sections for "Your Content" (My Prompts, My Skills, My Context) and "Your Analytics" (performance metrics for created assets). Migrated profile editing from modal to dedicated page UX with improved layout.
- **System Collections**: Introduced automatic tool-based and "Best of AI Library" collections. Added `systemCollections.ts` service with `ensureSystemCollections()`, `refreshToolCollection()`, `refreshBestOfCollection()`, and related utilities. Collections auto-populate with matching prompts based on tool tags or top performance metrics.
- **Collection system protections**: Added `isSystem` flag to Collection model. System collections cannot be modified or deleted by users. PATCH/DELETE endpoints now check `isSystem` and return 403 for protected collections.
- **Collections refresh endpoint**: Added `POST /api/collections/system/refresh` (admin-only) to manually trigger system collection refresh for tool-specific, best-of, or all system collections.
- **Automatic collection refresh**: Prompt create/update/delete operations now trigger async system collection refresh when status or tools change.
- **Help page AI search**: Added "Ask AI" beta feature to Help page with server-side AI-powered question answering via `/api/help/search` endpoint. Enhanced help content with "Your Content & Analytics" topic explaining Settings page features.
- **PromptListCard analytics**: Added `showAnalytics` prop to display view count, usage stats, ratings, and favorites inline when viewing "My Content" with analytics mode enabled.
- **Seed script enhancements**: Updated `seed.ts` to create system collections during database seeding via `ensureSystemCollections()`.
- **Expanded tool options**: Added "Saleo" and "Other" to `PROMPT_TOOL_OPTIONS` enum on both client and server.
- **Centralized tool labels**: Created `PROMPT_TOOL_LABELS` dictionary and utilities for human-readable tool names.
- **Tool selector UX overhaul**: Multi-select checkbox UI with conditional "Other" text input.
- **Terminology refinement**: Renamed "Modality" to "Generated output type" across UI and help documentation.
- **Markdown download button**: Added markdown export for Skills and Context detail pages.
- **Header branding refinement**: Changed header title from "SF AI Library" to "AI Library".
- **Comprehensive copy rewrite**: Salesforce voice across all user-facing content.
- **Searchable Help page**: Created `/help` route with indexed help content organized by topic.

## Audit Summary

The application has achieved **substantial completion** of the core implementation spec with significant improvements deployed in recent sessions. The original prompt-focused design has been extended to include Skills and Context Documents with enhanced usability features.

### Implementation Status Overview

| Component | Status |
|-----------|--------|
| Authentication (Google SSO, sessions, team scoping) | ✅ Complete |
| Prisma Data Model (all spec models + Skill/ContextDocument + usage events) | ✅ Complete |
| Prompt APIs (CRUD, versions, engagement, thumbnails) | ✅ Complete |
| Skills APIs (CRUD, list, search, usage tracking, ratings, collections, permanent delete) | ✅ Complete |
| Context Documents APIs (CRUD, list, search, usage tracking, ratings, collections, permanent delete) | ✅ Complete |
| Tags, Collections, Analytics APIs | ✅ Complete |
| System Collections (tool-based, best-of) | ✅ Complete |
| Frontend Routes (all spec routes + Skills/Context + Help + Settings) | ✅ Complete |
| Theme System (dark/light/system, persistence) | ✅ Complete |
| Share Functionality | ✅ Complete (Prompts, Skills, Context, Collections) |
| Analytics Dashboard UI | ✅ Complete (Top Used, Top Rated, Stale, Contributors, User Engagement, CSV Export) |
| Dedicated Settings Page | ✅ Complete (profile editing, my content, my analytics) |
| Quick-Create Actions | ✅ Complete (New Prompt/Skill/Context dropdown) |
| Skills/Context Feature Parity | ✅ Complete (ratings, collections, favorites, variables) |
| Help Documentation | ✅ Complete (searchable, indexed by topic, AI search beta) |
| Salesforce Brand Voice | ✅ Complete (individual-focused, action-oriented) |

### Identified Gaps (Prioritized)

1. **Feature Parity**: Skills/Context missing versioning and tags (lower priority).

### Remediation Roadmap (Updated)

| Phase | Description | Scope |
|-------|-------------|-------|
| 1 | Feature Parity for Skills/Context | Tags, Versioning (lower priority) |

## Technical Architecture

### Core Stack

- Backend runtime: Node.js 20+
- Backend framework: Express `^5.2.1`
- Backend language: TypeScript `^5.9.3`
- Validation: Zod `^4.3.6`
- Database/ORM: PostgreSQL + Prisma (`@prisma/client` `^6.19.3`, `prisma` `^6.19.3`)
- Session/auth infra: `express-session` `^1.19.0`, `connect-pg-simple` `^10.0.0`, `jose` `^6.2.2`
- Data/HTTP utilities: `pg` `^8.20.0`, `cors` `^2.8.6`, `cookie-parser` `^1.4.7`, `multer` `^2.1.1`
- Frontend framework: React `^19.2.4`
- Frontend tooling: Vite `^8.0.1`, TypeScript `~5.9.3`, Tailwind CSS `^4.2.2`
- Frontend data/routing: TanStack Query `^5.95.2`, React Router DOM `^7.13.2`, Axios `^1.14.0`
- Test stack: Vitest (server `^4.1.2`, client `^3.2.4`), Supertest `^7.2.2`, Testing Library/JSDOM

### Runtime and System Requirements

- Node.js 20+
- npm 9+
- PostgreSQL (local or Heroku Postgres)
- Heroku CLI (deploy + operational commands)
- Google OAuth credentials for login
- Google Generative Language API key for thumbnail generation

### Third-Party APIs / Webhooks

- Google OAuth 2.0 / OIDC
  - Role: authenticate users and mint/verify session identity
  - Implementation: `server/src/routes/auth.ts`
- Google JWKS endpoint (`https://www.googleapis.com/oauth2/v3/certs`)
  - Role: verify Google ID token signatures
  - Implementation: `server/src/routes/auth.ts`
- Google Generative Language API (`https://generativelanguage.googleapis.com`)
  - Role: generate prompt card thumbnails via model `gemini-2.5-flash-image`
  - Implementation: `server/src/services/nanoBanana.ts`, `server/src/routes/prompts.ts`
- Heroku + Heroku Postgres
  - Role: runtime hosting + managed relational datastore
  - Implementation references: `Procfile`, `app.json`, `server/prisma/schema.prisma`
- GitHub Actions CI
  - Role: branch and PR quality checks
  - Implementation: `.github/workflows/ci.yml`

## Project Blueprint

### Directory Layout (commented)

```text
.
├── client/                                     # React + Vite frontend
│   ├── public/                                 # Vite static assets (salesforce-logo.png, favicon.ico)
│   ├── src/
│   │   ├── app/
│   │   │   ├── providers/ThemeProvider.tsx    # Theme state + persisted/system mode bootstrap
│   │   │   ├── router.tsx                      # Authenticated route graph
│   │   │   └── analytics.ts                    # GA4 page view tracking
│   │   ├── assets/                             # Bundled static assets
│   │   ├── components/                         # Shared UI shell/chrome (AppShell, ProtectedRoute, AdminRoute)
│   │   ├── features/
│   │   │   ├── prompts/                        # Discovery/detail/create/edit, cards, filters, interpolation, external launch, share, ToolRequestModal
│   │   │   ├── skills/                         # Skill list/detail/create/edit (markdown body, copy, share, usage tracking)
│   │   │   ├── context/                        # Context (markdown) list/detail/create/edit (copy, share, usage tracking)
│   │   │   ├── builds/                         # Build list/detail/create/edit (buildUrl, supportUrl, share, usage tracking)
│   │   │   ├── search/                         # Smart AI search (SearchBar, FilterChip, SearchSuggestions, FacetedFilters, SearchEmptyState, useSearchState hook, highlight utils)
│   │   │   ├── analytics/                      # Admin analytics dashboard (top used/rated, contributors, user engagement)
│   │   │   ├── collections/                    # Collection CRUD + membership surfaces + share
│   │   │   ├── admin/                          # Admin pages: ToolRequestsPage for tool submission review
│   │   │   ├── help/                           # Searchable help documentation (HelpPage.tsx)
│   │   │   └── auth/                           # OAuth entry + role helpers (LoginPage, api, roles)
│   │   ├── pages/                              # Static pages (TermsPage, PrivacyPage)
│   │   ├── styles/                             # Design tokens + theme semantics
│   │   └── main.tsx                            # Bootstrap + providers
├── server/                                     # Express + Prisma backend
│   ├── prisma/
│   │   ├── schema.prisma                       # Canonical data model (33 models, 10 enums)
│   │   ├── migrations/                         # Applied schema migrations
│   │   └── seed.ts                             # Demo data generation/reset
│   ├── src/
│   │   ├── app.ts                              # Middleware + routes + SPA static hosting
│   │   ├── index.ts                            # Server entry point
│   │   ├── config/env.ts                       # Environment validation
│   │   ├── lib/                                # prisma singleton, auth helpers
│   │   ├── middleware/                         # auth, errorHandler
│   │   ├── routes/
│   │   │   ├── prompts.ts                      # Prompt CRUD/search/rating/usage/favorites/thumbnail orchestration
│   │   │   ├── skills.ts                       # Skill CRUD + list search + usage tracking (team-scoped)
│   │   │   ├── context.ts                      # Context document CRUD + list search + usage tracking (team-scoped)
│   │   │   ├── builds.ts                       # Build CRUD + favorites + ratings + usage + collections (team-scoped)
│   │   │   ├── search.ts                       # Smart search: suggestions endpoint and NL query parsing
│   │   │   ├── analytics.ts                    # Top-used/stale/contributors/user-engagement scoreboard
│   │   │   ├── collections.ts                  # Collection operations
│   │   │   ├── tags.ts                         # Tag management
│   │   │   ├── help.ts                         # Help search endpoint
│   │   │   ├── toolRequests.ts                 # Tool request submission and admin review
│   │   │   └── auth.ts                         # Google OAuth + session lifecycle
│   │   ├── services/
│   │   │   ├── nanoBanana.ts                   # Image generation adapter (Gemini API)
│   │   │   ├── thumbnailRetry.ts               # Background service for retrying stuck thumbnail generation
│   │   │   ├── helpSearch.ts                   # Help content search service
│   │   │   ├── searchParser.ts                 # Natural language query parsing (Gemini + local heuristics)
│   │   │   └── email.ts                        # Tool request email notifications
│   │   ├── lib/
│   │   │   ├── prisma.ts                       # Prisma singleton client
│   │   │   ├── auth.ts                         # Session/token helpers
│   │   │   └── email.ts                        # Nodemailer SMTP email client
│   └── test/                                   # API behavior tests
├── Procfile                                    # Heroku process model
├── app.json                                    # Heroku app metadata/env scaffolding
├── README.md                                   # Setup and runbook
└── summary.md                                  # This technical summary
```

### Prisma Data Model Summary

**Models (35):**
- `User` - with `avatarUrl`, `region`, `ou`, `title`, `onboardingCompleted`, `googleSub`, `apiKeys[]`
- `ApiKey` - secure API key storage with SHA-256 hash, expiration, scopes, and revocation tracking
- `Team` - multi-tenant team container
- `Prompt` - with `tools[]`, `modality`, `thumbnailUrl`, `thumbnailStatus`, `thumbnailError`, `isSmartPick`, `titleNormalized`, `bodyHash` (dedup fields)
- `Build` - pre-built solutions with `buildUrl`, `supportUrl`, `buildUrlNormalized` (dedup), thumbnails, and engagement tracking
- `BuildVersion` - version history for builds with title, summary, buildUrl, supportUrl, changelog
- `PromptVersion` - version history for prompts
- `PromptVariable` - dynamic variable definitions for prompts
- `Skill` - URL-based skill documents with `skillUrl`, `supportUrl`, `skillUrlNormalized` (dedup) (team-scoped)
- `SkillFavorite` - user favorites for skills
- `SkillRating` - user ratings for skills (1-5 stars)
- `SkillUsageEvent` - VIEW/COPY/SHARE tracking (skills)
- `ContextDocument` - markdown context files with `titleNormalized`, `bodyHash` (dedup) (team-scoped)
- `ContextVariable` - dynamic variable definitions for context documents
- `ContextFavorite` - user favorites for context documents
- `ContextRating` - user ratings for context documents (1-5 stars)
- `ContextUsageEvent` - VIEW/COPY/SHARE tracking (context documents)
- `Tag`, `PromptTag` - tagging system (prompts only currently)
- `BuildFavorite`, `BuildUsageEvent`, `BuildRating` - user engagement for builds
- `Collection`, `CollectionPrompt`, `CollectionSkill`, `CollectionContext`, `CollectionBuild`, `CollectionUser` - curated collections for all asset types with `isSystem` flag for protected system collections and user membership
- `Favorite`, `Rating` - user engagement (prompts)
- `UsageEvent` - VIEW/COPY/LAUNCH tracking (prompts)
- `ToolRequest` - tool submission requests with review workflow

**Enums (10):** `Role`, `PromptVisibility` (PUBLIC, TEAM, PRIVATE), `PromptStatus`, `UsageAction`, `PromptModality`, `ThumbnailStatus`, `SkillUsageAction`, `ContextUsageAction`, `ToolRequestStatus`, `BuildUsageAction`

### Primary Data Flow / Lifecycle

1. Frontend mounts providers and requests `/api/*` resources through Axios.
2. Express applies session + auth middleware, derives user/team context, and scopes database access by `teamId`.
3. Routes validate request payloads/query params via Zod and execute Prisma queries.
4. Prompt engagement writes (usage/favorites/ratings) persist in relational tables.
5. Analytics route composes aggregates and rankings:
   - prompt performance (`topUsedAssets`, `topRatedPrompts`, `stalePrompts`)
   - contributor output (`contributors`)
   - user engagement score leaderboard (`userEngagementLeaderboard`)
6. Prompt thumbnail generation executes async image generation and stores data URI/file URI in `Prompt.thumbnailUrl`.
7. Heroku deploy flow builds frontend, compiles server, serves SPA static assets from Express.

### API Routes Inventory

| Route File | Endpoints |
|------------|-----------|
| `auth.ts` | `GET /google`, `GET /google/callback`, `POST /logout`, `GET /me`, `PATCH /me`, `POST /me/profile-photo` |
| `apiKeys.ts` | `GET /api-keys`, `POST /api-keys`, `DELETE /api-keys/:id` |
| `v1/index.ts` | `POST /v1/prompts`, `POST /v1/skills`, `POST /v1/context`, `POST /v1/builds`, `GET /v1/me` (API key auth only) |
| `assets.ts` | `GET /` (unified asset listing with type/tool/status/search filters, sort options, pagination, and facet counts) |
| `search.ts` | `GET /suggestions` (asset/filter suggestions), `GET /parse` (natural language query parsing via Gemini) |
| `prompts.ts` | Full CRUD, `DELETE /:id/permanent`, `/versions`, `/restore/:version`, `/favorite`, `/rating`, `/usage`, `/regenerate-thumbnail` |
| `skills.ts` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `DELETE /:id/permanent`, `POST /:id/usage`, `POST /:id/favorite`, `POST /:id/rating`, `POST /:id/collections/:collectionId`, `DELETE /:id/collections/:collectionId` |
| `context.ts` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `DELETE /:id/permanent`, `POST /:id/usage`, `POST /:id/favorite`, `POST /:id/rating`, `PUT /:id/variables`, `POST /:id/collections/:collectionId`, `DELETE /:id/collections/:collectionId` |
| `builds.ts` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` (archive), `DELETE /:id/permanent`, `POST /:id/usage`, `POST /:id/favorite`, `POST /:id/rating`, `POST /:id/regenerate-thumbnail`, `POST /:id/collections/:collectionId`, `DELETE /:id/collections/:collectionId` |
| `collections.ts` | CRUD + `/prompts/:promptId` membership + `/users/:userId` membership + `POST /system/refresh` (admin-only system collection refresh) |
| `tags.ts` | `GET /`, `POST /` |
| `analytics.ts` | `GET /overview` (team-scoped aggregates) |
| `help.ts` | `POST /search` (AI-powered help search) |
| `toolRequests.ts` | `GET /approved-tools`, `POST /`, `GET /` (admin), `PATCH /:id` (admin review) |

### Frontend Routes Inventory

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | `LoginPage` | Public |
| `/terms` | `TermsPage` | Public |
| `/privacy` | `PrivacyPage` | Public |
| `/help` | `HelpPage` | Public |
| `/` | `HomePage` | Protected |
| `/prompts` | `PromptsListPage` | Protected |
| `/prompts/new` | `PromptEditorPage` | Protected |
| `/prompts/:id` | `PromptDetailPage` | Protected |
| `/prompts/:id/edit` | `PromptEditPage` | Protected |
| `/skills` | `SkillListPage` | Protected |
| `/skills/new` | `SkillEditorPage` | Protected |
| `/skills/:id` | `SkillDetailPage` | Protected |
| `/skills/:id/edit` | `SkillEditPage` | Protected |
| `/context` | `ContextListPage` | Protected |
| `/context/new` | `ContextEditorPage` | Protected |
| `/context/:id` | `ContextDetailPage` | Protected |
| `/context/:id/edit` | `ContextEditPage` | Protected |
| `/builds` | `BuildListPage` | Protected |
| `/builds/new` | `BuildEditorPage` | Writer only |
| `/builds/:id` | `BuildDetailPage` | Protected |
| `/builds/:id/edit` | `BuildEditPage` | Writer only |
| `/collections` | `CollectionsPage` | Protected |
| `/collections/:id` | `CollectionDetailPage` | Protected |
| `/analytics` | `AnalyticsPage` | Admin only |
| `/admin/tool-requests` | `ToolRequestsPage` | Admin only |
| `/settings` | `SettingsPage` | Protected |
| `/changelog` | `ChangelogPage` | Protected |

### Major Modules and Why They Exist

- `server/src/routes/prompts.ts`: primary prompt API with filtering, sorting, pagination, CRUD, versions, and engagement.
- `server/src/routes/skills.ts`: URL-based skill CRUD with team scoping, search, archive (soft delete), and usage tracking. Skills now use `skillUrl` and `supportUrl` instead of text body.
- `server/src/routes/context.ts`: context document CRUD with team scoping, search, archive, and usage tracking.
- `server/src/routes/builds.ts`: build CRUD with team scoping, visibility control, favorites, ratings, usage events, collection membership, and thumbnail generation.
- `server/src/routes/search.ts`: smart search API with asset/filter suggestions and natural language query parsing.
- `server/src/routes/analytics.ts`: consolidated overview payload consumed by homepage dashboards and leaderboards.
- `server/src/routes/help.ts`: help content search endpoint for the searchable help page.
- `server/src/services/nanoBanana.ts`: external image-generation bridge for prompt thumbnails via Gemini API.
- `server/src/services/thumbnailRetry.ts`: background service that retries stuck thumbnail generation every 5 minutes. Items in PENDING for >2 minutes are retried or marked FAILED.
- `server/src/services/helpSearch.ts`: help content search service with AI-powered question answering.
- `server/src/services/searchParser.ts`: natural language search query parser using Gemini with local heuristic fallback.
- `server/src/services/systemCollections.ts`: automatic tool-based and "Best of AI Library" collection management. Includes ChatGPT and Claude Cowork collections.
- `server/src/services/dedup.ts`: asset deduplication service with fuzzy title matching (Levenshtein), content hashing (SHA-256), and URL normalization. Prevents duplicate asset creation across all types.
- `client/src/app/providers/ToastProvider.tsx`: toast notification context and UI for success/error/info feedback.
- `server/prisma/schema.prisma`: source of truth for users/teams/prompts/skills/context/engagement relations and enums.
- `client/src/features/home/HomePage.tsx`: unified homepage with hero section, featured assets, tool integration cards, and admin leaderboards.
- `client/src/features/assets/AssetCard.tsx`: unified card component for rendering prompts, skills, and context with consistent actions and relevance highlighting.
- `client/src/features/assets/api.ts`: unified assets API client for fetching all asset types with filtering, pagination, and facet counts.
- `client/src/features/assets/AssetListView.tsx`: compact table view for browsing owned assets with name, status, and edit links.
- `client/src/components/AssetCollectionMenu.tsx`: reusable dropdown menu for adding/removing any asset type to/from collections.
- `server/src/routes/assets.ts`: unified assets API endpoint returning paginated list of all asset types with facet counts.
- `client/src/features/search/components/SearchBar.tsx`: unified search input with filter chips, keyboard shortcuts, and NL query submission.
- `client/src/features/search/components/FilterChip.tsx`: removable filter chip UI component.
- `client/src/features/search/components/SearchSuggestions.tsx`: auto-suggestions dropdown with keyboard navigation.
- `client/src/features/search/components/FacetedFilters.tsx`: clickable filter buttons showing result counts by type/tool.
- `client/src/features/search/components/SearchEmptyState.tsx`: helpful empty states for no results, no assets, and errors.
- `client/src/features/search/hooks/useSearchState.ts`: search state management hook with URL sync, debouncing, and NL parsing.
- `client/src/features/search/hooks/useSearchSuggestions.ts`: React Query hook for fetching search suggestions.
- `client/src/features/search/utils/highlight.tsx`: `highlightMatches()` and `truncateWithHighlight()` for relevance highlighting.
- `client/src/features/search/api.ts`: search API client for suggestions and NL query parsing.
- `client/src/features/prompts/PromptsListPage.tsx`: prompts-only list page with filters and PromptListCard components.
- `client/src/features/prompts/PromptDetailPage.tsx`: full prompt view with engagement chrome, variables/preview, versions, and external launch.
- `client/src/features/prompts/sharePrompt.ts`: Web Share API integration for prompt sharing.
- `client/src/lib/shareOrCopyLink.ts`: generic share utility used by Skills, Context, and Collections.
- `client/src/components/AppShell.tsx`: page chrome with navigation, theme toggle, footer with Help link and version display.
- `client/src/components/VariableEditor.tsx`: reusable component for defining template variables with key, label, default value, required flag.
- `client/src/components/VariableInputs.tsx`: runtime variable value entry component for detail pages.
- `client/src/lib/interpolate.ts`: centralized template variable interpolation logic for `[KEY]` and `{{KEY}}` placeholders.
- `client/src/data/changelog.ts`: structured changelog data for version history display.
- `client/src/pages/ChangelogPage.tsx`: version history display page with formatted entries.
- `scripts/version-bump.js`: automatic patch version increment script for Heroku builds.
- `client/src/components/AdminRoute.tsx`: redirects non-admin users away from admin-only routes (e.g. analytics).
- `client/src/components/MarkdownPreview.tsx`: reusable markdown rendering component using `react-markdown`.
- `client/src/features/prompts/interpolatePrompt.ts` / `launchProviders.ts`: client-side prompt variable fill-in and deep links to external chat products.
- `client/src/features/prompts/PromptThumbnail.tsx`: thumbnail rendering with graceful placeholder states and clickable regenerate button for failed thumbnails.
- `client/src/components/ConfirmDeleteModal.tsx`: reusable confirmation dialog for permanent asset deletion with warning messaging.
- `client/src/components/PublishStatusModal.tsx`: modal dialog for new asset creation prompting user to choose Draft or Published status with card-style options.
- `client/src/components/DuplicateWarningModal.tsx`: modal displaying detected duplicate assets when creation/update would result in a duplicate, with match type badges and links to existing assets.
- `client/src/features/analytics/AnalyticsPage.tsx`: admin dashboard with top used, top rated, stale prompts, contributors, and user engagement leaderboards.
- `client/src/features/analytics/api.ts`: strict typed contract for analytics payload shape.
- `client/src/features/help/HelpPage.tsx`: searchable help documentation with topic index sidebar and AI search beta feature.
- `client/src/features/settings/SettingsPage.tsx`: dedicated settings page with profile editing, my content links, and my analytics links.
- `client/src/features/skills/SkillDetailPage.tsx`: skill detail view with copy button, markdown preview toggle, and share.
- `client/src/features/context/ContextDetailPage.tsx`: context detail view with copy button, markdown preview toggle, and share.
- `client/src/features/builds/BuildListPage.tsx`: build list page with search, status filters, and pagination.
- `client/src/features/builds/BuildDetailPage.tsx`: build detail view with engagement actions (favorite, rate, share).
- `client/src/features/builds/BuildEditorPage.tsx`: create new build form with URL inputs.
- `client/src/features/builds/BuildEditPage.tsx`: edit existing build form.
- `client/src/features/builds/BuildListCard.tsx`: build card component for list display.
- `client/src/features/builds/api.ts`: builds API client with CRUD, favorites, ratings, and collection operations.
- `client/src/features/admin/ToolRequestsPage.tsx`: admin page for reviewing tool submission requests with status filtering and review modal.
- `client/src/features/prompts/ToolRequestModal.tsx`: modal form for submitting new tool requests with validation.
- `server/src/routes/toolRequests.ts`: tool request submission and admin review API endpoints.
- `server/src/lib/email.ts`: nodemailer-based email service with SMTP configuration.
- `server/src/services/email.ts`: tool request notification email templates.

## Replication and Setup

### 1) Install dependencies

```bash
npm --prefix client install
npm --prefix server install
```

### 2) Configure environment

Create `server/.env`:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/promptlibrary
CORS_ORIGIN=http://localhost:5173
APP_BASE_URL=http://localhost:5173
SESSION_SECRET=<long-random-secret>
COOKIE_SECURE=false
SESSION_SAME_SITE=lax
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
GOOGLE_ALLOWED_DOMAIN=salesforce.com
BOOTSTRAP_ADMIN_EMAILS=admin1@example.com,admin2@example.com
NANO_BANANA_API_KEY=<google-generative-language-api-key>
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=60
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=<mailgun-smtp-user>
SMTP_PASS=<mailgun-smtp-password>
SMTP_FROM=noreply@yourdomain.com
TOOL_REQUEST_NOTIFY_EMAIL=admin@example.com
```

Optional `client/.env`:

```env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3) Database migration + seed

```bash
npm --prefix server run prisma:migrate -- --name init
npm --prefix server run prisma:generate
npm --prefix server run prisma:seed
```

Reset/reseed:

```bash
SEED_RESET=true npm --prefix server run prisma:seed
```

### 4) Run locally

```bash
npm --prefix server run dev
npm --prefix client run dev
```

### 5) Validate

```bash
npm --prefix server test
npm --prefix server run build
npm --prefix client run build
```

### 6) Deploy

```bash
git push heroku main
```

## Maintenance Mode

### TODO/FIXME Scan

- Repository scan for `TODO|FIXME` in `*.{ts,tsx,js,jsx}` completed (April 24, 2026): no matches in application source.
- Workspace automation rules may still mention `TODO|FIXME` as documentation; that is non-runtime.

### Roadmap / Backlog

**Remaining Feature Work:**

1. **Feature Parity for Skills/Context** — Tags (SkillTag/ContextTag models, endpoints, picker UI, filter chips); Versioning (lower priority). Ratings, Favorites, Variables, and Collections are now complete.

2. **Analytics Enhancements** — Add time-range selector; add skill/context usage stats to overview.

**Completed in Recent Sessions:**

- ✅ Smart AI Search — Unified search bar with NL parsing (Gemini), auto-suggestions, filter chips, relevance highlighting, faceted counts, and empty states. New `/api/search/suggestions` and `/api/search/parse` endpoints.
- ✅ Template Variables for Skills/Context — Extended variable system with SkillVariable/ContextVariable models, editor UI, and interpolation.
- ✅ Skills/Context Favorites — Added SkillFavorite/ContextFavorite models with toggle endpoints and UI.
- ✅ Changelog System — Version history display with automatic version bump during deploys.
- ✅ Dedicated Settings Page — Full-page `/settings` route with profile editing, my content, and my analytics.
- ✅ Quick-Create Actions — Dropdown menu with "New Prompt", "New Skill", "New Context" options.
- ✅ System Collections — Automatic tool-based and "Best of AI Library" collections with protection.
- ✅ Help Page AI Search — Beta AI-powered question answering for help content.
- ✅ Sharing Feature Expansion — Created generic `shareOrCopyLink.ts` utility; added share to Skills, Context, Collections.
- ✅ Analytics Dashboard Enhancement — Added Top Rated, Contributors, User Engagement leaderboards.
- ✅ Content Copy & Markdown Preview — Added copy buttons, `react-markdown` preview, usage tracking.
- ✅ Comprehensive Copy Rewrite — Salesforce voice, individual-focused, action-oriented.
- ✅ Help Page — Searchable, indexed help documentation.

**Technical Debt:**

- ~~Add retry guardrails for thumbnail backfill jobs to avoid repeated processing on persistent provider errors.~~ ✅ Completed — Added `thumbnailRetry.ts` background service.
- Add provider capability check/health endpoint for image model compatibility before runtime generation attempts.
- Expand end-to-end tests for homepage leaderboards to validate user-engagement score ranking behavior.
- Add API contract tests for analytics response shape changes (`userEngagementLeaderboard`) to prevent frontend drift.
- Add structured observability around external image generation failures and recovery paths.
- Tune prompt/engagement indexes for larger production datasets and leaderboard query efficiency.
