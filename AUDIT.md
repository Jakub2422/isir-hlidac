# Audit aplikace dražeb – 27. 9. 2026

## Současný provoz

- Existující aplikace je Next.js 16 / React 19 sestavená přes Vinext pro Cloudflare Workers, hostovaná jako Site. Drizzle + Cloudflare D1 uchovávají **jen insolvenční události a kandidáty**. Neexistuje databázová tabulka dražeb.
- Dražební stránka `/drazby` spouští `/api/auctions` při načtení a každých pět minut, když zůstane otevřená. Server paralelně načítá katalogy, každému nastaví časový limit 18 sekund, odpovědi seskupí podle URL a vrátí nejvýše 250 položek. Jeden výpadek neodstaví ostatní zdroje.
- Publikovaná verze načítá 13 zdrojů. V tomto pracovním stavu jsou navíc implementovány **dražby-exekutoři** a **Správa železnic**, zatím nepřesunuté do nového nasazení. Soupis 21 webů obsahuje i pouhé odkazy a registry, které nejsou dražebními katalogy.
- Sběr používá veřejná rozhraní CEVD, exdrazby a ÚZSVM, RSS Finanční správy a HTML ostatních webů. Některé zdroje omezují rozsah na první stránku. Filtr MSK je u části zdrojů podle kraje, u jiných jen podle názvu obce v textu; tudíž není úplný.
- Přístup na současný Site se ověřuje na platformě Sites. `app/chatgpt-auth.ts` čte identitu z hlaviček této platformy; žádné ověřování identity na Vercelu zatím neexistuje.

## Funkce a omezení

| Funkce | Dnešní skutečný stav |
| --- | --- |
| Živý přehled nemovitostí | Funguje při otevření stránky, ale neukládá dražby a neprochází všechny stránky. |
| „Nové dnes“ | Porovnává datum zveřejnění u CEVD, Portálu dražeb a insolvenčních záměrů. **Není to datum prvního nalezení systémem.** U ostatních zdrojů nic nepočítá. |
| Filtr MSK, zdroj, text | Funguje nad aktuálně načtenými položkami; ostatní požadované filtry dosud chybějí. |
| Detail dražby | Jen karta s odkazem na pořadatele; interní detail neexistuje. |
| Fotografie/PDF/AI | Neukládají se, AI analýza neexistuje. |
| Deduplikace | Jen shodná URL; stejné řízení na více webech se může zobrazit vícekrát. |
| Historie a zrušení | Neexistuje. Zmizelé nabídky nejsou evidovány. |
| Oblíbené / uložené filtry | Neexistují. |
| Insolvenční kandidáti | Ukládají se do D1. Neověřují automaticky vlastnictví osoby v katastru a nejsou katalogem dražeb. |

## Zjištěný technický dluh

1. Volání na vzdálené weby v požadavku návštěvníka znamená pomalou a neúplnou odpověď. Sběr potřebuje naplánovanou úlohu, samostatnou historii běhů a úložiště.
2. `GET /api/auctions` vrací maximálně 250 položek a neprovádí stránkování zdrojů. Klient přepočítává dnešní počet jen z vrácených položek; může se lišit od serverového součtu.
3. Seznam nepoužívá strukturované údaje pro auta, oceňovací ceny, GPS, parcely, LV, dražebníky nebo dokumenty. Parsování krajů z názvu může minout malé obce.
4. ISIR synchronizace se spouští při návštěvě stránky, nikoliv jako samostatná naplánovaná práce. Přesun na Vercel vyžaduje náhradu hlavičkového přihlášení; samotná změna hostingu by zrušila ochranu uživatelských funkcí.
5. Stav přístupů se změnil: existující aplikace je nyní bezpečně importovaná do GitHub repozitáře `Jakub2422/isir-hlidac` a konektor má právo zápisu. Supabase stále vrací **0 projektů** a Vercel **0 týmů**, takže databázové a produkční nasazení je zatím blokované pouze těmito externími prostředími.

## Pořadí převodu bez přerušení funkční verze

1. Ověřit oprávnění ke GitHub repozitáři a Supabase projektu, cenu případného nového projektu a přístup k Vercelu. Připravit verzovaný převod kódu.
2. Nasadit schéma `supabase/schema.sql` s RLS, autentizací a ověřit zápis i čtení skutečné dražby.
3. Přesunout načítání mimo požadavky návštěvníků; každou nabídku uložit s okamžikem prvního a posledního zjištění a vazbou na všechny zdroje.
4. Zavést opatrné slučování podle jednoznačných údajů a audit změn. Zmizelé nabídky označovat až po úplném úspěšném průchodu příslušného zdroje.
5. Postavit z databáze filtry, detail, dnešní počty v kategoriích a osobní funkce. Teprve po ověření přesunout provoz na Vercel. Starý Site zůstává dostupný po dobu převodu.


## Aktualizace 28. 9. 2026

- GitHub repozitář je dostupný a obsahuje import existující nasazené Site verze 17.
- Produkční Supabase schéma nyní obsahuje i pravidla upozornění a idempotentní frontu notifikací.
- Identita dražeb byla zpřesněna: normalizuje název zdroje, odstraňuje trackingové parametry URL a stabilně řadí query parametry. Regresní testy byly rozšířeny.
- Běžící Site nebyl těmito změnami přepnut na nové schéma; změny jsou příprava pro bezpečný převod.
