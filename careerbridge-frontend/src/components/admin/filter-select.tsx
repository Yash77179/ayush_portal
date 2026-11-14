"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** A filter dropdown for the admin lists: one value out of a few labelled choices. */
export function FilterSelect({ value, items, onChange }: { value: string; items: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <Select value={value} items={items} onValueChange={(v) => v && onChange(String(v))}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([k, v]) => (
          <SelectItem key={k} value={k}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
