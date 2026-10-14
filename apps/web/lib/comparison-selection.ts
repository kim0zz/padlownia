import { z } from 'zod';

const token = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const selectionSchema = z.strictObject({
  releaseId: token,
  items: z.array(z.strictObject({ id: token, label: z.string().min(1).max(500) })).max(2),
}).refine((value) => new Set(value.items.map((item) => item.id)).size === value.items.length);

export type ComparisonSelection = z.infer<typeof selectionSchema>;
export type SelectionItem = ComparisonSelection['items'][number];
export function readSelection(raw: string | null): ComparisonSelection | null {
  try {
    if (!raw || raw.length > 2000) return null;
    const result = selectionSchema.safeParse(JSON.parse(raw));
    return result.success && result.data.items.length ? result.data : null;
  } catch { return null; }
}

export function comparisonUrl(selection: ComparisonSelection) {
  const query = new URLSearchParams({ release: selection.releaseId });
  if (selection.items[0]) query.set('left', selection.items[0].id);
  if (selection.items[1]) query.set('right', selection.items[1].id);
  return `/porownaj?${query}`;
}

export function toggleSelection(current: ComparisonSelection | null, releaseId: string, item: SelectionItem):
  { selection: ComparisonSelection | null; message: string } {
  if (current?.releaseId === releaseId && current.items.some((selected) => selected.id === item.id)) {
    const items = current.items.filter((selected) => selected.id !== item.id);
    return { selection: items.length ? { ...current, items } : null, message: 'Usunięto rakietę z porównania.' };
  }
  if (current && current.releaseId !== releaseId) return { selection: current, message: 'Wybór pochodzi z innej wersji danych. Wyczyść go i wybierz rakiety z aktualnego katalogu.' };
  if (current?.items.length === 2) return { selection: current, message: 'Wybrano już dwie rakiety. Usuń jedną z wyboru przed dodaniem kolejnej.' };
  const selection = { releaseId, items: [...(current?.items ?? []), item] };
  return { selection, message: `Dodano do porównania: ${item.label}. Wybrano ${selection.items.length} z 2.` };
}
