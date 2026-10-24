# Riso – stilguide för Hundras matikoner

Referenser (läs källkoden och titta på dem innan du ritar):
`src/icons/riso/potatis.svg`, `src/icons/riso/macka-ost.svg`, `src/icons/riso/kaffe-mjolk.svg`.
Förhandsvisning av referenserna: `design/riso/ref.png`.

Känsla: lekfullt risograph-/screentryck. Platta, korniga spotfärger som glidit lite ur en
jämntjock, handdragen bläcklinje. Grafiskt, självsäkert, enkelt – mer klistermärke än illustration.

## Filformat (måste följas exakt)

- Fil: `src/icons/riso/<varans-id>.svg`. Id:t är exakt varans `id` från listan.
- Rot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` – inga width/height.
- Två filter i `<defs>`, kopierade från referensen med id `riso-<id>-grain` och `riso-<id>-ink`.
  Byt gärna `seed`-värdena, ändra inget annat i filtren.
- Inga `<text>`, `<style>`, `<script>`, `<image>`, `<use>` eller externa resurser. Bara attribut.
- Alla id:n börjar med `riso-<id>-`.
- Max ca 3,5 kB per fil. Håll det enkelt: få paths, en decimal räcker i koordinater.

## Lageruppbyggnad (som i referenserna)

```svg
<g transform="translate(dx dy)">              <!-- valfri centrering av hela motivet -->
  <g filter="url(#riso-<id>-grain)" style="isolation:isolate" transform="translate(3.5 3)">
    <!-- FÄRGLAGRET: platta fyllningar, ritade på samma koordinater som bläcklinjen.
         Hela lagret förskjuts 3.5,3 – det är riso-förskjutningen. Rubba inte den. -->
    <!-- Skuggsida: samma färg igen med style="mix-blend-mode:multiply" och transform="translate(-1 .8)" -->
    <!-- Detaljer i färglagret: korta streck/prickar i rost #9A4E24 eller annan mörkare spotfärg,
         stroke-width 2.2–2.8, linecap round. -->
  </g>
  <g filter="url(#riso-<id>-ink)" fill="none" stroke="var(--ink, #2b2118)"
     stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <!-- BLÄCKLAGRET: lös siluett + några få viktiga inre linjer. Gärna en liten öppning
         eller ett överlapp där linjen inte riktigt sluter sig. Ingen fyllning här. -->
  </g>
</g>
```

- Bläcklinjen är alltid `stroke="var(--ink, #2b2118)"`, stroke-width 3 (2.4 för små inre detaljer, aldrig under 2.2).
  Appen byter `--ink` till ljust (#F2EDE4) i mörkt läge, så inga andra mörka linjer får förlita sig på bläcket.
- Mörka detaljer som ska synas i båda lägena (ögon, frön, prickar) ritas i färglagret i en spotfärg, inte i bläck.

## Palett (håll dig till den – max 3–4 färger per ikon utöver bläck)

| Färg | Hex | Används till |
| --- | --- | --- |
| Bläck | `var(--ink, #2b2118)` | Alla konturer |
| Brödbrun | `#DCA660` | Bröd, potatis, nötter, trä, kakor, kött som stekts ljust |
| Deg | `#EFCF9C` | Brödets insida, gröt, pasta, ljusa ytor |
| Rost | `#9A4E24` | Skuggdetaljer, stekyta, choklad-/kaffedetaljer, prickar |
| Mörkbrun | `#6B3A1E` | Choklad, cola, kaffe, köttfärs, grillat |
| Gul | `#FFD02E` | Ost, banan, äggula, citron, öl, majs, pommes |
| Orange | `#F28C28` | Morot, apelsin, juice, ostbågar, lax (med rosa) |
| Röd | `#E8453C` | Tomat, äpple, ketchup, sylt, rött kött, chili, jordgubbe |
| Rosa | `#F49AB0` | Lax, skinka, räkor, glass, korv |
| Grön | `#3BAA5C` | Grönsaker, sallad, gurka, avokado, flaskor |
| Blå | `#3D78D8` | Muggar, koppar, skålar, burkar, förpackningar |
| Ljusblå | `#A9C8F0` | Vatten, glas, is |
| Lila | `#7A4BB0` | Vindruvor, blåbär, rödbetor |
| Vinröd | `#9B1B30` | Rödvin, lingon, sylt |
| Grädde | `#FFF1CF` | Mjölk, skum, ris, högdagrar, äggvita, grädde |

Kärl (tallrik, skål, glas, mugg) ritas gärna i blått eller ljusblått så att maten syns mot dem.
En tallrik kan också vara bara grädde-färgad med bläckkontur.

## Komposition

- Motivet fyller ca 75–85 % av rutan (ungefär x 6–58, y 6–58) och är optiskt centrerat
  (räkna med att färglagret hamnar 3.5,3 längre ner till höger).
- Ett tydligt huvudmotiv per ikon, i lätt 3/4-vy eller rakt framifrån. Inga bakgrunder.
- Måste kännas igen i 28–30 px. Stora tydliga former, inga detaljer mindre än ca 2 enheter.
- Portion i enheten ska synas när den är viktig: "5 st köttbullar" = några bollar (3–5),
  "1 påse" = påse, "1 näve" = liten hög, "1 flaska" = flaska, "1 glas" = glas,
  "1 tallrik" = maten på en tallrik sedd snett ovanifrån, "1 skål" = skål.
- Liknande varor ska gå att skilja åt: t.ex. Chips (näve) mot Chips (påse), Vin (glas) mot Vin (flaska),
  Öl (burk) mot Öl stor (glas/stor burk) mot Lättöl, Läsk mot Läsk zero (t.ex. annan färg), Kaffe svart mot med mjölk.

## Kvalitetskontroll

Rendera kontaktark: `node scripts/icon-sheet.mjs design/riso/<namn>.png src/icons/riso/a.svg src/icons/riso/b.svg ...`
och titta på PNG:en med Read. Visa gärna referenserna (potatis, macka-ost, kaffe-mjolk) på samma ark
så att du ser att din ikon hör till samma familj.

## I appen

- Ikonerna laddas från `src/icons/riso/` (se `src/icons/riso/index.ts`) i en egen chunk efter första renderingen.
- `src/components/FoodIcon.tsx` visar ikonen som `<img>` och byter in rätt bläckfärg för ljust eller mörkt läge.
  Saknas en ikon (t.ex. för användarens egna varor) visas varans emoji.
- `npm test` kontrollerar att varje vara och kategori har en ikon och att formatet stämmer.
- Översiktsark över alla ikoner per kategori: `design/riso/oversikt/`.
  Rendera om ett ark med `node scripts/icon-sheet.mjs <ut.png> <svg-filer...>`.
