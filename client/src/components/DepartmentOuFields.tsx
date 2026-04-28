import { useEffect, useRef, useState } from "react";
import {
  DEPARTMENT_OU_OTHER_SENTINEL,
  OU_OPTIONS,
  departmentOuSubmitValue,
  isCanonicalDepartmentOu,
} from "../constants/ous";

export type DepartmentOuFieldsProps = {
  /** Stored `User.ou` from the API. */
  value: string;
  onChange: (ou: string) => void;
  disabled?: boolean;
  selectId?: string;
  customInputId?: string;
};

function splitFromStored(stored: string): { select: string; custom: string } {
  if (!stored) {
    return { select: "", custom: "" };
  }
  if (isCanonicalDepartmentOu(stored)) {
    return { select: stored, custom: "" };
  }
  return { select: DEPARTMENT_OU_OTHER_SENTINEL, custom: stored };
}

export function DepartmentOuFields({
  value,
  onChange,
  disabled = false,
  selectId = "department-ou-select",
  customInputId = "department-ou-custom",
}: DepartmentOuFieldsProps) {
  const [select, setSelect] = useState("");
  const [custom, setCustom] = useState("");
  const skipNextEmptySyncRef = useRef(false);

  useEffect(() => {
    if (skipNextEmptySyncRef.current && value === "") {
      skipNextEmptySyncRef.current = false;
      return;
    }
    const next = splitFromStored(value);
    setSelect(next.select);
    setCustom(next.custom);
  }, [value]);

  const pushCanonical = (nextSelect: string) => {
    setSelect(nextSelect);
    setCustom("");
    onChange(nextSelect);
  };

  const pushOther = (nextSelect: string, nextCustom: string) => {
    setSelect(nextSelect);
    setCustom(nextCustom);
    const submitted = departmentOuSubmitValue(nextSelect, nextCustom);
    if (submitted === "") {
      skipNextEmptySyncRef.current = true;
    }
    onChange(submitted);
  };

  return (
    <div className="space-y-2">
      <select
        id={selectId}
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        value={select}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (v === DEPARTMENT_OU_OTHER_SENTINEL) {
            pushOther(v, custom);
          } else {
            pushCanonical(v);
          }
        }}
        aria-controls={select === DEPARTMENT_OU_OTHER_SENTINEL ? customInputId : undefined}
      >
        <option value="">Select Department/OU</option>
        {OU_OPTIONS.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={DEPARTMENT_OU_OTHER_SENTINEL}>Other…</option>
      </select>

      {select === DEPARTMENT_OU_OTHER_SENTINEL ? (
        <div>
          <label htmlFor={customInputId} className="mb-1 block text-xs text-(--color-text-muted)">
            Enter your department
          </label>
          <input
            id={customInputId}
            type="text"
            className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
            value={custom}
            disabled={disabled}
            placeholder="Department name"
            onChange={(e) => {
              const t = e.target.value;
              setCustom(t);
              const submitted = departmentOuSubmitValue(DEPARTMENT_OU_OTHER_SENTINEL, t);
              if (submitted === "") {
                skipNextEmptySyncRef.current = true;
              }
              onChange(submitted);
            }}
          />
        </div>
      ) : null}

      <span className="block text-xs text-(--color-text-muted)">
        My Team (TEAM) visibility is based on Department/OU only — not Region. If you use Other, your admin can add
        common values to the official list.
      </span>
    </div>
  );
}
