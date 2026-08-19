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
