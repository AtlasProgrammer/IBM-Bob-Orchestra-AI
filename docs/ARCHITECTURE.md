# ORCHESTRA architecture

## Source-to-decision pipeline

1. **Observe** — adapters read GitHub, Jira, Slack and Calendar.
2. **Normalize** — source-specific records become common evidence objects.
3. **Reconcile** — duplicate identities and related work are connected.
4. **Build Twin** — intent, outcomes, work, people, dependencies and evidence form the current state.
5. **Analyze** — risk/resource/planner agents identify constraints.
6. **Simulate** — a counterfactual changes only requested variables and runs deterministic calculations.
7. **Decide** — Decision Agent creates a recommendation with evidence, confidence and approval requirement.
8. **Audit** — decisions are recorded; write-back is intentionally gated.

## Design principle

LLM work is bounded by a deterministic state model. Granite decides *what the user means* and *how to explain the result*. It does not invent the numerical result of the simulation.

## Security boundary

Credentials are environment variables and never reach the browser. Source APIs are called server-side. The browser receives normalized evidence only.
