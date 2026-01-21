/**
 * Process repository discovery utilities.
 * Discovers repositories in an organization that are configured for process scanning.
 */

import { CONCURRENCY, DEFAULTS } from "../constants.js";
import { listRepos, type GitHubRepo } from "./client.js";
import { hasRemoteCheckToml, hasRecentCommits } from "./repo-checks.js";

export interface ProcessRepoDiscoveryResult {
  repos: GitHubRepo[];
  totalRepos: number;
  reposWithCheckToml: number;
  isOrg: boolean;
  filteredByActivity: boolean;
  activityWindowHours?: number;
}

export interface DiscoverProcessReposOptions {
  org: string;
  token?: string;
  concurrency?: number;
  onProgress?: (checked: number, total: number) => void;
  onActivityProgress?: (checked: number, total: number) => void;
  sinceHours?: number;
  includeAll?: boolean;
}

interface FilterContext {
  token?: string;
  concurrency: number;
}

async function parallelLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  }
  await Promise.all(
    Array(Math.min(concurrency, items.length))
      .fill(null)
      .map(() => worker())
  );
  return results;
}

async function filterByCheckToml(
  repos: GitHubRepo[],
  ctx: FilterContext,
  onProgress?: (checked: number, total: number) => void
): Promise<GitHubRepo[]> {
  let checked = 0;
  const results = await parallelLimit(
    repos,
    async (repo) => {
      const [owner, name] = repo.full_name.split("/");
      const has = await hasRemoteCheckToml(owner, name, ctx.token);
      onProgress?.(++checked, repos.length);
      return has;
    },
    ctx.concurrency
  );
  return repos.filter((_, i) => results[i]);
}

async function filterByActivity(
  repos: GitHubRepo[],
  ctx: FilterContext,
  hours: number,
  onProgress?: (checked: number, total: number) => void
): Promise<GitHubRepo[]> {
  let checked = 0;
  const results = await parallelLimit(
    repos,
    async (repo) => {
      const [owner, name] = repo.full_name.split("/");
      const has = await hasRecentCommits(owner, name, hours, ctx.token);
      onProgress?.(++checked, repos.length);
      return has;
    },
    ctx.concurrency
  );
  return repos.filter((_, i) => results[i]);
}

/**
 * Discover repositories with check.toml, optionally filtering by recent activity.
 */
export async function discoverProcessRepos(
  options: DiscoverProcessReposOptions
): Promise<ProcessRepoDiscoveryResult> {
  const {
    org,
    token,
    concurrency = CONCURRENCY.maxRepoScans,
    onProgress,
    onActivityProgress,
    sinceHours = DEFAULTS.commitWindowHours,
    includeAll = false,
  } = options;

  const { repos: allRepos, isOrg } = await listRepos(org, token);
  const ctx: FilterContext = { token, concurrency };
  const base = { isOrg, totalRepos: allRepos.length };

  if (allRepos.length === 0) {
    const hours = includeAll ? undefined : sinceHours;
    return {
      ...base,
      repos: [],
      reposWithCheckToml: 0,
      filteredByActivity: !includeAll,
      activityWindowHours: hours,
    };
  }

  const configRepos = await filterByCheckToml(allRepos, ctx, onProgress);
  const configCount = configRepos.length;

  if (includeAll) {
    return {
      ...base,
      repos: configRepos,
      reposWithCheckToml: configCount,
      filteredByActivity: false,
    };
  }

  if (configCount === 0) {
    return {
      ...base,
      repos: [],
      reposWithCheckToml: 0,
      filteredByActivity: true,
      activityWindowHours: sinceHours,
    };
  }

  const active = await filterByActivity(
    configRepos,
    ctx,
    sinceHours,
    onActivityProgress
  );
  return {
    ...base,
    repos: active,
    reposWithCheckToml: configCount,
    filteredByActivity: true,
    activityWindowHours: sinceHours,
  };
}
