import { dateStringToMs, parseAgentDoc, stripBackticks } from './state-parser';

describe('parseAgentDoc', () => {
  it('parses all sections + bullets when present', () => {
    const md = `# Agent foo

- **Status**: \`active\`
- **Branch**: \`feat/foo\`
- **Worktree path**: \`/tmp/wt\`
- **Dispatched**: 2026-04-25
- **Merged commit**: \`abcdef0123\`
- **Reserved paths**: \`apps/api/src/foo.ts\`, \`apps/web/src/foo.tsx\`

## Human request (verbatim)

build foo

## Final plan summary

plan body

## Implementation prompt

prompt body

## Coordination brief

brief

## Post-merge notes

notes
`;
    const { parsed, warnings } = parseAgentDoc(md);
    expect(parsed.status).toBe('active');
    expect(parsed.branch).toBe('feat/foo');
    expect(parsed.worktree).toBe('/tmp/wt');
    expect(parsed.dispatchedAt).toBe('2026-04-25');
    expect(parsed.mergedCommit).toBe('abcdef0123');
    expect(parsed.reservedPaths).toEqual([
      'apps/api/src/foo.ts',
      'apps/web/src/foo.tsx',
    ]);
    expect(parsed.request).toBe('build foo');
    expect(parsed.plan).toBe('plan body');
    expect(parsed.implPrompt).toBe('prompt body');
    expect(parsed.coordinationBrief).toBe('brief');
    expect(parsed.postMergeNotes).toBe('notes');
    expect(warnings).toEqual([]);
  });

  it('warns + leaves implPrompt empty when section missing', () => {
    const md = `- **Status**: draft

## Human request (verbatim)

x

## Final plan summary

x

## Coordination brief

x

## Post-merge notes
`;
    const { parsed, warnings } = parseAgentDoc(md);
    expect(parsed.implPrompt).toBe('');
    expect(warnings).toContain('section missing: implPrompt');
  });

  it('leaves status null when bullet missing', () => {
    const md = `## Human request (verbatim)

x

## Final plan summary

x

## Implementation prompt

x

## Coordination brief

x

## Post-merge notes

x
`;
    const { parsed } = parseAgentDoc(md);
    expect(parsed.status).toBeNull();
  });

  it('returns all-empty + warnings for empty content', () => {
    const { parsed, warnings } = parseAgentDoc('');
    expect(parsed.status).toBeNull();
    expect(parsed.request).toBe('');
    expect(parsed.plan).toBe('');
    expect(parsed.implPrompt).toBe('');
    expect(parsed.coordinationBrief).toBe('');
    expect(parsed.postMergeNotes).toBe('');
    expect(warnings.length).toBe(5);
  });

  it('throws TypeError on non-string', () => {
    // @ts-expect-error testing runtime guard
    expect(() => parseAgentDoc(123)).toThrow(TypeError);
    // @ts-expect-error testing runtime guard
    expect(() => parseAgentDoc(null)).toThrow(TypeError);
  });

  it('coerces unknown status to draft + warns', () => {
    const md = `- **Status**: weird`;
    const { parsed, warnings } = parseAgentDoc(md);
    expect(parsed.status).toBe('draft');
    expect(warnings.some((w) => w.includes('unrecognized status'))).toBe(true);
  });
});

describe('dateStringToMs', () => {
  it('parses ISO date prefix', () => {
    expect(dateStringToMs('2026-01-02')).toBe(Date.UTC(2026, 0, 2));
  });

  it('returns null for null input', () => {
    expect(dateStringToMs(null)).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(dateStringToMs('not a date')).toBeNull();
  });
});

describe('stripBackticks', () => {
  it('removes leading + trailing backticks', () => {
    expect(stripBackticks('`foo`')).toBe('foo');
    expect(stripBackticks('foo')).toBe('foo');
    expect(stripBackticks('``bar``')).toBe('bar');
  });
});
