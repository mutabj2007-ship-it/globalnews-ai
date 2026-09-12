import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AnalysisApiResponse,
  SupportCategory,
  SupportTicketStatus,
} from '@globalnews-ai/shared';
import { AnalysisService } from '../analysis/service/analysis.service';

/**
 * SUPPORT-AI-1 — the GlobalNews AI Support Agent.
 *
 * THE ONE PLACE IN THE SUPPORT MODULE THAT KNOWS AN AI EXISTS. Every
 * other support file is unchanged in this respect, and the contract
 * specs assert it: `AnalysisService` appears here and nowhere else under
 * modules/support, and no file in the module contains an OpenAI client
 * of any kind. There is no second analysis pipeline; this class calls
 * the existing one.
 *
 * WHAT THE AGENT IS ALLOWED TO BE. It answers a news question when the
 * existing evidence-grounded pipeline produces a defensible answer, and
 * otherwise it says so and leaves the request with the human Support
 * team. It never resolves anything, never claims a repair, never claims
 * an account or a piece of content was changed, and never speaks as an
 * administrator. Those are not stylistic preferences: RESOLVED is
 * human-controlled, and a machine that can close its own tickets is a
 * machine that can close a ticket nobody answered.
 *
 * SIX OF THE SEVEN CATEGORIES NEVER REACH A PROVIDER AT ALL, AND NOW
 * RECEIVE NO AUTOMATED CONVERSATION MESSAGE EITHER. R4 SUPPORT UX
 * CLOSURE removed the deterministic per-category acknowledgement that
 * used to be written at creation. A bug report does not need a language
 * model to be acknowledged honestly — and it does not need a stored
 * message to be acknowledged at all. The ticket reference and status
 * already say the request arrived. A permanent conversation entry whose
 * entire content is "we received this and nothing has been fixed" is
 * noise in the one place the requester will look for a real answer.
 *
 * WHAT REMAINS. A NEWS_QUESTION receives exactly ONE stored SYSTEM_AI
 * message: either an evidence-grounded answer or the honest fallback
 * that says one could not be produced. Every other category stores
 * nothing from the agent at all.
 */
export type SupportAiLanguage = 'en' | 'pl';

/** The ONLY category permitted to reach AnalysisService. */
export const ANALYSIS_ELIGIBLE_CATEGORY: SupportCategory = 'NEWS_QUESTION';

export const SUPPORT_AI_DEFAULT_TIMEOUT_MS = 20_000;
export const SUPPORT_AI_DEFAULT_MAX_CONCURRENT = 2;
export const SUPPORT_AI_DEFAULT_PER_USER_WINDOW_MS = 15 * 60_000;
export const SUPPORT_AI_DEFAULT_PER_USER_LIMIT = 5;

/**
 * Why the agent did not produce an evidence-grounded answer.
 *
 * A MACHINE KEY, NEVER SHOWN TO THE USER. The user reads the same
 * honest fallback sentence whichever of these applies, because the
 * difference between "we are rate limiting you" and "the provider
 * failed" is operational detail they cannot act on — and one of them
 * would disclose the shape of the limiter. The key exists for the
 * server log and for tests.
 */
export type SupportAiSkipReason =
  | 'disabled'
  | 'not-eligible'
  | 'per-user-allowance'
  | 'concurrency'
  | 'timeout'
  | 'provider-failed'
  | 'no-evidence';

/**
 * What the server decides about a ticket AT CREATION.
 *
 * THERE IS NO `body` HERE, AND THAT IS THE POINT. Creation stores the
 * requester's own message and nothing else. This carries only the two
 * server-derived facts the write needs: the state the ticket opens in,
 * and whether it is allowed one analysis attempt afterwards.
 */
export interface SupportTicketCreationState {
  /** Server-derived. AWAITING_ADMIN at creation, for every category. */
  status: Extract<SupportTicketStatus, 'AWAITING_ADMIN'>;
  /** Whether this category may be followed by ONE analysis attempt. */
  analysisEligible: boolean;
}

export interface SupportAiAnswer {
  body: string;
  status: Extract<SupportTicketStatus, 'AWAITING_USER' | 'AWAITING_ADMIN'>;
  skipReason?: SupportAiSkipReason;
}

/**
 * The honest no-answer reply for a news question.
 *
 * IT SAYS THE ANSWER COULD NOT BE PRODUCED. It does not apologise its
 * way into implying one is coming automatically, and it does not
 * manufacture a helpful-sounding summary out of nothing, which is the
 * single most likely way this feature could damage the product.
 */
const NEWS_FALLBACK: Record<SupportAiLanguage, string> = {
  en: 'I could not produce an answer I am able to stand behind. That is a statement about the evidence available to me right now, not about your question: either the stored reporting did not support a defensible answer, or the analysis could not be completed. I have not guessed, because a confident-sounding answer with nothing behind it would be worse than none. Your request stays with the human Support team and somebody will read it.',
  pl: 'Nie udało mi się przygotować odpowiedzi, za którą mógłbym ręczyć. To stwierdzenie o materiałach dostępnych mi w tej chwili, a nie o Twoim pytaniu: albo zapisane doniesienia nie pozwalały na uzasadnioną odpowiedź, albo analiza nie mogła zostać ukończona. Nie zgadywałem, ponieważ pewnie brzmiąca odpowiedź bez pokrycia byłaby gorsza niż jej brak. Twoje zgłoszenie pozostaje przy zespole wsparcia i ktoś je przeczyta.',
};

const ANSWER_PREAMBLE: Record<SupportAiLanguage, string> = {
  en: 'Based on the reporting GlobalNews AI has stored, here is what I can support:',
  pl: 'Na podstawie doniesień zapisanych przez GlobalNews AI mogę potwierdzić, co następuje:',
};

const ANSWER_SOURCES_LABEL: Record<SupportAiLanguage, string> = {
  en: 'Sources this rests on',
  pl: 'Źródła, na których to się opiera',
};

const ANSWER_LIMITS: Record<SupportAiLanguage, string> = {
  en: 'This is drawn only from the reporting listed above and may be incomplete or out of date. It is not a technical support answer and confirms no repair. Reply here if it does not answer what you asked, and a person will pick it up.',
  pl: 'Pochodzi to wyłącznie z wymienionych wyżej doniesień i może być niepełne lub nieaktualne. Nie jest to odpowiedź wsparcia technicznego i nie potwierdza żadnej naprawy. Odpowiedz tutaj, jeśli to nie odpowiada na Twoje pytanie, a zajmie się tym człowiek.',
};

/**
 * The query handed to the analysis pipeline.
 *
 * THE SUBJECT AND THE MESSAGE. NOTHING ELSE. No user id, no address, no
 * session, no reference, no ticket metadata, no ownership, no database
 * identifier, and no message that was not written by the requester
 * themselves in this one request. Pure and exported so a spec can assert
 * what it produces rather than trusting that the call site behaved.
 */
export function buildAnalysisQuery(subject: string, message: string): string {
  return `${subject.trim()}\n\n${message.trim()}`.trim();
}

/**
 * Pure, exported: the state a new ticket opens in.
 *
 * IT RETURNS NO TEXT. Nothing is composed here, because nothing is
 * stored here. R4 SUPPORT UX CLOSURE removed the automated
 * acknowledgement message; what survived is the state decision it used
 * to carry alongside the copy.
 */
export function creationStateFor(category: SupportCategory): SupportTicketCreationState {
  return {
    /*
      AWAITING_ADMIN FOR EVERY CATEGORY AT THIS POINT, INCLUDING A NEWS
      QUESTION. A news question moves to AWAITING_USER only if an answer
      is actually produced. Starting there and moving BACK would mean a
      ticket whose analysis step died mid-flight sat in AWAITING_USER --
      waiting for a user who has nothing to reply to, and out of the
      operator's "needs me" view. Failing towards the human is the only
      safe direction.

      For the six categories that never reach a provider this is now the
      ticket's ONLY server-set state, and it is the correct one: the
      request is with the human Support team from the moment it opens.
    */
    status: 'AWAITING_ADMIN',
    analysisEligible: category === ANALYSIS_ELIGIBLE_CATEGORY,
  };
}

/** Pure, exported: the fallback body. Same text for every skip reason. */
export function newsFallbackFor(language: SupportAiLanguage): string {
  return NEWS_FALLBACK[language];
}

@Injectable()
export class SupportAiService {
  private readonly logger = new Logger(SupportAiService.name);

  /**
   * The per-user allowance and the global concurrency count.
   *
   * IN-PROCESS, AND THAT IS A REAL LIMITATION RECORDED RATHER THAN
   * BURIED: two backend instances carry two allowances, so the effective
   * platform-wide bound is this times the instance count. The same is
   * already true of AnalysisRateLimitGuard and of the telemetry ingest
   * ceiling; solving it needs a shared store, which is a dependency this
   * lane is not authorized to add and does not need at MVP scale.
   *
   * THIS IS A SECOND BUDGET, NOT THE ANALYSIS ROUTE'S. POST /analysis/news
   * is protected by AnalysisRateLimitGuard, which is an HTTP guard and
   * cannot see a direct service call. Modifying it would be a change to
   * the Analysis engine. So a user can spend this allowance AND that
   * one; this bound is deliberately small for exactly that reason.
   */
  private readonly userWindows = new Map<string, { startedAt: number; used: number }>();
  private inFlight = 0;

  /**
   * How many account windows are currently retained. DIAGNOSTIC ONLY.
   *
   * It exists so a regression test can assert the bounded-memory property
   * directly rather than inferring it from behaviour. It is read-only, is
   * not injected anywhere, appears in no controller, no DTO and no route,
   * and discloses nothing about any individual account -- a spec asserts
   * that the support module exposes it through no HTTP surface.
   */
  get trackedAccountCount(): number {
    return this.userWindows.size;
  }

  constructor(
    private readonly analysis: AnalysisService,
    private readonly config: ConfigService,
  ) {}

  /** Fail-closed: anything other than the exact string "true" is off. */
  get enabled(): boolean {
    return this.config.get<string>('SUPPORT_AI_ENABLED') === 'true';
  }

  get timeoutMs(): number {
    return this.positiveInt('SUPPORT_AI_TIMEOUT_MS', SUPPORT_AI_DEFAULT_TIMEOUT_MS);
  }

  get maxConcurrent(): number {
    return this.positiveInt('SUPPORT_AI_MAX_CONCURRENT', SUPPORT_AI_DEFAULT_MAX_CONCURRENT);
  }

  get perUserWindowMs(): number {
    return this.positiveInt('SUPPORT_AI_PER_USER_WINDOW', SUPPORT_AI_DEFAULT_PER_USER_WINDOW_MS);
  }

  get perUserLimit(): number {
    return this.positiveInt('SUPPORT_AI_PER_USER_LIMIT', SUPPORT_AI_DEFAULT_PER_USER_LIMIT);
  }

  /**
   * ONE analysis attempt for ONE newly created news question.
   *
   * Every path returns a stored-able body. This method NEVER throws, so
   * an analysis failure cannot roll back or lose a ticket that has
   * already been committed — which is the whole reason it is called
   * after the transaction rather than inside it.
   */
  async answerNewsQuestion(input: {
    userId: string;
    category: SupportCategory;
    subject: string;
    message: string;
    language: SupportAiLanguage;
    now?: number;
  }): Promise<SupportAiAnswer> {
    const now = input.now ?? Date.now();

    if (input.category !== ANALYSIS_ELIGIBLE_CATEGORY) {
      return this.fallback(input.language, 'not-eligible');
    }
    if (!this.enabled) {
      return this.fallback(input.language, 'disabled');
    }
    if (!this.admitUser(input.userId, now)) {
      return this.fallback(input.language, 'per-user-allowance');
    }
    if (this.inFlight >= this.maxConcurrent) {
      // NO QUEUE. A queue turns a burst into a longer burst and hides
      // the cost; refusing turns it into a stored honest answer.
      this.logger.warn('Support AI concurrency bound reached; answering from the stored fallback.');
      return this.fallback(input.language, 'concurrency');
    }

    const query = buildAnalysisQuery(input.subject, input.message);

    this.inFlight += 1;
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      this.inFlight -= 1;
    };

    try {
      /*
        THE TIMEOUT BOUNDS THE USER'S WAIT, NOT THE PROVIDER CALL, AND
        SAYING SO MATTERS. AnalysisService.analyzeNews takes no abort
        signal, and giving it one would be a change to the Analysis
        engine. So when the timeout wins, the underlying request is
        still running. Two consequences are handled rather than ignored:
        its rejection is absorbed so it cannot surface as an unhandled
        rejection, and the CONCURRENCY SLOT IS RELEASED WHEN THE CALL
        ITSELF SETTLES, not when the race resolves -- releasing early
        would make the bound a number that describes nothing.
      */
      /*
        STARTED INSIDE Promise.resolve().then SO A SYNCHRONOUS THROW IS A
        REJECTION. If analyzeNews threw before returning a promise, a bare
        call would skip the settle handlers below and leak the concurrency
        slot for the lifetime of the process -- a bound that silently
        tightens to zero is worse than no bound.
      */
      const call = Promise.resolve()
        .then(() => this.analysis.analyzeNews(query, input.language))
        .then(
          (value) => {
            release();
            return value;
          },
          (error: unknown) => {
            release();
            throw error;
          },
        );

      const result = await this.raceWithTimeout(call, this.timeoutMs);

      if (result === null) return this.fallback(input.language, 'timeout');

      return this.fromAnalysis(result, input.language);
    } catch (error) {
      this.logger.warn(
        `Support AI analysis failed: ${(error as Error)?.message ?? 'unknown'}. The ticket is unaffected.`,
      );
      return this.fallback(input.language, 'provider-failed');
    }
  }

  /** Resolves to null when the timeout wins. */
  private async raceWithTimeout(
    call: Promise<AnalysisApiResponse>,
    timeoutMs: number,
  ): Promise<AnalysisApiResponse | null> {
    let timer: NodeJS.Timeout | undefined;

    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
      // Do not hold the process open for a timer nobody is waiting on.
      timer.unref?.();
    });

    try {
      // The loser keeps running; its rejection is absorbed here so a slow
      // provider failure after a timeout cannot become an unhandled
      // rejection and take the process down.
      call.catch(() => undefined);
      return await Promise.race([call, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Turn an analysis response into a support answer, or refuse to.
   *
   * THE BAR IS DELIBERATELY HIGH: a successful provenance status, a
   * validated result, and at least one real source. A summary with no
   * source behind it is exactly the confident-sounding invention this
   * whole feature has to avoid, so it is treated as no answer at all.
   */
  private fromAnalysis(
    response: AnalysisApiResponse,
    language: SupportAiLanguage,
  ): SupportAiAnswer {
    const analysis = response.analysis;

    if (response.provenance.status !== 'success' || analysis === null) {
      return this.fallback(language, 'provider-failed');
    }

    const publishers = [...new Set(analysis.sources.map((source) => source.publisher))].filter(
      (publisher) => publisher.trim().length > 0,
    );

    if (publishers.length === 0 || analysis.summary.trim().length === 0) {
      return this.fallback(language, 'no-evidence');
    }

    const body = [
      ANSWER_PREAMBLE[language],
      '',
      analysis.headline.trim(),
      '',
      analysis.summary.trim(),
      '',
      `${ANSWER_SOURCES_LABEL[language]}: ${publishers.join(', ')}`,
      '',
      ANSWER_LIMITS[language],
    ].join('\n');

    return { body, status: 'AWAITING_USER' };
  }

  private fallback(language: SupportAiLanguage, skipReason: SupportAiSkipReason): SupportAiAnswer {
    return { body: newsFallbackFor(language), status: 'AWAITING_ADMIN', skipReason };
  }

  /**
   * Fixed-window, keyed on the account. Returns false when spent.
   *
   * BOUNDED MEMORY. Without the prune below, `userWindows` is a Map that
   * only ever grows: one entry per account that has ever asked a news
   * question, retained for the lifetime of the process long after the
   * window it describes has expired and the entry can no longer refuse
   * anything. On a long-lived server that is an unbounded leak whose
   * size is set by the size of the audience.
   *
   * WHERE THE PRUNE RUNS, AND WHY THERE. It runs on the branch that
   * OPENS a window -- a first request from an account, or a rollover --
   * and nowhere else. That branch is reached exactly when the Map is
   * about to gain or refresh an entry, so the sweep is paid for by the
   * work that causes the growth, and an account spending an allowance it
   * already holds does no extra work at all.
   *
   * IT IS DELIBERATELY NOT A TIMER. A timer would keep a handle alive
   * for a Map that is empty most of the time, and would have to be torn
   * down on shutdown. This needs no lifecycle, no dependency, and no
   * change to the limiter's behaviour: pruning an EXPIRED window is
   * indistinguishable, to every caller, from leaving it in place, because
   * `admitUser` treats an expired window and an absent one identically.
   * A LIVE window is never touched, so no account regains an allowance it
   * has already spent.
   */
  private admitUser(userId: string, now: number): boolean {
    const key = `user:${userId}`;
    const window = this.userWindows.get(key);

    if (!window || now - window.startedAt >= this.perUserWindowMs) {
      this.pruneExpired(now);
      // AFTER the sweep, so a same-account rollover REPLACES its own
      // entry rather than being swept and re-added, and the just-opened
      // window is never a casualty of the prune that preceded it.
      this.userWindows.set(key, { startedAt: now, used: 1 });
      return true;
    }

    if (window.used >= this.perUserLimit) return false;

    window.used += 1;
    return true;
  }

  /**
   * Drop every window that has already expired. Live windows are kept.
   *
   * The predicate is the SAME one admitUser uses to decide a window has
   * rolled over -- `now - startedAt >= perUserWindowMs` -- so an entry is
   * removed only when it could no longer have refused a request anyway.
   * Reading `perUserWindowMs` once matters: it goes through ConfigService
   * on every access, and this runs over the whole Map.
   */
  private pruneExpired(now: number): void {
    const windowMs = this.perUserWindowMs;

    for (const [key, counter] of this.userWindows) {
      if (now - counter.startedAt >= windowMs) {
        this.userWindows.delete(key);
      }
    }
  }

  private positiveInt(name: string, fallback: number): number {
    const raw = Number(this.config.get<string>(name));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
  }
}
