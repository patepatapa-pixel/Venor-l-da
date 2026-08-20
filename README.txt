OMI IDLE FARM ONLINE V3

ÚJ:
- online regisztráció / belépés
- PostgreSQL felhőmentés
- online ranglista
- adminpanel: /admin
- játékoslista és statisztika
- tiltás / feloldás
- teljes játékosmentés reset
- admin jutalom hozzáadás: arany, kristály, érc, lélekkő, dungeon jegy
- admin műveleti napló
- automatikus cloud save kb. 15 másodpercenként
- a V2 teljes idle RPG rendszere megmaradt

RENDER TELEPÍTÉS – BLUEPRINT:
1. Csomagold ki ezt a ZIP-et.
2. Töltsd fel a fájlokat egy új GitHub repositoryba.
3. Render Dashboard → New → Blueprint.
4. Válaszd ki a GitHub repót. A render.yaml automatikusan létrehozza:
   - omi-idle-farm Web Service
   - omi-idle-farm-db PostgreSQL adatbázis
5. A Render bekéri az ADMIN_PASSWORD értékét. Adj meg erős jelszót.
6. Deploy.
7. Weboldal: a Render által adott *.onrender.com cím
8. Admin: https://SAJAT-CIMED.onrender.com/admin
9. Admin felhasználónév alapból: OmiAdmin
   (render.yaml ADMIN_USERNAME mezőben átírható)

MANUÁLIS TELEPÍTÉS ESETÉN szükséges Environment változók:
DATABASE_URL = Render PostgreSQL Internal Database URL
JWT_SECRET = hosszú véletlen titkos kulcs
ADMIN_USERNAME = pl. OmiAdmin
ADMIN_PASSWORD = erős admin jelszó

Build Command: npm install
Start Command: npm start

BIZTONSÁG:
- jelszavak bcrypt hash-sel vannak tárolva
- login httpOnly cookie JWT-t használ
- az admin végpontok szerepkör ellenőrzöttek
- ez már online mentés, de a játéklogika jelentős része kliensoldali, ezért komoly verseny/ranglista esetén további szerveroldali anti-cheat szükséges

V4 MODERN KARAKTER:
- Külön látványos saját karakter panel a Farm oldalon.
- A karakter körül 6 felszerelés slot látszik.
- A felszerelt weapon/armor/helmet vizuálisan megjelenik.
- Rare/Epic/Mythic/Legendary tárgyak színes keretet kapnak.
- Epic/Mythic/Legendary felszerelés automatikus aurát ad.
- Legendary aura arany, Mythic bíbor, Epic lila.
- A pet vizuálisan a karakter mellett lebeg.
- Az aktuális farmterület külön háttérhangulatot ad a karakter panelhez.
- A játék minden V3 online funkciója megmaradt: account, cloud save, ranglista, adminpanel, PostgreSQL.
- A megjelenés modern fantasy idle-RPG ihletésű, saját eredeti UI/ikon megoldással.

V5:
- Külön, alapból megnyíló Karakter fül.
- A felszerelt sisak/fegyver/páncél/kesztyű/csizma/gyűrű látszik a karakter körül.
- A karakter vizuálisan változik felszerelés és aura alapján.
- EQUIP BEST gomb: slotonként automatikusan a legerősebb tárgyat rakja fel.
- Automata wave rendszer.
- Minden wave végén automatikus boss.
- Amíg a bosst nem győzi le, nem lép tovább a következő wave-re.
- 200-as szinten Prestige.
- Prestige +1 Paragon szint, +5 Paragon statpont és +1 Aura token.
- Paragon pontok: sebzés / arany / drop / krit.
- Prestige Aura Shop.
- Prestige alatt inventory, felszerelés, petek, paragon és prestige megmarad.

V6 FIX:
- Javítva a V5 régi cloud save kompatibilitási hibája, ami lefagyás-szerű működést okozhatott.
- Minden régi mentést automatikusan V6 struktúrára egészít ki.
- A karakter teljesen új SVG humanoid fantasy hőst kapott.
- A páncél, sisak, kesztyű, csizma, gyűrű és fegyver ritkasága vizuálisan módosítja a karaktert.
- Equip Best javítva: minden felszerelési slotra ténylegesen a legerősebb, megfelelő típusú inventory tárgy kerül.
- Inventory kézi Felszerel gombjai változatlanul működnek.
- Karakteres látványelemek nem blokkolják többé az egérkattintásokat.
- Wave/Boss/Prestige/Paragon/Aura rendszer megmaradt.

V7 KARAKTER ADOTTSÁGOK:
- A Karakter fülön külön stat panel mutatja:
  Erő, Sebzés, Szerencse, Krit esély, Drop bónusz,
  Szint, Paragon, Prestige, Paragon pont, Aura token, Wave, Összes kill.

V9 ADMIN LINK FIX
- Admin belépés után a játék felső sávjában megjelenik a ⚙️ Adminpanel gomb.
- A gomb közvetlenül a /admin oldalra visz.
- Normál játékosok nem látják az admin gombot.
- Közvetlen admin cím továbbra is: /admin
