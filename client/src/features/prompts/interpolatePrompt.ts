import { interpolateBody, type VariableForInterpolation } from "../../lib/interpolate";

export type PromptVariableForInterpolation = VariableForInterpolation;

export function interpolatePromptBody(
  template: string,
  variables: PromptVariableForInterpolation[],
  values: Record<string, string>,
): { text: string; missingRequiredKeys: string[] } {
  return interpolateBody(template, variables, values);
}
