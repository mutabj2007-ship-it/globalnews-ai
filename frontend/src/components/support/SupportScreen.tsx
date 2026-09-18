'use client';

import { useMemo, useState } from 'react';
import type { SupportTicketSummary } from '@globalnews-ai/shared';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { useAccount } from '@/lib/hooks/useAccount';
import type { SupportDictionary } from '@/lib/i18n/dictionaries/supportEn';
import { SUPPORT_API } from '@/lib/support/supportRoutes';
import { useSupportResource } from '@/lib/support/useSupportApi';
import { NewSupportRequestForm } from './NewSupportRequestForm';
import { SupportThread } from './SupportThread';
import { accountSignInUrl } from '@/lib/api/accountBase';
import { SupportConversation } from './conversation/SupportConversation';
import { createNoTransportAdapter } from '@/lib/support/conversation/noTransportAdapter';

/*
  M-ALPHA-AUTH — the defect the user actually reported was here: signing in from
  /support returned them to the homepage. The cause was not on this page. The
  backend callback ended with an unconditional redirect to the frontend origin
  and there was no returnTo concept anywhere in the product. This constant is
  this surface's half of the repair.
*/
const SUPPORT_RETURN_DESTINATION = '/support';

/**
 * S4 — the authenticated user Support surface, and the one client boundary
 * for it.
 *
 * FIVE STATES, AND THE FOURTH AND FIFTH ARE THE POINT.
 *
 *   not signed in  an explicit invitation, never an error. GlobalNews AI works
 *                  without an account and this page must not imply otherwise.
 *   loading        chrome only
 *   empty          "you have not opened a request yet"
 *   error          "your requests could not be loaded"
 *   real           the list
 *
 * EMPTY AND ERROR ARE DIFFERENT THINGS AND ARE SHOWN DIFFERENTLY. The RC-F1
 * audit credited the admin queue for making that distinction and faulted
 * `useAccount` for collapsing it, so this surface — written immediately after
 * that finding — must not repeat the mistake it reported. Someone told "you
 * have no requests" when the load actually failed will not open a second
 * request, and the real one they already opened goes unanswered.
 *
 * ONE FETCH DRIVES THE LIST; the thread fetches itself when one is opened. A
 * failed thread does not blank the list, and a failed list does not hide a
 * thread.
 *
 * THIS COMPONENT USES NavBar AND Footer, AND MODIFIES NEITHER. `app/history`
 * establishes that an account page renders the shared chrome with no props;
 * consuming a component is not owning it, and no navigation entry is added
 * here. The account-menu link to this page is a separate, deferred change in
 * files another lane owns.
 */
export function SupportScreen({
  t,
  language,
}: {
  t: SupportDictionary;
  /** Resolved once, on the server, and passed straight through. */
  language: 'en' | 'pl';
}): JSX.Element {
  const { user, isLoading: isAccountLoading } = useAccount();
  const [openReference, setOpenReference] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  /*
    SUPPORT AI CONVERSATION V1 — THE TICKET SURFACE IS DEMOTED, NOT REMOVED.

    F `01`: "a ticket is what a conversation BECOMES when it escalates —
    escalation infrastructure, not the UX." So the conversation is what a
    reader meets, and the request list they opened before this surface existed
    is one deliberate click away, closed by default.

    Closed by default is also why `tickets` is fetched lazily below: a reader
    having an ordinary conversation makes NO ticket API call at all, which is
    a property the evidence harness measures rather than a claim.
  */
  const [showTickets, setShowTickets] = useState(false);

  /*
    Built once per mount. The adapter is stateless, but `SupportConversation`
    subscribes to `onOperatorTurn` keyed on its identity, and a new object every
    render would re-subscribe on every render.
  */
  const conversationAdapter = useMemo(() => createNoTransportAdapter(), []);

  // A null path means "do not fetch": there is no session, or the reader has
  // not asked for their earlier requests, so there is nothing to load and
  // nothing worth a 401.
  const tickets = useSupportResource<SupportTicketSummary[]>(
    !isAccountLoading && user && showTickets ? SUPPORT_API.tickets : null,
  );

  const list = tickets.data ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-void">
      <NavBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {openReference !== null && user ? (
          <SupportThread t={t} reference={openReference} onBack={() => setOpenReference(null)} />
        ) : (
          <section className="flex flex-col gap-6">
            {/*
              The page heading now belongs to the conversation, which owns the
              surface. For a signed-out visitor the old heading still leads, so
              the page never opens with no title.
            */}
            {!user && (
              <header className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold text-ink-primary">{t.heading}</h1>
                <p className="text-ink-secondary">{t.intro}</p>
              </header>
            )}

            {!isAccountLoading && !user && (
              <div className="rounded-lg border border-cyan-500/15 p-5">
                <p className="font-semibold text-ink-primary">{t.signedOut.title}</p>
                <p className="mt-1 text-sm text-ink-secondary">{t.signedOut.body}</p>
                {/*
                  SUPPORT CLOSURE — THE SIGN-IN ACTION, NOT A SECOND AUTH PATH.
                  Help is now discoverable from the public chrome, so a signed-out
                  visitor arrives here on purpose. Telling them to sign in without
                  giving them the means to is a dead end, and this screen was one.
                  It is the SAME first-party /api/auth/google navigation
                  AccountControl already uses — a plain link to the existing
                  endpoint, no new route, no popup, no client-side auth logic.
                */}
                <a
                  href={accountSignInUrl(SUPPORT_RETURN_DESTINATION)}
                  className="mt-4 inline-flex min-h-[44px] items-center rounded-full border border-cyan-500/40 px-4 py-1.5 text-sm text-ink-primary hover:border-cyan-400/70"
                >
                  {t.signedOut.signIn}
                </a>
              </div>
            )}

            {/*
              E1 C-11 — THERE IS NO ANONYMOUS CONVERSATION SURFACE IN V1. The
              conversation renders for the signed-in owner only; a signed-out
              visitor gets the invitation above, which is the same treatment
              the request list already had. This is a UI expression of a rule
              the server must also hold — the browser's gate is a courtesy, the
              route guard is the control.
            */}
            {/*
              ALPHA-VISUAL-SUPPORT-FIXTURE-ISOLATION-R2 — THE LIVE ADAPTER,
              NAMED HERE.

              This line used to be `<SupportConversation t={t} locale={language} />`
              and the missing prop is what made the defect. `SupportConversation`
              defaulted the adapter to `createMockConversationAdapter()`, so the
              live surface answered from checked-in fixtures without any file in
              the live path ever mentioning them. Both "Jak działa GlobalNews AI?"
              and "How does GlobalNews AI work?" contain `news`, matched the
              mock's ANALYSIS route, and came back as a fabricated news finding
              citing two publishers that do not exist.

              The adapter is now required and is written out here, which is the
              point: the only implementation this file can reach is the one it
              imports. Until a real grounded Support transport exists that is
              `createNoTransportAdapter` — it answers every turn with F's one
              approved WITHHELD text and reaches nothing. Swapping it for the
              real transport is an edit to this line and to nothing else.
            */}
            {user && (
              <SupportConversation
                t={t}
                locale={language}
                adapter={conversationAdapter}
                /*
                  R2-1 — THE ONE REAL ROUTE TO A PERSON, MADE REACHABLE.

                  The no-transport adapter cannot deliver a handoff, so the
                  conversation offers no "ask for a person" control and points
                  here instead. This opens the request surface and the new
                  request form together, because the reader's goal is to reach
                  somebody, not to browse what they filed before — and a route
                  that is two unexplained clicks deep is not a route.

                  Nothing is submitted here. The reader writes their own
                  subject, chooses their own category and sends it themselves,
                  through the existing POST /support/tickets contract, which
                  opens the ticket in AWAITING_ADMIN server-side. That
                  transition is the measurable backend state change the
                  invariant asks for, and it happens because a person chose it.
                */
                onOpenRequestSurface={() => {
                  setShowTickets(true);
                  setComposing(true);
                }}
              />
            )}

            {user && (
              <>
                <div className="flex flex-col gap-2 border-t border-cyan-500/15 pt-6">
                  <h2 className="text-lg font-semibold text-ink-primary">
                    {t.conversation.tickets.heading}
                  </h2>
                  <p className="text-sm text-ink-secondary">{t.conversation.tickets.body}</p>
                  <button
                    type="button"
                    onClick={() => setShowTickets((open) => !open)}
                    aria-expanded={showTickets}
                    className="self-start rounded-full border border-cyan-500/25 px-4 py-1.5 text-sm text-ink-secondary hover:border-cyan-400/60"
                  >
                    {showTickets ? t.conversation.tickets.hide : t.conversation.tickets.open}
                  </button>
                </div>
              </>
            )}

            {user && showTickets && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-ink-primary">{t.list.heading}</h2>
                  {!composing && (
                    <button
                      type="button"
                      onClick={() => setComposing(true)}
                      className="rounded-full border border-cyan-500/40 px-4 py-1.5 text-sm text-ink-primary hover:border-cyan-400/70"
                    >
                      {t.list.newRequest}
                    </button>
                  )}
                </div>

                {composing && (
                  <NewSupportRequestForm
                    t={t}
                    language={language}
                    onCreated={(created) => {
                      setComposing(false);
                      tickets.reload();
                      /*
                        SUPPORT-AI-1 — OPEN THE THREAD THAT WAS JUST CREATED.

                        The agent's first response is already stored and
                        already in this response. Landing back on the list
                        would leave the person looking at a row and having to
                        work out that there is something to read inside it,
                        which is barely better than the empty conversation
                        this feature exists to remove.
                      */
                      setOpenReference(created.reference);
                    }}
                    onCancel={() => setComposing(false)}
                  />
                )}

                {tickets.state === 'loading' && (
                  <p className="text-ink-secondary">{t.list.loading}</p>
                )}

                {tickets.state === 'error' && (
                  <div role="alert" className="rounded-lg border border-red-500/40 p-5">
                    <p className="font-semibold text-red-300">{t.list.errorTitle}</p>
                    <p className="mt-1 text-sm text-ink-secondary">{t.list.errorBody}</p>
                    <button
                      type="button"
                      onClick={tickets.reload}
                      className="mt-3 rounded-full border border-cyan-500/25 px-4 py-1.5 text-sm text-ink-secondary hover:border-cyan-400/60"
                    >
                      {t.list.retry}
                    </button>
                  </div>
                )}

                {tickets.state === 'real' && list.length === 0 && !composing && (
                  <div className="rounded-lg border border-cyan-500/15 p-5">
                    <p className="font-semibold text-ink-primary">{t.list.emptyTitle}</p>
                    <p className="mt-1 text-sm text-ink-secondary">{t.list.emptyBody}</p>
                  </div>
                )}

                {tickets.state === 'real' && list.length > 0 && (
                  <ul className="flex flex-col gap-3">
                    {list.map((ticket) => (
                      <li key={ticket.reference}>
                        <button
                          type="button"
                          onClick={() => setOpenReference(ticket.reference)}
                          className="flex w-full flex-col gap-1 rounded-lg border border-cyan-500/15 px-4 py-3 text-left hover:border-cyan-400/40"
                        >
                          <span className="text-ink-primary">{ticket.subject}</span>
                          <span className="text-xs text-ink-secondary">
                            <span className="font-mono">{ticket.reference}</span> ·{' '}
                            {t.categories[ticket.category]} · {t.statuses[ticket.status]} ·{' '}
                            {ticket.messageCount} {t.list.messageCount}
                          </span>
                          <span className="text-xs text-ink-secondary">
                            {t.list.lastActivity}: {ticket.updatedAt}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
