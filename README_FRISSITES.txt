VENORI ONLINE V2

Módosítások:
- minden nyeremény látható
- 500K / 1M / 5M Yang
- 10 MILLIÁRD Yang max jackpot
- Ritka PET + csengő + tűzijáték
- 500 Coin
- nyert Coin automatikusan hozzáadódik
- összes nyert Coin és Yang külön statisztika
- ranglista a legtöbb nyert Yang alapján
- ranglistán a nyert Coin is látható
- nyitás után minden nyert drop és darabszám látható
- 1000x nyitás továbbra is tiltva
- meglévő Render PostgreSQL adatbázishoz automatikus migráció

- 10 milliárd Yang főnyeremény átvétel: játékban a Hox nevű játékosnak kell írni; a jackpot nem automatikus jóváírás.

ÚJ V3:
- 10 milliárd Yang nyeréskor teljes képernyős NYERTÉL 10 MILLIÁRD YANGOT effekt
- gratuláció és Hox játékos megkeresésére szóló üzenet
- minden 10B jackpot szerveroldalon külön jackpot_wins táblába kerül
- adminpanelen külön jackpot ellenőrző lista
- admin átadottnak tudja jelölni a 10B nyereményt
- napi 5000 Coin adatbázis-szinten atomikusan csak napi 1 alkalommal vehető fel

V4: A ládanyitó gomb alatt oszloposan megjelenik a legutóbbi nyitás összes nyereménye, összevont darabszámmal, valamint az összes nyert Yang és Coin.

V5:
- Adminpanelen új 🔄 RANGLISTA RESET gomb
- Kétlépcsős megerősítés: böngészős megerősítés + RESET szó beírása
- Nullázza minden normál játékos total_yang_won és total_coin_won értékét
- Nem törli a Coin egyenleget, fiókot, inventoryt, játéktörténetet vagy jackpot auditot

V6 JAVÍTÁS:
- A 10 milliárd Yang jackpot ablak ÉRTETTEM gombja most biztosan működik.
- A hibát az okozta, hogy a gomb eseménykezelője a HTML elem betöltése előtt futott le.
- Most eseménydelegálással működik, ezért stabil.
- ESC billentyűvel is bezárható a jackpot ablak.

V7 KATTINTÁSI JAVÍTÁS:
- A rejtett jackpot overlay többé nem tudja blokkolni az egész oldalt.
- A rejtett belépési modal sem fogja el a kattintásokat.
- A fejléc, menü, regisztráció, belépés, napi Coin, ranglista és admin link újra kattintható.
- A jackpot ablak csak akkor kap pointer-events jogosultságot, amikor ténylegesen látható.

V8:
- Adminpanelen TELJES RENDSZER RESET gomb.
- Háromlépcsős megerősítés, TELJES RESET szöveg beírásával.
- Törli az összes normál játékost és kapcsolódó játékadatot.
- Az adminfiók megmarad.
- Alap beállítások visszaállnak: napi 5000 Coin, ládaár 100 Coin.
- Belépési ablakban "Belépve maradok ezen az eszközön" opció.
- Bekapcsolva 30 napos munkamenetet használ.
- A böngésző eltárolja a felhasználónevet, a jelszót NEM tárolja az oldal saját kódja.

V9:
- A 10 milliárd Yang jackpot ellenőrző listából az admin egyesével törölheti a neveket/bejegyzéseket.
- Van külön JACKPOT LISTA KIÜRÍTÉSE gomb.
- A lista törlése NEM törli a játékos fiókját, Coinját, ranglistáját, inventoryját vagy játéktörténetét.
- A teljes lista törléséhez külön megerősítő szöveg szükséges.

V10 ITEM DROP BŐVÍTÉS:
- A felhasználó képe alapján 88 külön item került a Venori ládába.
- Az itemekből egy sikeres item-drop esetén véletlenszerűen 1, 2 vagy maximum 3 db nyitható.
- A meglévő Yang, Coin, Ritka PET és 10 milliárd Yang jackpot nyeremények megmaradtak.
- A nyitási eredménylistában az itemek tényleges darabszáma összeadódik és megjelenik.

V11 TOVÁBBI ITEMEK:
- A két új képről további 117 item került a ládába.
- A V10-ben lévő 88 item és minden korábbi nyeremény megmaradt.
- Ezekből is 1, 2 vagy maximum 3 db nyitható egy item-drop alkalmával.
- Kategóriák: kulcsok/belépők, Aura, növények, anyagok, eventes tárgyak.

V12 DROP ADMIN:
- Adminpanelen külön "Láda tartalma / Drop esélyek" rész.
- Keresés és típus szerinti szűrés.
- Minden nyereménynél állítható a súly/esély.
- Yang/Coin érték adminból állítható.
- Itemek minimum és maximum darabszáma adminból állítható.
- Egyes dropok ki/be kapcsolhatók.
- Drop lista egy gombbal alapértékre visszaállítható.
- A játékos oldalon megjelenik az aktuálisan aktív teljes ládatartalom.

V13:
- 500K Yang teljesen kikerült a ládából.
- 1M Yang teljesen kikerült a ládából.
- A régi adatbázisban esetleg elmentett drop configból is automatikusan kiszűri ezt a két nyereményt.
- Az admin drop-listában sem jelennek meg többé.

V14 RENDER JAVÍTOTT:
- Javítva a Render hiba: ReferenceError: getRewardConfig is not defined.
- Javítva/definiálva a baseRewards, getRewardConfig és pickFrom.
- 500K Yang és 1M Yang továbbra sincs a ládában.
- A meglévő itemes drop-admin rendszer megmaradt.
- Node.js szintaktikai ellenőrzés: OK.

V15 FINOMHANGOLÁS:
- 5M Yang kikerült.
- Helyette 50M Yang került be.
- 500 Coin továbbra is jóváíródik, de a játékosnak nem jelenik meg külön dropként.
- A jobb oldali "Legutóbbi nyerések" blokk kikerült.
- A nyitási eredmény kizárólag a nyitás gomb alatt jelenik meg.
- A nyeremények egymás alatt, rendezett sorokban jelennek meg.
- A láda teljes tartalma nézetben a 500 Coin nincs kijelezve.

V16:
- A hatalmas "A láda teljes tartalma" rész kikerült a főoldal aljáról.
- A láda dropjai most a jobb oldali panelen, külön kompakt blokkban jelennek meg.
- A blokk görgethető, így nem nyújtja több képernyő hosszúra az oldalt.
- Keresőmező került bele.
- A nyitás tényleges eredménye továbbra is közvetlenül a Nyitás gomb alatt jelenik meg.

V17 STABILITÁS + EFFEKTEK:
- A ládanyitás alatt a Nyitás gomb lezár, így nem küldhető el több 100x kérés egyszerre.
- A gomb finally blokkban mindig visszakapcsol, hiba esetén is.
- A belépés/regisztráció nem fagyhat be a sok nyitási kérés miatt.
- A drop panel új, lenyitható "Láda tartalma" fiók lett, keresővel és típus szűrőkkel.
- Ritka PET nyerésnél külön teljes képernyős PET effekt jelenik meg.
- 10 milliárd Yang jackpot effekt és Hox figyelmeztetés megmaradt.
- Ritka PET és 10B jackpot esetén csilingelő hang szól a böngésző Web Audio API-jával.
- 10B jackpot elsőbbséget élvez, ha ugyanabban a nyitásban PET is esik.

V18 BELÉPÉS JAVÍTÁS:
- Javítva a valódi belépési hiba: a loadRememberedLogin függvény hiányzott.
- A Belépés / Regisztráció modal gombkezelése átírva stabilabbra.
- 100x nyitás közben a nyitás gomb zárolódik, majd mindig visszakapcsol.
- PET effekt + csilingelés.
- 10B jackpot effekt + csilingelés + Hox figyelmeztetés megmaradt.
- Frontend JavaScript és server.js szintaktikai ellenőrzés: OK.

V19 RENDER PORT FIX:
- A szerver most explicit 0.0.0.0 címen figyel.
- A Render által biztosított PORT környezeti változót használja.
- A HTTP szerver azonnal elindul, nem vár az adatbázis inicializálására.
- /api/health azonnal 200 OK választ ad.
- PostgreSQL kapcsolat időtúllépést kapott, hogy ne tudja végtelenül blokkolni az indulást.
- SIGTERM kezelés hozzáadva.

V21 ADMIN BELÉPÉS JAVÍTÁS:
- Az admin oldal többé nem dob vissza a főoldalra attól, hogy egy admin blokk betöltése hibázik.
- Csak akkor irányít vissza, ha nincs érvényes admin munkamenet vagy a fiók nem admin.
- Külön "Admin adatok újratöltése" gomb került az oldalra.
- A szerver /api/ready végponttal jelzi az adatbázis inicializáltságát.
- Admin API-k egyértelmű 503 üzenetet adnak, ha a Render indulás után még inicializálja az adatbázist.
- server.js és frontend JS szintaxis ellenőrizve.

V22 ADMIN JÁTÉKOS STATISZTIKA:
- Admin fiókkal a normál játékos felületen külön "Admin · Játékos aktivitás" panel látható.
- Látszik játékosonként: elpörgetett Coin, slot pörgetések, slotból nyert Coin, ládanyitások, összes eljátszott Coin és jelenlegi Coin.
- A panel csak admin szerepkörnél jelenik meg.
- Kereső és manuális frissítés gomb került bele.

V23:
- Minden új játékos 5000 Coinnal és 5000 Lélek Ponttal kezd.
- Napi 5000 Coin külön, naponta egyszer vehető fel.
- Napi 5000 Lélek Pont külön, naponta egyszer vehető fel.
- Láda csak Lélek Pontért nyitható, alapár 1000 Lélek Pont / láda.
- Coin kizárólag Slothoz és jutalomkiváltáshoz használható.
- Láda drop: 100, 1K, 10K, 100K, 1M, 10M, 100M, 1B, 10B Yang + Ritka PET.
- Admin állítja a láda drop súlyokat, a Lélek Pont ládaárat, Slot téteket/nyereményeket és kiváltható jutalmakat.
- Kiváltás admin átadási listára kerül.

V24 SLOT ESÉLY:
- Adminpanelen 0-100% között állítható a Slot NYERTES esélye.
- Koponya esély = 100 - NYERTES esély.
- Játékos oldalon a tényleges aktuális százalék jelenik meg.
- Alapérték 60% NYERTES / 40% Koponya.
- Admin beállítás panel egyúttal rendezve és kiegészítve a napi Lélek Pont, ládaár és Slot mezőkkel.

V25 TARTÓS NYEREMÉNYLISTA:
- A ládanyitás eredménye többé nem törlődik a következő nyitásnál.
- Minden játékos minden nyereménye adatbázisban folyamatosan összeadódik.
- 100x nyitás után újabb 100x nyitás hozzáadódik az előző eredményekhez.
- A játékos kilépés/böngészőfrissítés után is ugyanazt a mentett összesítést látja.
- Külön user_reward_totals adatbázistábla tárolja rewardonként a darabszámot és értéket.
- A panel mutatja az összes ládanyitást, rewardonkénti összdarabszámot és összes nyert Yangot.

V26 STATISZTIKA FÜL:
- Új külön Statisztika fül a játékos felületen.
- Slot: összes pörgetés, megforgatott Coin, nyert Coin, elbukott Coin, profit/nettó eredmény, ROI.
- Láda: összes nyitás, ténylegesen elköltött Lélek Pont, összes nyert Yang.
- Aktuális Coin és Lélek Pont egyenleg.
- Az új veszteség és Lélek Pont költés statisztikák adatbázisban tartósan mentődnek.

V27 JAVÍTÁS:
- Javítva: relation "user_reward_totals" does not exist.
- A user_reward_totals tábla explicit migrációként létrejön minden deploynál.
- A nyereménylista API és a ládanyitás önjavító módon is létrehozza a táblát, ha egy régebbi adatbázisból hiányzik.
- Meglévő játékosadatok nem törlődnek.

V28 BELÉPÉS + ADATBÁZIS JAVÍTÁS:
- Megtalálva és javítva az init() SQL hibája: hiányzott a pontosvessző a redemption_claims tábla után.
- Emiatt az adatbázis inicializálás leállt, az új users oszlopok nem jöttek létre, és a login 500-as hibára futott.
- Login részletesebb hibakezelést kapott.
- /api/auth-health diagnosztikai végpont hozzáadva.

V29: Tartós, összeadódó statisztika. Slot pörgetés/tét/nyerés/bukás/profit/veszteség/nettó/ROI és ládanyitás/Lélek Pont/Yang tartósan adatbázisban. A korábbi számlálók egyszer automatikusan átkerülnek.

V30 STATISZTIKA + JACKPOT SZABÁLY:
- Külön Statisztika fülön látszik Slotnál: pörgetések, megforgatott Coin, nyert Coin, elbukott Coin, profit, veszteség, nettó, ROI.
- Ládánál: nyitások, elköltött Lélek Pont, összes nyert Yang, 10B jackpotok száma.
- Feltűnő figyelmeztetés: CSAK A JACKPOT FIZET JÁTÉKON BELÜL.
- A normál Yang dropok statisztikai eredmények, tényleges játékbeli kifizetés csak 10B JACKPOT esetén, Hox játékosnál.

V31 ADMIN JÁTÉKOS STATISZTIKÁK:
- Adminpanelen minden játékosnál külön Statisztika gomb.
- Megnyitható játékosonként: Slot pörgetések, megforgatott Coin, nyert/bukott Coin, profit, veszteség, nettó, ROI.
- Láda: összes nyitás, elköltött Lélek Pont, nyert Yang, 10B jackpotok száma.
- Látható a játékos összes mentett nyereménye és kiváltása is.

V32 OMI GAMBA:
- Weboldal neve: OMI Gamba.
- Böngésző címe: OMI Gamba – Gemblingezni csak saját felelősségre.
- Játékos és admin oldalon is feltűnő felelősségi figyelmeztetés.

V33 FEKETE-ARANY:
- A felső logó most OMI GAMBA.
- Teljes fekete/arany prémium megjelenés.
- Arany aktív gombok, arany kiemelések, fekete panelek.
- Modern arany egyedi egérkurzor.
- Játékos és admin oldal is ugyanazt az OMI Gamba stílust kapta.
