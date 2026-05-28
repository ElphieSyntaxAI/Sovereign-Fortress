import type { DevHealCycleChoice } from "./devHealCycle";

let lastDevHealChoice: DevHealCycleChoice | null = null;

export function setLastDevHealChoice(choice: DevHealCycleChoice): void {
  if (choice === "cancel") return;
  lastDevHealChoice = choice;
}

export function getLastDevHealChoiceForVerify():
  | "self_guided"
  | "self_local"
  | "cloud"
  | undefined {
  if (lastDevHealChoice === "self_guided") return "self_guided";
  if (lastDevHealChoice === "self_local") return "self_local";
  if (lastDevHealChoice === "cloud") return "cloud";
  return undefined;
}
