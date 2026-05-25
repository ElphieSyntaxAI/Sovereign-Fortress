/** Vague, inspiring prompts for the post–Vault Pact 5-minute HAL startup typing session. */
export const HAL_STARTUP_PROMPTS: readonly string[] = [
  "A traveler finds something in the road that does not belong to this century. Describe what they do in the next hour.",
  "Write about a promise that was kept in secret, and who was never told.",
  "Someone is listening from the other side of a wall. What are they hoping to hear?",
  "The weather changes before the argument does. Let the scene show why.",
  "Describe a ordinary object that your main character is afraid to lose, without naming why.",
  "A message arrives too late to change the outcome, but in time to change the meaning.",
  "Two people share a meal; only one of them knows it is a farewell.",
  "The city makes a sound at night that everyone explains differently. Write the true explanation as fiction.",
  "Begin with a door that should stay closed. Do not open it until the last sentence.",
  "Someone tells a story they swear is not about their life. Make the reader doubt them.",
] as const;

export function pickHalStartupPrompt(seed?: string): string {
  const list = HAL_STARTUP_PROMPTS;
  if (!seed?.trim()) {
    return list[Math.floor(Math.random() * list.length)]!;
  }
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length]!;
}

export const HAL_STARTUP_TARGET_SECONDS = 5 * 60;
export const HAL_STARTUP_MIN_WORDS = 120;
