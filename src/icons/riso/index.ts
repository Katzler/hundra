// Alla Riso-ikoner som råa SVG-strängar, med varans id som nyckel.
// Modulen laddas separat (se lib/foodIcons.ts) så att första renderingen inte väntar på den.
const files = import.meta.glob('./*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export const ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [path.slice(2, -4), svg]),
)
