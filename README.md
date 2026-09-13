# ORCHESTRA — Outcome Operating System

> **Most AI productivity tools generate work. ORCHESTRA simulates work.**

ORCHESTRA observes the systems where work already happens — **GitHub, Jira, Slack and Calendar** — and turns that evidence into a live **Digital Twin** of the organization.

The user does not maintain another project plan. ORCHESTRA continuously reconstructs:

`Intent → Outcomes → Work → People → Dependencies → Evidence`

Then the user can ask:

> “What happens if we lose 20% engineering capacity but cannot move the deadline?”

IBM Granite interprets the request. ORCHESTRA mutates the Digital Twin, runs a deterministic counterfactual simulation, asks the Decision Agent to explain the trade-off, and waits for human approval before anything is written back.

## Why this is a strong Wildcard demo

The demo shows a complete loop:

**Observe → Build Twin → Detect Risk → Simulate → Explain → Approve**

This changes the product category from an AI task generator into a decision-intelligence layer over existing enterprise work systems.

## Architecture

```text
 GitHub ─┐
 Jira ───┼──> Source Adapters ──> Evidence Normalizer
 Slack ──┤                             │
 Calendar┘                             ▼
                              Outcome Graph / Digital Twin
                                         │
                    ┌────────────────────┼───────────────────┐
                    ▼                    ▼                   ▼
               Risk Agent          Resource Agent       Planner Agent
                    └────────────────────┼───────────────────┘
                                         ▼
                              Counterfactual Engine
                                         │
                                         ▼
                                  Decision Agent
                                         │
                                         ▼
                                   Human Approval
                                         │
                                         ▼
                                   Audit / Write-back

                        IBM Granite = interpretation + explanation
                        Deterministic engine = reproducible numbers
```

## IBM Granite

Live mode uses `ibm/granite-4-h-small` through watsonx.ai. Granite is used for:

1. natural-language what-if interpretation;
2. evidence-grounded project summary;
3. executive decision explanation.

The numerical simulation remains deterministic so a judge can reproduce the same scenario outcome.

## Real source connectors

The server contains production-shaped REST adapters:

- **GitHub** — repository commits, pull requests and open issues. Public repositories can work without a token; private repositories use `GITHUB_TOKEN`.
- **Jira Cloud** — recent project issues using Jira REST API with email + API token.
- **Slack** — workspace message search using a bot token.
- **Google Calendar** — primary calendar events using an OAuth access token.

If a source is not configured, ORCHESTRA automatically falls back to its demo evidence set. The UI labels each source **LIVE** or **DEMO**, so the demo remains deterministic while the same code path supports real enterprise data.

## Environment

Copy `.env.example` to `.env` and fill only the credentials available to you.

```bash
npm install
npm run dev
```

Open the Vite URL shown by the terminal. The frontend proxies `/api` to the ORCHESTRA server on port `8787`.

### Watsonx

```text
WATSONX_API_KEY=
WATSONX_PROJECT_ID=
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_API_VERSION=2025-10-25
WATSONX_MODEL_ID=ibm/granite-4-h-small
```

### GitHub

```text
GITHUB_REPO=owner/repository
GITHUB_TOKEN=
```

### Jira

```text
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_PROJECT_KEY=PROJ
JIRA_EMAIL=
JIRA_API_TOKEN=
```

### Slack

```text
SLACK_BOT_TOKEN=
```

### Calendar

```text
GOOGLE_CALENDAR_ACCESS_TOKEN=
```

**Never commit `.env` or credentials.**

## API

`GET /api/health` — runtime status, Granite configuration, source mode.

`GET /api/twin` — current Digital Twin.

`POST /api/sync` — pull all configured sources and rebuild the twin.

`POST /api/what-if` — interpret and simulate a natural-language counterfactual.

## IBM Bob integration

The repository includes Bob-native project assets under `.bob/`:

- custom modes for architecture and implementation;
- Orchestrator, Risk, Resource and Decision agent instructions;
- reusable `outcome-observability` and `counterfactual-simulation` skills;
- an MCP example configuration.

The intended Bob workflow is:

**Plan** → inspect architecture and source adapters → **Agent** → implement/test → **Ask** → review evidence and changes.

The `.bob/` assets are deliberately versioned with the project so the development workflow is reproducible for the team.

## Challenge fit

- **AI is core:** Granite interprets natural language and generates evidence-grounded explanations.
- **Technical execution:** four real enterprise source adapters, normalized Digital Twin, deterministic simulation, auditable decision layer.
- **Innovation:** counterfactual decision simulation over an organizational graph.
- **Feasibility:** starts read-only, falls back safely, and adds write-back only after approval.
- **IBM Bob:** the repo contains Bob modes, agents, skills and MCP configuration for the development workflow.
