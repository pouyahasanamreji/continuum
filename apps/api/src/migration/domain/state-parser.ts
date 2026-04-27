export interface ParsedAgent {
  status: 'draft' | 'active' | 'merged' | 'abandoned' | null;
  branch: string | null;
  worktree: string | null;
  reservedPaths: string[] | null;
  request: string;
  plan: string;
  implPrompt: string;
  coordinationBrief: string;
  postMergeNotes: string;
  dispatchedAt: string | null;
  mergedAt: string | null;
  mergedCommit: string | null;
}

const SECTION_MAP: Record<
  string,
  'request' | 'plan' | 'implPrompt' | 'coordinationBrief' | 'postMergeNotes'
> = {
  'human request (verbatim)': 'request',
  'final plan summary': 'plan',
  'implementation prompt': 'implPrompt',
  'coordination brief': 'coordinationBrief',
  'post-merge notes': 'postMergeNotes',
};

const VALID_STATUS = new Set(['draft', 'active', 'merged', 'abandoned']);

export function stripBackticks(s: string): string {
  return s.replace(/^`+|`+$/g, '').trim();
}

export function dateStringToMs(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const d = new Date(m[1] + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

function parseReservedPaths(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '(released)' || trimmed === '(none)') {
    return [];
  }
  const parts = trimmed
    .split(',')
    .map((p) => stripBackticks(p.trim()))
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : [];
}

export function parseAgentDoc(content: string): {
  parsed: ParsedAgent;
  warnings: string[];
} {
  if (typeof content !== 'string') {
    throw new TypeError('parseAgentDoc: content must be a string');
  }

  const warnings: string[] = [];
  const parsed: ParsedAgent = {
    status: null,
    branch: null,
    worktree: null,
    reservedPaths: null,
    request: '',
    plan: '',
    implPrompt: '',
    coordinationBrief: '',
    postMergeNotes: '',
    dispatchedAt: null,
    mergedAt: null,
    mergedCommit: null,
  };

  const lines = content.split('\n');
  const bulletRe = /^-\s+\*\*([^*]+)\*\*:\s*(.+)$/;

  for (const line of lines) {
    const m = line.match(bulletRe);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    const valueRaw = m[2].trim();
    if (key === 'reserved paths' || key === 'reserved-paths') {
      parsed.reservedPaths = parseReservedPaths(valueRaw);
      continue;
    }
    const value = stripBackticks(valueRaw.replace(/^`([^`]+)`.*$/, '$1'));

    if (key === 'status') {
      const lowered = value.toLowerCase();
      if (VALID_STATUS.has(lowered)) {
        parsed.status = lowered as ParsedAgent['status'];
      } else {
        warnings.push(`unrecognized status "${value}", coerced to draft`);
        parsed.status = 'draft';
      }
    } else if (key === 'branch') {
      parsed.branch = value;
    } else if (key.startsWith('worktree')) {
      parsed.worktree = value;
    } else if (key === 'dispatched') {
      parsed.dispatchedAt = value;
    } else if (key === 'merged') {
      parsed.mergedAt = value;
    } else if (key === 'merged commit') {
      parsed.mergedCommit = value;
    }
  }

  let i = 0;
  const seenSections = new Set<string>();
  while (i < lines.length) {
    const line = lines[i];
    const headMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headMatch) {
      const title = headMatch[1].trim().toLowerCase();
      const target = SECTION_MAP[title];
      i++;
      const buf: string[] = [];
      while (i < lines.length && !lines[i].startsWith('## ')) {
        buf.push(lines[i]);
        i++;
      }
      if (target) {
        parsed[target] = buf.join('\n').trim();
        seenSections.add(target);
      }
      continue;
    }
    i++;
  }

  for (const target of Object.values(SECTION_MAP)) {
    if (!seenSections.has(target)) {
      warnings.push(`section missing: ${target}`);
    }
  }

  return { parsed, warnings };
}
