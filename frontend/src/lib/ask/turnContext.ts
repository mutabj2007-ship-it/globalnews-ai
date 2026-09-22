/** A conservative draft hint; the settled turn uses the server routing decision. */
export function usesStoryContextLabel(question: string, serverUsed?: boolean): boolean {
  if (serverUsed !== undefined) return serverUsed;
  const text = question.trim();
  if (!text) return true;
  if (text.split(/\s+/u).length > 8) return false;
  return /^(?:what happened next|why|what does (?:this|that) mean|tell me more|explain (?:this|that)|co (?:dalej|się stało)|dlaczego|co to znaczy|wyjaśnij to)[?!.\s]*$/iu.test(
    text,
  );
}
