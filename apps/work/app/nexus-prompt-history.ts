const MAX_PROMPTS = 20;
const keyOf = (text: string) => text.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export function cleanPromptHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is string => {
    if (typeof item !== "string" || !item.trim() || item.length > 3000) return false;
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, MAX_PROMPTS).map(item => item.trim());
}

export function rememberPrompt(history: string[], text: string): string[] {
  return cleanPromptHistory([text, ...history]);
}

export function rankPrompts(history: string[], query: string): string[] {
  const words = keyOf(query).split(" ").filter(Boolean);
  if (!words.length) return history;
  const score = (text: string) => words.filter(word => keyOf(text).includes(word)).length;
  return [...history].sort((a, b) => score(b) - score(a));
}

export function promptHistoryKey(accountId?: string): string | null {
  return accountId ? `nosmo:nexus-prompts:v1:${encodeURIComponent(accountId)}` : null;
}
