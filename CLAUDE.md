# Hundra

En mobilanpassad PWA för snabb matloggning utan att väga. Hela dagens energibehov är 100 poäng, och snittet över tid avgör viktförändringen. Appen är på svenska, har en Apple-lik design och används mest som hemskärmsapp på iPhone.

Den publiceras på https://katzler.github.io/hundra/. Varje push till `main` byggs och publiceras automatiskt via `.github/workflows/deploy.yml`, vilket tar ungefär en minut.

## Arbetssätt

- **Svenska:** svara på svenska. All text i appen och alla kodkommentarer är på svenska.
- **Visa live:** ägaren vill se resultatet på den publicerade sidan. Lämna ingen dev-server igång, en tillfällig `vite preview` för test är okej.
- **Pusha direkt:** när en ändring är klar och testad, committa och pusha till `main`. Bekräfta sedan att bygget i GitHub Actions gick igenom med `gh run watch`.
- **Kontroller före push:** `npm run typecheck`, `npm test` och `GITHUB_PAGES=1 npm run build`.

## Kommandon

| Kommando | Vad |
| --- | --- |
| `npm test` | Vitest: poänglogik, sök, lagring, migrering och ikoner |
| `npm run typecheck` | Appen utan Node-typer (`tsconfig.json`), tester och konfig för sig (`tsconfig.node.json`) |
| `GITHUB_PAGES=1 npm run build` | Bygger med sökvägen `/hundra/`, som Pages kräver |
| `npm run icons:raster` | Förrenderar matikonerna till WebP. Kräver Google Chrome. Kör efter ändrade eller nya SVG:er. |
| `npm run icons` | Appikonerna av `public/icon.svg` |

## Struktur

- `src/lib/calc.ts`: poäng (Mifflin-St Jeor × aktivitet = 100 p), budgethistorik, snitt, prognos, vikttrend, kalibrering och mönster.
- `src/store/useStore.ts`: all data i Zustand med persist till localStorage.
- `src/data/foods.ts`: matlistan med kcal per naturlig portion, kategorier, säsong och `ICON_FALLBACK`.
- `src/screens/` (Today, Trend, Profile, Onboarding) och `src/components/`.
- `src/icons/riso/*.svg`: handritade ikoner. Stil och format beskrivs i `design/riso/STILGUIDE.md`.

## Datan – var försiktig

All användardata finns bara i localStorage på telefonen, under nyckeln `hundra-v1` (`STORAGE_KEY`). Ett fel här kan radera någons historik, och det har nästan hänt en gång.

- **Nyckeln:** byt aldrig `STORAGE_KEY`.
- **Ny datamodell:** ändras modellen, höj `version` och lägg ett steg i `migrateData`. Nya fält läggs i `emptyData`, som är den enda fältlistan för lagring, export och import, och tvättas i `sanitizeData`.
- **Ordningen i filen:** `useStore` skapas sist i filen eftersom sparad data läses in direkt när modulen laddas. Allt som inläsningen använder måste vara definierat ovanför. Ett tidigare fel med en `const` som definierades efter skapandet gjorde att datan inte lästes in.
- **Skrivskyddet:** lagringen skrivs inte förrän inläsningen har lyckats (flaggan `hydrated`). Ta inte bort det skyddet.
- **Testet:** `src/store/hydrate.test.ts` startar appen med sparad data, precis som på telefonen. Det måste alltid gå igenom.
- **Hemskärmen:** på iPhone har hemskärmsappen egen lagring, och den försvinner om appen tas bort från hemskärmen. Råd aldrig någon att ta bort appen utan att först exportera en backup.

## Ikoner

- **Ny vara:** antingen ritas `src/icons/riso/<id>.svg` enligt stilguiden och sedan körs `npm run icons:raster`, eller så lånas en liknande befintlig ikon via `ICON_FALLBACK` i `foods.ts`. Det andra räcker ofta.
- **Visning:** ikonerna visas som WebP-bilder, en för ljust och en för mörkt läge, eftersom Safari ritar SVG-filtren suddigt. `FoodIcon` väljer bild.
- **Testerna:** de kontrollerar att varje vara har en ikon, att formatet stämmer och att ingen SVG har ändrats utan att bilderna renderats om.
- **Agenter som ritar ikoner:** de ska lägga sina hjälpskript i scratchpad, aldrig i projektet. Kontrollera med `git status` före commit.

## Uppdateringar på telefonen

Service workern använder `registerType: 'prompt'`. I `src/main.tsx` byts appen till en ny version direkt om den nyss öppnades, annars när man lämnar den, och aldrig medan ett ark är öppet. Efter en publicering behöver telefonen ofta öppnas en eller två gånger innan ändringen syns. Versionen syns längst ner i Profil och i introt.
