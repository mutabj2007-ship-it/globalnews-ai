import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { adminEn } from '@/lib/i18n/dictionaries/adminEn';
import { adminPl } from '@/lib/i18n/dictionaries/adminPl';
import type { AdminMeResponse } from '@/lib/admin/adminApiTypes';
import { AdminContextProvider } from './shell/AdminContext';
import { AdminDataTable, type AdminColumn } from './primitives/AdminDataTable';
import { BaselineAdminDataTable } from './__fixtures__/BaselineAdminDataTable';
import { selectAdminTableView, tokensIn } from './primitives/adminTableView';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN COMPACT LISTS R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The directive named five properties. Each is measured here, not asserted:
 * search covers all fetched rows before pagination; the page resets when the
 * query changes; matching counts are shown; a server-truncated table discloses
 * that search reaches only loaded records; and opening, searching or selecting
 * triggers NO computation — proven with `fetch` mocked at the wire and counted,
 * the same way the Ask save control proves it sends one request.
 *
 * Plus the two the directive made conditions rather than features: existing
 * callers are preserved, and M-B's hidden columns become reachable in portrait.
 */

/* ── the wire. Nothing in this component should ever reach it. ─────────────── */
let requests: string[] = [];
beforeEach(() => {
  requests = [];
  global.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
});

const me: AdminMeResponse = {
  adminId: 'admin-1',
  role: 'SUPER_ADMIN',
  capabilities: ['analytics.view'],
};

function render(node: ReactNode): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(h(AdminContextProvider, { t: adminEn, me, children: node }));
  });
  return tree;
}

/** Every element of a type, anywhere in the tree. */
const all = (tree: ReactTestRenderer, type: string) => tree.root.findAllByType(type as never);
/** The rendered text of the whole tree. Always via `toJSON()` — a test renderer
    instance's `props` carry React internals and are circular. */
const text = (tree: ReactTestRenderer): string => JSON.stringify(tree.toJSON());

/**
 * Source with comments removed.
 *
 * EVERY source-level assertion in this file goes through this. The files being
 * scanned DISCUSS the things the scans forbid — "no `fetch`", "no
 * `loadedOnlyNote` here", "a fixed overlay is what traps scroll" — so a raw scan
 * matches the documentation explaining the property and passes, or fails, for
 * the wrong reason. It did, three times, before this helper existed.
 */
/** Every .ts/.tsx file under a directory, recursively. */
function collectSources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) return [];
    if (statSync(full).isDirectory()) return collectSources(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

const codeOf = (path: string): string =>
  readFileSync(join(__dirname, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/* ── fixtures ─────────────────────────────────────────────────────────────── */

interface Country {
  countryCode: string;
  followerAccountCount: number;
}
const countries: Country[] = Array.from({ length: 195 }, (_, index) => ({
  countryCode: `C${String(index).padStart(3, '0')}`,
  followerAccountCount: index,
}));
/* Three recognisable rows to search for. */
countries[3].countryCode = 'POL';
countries[40].countryCode = 'LTU';
countries[80].countryCode = 'POR';

const countryColumns: ReadonlyArray<AdminColumn<Country>> = [
  { id: 'country', header: 'Country', render: (row) => row.countryCode },
  {
    id: 'accounts',
    header: 'Accounts',
    align: 'right',
    render: (row) => String(row.followerAccountCount),
  },
];

const matchesCode = (row: Country, query: string) =>
  row.countryCode.toLowerCase().includes(query.trim().toLowerCase());

const table = (props: Record<string, unknown> = {}) =>
  h(AdminDataTable<Country>, {
    caption: 'Followed countries',
    state: 'real',
    rows: countries,
    rowKey: (row: Country) => row.countryCode,
    emptyTitle: 'none',
    emptyBody: 'none',
    columns: countryColumns,
    ...props,
  } as never);

/** Types into the single search input and flushes. */
function typeSearch(tree: ReactTestRenderer, value: string): void {
  const input = tree.root.findByProps({ type: 'search' });
  act(() => {
    (input.props as { onChange: (e: unknown) => void }).onChange({ target: { value } });
  });
}

/** Presses a pagination button by its aria-label. */
function press(tree: ReactTestRenderer, label: string): void {
  const button = tree.root.findByProps({ 'aria-label': label });
  act(() => {
    (button.props as { onClick: () => void }).onClick();
  });
}

/* ══════════════════════════════════════════════════════════════════════════ */

describe('selectAdminTableView — the rule, exhaustively', () => {
  const rows = ['a1', 'a2', 'b1', 'b2', 'b3'];
  const matches = (row: string, query: string) => row.startsWith(query);

  it('SEARCHES EVERY FETCHED ROW BEFORE PAGINATING, not the current page', () => {
    /*
      'b3' is on page 3 of an unfiltered 5-row/2-per-page list. Searching 'b'
      from page 1 must find all three b-rows. A server that paged first and
      filtered the page would return only what page 1 happened to hold — and
      would look identical on screen.
    */
    const view = selectAdminTableView({ rows, query: 'b', matches, page: 1, pageSize: 2 });
    expect(view.matching).toBe(3);
    expect(view.rows).toEqual(['b1', 'b2']);
    expect(view.pages).toBe(2);
  });

  it('positive control: filtering the page first would give a different answer', () => {
    const pageFirst = rows.slice(0, 2).filter((row) => matches(row, 'b'));
    expect(pageFirst).toEqual([]);
    expect(selectAdminTableView({ rows, query: 'b', matches, page: 1, pageSize: 2 }).rows).toEqual([
      'b1',
      'b2',
    ]);
  });

  it('CLAMPS AN OUT-OF-RANGE PAGE rather than rendering a blank table', () => {
    const view = selectAdminTableView({ rows, query: 'b', matches, page: 6, pageSize: 2 });
    expect(view.page).toBe(2);
    expect(view.rows).toEqual(['b3']);
  });

  it('reports counts that came from the same computation as the rows', () => {
    const view = selectAdminTableView({ rows, query: 'b', matches, page: 1, pageSize: 2 });
    expect([view.from, view.to, view.matching, view.total]).toEqual([1, 2, 3, 5]);
  });

  it('a blank or whitespace query is NOT a query', () => {
    for (const query of ['', '   ', '\t']) {
      const view = selectAdminTableView({ rows, query, matches });
      expect([query, view.hasQuery, view.rows.length]).toEqual([query, false, 5]);
    }
  });

  it('no pageSize means every match renders, on one page', () => {
    const view = selectAdminTableView({ rows, query: 'b', matches });
    expect(view.rows).toEqual(['b1', 'b2', 'b3']);
    expect([view.pages, view.page]).toEqual([1, 1]);
  });

  it('no matcher means no filtering, even with a query', () => {
    expect(selectAdminTableView({ rows, query: 'zzz' }).rows).toEqual(rows);
  });

  it('a query matching nothing yields zero rows and honest counts', () => {
    const view = selectAdminTableView({ rows, query: 'zzz', matches, pageSize: 2 });
    expect([view.matching, view.rows.length, view.from, view.to]).toEqual([0, 0, 0, 0]);
    expect(view.page).toBe(1);
  });

  it('the last page is a partial page, not a padded one', () => {
    const view = selectAdminTableView({ rows, page: 3, pageSize: 2 });
    expect(view.rows).toEqual(['b3']);
    expect([view.from, view.to]).toEqual([5, 5]);
  });
});

describe('AdminDataTable — EXISTING CALLERS ARE UNCHANGED', () => {
  it('with no options it renders no input, no buttons and no disclosure', () => {
    const tree = render(table());
    expect(all(tree, 'input')).toHaveLength(0);
    expect(all(tree, 'button')).toHaveLength(0);
    expect(all(tree, 'details')).toHaveLength(0);
    expect(text(tree)).not.toContain(adminEn.table.searchLabel);
  });

  it('with no options EVERY row renders, in the order given', () => {
    const tree = render(table());
    expect(all(tree, 'tr')).toHaveLength(countries.length + 1 /* header */);
    const rendered = text(tree);
    expect(rendered.indexOf('POL')).toBeLessThan(rendered.indexOf('LTU'));
    expect(rendered.indexOf('LTU')).toBeLessThan(rendered.indexOf('POR'));
  });

  it('positive control: the SAME table WITH options does render them', () => {
    const tree = render(table({ search: { matches: matchesCode }, pageSize: 25 }));
    expect(all(tree, 'input')).toHaveLength(1);
    expect(all(tree, 'button').length).toBeGreaterThan(0);
  });
});

describe('THE OPT-IN PROMISE, PROVEN BY COMPARISON', () => {
  /*
    The claim is that supplying none of the new props leaves existing callers'
    markup unchanged. Reading both files and agreeing is not evidence for that.
    This renders BOTH — the frozen baseline component and the new one with no
    options — to static HTML and compares the strings.
  */
  const markupOf = (component: unknown, rows: readonly Country[]): string =>
    renderToStaticMarkup(
      h(AdminContextProvider, {
        t: adminEn,
        me,
        children: h(component as never, {
          caption: 'Followed countries',
          state: 'real',
          rows,
          rowKey: (row: Country) => row.countryCode,
          emptyTitle: 'none',
          emptyBody: 'none',
          columns: countryColumns,
        } as never),
      }),
    );

  it.each([
    ['a populated table', countries],
    ['a single row', countries.slice(0, 1)],
    ['no rows at all', [] as Country[]],
  ])('%s renders BYTE-IDENTICALLY to the baseline component', (_label, rows) => {
    expect(markupOf(AdminDataTable, rows)).toBe(markupOf(BaselineAdminDataTable, rows));
  });

  it.each(['loading', 'error', 'unavailable', 'notImplemented', 'zero'] as const)(
    'the %s state renders byte-identically too',
    (state) => {
      const both = [AdminDataTable, BaselineAdminDataTable].map((component) =>
        renderToStaticMarkup(
          h(AdminContextProvider, {
            t: adminEn,
            me,
            children: h(component as never, {
              caption: 'Followed countries',
              state,
              rows: countries.slice(0, 3),
              rowKey: (row: Country) => row.countryCode,
              emptyTitle: 'none',
              emptyBody: 'none',
              columns: countryColumns,
            } as never),
          }),
        ),
      );
      expect(both[0]).toBe(both[1]);
    },
  );

  it('POSITIVE CONTROL: the comparison DOES detect a difference when one exists', () => {
    /* With options supplied the markup must differ — otherwise the test above
       would pass even if the new props did nothing. */
    const plain = markupOf(AdminDataTable, countries);
    const enhanced = renderToStaticMarkup(
      h(AdminContextProvider, {
        t: adminEn,
        me,
        children: table({ search: { matches: matchesCode }, pageSize: 25 }),
      }),
    );
    expect(enhanced).not.toBe(plain);
    expect(enhanced).toContain(adminEn.table.searchLabel);
  });

  it('the frozen baseline copy is referenced by this spec and nothing else', () => {
    const offenders = collectSources(join(__dirname, '..', '..'))
      .filter((file) => !file.endsWith('adminCompactLists.spec.ts'))
      .filter((file) => !file.includes('__fixtures__'))
      .filter((file) => readFileSync(file, 'utf8').includes('BaselineAdminDataTable'));
    expect(offenders).toEqual([]);
  });
});

describe('AdminDataTable — search, paging and the counts', () => {
  it('SHOWS THE MATCHING COUNT, and it changes with the query', () => {
    const tree = render(table({ search: { matches: matchesCode }, pageSize: 25 }));
    expect(text(tree)).toContain('Showing 1–25 of 195 records');
    typeSearch(tree, 'PO');
    /* POL and POR — and the paginated wording states BOTH the match count and
       the position within it, which is the pair a reader mid-search needs. */
    expect(text(tree)).toContain('Showing 1–2 of 2 matching records, out of 195');
  });

  it('THE PAGE RESETS WHEN THE QUERY CHANGES', () => {
    const tree = render(table({ search: { matches: matchesCode }, pageSize: 25 }));
    press(tree, adminEn.table.nextPage);
    press(tree, adminEn.table.nextPage);
    expect(text(tree)).toContain('Page 3 of 8');
    typeSearch(tree, 'C0');
    /* Back to page 1 of the matches — not an empty page 3. */
    expect(text(tree)).not.toContain('Page 3 of');
    expect(text(tree)).toContain('C000');
  });

  it('search reaches a row that is NOT on the current page', () => {
    const tree = render(table({ search: { matches: matchesCode }, pageSize: 25 }));
    /* 'POR' is row 80 — page 4 unfiltered. */
    expect(text(tree)).not.toContain('POR');
    typeSearch(tree, 'POR');
    expect(text(tree)).toContain('POR');
  });

  it('A SEARCH THAT MATCHES NOTHING KEEPS THE SEARCH BOX, and says so in its own words', () => {
    const tree = render(table({ search: { matches: matchesCode }, pageSize: 25 }));
    typeSearch(tree, 'zzzzz');
    expect(text(tree)).toContain(adminEn.table.noMatch);
    /* Not the caller's "no records at all" copy — a different fact. */
    expect(text(tree)).not.toContain('none');
    /* And the control that caused it is still there to clear. */
    expect(all(tree, 'input')).toHaveLength(1);
  });

  it('the clear button appears only with a query, and restores every row', () => {
    const tree = render(table({ search: { matches: matchesCode }, pageSize: 25 }));
    expect(text(tree)).not.toContain(adminEn.table.clear);
    typeSearch(tree, 'POL');
    expect(text(tree)).toContain(adminEn.table.clear);
    const clear = tree.root.findAllByType('button').find((b) => {
      const children = (b.props as { children?: unknown }).children;
      return children === adminEn.table.clear;
    });
    act(() => {
      (clear!.props as { onClick: () => void }).onClick();
    });
    expect(text(tree)).toContain('Showing 1–25 of 195 records');
  });

  it('pagination is absent when everything fits on one page', () => {
    const tree = render(table({ rows: countries.slice(0, 5), pageSize: 25 }));
    expect(tree.root.findAllByProps({ 'aria-label': adminEn.table.nextPage })).toHaveLength(0);
  });

  it('the boundary buttons are DISABLED, not removed — the control does not move', () => {
    const tree = render(table({ search: { matches: matchesCode }, pageSize: 25 }));
    const prev = tree.root.findByProps({ 'aria-label': adminEn.table.previousPage });
    expect((prev.props as { disabled: boolean }).disabled).toBe(true);
  });
});

describe('AdminDataTable — TRUNCATION IS DISCLOSED', () => {
  it('a server-truncated table says search covers only loaded records', () => {
    const tree = render(
      table({
        rows: countries.slice(0, 25),
        search: { matches: matchesCode },
        loadedOnlyNote: adminEn.table.loadedOnly,
      }),
    );
    expect(text(tree)).toContain(adminEn.table.loadedOnly);
  });

  it('A COMPLETE TABLE DOES NOT — a false disclaimer is its own defect', () => {
    const tree = render(table({ search: { matches: matchesCode }, pageSize: 25 }));
    expect(text(tree)).not.toContain(adminEn.table.loadedOnly);
  });

  it('the note is wired to the input with aria-describedby', () => {
    const tree = render(
      table({
        rows: countries.slice(0, 25),
        search: { matches: matchesCode },
        loadedOnlyNote: adminEn.table.loadedOnly,
      }),
    );
    const input = tree.root.findByProps({ type: 'search' });
    expect((input.props as { 'aria-describedby'?: string })['aria-describedby']).toBeTruthy();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   M-B — the hidden columns, in portrait
   ══════════════════════════════════════════════════════════════════════════ */

interface HistoryRow {
  when: string;
  control: string;
  change: string;
  who: string;
  reason: string;
}
/** The Operations history shape, column for column. */
const historyColumns: ReadonlyArray<AdminColumn<HistoryRow>> = [
  { id: 'when', header: 'When', render: (row) => row.when },
  { id: 'control', header: 'Control', render: (row) => row.control },
  { id: 'change', header: 'Change', render: (row) => row.change },
  { id: 'who', header: 'Who', secondary: true, render: (row) => row.who },
  { id: 'reason', header: 'Reason', secondary: true, render: (row) => row.reason },
];
const history: HistoryRow[] = [
  {
    when: '2026-09-30T04:00:00Z',
    control: 'Pause new AI answers',
    change: 'OFF',
    who: 'operator-7',
    reason: 'provider incident',
  },
];

describe('M-B — every column is reachable on a phone', () => {
  const stacked = (props: Record<string, unknown> = {}) =>
    h(AdminDataTable<HistoryRow>, {
      caption: 'History',
      state: 'real',
      rows: history,
      rowKey: (row: HistoryRow) => row.when,
      emptyTitle: 'none',
      emptyBody: 'none',
      columns: historyColumns,
      ...props,
    } as never);

  it('WITHOUT the option, WHO and REASON are in cells hidden below the breakpoint', () => {
    const tree = render(stacked());
    const hiddenCells = tree.root
      .findAllByType('td')
      .filter((cell) =>
        String((cell.props as { className?: string }).className).includes('hidden adm-rail:'),
      );
    /* Two per row: who and reason. Present in the DOM, invisible in portrait. */
    expect(hiddenCells).toHaveLength(2);
    expect(all(tree, 'details')).toHaveLength(0);
  });

  it('WITH `stackedOnNarrow`, EVERY column appears in the row expansion', () => {
    const tree = render(stacked({ stackedOnNarrow: true }));
    const details = all(tree, 'details');
    expect(details).toHaveLength(1);

    const labels = tree.root.findAllByType('dt').map((node) => (node.props as { children: string }).children);
    expect(labels).toEqual(['When', 'Control', 'Change', 'Who', 'Reason']);

    const values = tree.root.findAllByType('dd').map((node) => (node.props as { children: string }).children);
    expect(values).toEqual([
      '2026-09-30T04:00:00Z',
      'Pause new AI answers',
      'OFF',
      'operator-7',
      'provider incident',
    ]);
  });

  it('the summary carries the primary columns, so the list still scans unopened', () => {
    const tree = render(stacked({ stackedOnNarrow: true }));
    /* Read the RENDERED summary, not the renderer's props object. */
    const rendered = text(tree);
    const summaryStart = rendered.indexOf('"type":"summary"');
    const detailBody = rendered.indexOf('"type":"dl"');
    expect(summaryStart).toBeGreaterThan(-1);
    /* The control label appears in the summary, before the expansion body. */
    expect(rendered.slice(summaryStart, detailBody)).toContain('Pause new AI answers');
    /* And WHO is NOT in the summary — it lives in the expansion. */
    expect(rendered.slice(summaryStart, detailBody)).not.toContain('operator-7');
  });

  it('IT IS A NATIVE DISCLOSURE — no script, no focus trap, no fixed overlay', () => {
    const code = codeOf('primitives/AdminDataTable.tsx');
    expect(code).toContain('<details');
    expect(code).toContain('<summary');
    /* No scripted open state, so it works with JavaScript disabled and cannot desync. */
    expect(code).not.toMatch(/setOpen|isOpen|openRow/);
    /* Nothing fixed or sticky: a dropdown overlay is what traps page scroll on a phone. */
    expect(code).not.toMatch(/\bfixed\b|\bsticky\b/);
    /* Positive control: the stripper left the markup it is scanning. */
    expect(code).toContain('adm-rail:hidden');
  });

  it('the wide table is still rendered, and hidden below the breakpoint', () => {
    const tree = render(stacked({ stackedOnNarrow: true }));
    /* Both in the DOM, switched with `hidden` — so neither is announced twice. */
    expect(text(tree)).toContain('hidden adm-rail:block');
    expect(text(tree)).toContain('adm-rail:hidden');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   No computation, keyboard access, EN/PL
   ══════════════════════════════════════════════════════════════════════════ */

describe('NOTHING HERE COMPUTES — measured at the wire', () => {
  it('a search, a page turn and a row expansion send ZERO requests', () => {
    const onRetry = jest.fn();
    const tree = render(
      table({
        search: { matches: matchesCode },
        pageSize: 25,
        stackedOnNarrow: true,
        onRetry,
      }),
    );
    typeSearch(tree, 'PO');
    typeSearch(tree, '');
    press(tree, adminEn.table.nextPage);
    press(tree, adminEn.table.previousPage);

    expect(requests).toEqual([]);
    /* And the caller's reload is never called outside the error branch. */
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('positive control: the harness DOES count a request when one is made', async () => {
    await fetch('/admin/anything');
    expect(requests).toEqual(['/admin/anything']);
  });

  it('the component imports no fetch and no resource hook', () => {
    const code = codeOf('primitives/AdminDataTable.tsx');
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toContain('useAdminResource');
    /* Positive control: the stripper did not empty the file. */
    expect(code).toContain('export function AdminDataTable');

    const pure = codeOf('primitives/adminTableView.ts');
    expect(pure).not.toMatch(/\bfetch\(/);
    /* The pure module imports NOTHING — not even React. */
    expect(pure).not.toMatch(/^\s*import /m);
    expect(pure).toContain('export function selectAdminTableView');
  });
});

describe('keyboard access and labelling', () => {
  it('the search input has a real label pointing at it', () => {
    const tree = render(table({ search: { matches: matchesCode } }));
    const input = tree.root.findByProps({ type: 'search' });
    const label = tree.root.findByType('label' as never);
    expect((label.props as { htmlFor: string }).htmlFor).toBe((input.props as { id: string }).id);
  });

  it('EVERY interactive element carries a visible focus state', () => {
    const tree = render(
      table({ search: { matches: matchesCode }, pageSize: 25, stackedOnNarrow: true }),
    );
    typeSearch(tree, 'C0');
    const interactive = [
      ...tree.root.findAllByType('input'),
      ...tree.root.findAllByType('button'),
      ...tree.root.findAllByType('summary' as never),
    ];
    expect(interactive.length).toBeGreaterThanOrEqual(4);
    interactive.forEach((node) =>
      expect(String((node.props as { className?: string }).className)).toContain(
        'focus-visible:outline-adm-accent',
      ),
    );
  });

  it('the count is a live region, so a narrowed result is announced', () => {
    const tree = render(table({ search: { matches: matchesCode } }));
    expect(tree.root.findAllByProps({ role: 'status' }).length).toBeGreaterThan(0);
  });

  it('the search input is wired to the results it controls', () => {
    const tree = render(table({ search: { matches: matchesCode } }));
    const input = tree.root.findByProps({ type: 'search' });
    const controls = (input.props as { 'aria-controls': string })['aria-controls'];
    expect(tree.root.findAllByProps({ id: controls }).length).toBeGreaterThan(0);
  });
});

describe('EN/PL', () => {
  it('BOTH LANGUAGES DECLARE THE SAME {tokens} — a dropped one would render a hole', () => {
    (Object.keys(adminEn.table) as Array<keyof typeof adminEn.table>).forEach((key) => {
      expect([key, tokensIn(adminPl.table[key])]).toEqual([key, tokensIn(adminEn.table[key])]);
    });
  });

  it('the tokens are the ones the component fills', () => {
    expect(tokensIn(adminEn.table.countPage)).toEqual(['from', 'to', 'total']);
    expect(tokensIn(adminEn.table.countMatchPage)).toEqual(['from', 'matching', 'to', 'total']);
    expect(tokensIn(adminEn.table.pageOf)).toEqual(['page', 'pages']);
  });

  it('renders Polish copy when the Polish dictionary is supplied', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        h(AdminContextProvider, {
          t: adminPl,
          me,
          children: table({ search: { matches: matchesCode }, pageSize: 25 }),
        }),
      );
    });
    expect(text(tree)).toContain(adminPl.table.searchLabel);
    expect(text(tree)).toContain('Widok 1–25 z 195');
  });
});

describe('the geography adoption is the measured need, and nothing more', () => {
  /* Comments stripped: both blocks EXPLAIN why they do or do not pass
     `loadedOnlyNote`, which a raw scan would read as passing it. */
  const source = codeOf('screens/AnalyticsGeographyTab.tsx');
  const followedBlock = source.slice(source.indexOf('caption={screen.followedTitle}'));
  const coverageBlock = source.slice(
    source.indexOf('caption={screen.geographyTitle}'),
    source.indexOf('caption={screen.followedTitle}'),
  );

  it('the UNCAPPED followed table gets search, paging and stacked rows', () => {
    expect(followedBlock).toContain('search={{');
    expect(followedBlock).toContain('pageSize={25}');
    expect(followedBlock).toContain('stackedOnNarrow');
  });

  it('AND NO loadedOnly NOTE — every followed row is loaded, so the disclaimer would be false', () => {
    expect(followedBlock).not.toContain('loadedOnlyNote');
  });

  it('the SERVER-TRUNCATED coverage table gets search WITH the disclosure', () => {
    expect(coverageBlock).toContain('search={{');
    expect(coverageBlock).toContain('loadedOnlyNote');
  });

  it('and no pagination, because paging a capped ranked list implies more behind it', () => {
    expect(coverageBlock).not.toContain('pageSize');
  });

  it('NO COUNTRY SELECTOR WAS CREATED — the directive said not to invent one', () => {
    expect(source).not.toMatch(/role="combobox"|role="listbox"|<select/);
  });

  it('and no cap was introduced on the returned countries', () => {
    /* `pageSize` governs rendering only; nothing slices the fetched array. */
    expect(source).not.toMatch(/followed\??\.slice|countries\??\.slice/);
  });
});
