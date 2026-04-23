# AI Library MCP Server

An MCP (Model Context Protocol) server that allows you to add prompts, skills, context documents, and builds to the AI Library from any MCP-compatible tool like Cursor.

## Installation

```bash
npm install @ailibrary/mcp-server
```

Or run directly with npx:

```bash
npx @ailibrary/mcp-server
```

## Configuration

### Environment Variables

- `AI_LIBRARY_API_KEY` (required): Your AI Library API key. Generate one from your Settings page.
- `AI_LIBRARY_BASE_URL` (optional): The base URL of your AI Library instance. Defaults to `https://ailibrary.example.com`.

### Cursor Configuration

Add to your Cursor MCP config (`~/.cursor/mcp.json` or project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "ai-library": {
      "command": "npx",
      "args": ["@ailibrary/mcp-server"],
      "env": {
        "AI_LIBRARY_API_KEY": "alib_your_api_key_here",
        "AI_LIBRARY_BASE_URL": "https://your-ailibrary-instance.com"
      }
    }
  }
}
```

## Available Tools

### `add_prompt`

Add a prompt to the AI Library.

**Parameters:**
- `title` (required): The title of the prompt
- `body` (required): The prompt content/template
- `summary`: Brief description of what the prompt does
- `tools`: Array of tools this works with (e.g., `["cursor", "chatgpt"]`)
- `modality`: Type of content (`text`, `code`, `image`, `video`, `audio`, `multimodal`)
- `visibility`: Who can see this (`PUBLIC`, `TEAM`, `PRIVATE`)
- `publish`: Publish immediately (true) or save as draft (false)

**Example usage in Cursor:**
> "MeshMesh, add this prompt to the AI Library"

Now you can say "MeshMesh, add this [prompt/skill/context/build] to the AI Library" and it will work!

### `add_skill`

Add a skill package to the AI Library.

**Parameters:**
- `title` (required): The title of the skill
- `skillUrl` (required): URL to the skill archive (.zip, .tar.gz, etc.)
- `summary`: Brief description
- `supportUrl`: URL for support/documentation
- `tools`: Array of tools this works with
- `visibility`: Who can see this
- `publish`: Publish immediately or draft

### `add_context`

Add a context document to the AI Library.

**Parameters:**
- `title` (required): The title
- `body` (required): The content
- `summary`: Brief description
- `tools`: Array of tools
- `visibility`: Who can see this
- `publish`: Publish immediately or draft

### `add_build`

Add a build/application link to the AI Library.

**Parameters:**
- `title` (required): The title
- `buildUrl` (required): URL to the build/application
- `summary`: Brief description
- `supportUrl`: URL for support/documentation
- `visibility`: Who can see this
- `publish`: Publish immediately or draft

### `whoami`

Get information about the authenticated user.

## Example Conversations

**Adding a prompt:**
```
User: Add this prompt to the AI Library as "React Component Generator"

Agent: [uses add_prompt tool]
Successfully added prompt "React Component Generator" to the AI Library!

ID: 123
Status: DRAFT
URL: https://ailibrary.example.com/prompts/123
```

**Adding a skill:**
```
User: Add my new skill package to the library. It's at https://github.com/user/skill/releases/download/v1/skill.zip

Agent: [uses add_skill tool]
Successfully added skill to the AI Library!
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev
```

## License

MIT
