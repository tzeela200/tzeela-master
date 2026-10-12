import type { Agent } from "./types";

export type AgentInput = Pick<
  Agent,
  | "name"
  | "description"
  | "system_prompt"
  | "category"
  | "icon"
  | "is_favorite"
  | "is_master"
  | "is_image_generator"
>;

export type AgentErrors = Partial<Record<keyof AgentInput, string>>;

// Mirrors the CHECK constraints in supabase/migrations/0001_init.sql
export function validateAgent(input: AgentInput): AgentErrors {
  const errors: AgentErrors = {};
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) errors.name = "שם הסוכן צריך להיות בין 2 ל־60 תווים.";
  if (!input.description.trim()) errors.description = "צריך לכתוב תיאור קצר.";
  else if (input.description.length > 180) errors.description = "התיאור יכול להכיל עד 180 תווים.";
  if (input.system_prompt.trim().length < 30)
    errors.system_prompt = "ההנחיות צריכות להכיל לפחות 30 תווים.";
  if (!input.category.trim()) errors.category = "צריך לבחור או לכתוב קטגוריה.";
  return errors;
}

export function normalizeAgent(input: AgentInput): AgentInput {
  return {
    ...input,
    name: input.name.trim(),
    description: input.description.trim(),
    system_prompt: input.system_prompt.trim(),
    category: input.category.trim(),
    icon: input.icon || null,
  };
}

export function matchesSearch(agent: Agent, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [agent.name, agent.description, agent.category].some((f) =>
    f.toLowerCase().includes(q),
  );
}
