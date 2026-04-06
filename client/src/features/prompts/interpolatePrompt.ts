export type PromptVariableForInterpolation = {
  key: string;
  defaultValue: string | null;
  required: boolean;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Fills `[KEY]` and `{{KEY}}` placeholders using the variable schema and user values.
 * Empty optional fields fall back to defaultValue; required fields missing both count as errors.
 */
export function interpolatePromptBody(
  template: string,
  variables: PromptVariableForInterpolation[],
  values: Record<string, string>,
): { text: string; missingRequiredKeys: string[] } {
  const missingRequiredKeys: string[] = [];
  const replacements: Array<{ key: string; value: string }> = [];

  for (const variable of variables) {
    const raw = values[variable.key];
    const trimmed = raw !== undefined ? raw.trim() : "";
    const fromDefault = variable.defaultValue?.trim() ?? "";
    const effective = trimmed !== "" ? trimmed : fromDefault;
    if (variable.required && effective === "") {
      missingRequiredKeys.push(variable.key);
    }
    replacements.push({ key: variable.key, value: effective });
  }

  replacements.sort((a, b) => b.key.length - a.key.length);

  let text = template;
  for (const { key, value } of replacements) {
    const bracket = new RegExp(`\\[\\s*${escapeRegex(key)}\\s*\\]`, "g");
    const mustache = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, "g");
    text = text.replace(bracket, value);
    text = text.replace(mustache, value);
  }

  return { text, missingRequiredKeys };
}
