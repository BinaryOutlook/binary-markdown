export type TableToolbarPosition = 'auto' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left' | 'right' | 'top-bar';
export const positions: readonly TableToolbarPosition[];
export function normalize(value: unknown): TableToolbarPosition;
