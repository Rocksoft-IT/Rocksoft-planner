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
| `search_experts` | Rank people by a free-text brief and/or explicit skill/tech slugs. Returns matched competencies + experience per person, capped at `limit` (default 10). | `POST /api/search/experts` |
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

**How they reach the process.** Unlike the Next.js app — which gets `.env.local`
loading for free from Next itself — this is a plain Node process, so nothing is
loaded implicitly. In practice:

- **Registered with an MCP client** (the normal case): the client passes them from
  its own `env` block. No `.env` is involved.
- **Standalone `npm start`**: the script runs Node with `--env-file-if-exists=.env`,
  so `cp .env.example .env` works. Inline vars still work too, and a missing `.env`
  is not an error (Node just notes it on stderr).
- `.env` is gitignored. Never commit a real `COMPETENCY_API_KEY`.

## Install & build

Requires Node ≥ 20.12 — for `--env-file-if-exists` in `npm start`, and because the
MCP SDK's dependency tree declares `node >= 20`. (The stdio path itself runs on 18,
but `npm install` will warn.)

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
- Keep `COMPETENCY_API_KEY` out of source control — see **Configuration** above.
- Ranking is deliberately permissive: the RPC ORs every word of the brief, so filler
  words match too. `search_experts` therefore returns the top `limit` rows (default 10)
  and reports the true total as `count`, with `truncated: true` when it trimmed. The
  API also uses only the first 2000 characters of a brief — summarize long ones.
- Requests time out after 30s and surface the underlying network error (e.g.
  `ENOTFOUND`), which is usually a wrong `COMPETENCY_API_BASE_URL`.
