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
| `npm run typecheck` | Typkontroll av appen (utan Node-typer) och av tester/konfig |
| `npm run icons` | Gör appikonerna i `public/` av `public/icon.svg` (kräver Google Chrome) |
| `npm run icons:raster` | Förrenderar matikonerna i `src/icons/riso/` till WebP (kräver Google Chrome). Kör efter varje ändrad eller ny ikon – testerna säger till om det glömts. |

## Publicera

Appen publiceras automatiskt på GitHub Pages, https://katzler.github.io/hundra/, varje gång något pushas till `main` (se `.github/workflows/deploy.yml`). Bygget får då sökvägen `/hundra/` via `GITHUB_PAGES=1`.

## Så fungerar poängen

- Energibehovet räknas med Mifflin-St Jeor × aktivitetsfaktor. Det motsvarar 100 poäng.
- 1 poäng = energibehovet / 100 kcal. En vara kostar `kcal / (energibehov / 100)` poäng.
- Allt sparas som kcal internt. Varje loggrad sparar en kopia av varans kcal, och en budgethistorik gör att gamla dagar inte ändras när du uppdaterar vikten.
- Snittet räknas på hela dagar. Dagar utan loggning räknas inte med.

Koden för detta finns i `src/lib/calc.ts`, och matlistan i `src/data/foods.ts`.

All data ligger i webbläsarens localStorage på enheten. Använd Exportera/Importera i Profil som backup.

**Viktigt på iPhone:** appen på hemskärmen har egen lagring, skild från Safari. Tar man bort appen från hemskärmen raderas all data. Exportera alltid en backup först.

## Datamodell

`src/store/useStore.ts` sparar allt under nyckeln `hundra-v1` (som aldrig får bytas). Fälten listas en gång i `emptyData`; export, import och lagring använder samma lista. Ändras modellen: höj `version` och lägg till ett steg i `migrateData`. Både lagrad data och importfiler tvättas av `sanitizeData`, så trasiga rader hoppas över i stället för att krascha appen.

## Matikoner

Stil och format: `design/riso/STILGUIDE.md`. Översiktsark: `design/riso/oversikt/`. Nya varor i `src/data/foods.ts` kräver en ikon `src/icons/riso/<id>.svg` och sedan `npm run icons:raster`.
