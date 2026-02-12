# GitHub PR Code Review Agent

An AI-powered code review agent built with [Mastra](https://mastra.ai/) that analyzes any GitHub pull request and returns detailed feedback directly in chat. It uses a structured workflow, workspace skills for review standards, and adaptive review depth based on PR size.

## Prerequisites

- Node.js >= 22.13.0
- pnpm
- A [GitHub Personal Access Token](https://github.com/settings/tokens) (read-only scope)
- An [Anthropic API Key](https://console.anthropic.com/)

## Setup

```shell
pnpm install
cp .env.example .env
```

Fill in your `.env`:

```
GITHUB_TOKEN=ghp_...
ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

Start the dev server:

```shell
pnpm run dev
```

Open [http://localhost:4111](http://localhost:4111) to access Mastra Studio. You can interact with the **GitHub PR Code Reviewer** agent directly — give it a PR URL like:

```
Review this PR: https://github.com/owner/repo/pull/123
```

You can also run the **pr-review-workflow** directly from the Workflows tab by providing `owner`, `repo`, and `pullNumber`.

## Deployment

```shell
pnpm run build
pnpm run start
```

Or deploy to [Mastra Cloud](https://cloud.mastra.ai/) — see the [deployment guide](https://mastra.ai/docs/deployment/overview).

## Learn More

- [Mastra Documentation](https://mastra.ai/docs/)
- [Agents](https://mastra.ai/docs/agents/overview) · [Tools](https://mastra.ai/docs/agents/using-tools) · [Workflows](https://mastra.ai/docs/workflows/overview) · [Workspace Skills](https://mastra.ai/docs/agents/workspace)
- [Discord](https://discord.gg/BTYqqHKUrf)
