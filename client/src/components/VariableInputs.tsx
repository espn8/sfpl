export type Variable = {
  id?: number;
  key: string;
  label: string | null;
  defaultValue: string | null;
  required: boolean;
};

type VariableInputsProps = {
  variables: Variable[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
};

export function VariableInputs({ variables, values, onChange }: VariableInputsProps) {
  const handleChange = (key: string, value: string) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="grid gap-3">
      {variables.map((variable) => (
        <label key={variable.id ?? variable.key} className="grid gap-1 text-sm">
          <span>
            {variable.label || variable.key}
            {variable.required ? <span className="text-(--color-danger)"> *</span> : null}
          </span>
          <textarea
            className="min-h-16 w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
            value={values[variable.key] ?? ""}
            placeholder={variable.defaultValue ?? ""}
            onChange={(event) => handleChange(variable.key, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
