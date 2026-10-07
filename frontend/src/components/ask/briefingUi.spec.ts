import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BriefingListView, BriefingVersionView, briefingHref } from './BriefingViews';
import { briefingsAvailable, resetBriefingsAvailability } from '@/lib/ask/briefingStrings';
import type { AskV2BriefingDetail, AskV2BriefingVersion } from '@/lib/api/askV2Api';

/**
 * R2 · D1 — the minimal briefing UI (CTO checkpoint 4 §12): Save as briefing on an answer, a
 * Briefings section in Saved, and a read-only version page. No dashboard, no share, no export.
 */
const read = (file: string) => readFileSync(join(__dirname, file), 'utf8');
/* code only: comments removed, and the shared package's name is not a 'share' feature */
const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/@globalnews-ai\/shared/g, '');
const BACKEND = read('../../../../backend/src/modules/ask-v2/briefings/briefings.controller.ts');
const API = readFileSync(join(__dirname, '../../lib/api/askV2Api.ts'), 'utf8');

const detail: AskV2BriefingDetail = {
  id: 'b1',
  title: 'EAC rates',
  scope: { kind: 'ASK_QUESTION', question: 'Compare Kenya and Tanzania rates', storyId: 's1' },
  status: 'ACTIVE',
  createdAt: '2026-10-02T08:00:00Z',
  updatedAt: '2026-10-03T08:00:00Z',
  versions: [
    {
      version: 1,
      asOf: '2026-10-02T08:00:00Z',
      windowFrom: null,
      windowTo: '2026-10-02T08:00:00Z',
      createdAt: '2026-10-02T08:00:00Z',
    },
    {
      version: 2,
      asOf: '2026-10-03T08:00:00Z',
      windowFrom: '2026-10-02T08:00:00Z',
      windowTo: '2026-10-03T08:00:00Z',
      createdAt: '2026-10-03T08:00:00Z',
    },
  ],
  update: {
    kind: 'STORY_MATERIAL_UPDATE',
    available: true,
    recordedBriefVersion: 2,
    currentBriefVersion: 3,
  },
};
const version: AskV2BriefingVersion = {
  briefingId: 'b1',
  title: 'EAC rates',
  version: 1,
  asOf: '2026-10-02T08:00:00Z',
  windowFrom: null,
  windowTo: '2026-10-02T08:00:00Z',
  blocks: {
    schema: 'briefing-blocks/1',
    answerState: 'CURRENT_REPORTING',
    summary: 'Kenya held while Tanzania cut [1][2].',
    keyFacts: [{ claim: 'Kenya held at 9.5%', sourceArticleIds: ['a1'] }],
    comparisonTable: {
      schema: 'ask-comparison-table/1',
      omittedRows: 0,
      rows: [
        {
          kind: 'DIFFERENCE',
          topic: 'Policy rate',
          statement: 'Kenya: held',
          sourceArticleIds: ['a1'],
        },
        {
          kind: 'DIFFERENCE',
          topic: 'Policy rate',
          statement: 'Tanzania: cut',
          sourceArticleIds: ['a2'],
        },
      ],
    },
    background: null,
  },
  evidenceRefs: [
    {
      id: 'a1',
      host: 'one.example',
      url: 'https://one.example/k',
      title: 'Kenya holds',
      publisher: 'One',
      publishedAt: '2026-10-01T08:00:00Z',
    },
    {
      id: 'a2',
      host: 'two.example',
      url: 'https://two.example/t',
      title: 'Tanzania cuts',
      publisher: 'Two',
      publishedAt: '2026-10-02T07:00:00Z',
    },
  ],
  evidenceRevision: 'rev-1',
  coverageGaps: ['No official statement from Uganda'],
  createdAt: '2026-10-02T08:00:00Z',
  supersededBy: 2,
  aiExecuted: false,
};
const html = (locale: 'en' | 'pl' = 'en') =>
  renderToStaticMarkup(createElement(BriefingVersionView, { detail, version, locale }));

describe('R2 · D1 — briefing version page (read-only, zero compute)', () => {
  it('shows title, scope, version history, as-of, update status and the read-only note', () => {
    const out = html();
    expect(out).toContain('EAC rates');
    expect(out).toContain('Followed story');
    expect(out).toContain('data-update-available="true"');
    expect(out.match(/data-briefing="versions"/g)).toHaveLength(1);
    expect(out).toContain(`href="${briefingHref('b1', 1).replace('&', '&amp;')}"`);
    expect(out).toContain(`href="${briefingHref('b1', 2).replace('&', '&amp;')}"`);
    expect(out).toContain('opening it runs no AI');
  });

  it('discloses that a newer version exists without changing this one', () => {
    expect(html()).toContain('A newer version (2) exists');
    expect(html()).toContain('Kenya held while Tanzania cut');
  });

  it('shows coverage gaps, the evidence table and every source as a link', () => {
    const out = html();
    expect(out).toContain('No official statement from Uganda');
    expect(out).toContain('data-ask="evidence-table"');
    expect(out).toContain('href="https://one.example/k"');
    expect(out).toContain('href="https://two.example/t"');
  });

  it('is localized', () => {
    expect(html('pl')).toContain('Istnieje nowsza wersja (2)');
  });

  it('the list shows latest version and as-of time, linking to the briefing', () => {
    const out = renderToStaticMarkup(
      createElement(BriefingListView, {
        rows: [
          {
            id: 'b1',
            title: 'EAC rates',
            scope: { kind: 'ASK_QUESTION' },
            status: 'ACTIVE',
            createdAt: '2026-10-02T08:00:00Z',
            updatedAt: '2026-10-03T08:00:00Z',
            latestVersion: 2,
            latestAsOf: '2026-10-03T08:00:00Z',
          },
        ],
        locale: 'en',
      }),
    );
    expect(out).toContain(`href="${briefingHref('b1')}"`);
    expect(out).toContain('Version 2');
  });

  it('the views compose nothing and reach nothing: no fetch, no effect, no API in the presentation', () => {
    const views = code('BriefingViews.tsx');
    expect(views).not.toMatch(/fetch\(|useEffect|askV2Api\.|XMLHttpRequest/);
    expect(views).toMatch(/import type \{[^}]*\} from '@\/lib\/api\/askV2Api';/);
  });

  it('the detail page writes only Delete, after a confirmation; reads are GETs', () => {
    const page = read('BriefingDetailClient.tsx');
    expect(page.match(/askV2Api\.\w+/g)?.sort()).toEqual([
      'askV2Api.briefing',
      'askV2Api.briefingVersion',
      'askV2Api.deleteBriefing',
    ]);
    expect(page).toContain('window.confirm(t.deleteConfirm)');
  });

  it('no share or export exists anywhere in the briefing UI', () => {
    for (const f of [
      'BriefingViews.tsx',
      'BriefingDetailClient.tsx',
      'SavedBriefings.tsx',
      '../ask-frame/AskTurnBrief.tsx',
    ])
      expect(code(f)).not.toMatch(/share|export\s+as|download|navigator\.share|\.pdf|\.csv/i);
  });
});

describe('R2 · D1 — Save as briefing and its server contract', () => {
  it('the client paths are the routes the backend controller declares', () => {
    expect(BACKEND).toContain("@Controller('ask-v2/briefings')");
    expect(BACKEND).toContain("@Post(':id/versions')");
    expect(BACKEND).toContain("@Get(':id/versions/:version')");
    expect(BACKEND).toContain("@Delete(':id')");
    expect(API).toContain("'/ask-v2/briefings'");
    expect(API).toContain('/ask-v2/briefings/${encodeURIComponent(briefingId)}/versions');
  });

  it('is offered only where Save is, and only for produced answers', () => {
    /* ASK DESIGN COMPLETENESS R1 — "Use in a briefing" now lives in the answer toolbar's More
       sheet (Design C3); it is still gated by the same canSave the turn passes, and the turn
       still hands its own canSave to that toolbar. */
    const turn = read('../ask-frame/AskR2TurnView.tsx');
    expect(turn).toContain('canSave={canSave}');
    const toolbar = read('../ask-frame/AskAnswerToolbar.tsx');
    expect(toolbar).toContain('{canSave && (');
    expect(toolbar).toContain(
      '<AskTurnBrief operation={turn.operation} locale={locale} label={r.useInBriefing} />',
    );
    const brief = read('../ask-frame/AskTurnBrief.tsx');
    expect(brief).toContain('ASK_SAVABLE_ANSWER_STATES.has(state)');
  });

  it('is hidden unless the server has briefings on (one shared probe, fail closed)', async () => {
    resetBriefingsAvailability();
    const probe = jest.fn(async () => ({ ok: false }));
    expect(await briefingsAvailable(probe)).toBe(false);
    expect(await briefingsAvailable(probe)).toBe(false);
    expect(probe).toHaveBeenCalledTimes(1);
    resetBriefingsAvailability();
    expect(
      await briefingsAvailable(async () => {
        throw new Error('network');
      }),
    ).toBe(false);
    resetBriefingsAvailability();
    expect(await briefingsAvailable(async () => ({ ok: true }))).toBe(true);
    resetBriefingsAvailability();
  });
});
