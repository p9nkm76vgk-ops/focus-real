/** Paleta y color por asignatura, CENTRALIZADOS. Color efectivo = personalizado (userColor) > predeterminado por clave > color heredado (`color`). */
export const DEFAULT_SUBJECT_COLORS: Record<string, string> = {
  'Matemáticas II': '#4F7CAC', 'Física': '#7A6BAF', 'Química': '#3E9A8C', 'Business': '#B98A3C', 'Lengua Castellana': '#C0607A',
  'Catalán': '#D07A4A', 'Inglés': '#9A5C93', 'Historia de España': '#8A6A4F', 'Historia de la Filosofía': '#7B8794',
};
export const SPARE_COLORS = ['#5E9C6E', '#C4A24A', '#4E9BBF', '#B5735A', '#8E6FB3', '#6E8F5A'];
type S = { id?: string; color?: string; colorKey?: string; userColor?: string };
export const effectiveColor = (s: S): string => s.userColor ?? (s.colorKey ? DEFAULT_SUBJECT_COLORS[s.colorKey] : undefined) ?? s.color ?? '#7B8794';
export const nextSpare = (used: string[]): string => SPARE_COLORS.find(c => !used.map(u => u.toLowerCase()).includes(c.toLowerCase())) ?? '#7B8794';
/** ¿Otro asignatura ya usa este color? (cada asignatura debe tener un color único). */
export const colorConflict = (subjects: S[], id: string | undefined, color: string): boolean => subjects.some(s => s.id !== id && effectiveColor(s).toLowerCase() === color.toLowerCase());
export const resetColors = <T extends S>(subjects: T[]): T[] => subjects.map(s => { const { userColor, ...rest } = s as any; return rest as T; });
