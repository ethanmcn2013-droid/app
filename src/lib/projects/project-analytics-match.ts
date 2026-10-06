/**
 * Finding a question by its words: the whole of what the Analytics ask box
 * does with what is typed. Keywords, light stemming and a few synonyms; no
 * model, no network. Kept in its own small module because it is the only part
 * of the questions library the browser needs.
 *
 * Pure; pinned by `project-files-analytics.test.ts`.
 */

export type MatchCandidate = Readonly<{ id: string; label: string; words: Readonly<Record<string, number>> }>;

export type QuestionMatch = Readonly<{ id: string; score: number }>;

/** At or above this a match is offered; below it the box says it has no ready answer. */
export const MATCH_THRESHOLD = 4;

const STOP = new Set(["the", "a", "an", "is", "are", "we", "us", "our", "do", "does", "did", "to", "of", "in", "on", "for", "and", "what", "which", "how", "it", "this", "that", "my", "me", "i", "be", "has", "have", "too", "s"]);

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Light stemming: enough for "slipping" to find "slip" and "changes" "chang". */
function stem(word: string): string {
  return word.replace(/(ing|ed|es|s|e)$/, "").replace(/(.)\1$/, "$1");
}

function hits(token: string, key: string): boolean {
  if (token === key) return true;
  const a = stem(token);
  const b = stem(key);
  if (a.length < 3 || b.length < 3) return a === b;
  return a.startsWith(b) || b.startsWith(a);
}

/**
 * The questions that share words with what was typed, best first. Empty when
 * nothing clears the threshold: an answer to a different question is worse
 * than none.
 */
export function matchQuestions(input: string, questions: readonly MatchCandidate[]): QuestionMatch[] {
  const typed = tokens(input);
  if (typed.length === 0) return [];
  const whole = input.trim().toLowerCase();
  return questions
    .map((question) => {
      const labelWords = tokens(question.label).filter((word) => !STOP.has(word));
      let score = 0;
      for (const token of typed) {
        if (STOP.has(token)) continue;
        let best = 0;
        for (const [key, weight] of Object.entries(question.words)) if (hits(token, key)) best = Math.max(best, weight);
        // Words in the question itself count, so typing part of it finds it.
        if (best === 0 && token.length >= 3 && labelWords.some((word) => hits(token, word))) best = 3;
        score += best;
      }
      if (whole.length > 3 && question.label.toLowerCase().startsWith(whole)) score += 6;
      return { id: question.id, score };
    })
    .filter((match) => match.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}
