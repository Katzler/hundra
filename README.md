# Hundra

Snabb matloggning med poäng. Hela din dag är 100 poäng. Logga det du äter med ett par tryck, utan att väga. Ligger snittet under 100 över tid går du ner i vikt, ligger det över går du upp.

## Kom igång

```bash
npm install
npm run dev -- --host
```

Öppna adressen som visas under "Network" i Safari på telefonen (samma wifi).

## Kommandon

| Kommando | Vad det gör |
| --- | --- |
| `npm run dev` | Startar utvecklingsservern |
| `npm test` | Kör testerna för poänglogik, sök och lagring |
| `npm run build` | Bygger en statisk sajt i `dist/` (med offline-stöd) |
| `npm run icons` | Ritar om appikonerna i `public/` |

## Publicera

Appen publiceras automatiskt på GitHub Pages, https://katzler.github.io/hundra/, varje gång något pushas till `main` (se `.github/workflows/deploy.yml`). Bygget får då sökvägen `/hundra/` via `GITHUB_PAGES=1`.

## Så fungerar poängen

- Energibehovet räknas med Mifflin-St Jeor × aktivitetsfaktor. Det motsvarar 100 poäng.
- 1 poäng = energibehovet / 100 kcal. En vara kostar `kcal / (energibehov / 100)` poäng.
- Allt sparas som kcal internt. Varje loggrad sparar en kopia av varans kcal, och en budgethistorik gör att gamla dagar inte ändras när du uppdaterar vikten.
- Snittet räknas på hela dagar. Dagar utan loggning räknas inte med.

Koden för detta finns i `src/lib/calc.ts`, och matlistan i `src/data/foods.ts`.

All data ligger i webbläsarens localStorage på enheten. Använd Exportera/Importera i Profil som backup.
