# CLS TCCC

Offline webová aplikace (PWA), která provádí záchranáře na úrovni Combat Lifesaver postupem TCCC: Care Under Fire → MARCH PAWS → hlášení 9-Line MEDEVAC / MIST / DD Form 1380 → TACEVAC.

> **Výcviková pomůcka.** Nenahrazuje certifikovaný výcvik TCCC CLS, pokyny zdravotníka ani platné směrnice CoTCCC / JTS a vlastního útvaru.

## Co umí

- **Stavový automat** (`src/model/fsm.ts`): `PHASE_QUERY → CUF_EXECUTOR → MARCH_M … PAWS_S → REPORT_GEN → TACEVAC`. Krok MARCH PAWS nejde dokončit, dokud nejsou vyřešené kritické body (např. nezastavené masivní krvácení, otevřená rána hrudníku bez chest sealu, nepřehodnocený turniket). Přeskočit se dá jen vědomě a zapíše se to do záznamu. Kroky nejde přeskakovat dopředu. Tlačítko „PALBA!“ kdykoli vrátí do CUF, „Změna stavu“ vrátí postup na M.
- **Care Under Fire**: čtyři velká tlačítka Hasty TQ podle končetiny a přesun do krytu.
- **SVG mapa těla** zepředu i zezadu s anatomickými zónami (končetinové, junkční, hrudní, nestlačitelné). Klepnutí otevře spodní panel se zraněními a zásahy pro danou oblast. Barvy podle závažnosti, nezastavené masivní krvácení bliká, turnikety jsou vyznačené páskem. Malé zóny (podpaží, tříslo) jdou vybrat i ze seznamu.
- **Časovače turniketů**: čas od přiložení, reassessment, náhrada hasty → deliberate, konverze CLS jen do 2 h. Upozornění 15 min před limitem a po 2 h (vibrace + notifikace).
- **Hlášení**: 9-Line MEDEVAC s fonetickou abecedou pro vysílání (L1–5 zvýrazněné), návrh naléhavosti a typu pacienta, souhrnné hlášení za všechny ošetřované; MIST; náhled karty DD 1380 s tiskem do PDF; kopírování do schránky.
- **TACEVAC**: zápis vitálních funkcí stepperem (ovladatelný v rukavicích), přehled zásahů s možností smazat omyl.
- **Offline-first**: service worker s cache-first strategií, data v IndexedDB + záloha v localStorage, žádný server. Režimy zobrazení TMA / DEN / NVG (červená na černé), wake lock displeje, haptická odezva.

## Vývoj

```bash
npm install
npm run dev        # vývojový server
npm test           # unit testy modelu, automatu a hlášení
npm run build      # typecheck + produkční build do dist/ (včetně sw.js)
npm run preview    # náhled produkčního buildu
```

Stack: Vite, React 19, TypeScript, bez dalších runtime závislostí. Service worker generuje plugin ve `vite.config.ts` ze šablony `scripts/sw-template.js` se seznamem všech souborů buildu.

```
src/model/      datové typy, zóny těla, stavový automat, generátory hlášení (čisté funkce + testy)
src/storage/    IndexedDB + localStorage záloha
src/components/ obrazovky a UI prvky
src/hooks/      časovač, téma, wake lock, upozornění na TQ
```

## Nasazení na Cloudflare

Statické soubory servíruje Cloudflare Workers (Static Assets), konfigurace je ve `wrangler.jsonc`.

```bash
npx wrangler login
npm run deploy
```

Případně lze repozitář napojit na Cloudflare Workers Builds (build: `npm run build`, deploy: `npx wrangler deploy`).

## Odchylky od výchozí specifikace

Tam, kde se podklad lišil od aktuálních doporučení CoTCCC, aplikace se drží CoTCCC:

- **Combat Wound Medication Pack**: paracetamol 2× 650 mg (1300 mg), ne 1000 mg; meloxicam 15 mg; moxifloxacin 400 mg.
- **NDC**: nabízí se 5. mezižebří v přední axilární čáře i 2. mezižebří v medioklavikulární čáře, jehla 14G nebo 10G, 3,25″.
- **TXA** podává zdravotník (CMC). CLS ji nepodává, aplikace jen upozorní na indikaci a umožní zapsat, že ji podal zdravotník.
- **Časovače** v prohlížeči neběží na pozadí při zamčeném telefonu (Background Sync k tomu neslouží). Čas přiložení TQ je proto vždy nutné zapsat i fyzicky.
