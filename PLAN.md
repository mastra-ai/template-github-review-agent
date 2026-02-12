# PLAN: Advanced GitHub PR Code Review Agent

## Goal

Build an advanced GitHub PR code review agent using Mastra that can review **any** GitHub PR (not just local code). It uses **Workspace Skills** for review styleguides/best practices and **Workflows** for a structured, consistent review process.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Mastra Instance                   │
│                                                     │
│  ┌──────────────┐   ┌───────────────────────────┐   │
│  │   Workspace   │   │    PR Review Workflow      │   │
│  │  ┌──────────┐ │   │                           │   │
│  │  │  Skills   │ │   │  1. Fetch PR metadata     │   │
│  │  │          │ │   │  2. Fetch PR diff/files    │   │
│  │  │ - code-  │ │   │  3. Categorize files       │   │
│  │  │   standards│ │  │  4. Review per-file        │   │
│  │  │ - security│ │   │  5. Aggregate findings     │   │
│  │  │ - perf   │ │   └───────────────────────────┘   │
│  │  └──────────┘ │                                   │
│  └──────────────┘                                   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │           Tools (GitHub API — read-only)       │   │
│  │  - getPullRequest    - getPullRequestDiff     │   │
│  │  - getPullRequestFiles  - getFileContent      │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │            Code Review Agent                  │   │
│  │  Uses skills + tools, orchestrated by workflow│   │
│  │  Returns review feedback directly in chat     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: Project Setup

### 1.1 Clean up scaffolding
- Remove all weather-related files (`weather-agent.ts`, `weather-tool.ts`, `weather-workflow.ts`, `weather-scorer.ts`)
- Update `src/mastra/index.ts` to register the new agent, tools, and workflows
- Create `.env.example` with required env vars (`GITHUB_TOKEN`, `OPENAI_API_KEY`)

### 1.2 Install dependencies
- Run `pnpm install` to ensure all Mastra packages are available
- No additional dependencies needed — GitHub API is REST-based (use `fetch`)

---

## Phase 2: Workspace & Skills

### 2.1 Create workspace directory structure
```
workspace/
└── skills/
    ├── code-standards/
    │   ├── SKILL.md
    │   └── references/
    │       └── style-guide.md
    ├── security-review/
    │   ├── SKILL.md
    │   └── references/
    │       └── security-checklist.md
    └── performance-review/
        ├── SKILL.md
        └── references/
            └── performance-checklist.md
```

### 2.2 `code-standards` skill (`workspace/skills/code-standards/SKILL.md`)
Defines the core review process:
- Critical issues: security vulnerabilities, logic bugs, missing error handling
- Code quality: function length, duplication, naming, types
- Style guide conformance (references `references/style-guide.md`)
- Linting flags: `var` usage, leftover `console.log`, `debugger`
- Output format: Summary → Critical Issues → Suggestions → Positive Notes

### 2.3 `security-review` skill (`workspace/skills/security-review/SKILL.md`)
Focused security analysis:
- Injection vulnerabilities (SQL, command, XSS)
- Authentication/authorization issues
- Secrets/credentials in code
- Insecure dependencies or patterns
- Input validation gaps

### 2.4 `performance-review` skill (`workspace/skills/performance-review/SKILL.md`)
Performance-focused review:
- N+1 queries, missing indexes
- Unnecessary re-renders (React)
- Memory leaks, unbounded growth
- Missing caching opportunities
- Algorithmic complexity concerns

### 2.5 Configure workspace in Mastra
```typescript
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { resolve } from 'node:path';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath: resolve(import.meta.dirname, '../../workspace'),
  }),
  skills: ['/skills'],
});
```

---

## Phase 3: GitHub Tools

All tools use `createTool` from `@mastra/core/tools` with Zod schemas.

### 3.1 `getPullRequest`
- **Input**: `{ owner, repo, pullNumber }`
- **Output**: PR metadata (title, description, author, base/head branches, labels)
- **API**: `GET /repos/{owner}/{repo}/pulls/{pull_number}`

### 3.2 `getPullRequestDiff`
- **Input**: `{ owner, repo, pullNumber }`
- **Output**: Raw unified diff string
- **API**: `GET /repos/{owner}/{repo}/pulls/{pull_number}` with `Accept: application/vnd.github.diff`

### 3.3 `getPullRequestFiles`
- **Input**: `{ owner, repo, pullNumber }`
- **Output**: Array of changed files with filename, status (added/modified/removed), additions, deletions, patch
- **API**: `GET /repos/{owner}/{repo}/pulls/{pull_number}/files`

### 3.4 `getFileContent`
- **Input**: `{ owner, repo, path, ref }`
- **Output**: File content as string
- **API**: `GET /repos/{owner}/{repo}/contents/{path}?ref={ref}`

### 3.5 Helper: `parseGitHubPRUrl`
- **Input**: `{ url }` (e.g., `https://github.com/owner/repo/pull/123`)
- **Output**: `{ owner, repo, pullNumber }`
- Allows users to just paste a PR URL

---

## Phase 4: PR Review Workflow

A structured `createWorkflow` with sequential and parallel steps.

### 4.1 Workflow: `prReviewWorkflow`

```
Input: { owner, repo, pullNumber }
  │
  ├── Step 1: fetchPRContext
  │   Fetch PR metadata + file list (parallel API calls)
  │   Output: { pr, files }
  │
  ├── Step 2: categorizeFiles
  │   Group files by type/relevance, filter out non-reviewable files
  │   (lock files, generated code, binary files)
  │   Output: { reviewableFiles, skippedFiles, fileGroups }
  │
  ├── Step 3: reviewFiles (forEach over fileGroups)
  │   For each file group, use the agent to review with relevant skills
  │   Agent reads diff + full file content, applies skills
  │   Output: { fileReviews[] }
  │
  └── Step 4: aggregateFindings
      Combine all per-file reviews into a cohesive summary
      Deduplicate, prioritize, assign severity
      Output: { summary, criticalIssues, suggestions, positiveNotes, verdict }
```

### 4.2 Workflow step details

**Step 1 — `fetchPRContext`**: Uses `getPullRequest` and `getPullRequestFiles` tools. Pure data fetching, no LLM needed.

**Step 2 — `categorizeFiles`**: Deterministic logic (no LLM). Filters out:
- `*.lock`, `*.lockb` files
- `node_modules/`, `dist/`, `build/` paths
- Binary files, images
- Files with only deletions (unless > 50 lines)

Groups remaining files by:
- Language/framework
- Directory (to understand component boundaries)
- Size of diff (large diffs get chunked)

**Step 3 — `reviewFiles`**: Uses the code review agent with all skills loaded. For each reviewable file:
1. Fetches full file content at HEAD ref
2. Provides the diff + full context to the agent
3. Agent activates relevant skills based on file type
4. Returns structured review per file

**Step 4 — `aggregateFindings`**: Uses the agent to synthesize all per-file reviews into a single structured response. Produces:
- Overall PR quality assessment (1-10 score)
- Critical issues requiring changes (with file:line references)
- Suggestions for improvement
- Positive callouts
- Verdict: APPROVE / REQUEST_CHANGES / COMMENT

This final output is returned directly in chat as the review feedback.

---

## Phase 5: Code Review Agent

### 5.1 Agent: `codeReviewAgent`

```typescript
new Agent({
  id: 'code-review-agent',
  name: 'GitHub PR Code Reviewer',
  instructions: `You are an expert code reviewer...`,
  model: 'anthropic/claude-sonnet-4-20250514',
  tools: {
    getPullRequest,
    getPullRequestDiff,
    getPullRequestFiles,
    getFileContent,
    parseGitHubPRUrl,
  },
});
```

The agent's instructions will tell it to:
1. Load and follow all workspace skills
2. Be constructive and specific (always include file paths and line numbers)
3. Prioritize critical issues over style nits
4. Acknowledge good patterns and decisions
5. Consider the PR description and context when reviewing
6. Adapt review depth based on PR size (small PRs get detailed review, large PRs focus on architecture + critical issues)

---

## Phase 6: Mastra Registration & Configuration

### 6.1 Update `src/mastra/index.ts`

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { resolve } from 'node:path';
import { codeReviewAgent } from './agents/code-review-agent';
import { prReviewWorkflow } from './workflows/pr-review-workflow';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath: resolve(import.meta.dirname, '../../workspace'),
  }),
  skills: ['/skills'],
});

export const mastra = new Mastra({
  workspace,
  agents: { codeReviewAgent },
  workflows: { prReviewWorkflow },
  storage: new LibSQLStore({ ... }),
  logger: new PinoLogger({ ... }),
  observability: new Observability({ ... }),
});
```

---

## Phase 7: Testing & Verification

### 7.1 Manual testing via Mastra Studio
- Start with `pnpm run dev`
- Open http://localhost:4111
- Test the agent directly by pasting a PR URL
- Test the workflow by providing `{ owner, repo, pullNumber }`

### 7.2 Test scenarios
1. **Small PR** (1-3 files): Verify detailed line-by-line feedback
2. **Large PR** (20+ files): Verify file categorization and focused review
3. **Security issue**: PR with SQL injection or hardcoded secret
4. **Style issues**: PR with `var`, `console.log`, poor naming
5. **Clean PR**: Verify the agent gives positive feedback and approves

### 7.3 Type checking
- Run `npx tsc --noEmit` to verify no type errors

---

## File Structure (Final)

```
├── src/
│   └── mastra/
│       ├── index.ts                          # Mastra instance with workspace
│       ├── agents/
│       │   └── code-review-agent.ts          # Code review agent
│       ├── tools/
│       │   └── github.ts                     # GitHub API tools (read-only) + URL parser
│       └── workflows/
│           └── pr-review-workflow.ts          # PR review workflow
├── workspace/
│   └── skills/
│       ├── code-standards/
│       │   ├── SKILL.md
│       │   └── references/
│       │       └── style-guide.md
│       ├── security-review/
│       │   ├── SKILL.md
│       │   └── references/
│       │       └── security-checklist.md
│       └── performance-review/
│           ├── SKILL.md
│           └── references/
│               └── performance-checklist.md
├── .env.example                              # GITHUB_TOKEN, OPENAI_API_KEY
├── package.json
└── tsconfig.json
```

---

## Implementation Order

| Step | Description | Est. Effort |
|------|-------------|-------------|
| 1 | Clean up weather scaffolding, set up `.env.example` | 5 min |
| 2 | Create workspace directory + all 3 skills (SKILL.md + references) | 15 min |
| 3 | Build GitHub read-only tools (`src/mastra/tools/github.ts`) | 15 min |
| 4 | Build `parseGitHubPRUrl` utility tool | 5 min |
| 5 | Build the PR review workflow with all 4 steps | 25 min |
| 6 | Build the code review agent | 10 min |
| 7 | Wire everything in `src/mastra/index.ts` | 5 min |
| 8 | Test with real PRs via Mastra Studio | 15 min |
| 9 | Iterate on skill content and agent instructions based on output quality | Ongoing |

**Total estimated implementation time: ~1.5 hours**

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub personal access token (read-only `repo` or `public_repo` scope) | Yes |
| `OPENAI_API_KEY` | OpenAI API key (if using `openai/*` models) | Depends on model |
| `ANTHROPIC_API_KEY` | Anthropic API key (if using `anthropic/*` models) | Depends on model |

---

## What Makes This "Advanced"

Compared to the simple version from the Mastra guide:

1. **Works with any GitHub PR** — not just local code snippets. Fetches real PR data via GitHub API.
2. **Multi-skill workspace** — separate skills for code standards, security, and performance reviews rather than a single generic review.
3. **Structured workflow** — deterministic pipeline ensures consistent, thorough reviews every time (fetch → categorize → review → aggregate).
4. **Smart file categorization** — skips irrelevant files (lock files, generated code), groups by type for contextual review.
5. **Severity classification** — distinguishes critical issues from suggestions from positive notes.
6. **PR-size-aware** — adapts review depth based on the size and scope of the PR.
7. **Full context** — fetches complete file content alongside diffs so the agent understands the full picture, not just changed lines.
8. **Chat-native** — review feedback is returned directly in the conversation, no GitHub permissions beyond read access needed.
