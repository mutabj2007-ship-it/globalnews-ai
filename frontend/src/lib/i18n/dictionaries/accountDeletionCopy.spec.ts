import { getDictionary } from './index';

/**
 * RC-2A / D-4 — THE IRREVERSIBLE-DELETION CONFIRMATION MUST NOT UNDERSTATE
 * WHAT IT DESTROYS.
 *
 * The previous copy named ONE of the things account deletion removes ("your
 * saved history"). `prisma.user.delete()` cascades across five owned tables:
 * SearchHistoryEntry, UserIdentity, Session, CountryFollow and SupportTicket
 * (which in turn cascades to SupportMessage, so staff replies go too), and
 * severs ProductEvent.userId.
 *
 * A user who read "removes your saved history" and confirmed also lost their
 * Watch list, every support conversation and their sign-in link, having been
 * told about none of it. Under-describing an irreversible destructive action
 * is the same class of defect as a fabricated publication timestamp.
 *
 * THIS SUITE IS COPY-ONLY. Deletion behaviour is unchanged and no backend file
 * was touched; these tests guard the wording, in both languages, against
 * regressing to the narrow claim.
 */
describe('D-4 — account-deletion confirmation copy', () => {
  const en = getDictionary('en').navBar.deleteAccountConfirm;
  const pl = getDictionary('pl').navBar.deleteAccountConfirm;

  it('ENGLISH no longer claims that only saved history is removed', () => {
    // The exact pre-correction sentence, which must never come back.
    expect(en).not.toBe(
      'Delete your account? This permanently removes your saved history and cannot be undone.',
    );
    expect(en).not.toMatch(/removes your saved history and cannot be undone/);
  });

  it('ENGLISH names every category the deletion actually destroys', () => {
    expect(en).toMatch(/saved history/i);
    expect(en).toMatch(/followed countries/i);
    expect(en).toMatch(/support requests/i);
    expect(en).toMatch(/messages/i);
    expect(en).toMatch(/sessions/i);
  });

  it('ENGLISH still states plainly that the action is irreversible', () => {
    expect(en).toMatch(/cannot be undone/i);
    expect(en).toMatch(/permanent/i);
  });

  it('POLISH no longer claims that only saved history is removed', () => {
    expect(pl).not.toBe(
      'Usunąć konto? Spowoduje to trwałe usunięcie zapisanej historii i nie można tego cofnąć.',
    );
  });

  it('POLISH names every category the deletion actually destroys', () => {
    expect(pl).toMatch(/zapisanej historii/i);
    expect(pl).toMatch(/obserwowanych krajów/i);
    expect(pl).toMatch(/zgłoszeń do pomocy/i);
    expect(pl).toMatch(/wiadomościami/i);
    expect(pl).toMatch(/sesji/i);
  });

  it('POLISH still states plainly that the action is irreversible', () => {
    expect(pl).toMatch(/nie można cofnąć/i);
    expect(pl).toMatch(/trwałe/i);
  });

  it('POLISH is a real translation, not the English string', () => {
    expect(pl).not.toBe(en);
    expect(pl.length).toBeGreaterThan(60);
  });

  it('neither language leaks implementation terminology', () => {
    for (const copy of [en, pl]) {
      expect(copy).not.toMatch(/ProductEvent|SearchHistoryEntry|CountryFollow|SupportTicket|SupportMessage|UserIdentity|prisma|userId|cascade/i);
    }
  });

  it('the copy still reaches the confirmation surface through the existing dictionary architecture', () => {
    // AccountControl receives it as deleteAccountConfirmLabel from navBar;
    // no second copy of this string exists anywhere.
    expect(getDictionary('en').navBar.deleteAccountConfirm).toBe(en);
    expect(getDictionary('pl').navBar.deleteAccountConfirm).toBe(pl);
  });
});
