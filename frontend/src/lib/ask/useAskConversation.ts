'use client';
import { useEffect, useRef, useState } from 'react';
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
/** Display history only. Only the previous USER question crosses transport. */
export function useAskConversation(language: LanguageCode, context: StoryContext | undefined) {
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const previous = useRef<AskTurn>();
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  async function submit(question: string): Promise<boolean> {
    if (!question.trim() || inFlight.current) return false;
    inFlight.current = true;
    const request = ++generation.current;
    const sent = transportableContext(context);
    const prior = previous.current;
    const priorQuestion = prior && sameAskContext(prior.context, sent) ? prior.question : undefined;
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
    if (generation.current !== request) return false;
    previous.current = turn;
    setTurns((current) => [...current, turn]);
    setPending(null);
    inFlight.current = false;
    return true;
  }
  return { turns, pending, submit };
}
