'use client';

import { useAdminContext } from '../shell/AdminContext';
import { sectionNumber, sectionState } from '@/lib/admin/adminDataState';
import { ADMIN_API } from '@/lib/admin/adminRoutes';
import { useAdminResource, type AdminResource } from '@/lib/admin/useAdminResource';
import type { AdminCoverageGeographyResponse } from '@/lib/admin/adminApiTypes';
import { AdminDataTable } from '../primitives/AdminDataTable';
import { AdminPanel } from '../primitives/AdminPanel';
import { KpiCard } from '../primitives/KpiCard';
import { PlaceholderPanel } from '../primitives/PlaceholderPanel';

/**
 * ADMIN-03 — the geography tab. THREE GEOGRAPHIES, AND THEY ARE NOT THE
 * SAME THING.
 *
 *   COVERAGE      where stored reporting is ABOUT. Computed over
 *                 ArticleCountry. Says nothing about any person.
 *   FOLLOWED      which countries signed-in accounts CHOSE. Declared
 *                 interest — and a reader in one country routinely
 *                 follows another, so this is not a location either.
 *   AUDIENCE      where readers ARE. NOT IMPLEMENTED, with no field in
 *                 the contract for it to occupy.
 *
 * The failure this file exists to prevent is the quiet relabelling of
 * either of the first two as the third. So each is titled for exactly
 * what it measures, the followed panel carries the CTO-approved wording
 * verbatim, and audience geography keeps a visible, explicitly inert
 * panel stating why it is absent — which is a stronger disclosure than
 * omitting it, because an omitted panel invites somebody to build one.
 */
/**
 * What a reader types when looking for a country: the code, or the name when the
 * row carries one. Case- and whitespace-insensitive, and a SUBSTRING match rather
 * than a prefix — "land" should find Poland and Finland, because a reader
 * scanning a 195-row list is more often checking presence than spelling a prefix.
 *
 * Deliberately NOT a stringify-everything matcher: the follower COUNT is a number
 * nobody searches by, and matching it would make typing "12" select unrelated
 * rows.
 */
function matchesCountry(query: string, code: string, name?: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return (
    code.toLowerCase().includes(needle) || (name !== undefined && name.toLowerCase().includes(needle))
  );
}

export function AnalyticsGeographyTab({
  resource,
}: { resource?: AdminResource<AdminCoverageGeographyResponse> } = {}): JSX.Element {
  return resource ? <GeographyData geography={resource} /> : <GeographyResource />;
}

function GeographyResource(): JSX.Element {
  const geography = useAdminResource<AdminCoverageGeographyResponse>(
    ADMIN_API.analyticsCoverageGeography,
  );
  return <GeographyData geography={geography} />;
}

function GeographyData({
  geography,
}: {
  geography: AdminResource<AdminCoverageGeographyResponse>;
}): JSX.Element {
  const { t } = useAdminContext();
  const screen = t.screens.analytics;

  const countries = geography.data?.countries ?? null;
  const followed = geography.data?.followedCountries ?? null;

  const coverageState = sectionState(geography.state, countries);
  const followedState = sectionState(geography.state, followed);

  const isTruncated =
    countries !== null &&
    geography.data !== null &&
    countries.length >= geography.data.countryLimit;

  return (
    <>
      <AdminPanel
        title={screen.geographyTitle}
        field="admin-03.contentGeography"
        note={screen.geographyNote}
      >
        <div className="grid grid-cols-1 gap-3 adm-rail:grid-cols-2">
          <KpiCard
            label={screen.coverageDistinct}
            field="admin-03.contentGeography"
            data={sectionNumber(
              geography.state,
              geography.data?.distinctCountriesWithRelevantCoverage ?? null,
              geography.data?.distinctCountriesWithRelevantCoverage ?? undefined,
            )}
            onRetry={geography.reload}
          />
        </div>

        {/*
          THE CAP IS DISCLOSED WHERE THE LIST IS. The distinct count above
          is computed over every country before the ranked list is
          truncated, so the two numbers legitimately disagree — and a
          reader who is not told that would reasonably conclude the
          platform covers only what it can see.
        */}
        {isTruncated && (
          <p className="text-[11px] leading-relaxed text-adm-ink-dim">{screen.coverageTruncated}</p>
        )}

        <AdminDataTable
          caption={screen.geographyTitle}
          state={coverageState}
          rows={countries ?? []}
          rowKey={(row) => row.countryCode}
          emptyTitle={screen.geographyTitle}
          emptyBody={screen.geographyRequirement}
          onRetry={geography.reload}
          /*
            SEARCH, BUT WITH THE TRUNCATION SAID OUT LOUD. This list is a ranked
            subset — the server caps it at `countryLimit` — so a search that finds
            nothing means "not in the top N", NOT "not covered". `loadedOnlyNote`
            is passed for exactly that reason, and it is not optional for a
            truncated table: without it a reader would take an empty result as a
            statement about the whole dataset.

            NO PAGINATION HERE, deliberately. Paging a 25-row ranked list would
            imply there is more behind it when the cap is the reason there is not.
          */
          search={{
            label: screen.coverageSearchLabel,
            matches: (row, query) => matchesCountry(query, row.countryCode, row.countryName),
          }}
          loadedOnlyNote={t.table.loadedOnly}
          columns={[
            {
              id: 'country',
              header: screen.coverageCountryColumn,
              render: (row) => `${row.countryName} (${row.countryCode})`,
            },
            {
              id: 'relevant',
              header: screen.coverageRelevantColumn,
              align: 'right',
              render: (row) => String(row.relevantArticleCount),
            },
            {
              id: 'total',
              header: screen.coverageTotalColumn,
              align: 'right',
              secondary: true,
              render: (row) => String(row.totalArticleCount),
            },
          ]}
        />
      </AdminPanel>

      {/*
        THE TITLE IS THE CTO-APPROVED WORDING, VERBATIM AND UNABBREVIATED.
        "Followed countries" alone would be read as audience geography
        within a week; the qualifier is the panel, not decoration on it.
      */}
      <AdminPanel
        title={screen.followedTitle}
        field="admin-03.followedCountries"
        note={screen.followedPurpose}
      >
        <AdminDataTable
          caption={screen.followedTitle}
          state={followedState}
          rows={followed ?? []}
          rowKey={(row) => row.countryCode}
          emptyTitle={screen.followedEmptyTitle}
          emptyBody={screen.followedEmptyBody}
          onRetry={geography.reload}
          /*
            THE MEASURED NEED. This list is UNCAPPED server-side — one row per
            distinct followed country, so up to ~195 — and it had no search, no
            paging and no truncation notice. It is the one admin table that is
            both long and complete.

            NO `loadedOnlyNote` HERE, and that absence is the point: every row is
            loaded, so search really does cover every record, and saying otherwise
            would be a false disclaimer. PAGINATION IS NOT A CAP — all rows are
            fetched, searched and reachable; only how many render at once changes.
          */
          search={{
            label: screen.followedSearchLabel,
            matches: (row, query) => matchesCountry(query, row.countryCode),
          }}
          pageSize={25}
          stackedOnNarrow
          columns={[
            {
              id: 'country',
              header: screen.followedCountryColumn,
              render: (row) => row.countryCode,
            },
            {
              id: 'accounts',
              header: screen.followedAccountsColumn,
              align: 'right',
              render: (row) => String(row.followerAccountCount),
            },
          ]}
        />
      </AdminPanel>

      <PlaceholderPanel
        title={screen.audienceGeographyTitle}
        purpose={screen.geographyNote}
        requirement={screen.audienceGeographyRequirement}
        field="admin-03.audienceGeography"
        ratio="min-h-[160px]"
      />
    </>
  );
}
