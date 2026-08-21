# RS Planner — Competency MCP server

An [MCP](https://modelcontextprotocol.io) server that exposes the RS Planner
**employee competency base** to LLM agents (Claude Desktop, Claude Code, or any
MCP client). Hand a model a pasted project brief and it can find the best-matching
experts in the organization.

It is a **thin, stateless client** over the public competency API
([`docs/competency-api.md`](../../docs/competency-api.md)) — it does no reasoning
and embeds no model. It only retrieves and ranks; the calling LLM does the
matching. The API contract it depends on is frozen with PR 1.

## Tools

| Tool | What it does | Backing endpoint |
|---|---|---|
| `search_experts` | Rank people by a free-text brief and/or explicit skill/tech slugs. Returns matched competencies + experience per person. | `POST /api/search/experts` |
| `get_employee_competencies` | Full detail for one employee (skills, proficiency, years, project experience). | `GET /api/employees/:id/competencies` |
| `list_competencies` | Enumerate the skill/technology catalog to discover valid slugs. | `GET /api/competencies` |

Typical flow: an agent calls `search_experts({ description: "<pasted brief>" })`,
then `get_employee_competencies` on the top hits to justify a recommendation.
`list_competencies` is for discovering exact slugs when filtering explicitly.

## Configuration

Two environment variables (see [`.env.example`](.env.example)):

| Var | Meaning |
|---|---|
| `COMPETENCY_API_BASE_URL` | Base URL of the deployed RS Planner app — **no** trailing slash, **no** `/api` (the server appends `/api/...`). |
| `COMPETENCY_API_KEY` | One of the keys in the server's `COMPETENCY_API_KEYS`. |

## Install & build

Requires Node ≥ 18 (uses the built-in `fetch`).

```bash
cd mcp/competency
npm install
npm run build   # compiles src/ → dist/
```

Run it standalone (it speaks MCP over stdio; a ready line goes to stderr):

```bash
COMPETENCY_API_BASE_URL=https://planner.example.com \
COMPETENCY_API_KEY=your-key \
npm start
```

## Register with an MCP client

### Claude Desktop

Add to `claude_desktop_config.json`
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "rockplanner-competency": {
      "command": "node",
      "args": ["/absolute/path/to/rocksoft-planner/mcp/competency/dist/index.js"],
      "env": {
        "COMPETENCY_API_BASE_URL": "https://planner.example.com",
        "COMPETENCY_API_KEY": "your-key"
      }
    }
  }
}
```

Restart Claude Desktop; the three tools appear under this server.

### Claude Code

```bash
claude mcp add rockplanner-competency \
  --env COMPETENCY_API_BASE_URL=https://planner.example.com \
  --env COMPETENCY_API_KEY=your-key \
  -- node /absolute/path/to/rocksoft-planner/mcp/competency/dist/index.js
```

(Build first so `dist/index.js` exists.)

## Notes

- **Read-only.** Writes to the competency base happen through the web UI (self-service).
- The server needs the RS Planner deployment (PR 1) to be **live with the API env
  vars set** — until then calls return `401`/`503` from the API. See the change's
  `plan.md` for the deploy prerequisites.
- Keep `COMPETENCY_API_KEY` out of source control — pass it via the client's `env`
  block or a local `.env`.
