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
| `npm test` | Vitest: poänglogik, näring, sök, lagring, migrering och ikoner |
| `npm run typecheck` | Appen utan Node-typer (`tsconfig.json`), tester och konfig för sig (`tsconfig.node.json`) |
| `GITHUB_PAGES=1 npm run build` | Bygger med sökvägen `/hundra/`, som Pages kräver |
| `npm run icons:raster` | Förrenderar matikonerna till WebP. Kräver Google Chrome. Kör efter ändrade eller nya SVG:er. |
| `npm run icons` | Appikonerna av `public/icon.svg` |

## Struktur

- `src/lib/calc.ts`: poäng (Mifflin-St Jeor × aktivitet = 100 p), budgethistorik, snitt, prognos, vikttrend, kalibrering och mönster.
- `src/store/useStore.ts`: all data i Zustand med persist till localStorage.
- `src/data/foods.ts`: matlistan med kcal per naturlig portion, kategorier, säsong och `ICON_FALLBACK`.
- `src/data/macros.ts`: protein, fett och kolhydrater i gram för samma portion som i `foods.ts`.
- `src/screens/` (Today, Trend, Profile, Onboarding) och `src/components/`.
- `src/icons/riso/*.svg`: handritade ikoner. Stil och format beskrivs i `design/riso/STILGUIDE.md`.
- Streckkoder: `src/lib/barcode.ts` (kontrollsiffra, UPC → EAN-13, butikens egna koder), `src/lib/openfoodfacts.ts` (uppslag och tolkning), `src/lib/packaged.ts` (portion, förpackning, glas och 100 g), `src/lib/scanner.ts` (ZXing) och `src/components/ScanSheet.tsx` (kameran).

## Datan – var försiktig

All användardata finns bara i localStorage på telefonen, under nyckeln `hundra-v1` (`STORAGE_KEY`). Ett fel här kan radera någons historik, och det har nästan hänt en gång.

- **Nyckeln:** byt aldrig `STORAGE_KEY`.
- **Ny datamodell:** ändras modellen, höj `version` och lägg ett steg i `migrateData`. Nya fält läggs i `emptyData`, som är den enda fältlistan för lagring, export och import, och tvättas i `sanitizeData`.
- **Ordningen i filen:** `useStore` skapas sist i filen eftersom sparad data läses in direkt när modulen laddas. Allt som inläsningen använder måste vara definierat ovanför. Ett tidigare fel med en `const` som definierades efter skapandet gjorde att datan inte lästes in.
- **Skrivskyddet:** lagringen skrivs inte förrän inläsningen har lyckats (flaggan `hydrated`). Ta inte bort det skyddet.
- **Testet:** `src/store/hydrate.test.ts` startar appen med sparad data, precis som på telefonen. Det måste alltid gå igenom.
- **Skannade varor:** de sparas som egna varor med `barcode` och `per100` (version 6). Näringen sparas per förvalt mått, som för andra varor (`macrosToUnit` i `packaged.ts`). `cleanFood` släpper bara igenom kända fält, så ett nytt fält på egna varor måste läggas till där.
- **Hemskärmen:** på iPhone har hemskärmsappen egen lagring, och den försvinner om appen tas bort från hemskärmen. Råd aldrig någon att ta bort appen utan att först exportera en backup.

## Näring

- **Av som standard:** `showMacros` slås på i Profil. Då visar ringen på Idag tre tunna ringar innanför poängen, för protein, fett och kolhydrater, var och en mot sitt mål i gram. Avstängd ser ringen ut som förut. Med `trackedMacros` väljer man vilka av de tre som visas, t.ex. bara protein. Minst en är alltid på.
- **Ny vara:** lägg också en rad i `macros.ts`. Testet kräver att varje vara har näring och att 4·P + 9·F + 4·K ungefär stämmer med varans kcal.
- **Valen:** `applyPicks` i `choices.ts` räknar om näringen. `add` räknas som fett om svaret inte har `addMacros`, en annan fetthalt (`fatDiff`) ändrar fettet och en ny `kcal` skalar resten.
- **Raderna:** loggade rader sparar en kopia i `macrosPerUnit`, precis som `kcalPerUnit`. Rader från före version 5 saknar den och räknas från varan när de visas.
- **Målen:** `macroTargets` i `calc.ts`. 1,2 g protein per kilo för att hålla vikten och 1,6 g när man går ner (på vikten vid BMI 25 om man väger mer), 30 % av energin från fett och resten kolhydrater.

## Ikoner

- **Ny vara:** antingen ritas `src/icons/riso/<id>.svg` enligt stilguiden och sedan körs `npm run icons:raster`, eller så lånas en liknande befintlig ikon via `ICON_FALLBACK` i `foods.ts`. Det andra räcker ofta.
- **Visning:** ikonerna visas som WebP-bilder, en för ljust och en för mörkt läge, eftersom Safari ritar SVG-filtren suddigt. `FoodIcon` väljer bild.
- **Testerna:** de kontrollerar att varje vara har en ikon, att formatet stämmer och att ingen SVG har ändrats utan att bilderna renderats om.
- **Agenter som ritar ikoner:** de ska lägga sina hjälpskript i scratchpad, aldrig i projektet. Kontrollera med `git status` före commit.

## Uppdateringar på telefonen

Service workern använder `registerType: 'prompt'`. I `src/main.tsx` byts appen till en ny version först när man lämnar den, aldrig när den startar, medan den används eller medan ett ark är öppet. Ladda inte om appen vid start: på iPhone gav det två starter i rad och lång svart skärm morgonen efter en publicering. Efter en publicering öppnar man appen (den hittar uppdateringen), lämnar den och öppnar den igen. Har iOS stängt appen under tiden används den nya versionen direkt vid nästa start. Versionen syns längst ner i Profil och i introt.

## Starten

- **Startbilden:** `index.html` har en inbäddad appikon i `#root` som syns tills React ritar appen. Dess bakgrund ska stämma med `--bg` i `tokens.css`.
- **Mätningen:** raden under versionen i Profil visar var tiden gick vid senaste starten (`src/lib/startup.ts`). Den hålls bara i minnet. Små värden trots lång väntan betyder att tiden gick i iOS innan sidan började laddas.
- **Offline-cachen:** alla filer utom de stora appikonerna (icon-512 och den maskerbara) ligger i precachen, ungefär 700 poster med matikonerna. Cachen öppnas vid varje kallstart, så håll nere antalet poster. Stora filer gör varje uppdatering långsammare.
- **Streckkodsläsaren:** WebAssembly-filen (ca 1 MB) ligger inte i precachen. Den hämtas första gången man skannar och sparas sedan i en egen cache (`runtimeCaching` i `vite.config.ts`).

## Open Food Facts

Uppslaget går direkt från telefonen till `world.openfoodfacts.org` (fri, ingen nyckel, ca 100 uppslag i minuten per användare). Bara koden skickas, och Profil säger det. Vägda varor har butikens egna koder (börjar på 2) och går inte att slå upp. Testerna använder handskrivna svar i samma form som API:et.
