export type VariableRow = {
  clientId: string;
  key: string;
  label: string;
  defaultValue: string;
  required: boolean;
};

type VariableEditorProps = {
  variables: VariableRow[];
  onChange: (variables: VariableRow[]) => void;
  onInsert?: (key: string) => void;
};

const VALID_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function sanitizeVariableKey(input: string): string {
  let result = input.replace(/[^A-Za-z0-9_]/g, "_");
  if (result.length > 0 && /^[0-9]/.test(result)) {
    result = "_" + result;
  }
  return result.toUpperCase();
}

function isValidVariableKey(key: string): boolean {
  return key === "" || VALID_KEY_PATTERN.test(key);
}

export function VariableEditor({ variables, onChange, onInsert }: VariableEditorProps) {
  const handleAddVariable = () => {
    onChange([
      ...variables,
      {
        clientId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        key: "",
        label: "",
        defaultValue: "",
        required: false,
      },
    ]);
  };

  const handleUpdateVariable = (index: number, updates: Partial<VariableRow>) => {
    onChange(variables.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item)));
  };

  const handleKeyChange = (index: number, rawValue: string) => {
    const sanitized = sanitizeVariableKey(rawValue);
    handleUpdateVariable(index, { key: sanitized });
  };

  const handleRemoveVariable = (index: number) => {
    onChange(variables.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Template variables (optional)</p>
          <p className="text-xs text-(--color-text-muted)">
            Define placeholders for dynamic content.{" "}
            {onInsert ? (
              <>
                Add a variable below and click <strong>Insert</strong> to add it to your body, or manually type{" "}
              </>
            ) : (
              <>Manually type </>
            )}
            <code className="rounded bg-(--color-surface) px-1">[KEY]</code> or{" "}
            <code className="rounded bg-(--color-surface) px-1">{"{{KEY}}"}</code>.
          </p>
        </div>
        <button
          type="button"
          className="rounded border border-(--color-border) bg-(--color-surface) px-2 py-1 text-xs"
          onClick={handleAddVariable}
        >
          Add variable
        </button>
      </div>
      {variables.length > 0 ? (
        <ul className="space-y-3">
          {variables.map((row, index) => (
            <li
              key={row.clientId}
              className="grid gap-2 rounded border border-(--color-border) bg-(--color-surface) p-3 md:grid-cols-2"
            >
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="flex items-center gap-2">
                  Key
                  <span className="text-xs font-normal text-(--color-text-muted)">(letters, numbers, underscores only)</span>
                </span>
                <input
                  className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1 font-mono uppercase"
                  value={row.key}
                  onChange={(event) => handleKeyChange(index, event.target.value)}
                  placeholder="e.g. TOPIC"
                  maxLength={64}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Label
                <input
                  className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1"
                  value={row.label}
                  onChange={(event) => handleUpdateVariable(index, { label: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Default
                <input
                  className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1"
                  value={row.defaultValue}
                  onChange={(event) => handleUpdateVariable(index, { defaultValue: event.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={row.required}
                  onChange={(event) => handleUpdateVariable(index, { required: event.target.checked })}
                />
                Required
              </label>
              <div className="flex items-center gap-3 md:col-span-2">
                {onInsert && row.key.trim() && (
                  <button
                    type="button"
                    className="rounded bg-(--color-primary) px-2 py-1 text-xs text-(--color-text-inverse) hover:bg-(--color-primary-hover)"
                    onClick={() => onInsert(row.key.trim())}
                  >
                    Insert [{row.key.trim()}]
                  </button>
                )}
                <button
                  type="button"
                  className="text-xs text-(--color-danger) underline"
                  onClick={() => handleRemoveVariable(index)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
