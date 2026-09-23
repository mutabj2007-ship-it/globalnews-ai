'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AnalysisApiResponse, LanguageCode, StoryContext } from '@globalnews-ai/shared';
import { analyzeNews } from '@/lib/api/analysisApi';
import { resolveAnalysisErrorMessage } from '@/components/search/SearchPageClient';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { transportableContext } from './storyContextStore';
import { sameAskContext } from './dashboardContext';
export interface AskTurn {
  readonly question: string;
  readonly context: StoryContext | undefined;
  readonly language: LanguageCode;
  readonly response?: AnalysisApiResponse;
  readonly error?: string;
}
// Commit the identity before promise continuations can publish after a client render.
const useCommittedEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Display history only. Only the previous USER question crosses transport. */
export function useAskConversation(language: LanguageCode, context: StoryContext | undefined) {
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const previous = useRef<AskTurn>();
  const bounded = transportableContext(context);
  const { title, articleId, countryCode } = bounded ?? {};
  const identity = useRef({ language, context: bounded });
  useCommittedEffect(() => {
    identity.current = {
      language,
      context: title === undefined ? undefined : { title, articleId, countryCode },
    };
    inFlight.current = false;
    setPending(null);
    // Also invalidate on unmount, and on A -> B -> A transitions.
    return () => {
      generation.current += 1;
    };
  }, [language, title, articleId, countryCode]);
  async function submit(question: string): Promise<boolean> {
    if (!question.trim() || inFlight.current) return false;
    inFlight.current = true;
    const request = ++generation.current;
    const sent = transportableContext(context);
    const prior = previous.current;
    const priorQuestion =
      prior && prior.language === language && sameAskContext(prior.context, sent)
        ? prior.question
        : undefined;
    setPending(question);
    let turn: AskTurn;
    try {
      const response = await analyzeNews(question, language, sent, priorQuestion);
      turn = { question, context: sent, language, response };
    } catch (error) {
      turn = {
        question,
        context: sent,
        language,
        error: resolveAnalysisErrorMessage(error, getDictionary(language)),
      };
    }
    if (
      generation.current !== request ||
      identity.current.language !== language ||
      !sameAskContext(identity.current.context, sent)
    )
      return false;
    previous.current = turn;
    setTurns((current) => [...current, turn]);
    setPending(null);
    inFlight.current = false;
    return true;
  }
  return { turns, pending, submit };
}
