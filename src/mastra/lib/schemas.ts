/**
 * Shared Zod schemas used across tools, workflows, and agents.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// GitHub PR identifier — { owner, repo, pullNumber }
// ---------------------------------------------------------------------------

export const prIdentifierSchema = z.object({
  owner: z.string().describe('Repository owner (user or organization)'),
  repo: z.string().describe('Repository name'),
  pullNumber: z.number().describe('Pull request number'),
});

// ---------------------------------------------------------------------------
// PR metadata
// ---------------------------------------------------------------------------

export const prSchema = z.object({
  title: z.string(),
  body: z.string().nullable(),
  state: z.string(),
  author: z.string(),
  baseBranch: z.string(),
  headBranch: z.string(),
  headSha: z.string().describe('Head commit SHA — persists even after the branch is deleted'),
  labels: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  additions: z.number(),
  deletions: z.number(),
  changedFiles: z.number(),
});

// ---------------------------------------------------------------------------
// Changed file entry
// ---------------------------------------------------------------------------

export const fileSchema = z.object({
  filename: z.string(),
  status: z.string(),
  additions: z.number(),
  deletions: z.number(),
  changes: z.number(),
  patch: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Per-file review result
// ---------------------------------------------------------------------------

export const fileReviewSchema = z.object({
  filename: z.string(),
  issues: z.array(
    z.object({
      severity: z.enum(['critical', 'warning', 'suggestion', 'positive']),
      category: z.enum(['bug', 'security', 'performance', 'style', 'quality', 'positive']),
      line: z.string().optional(),
      message: z.string(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Aggregated review — agent-produced summary (without step-injected fields)
// ---------------------------------------------------------------------------

export const aggregateSummarySchema = z.object({
  summary: z.string(),
  qualityScore: z.number(),
  verdict: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']),
  criticalIssues: z.array(z.string()),
  securityConcerns: z.array(z.string()),
  performanceNotes: z.array(z.string()),
  suggestions: z.array(z.string()),
  positiveNotes: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Full review output (agent summary + step-injected fileReviews/skippedFiles)
// ---------------------------------------------------------------------------

export const reviewOutputSchema = aggregateSummarySchema.extend({
  fileReviews: z.array(fileReviewSchema),
  skippedFiles: z.array(z.string()),
});
