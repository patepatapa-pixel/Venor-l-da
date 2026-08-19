VENORI ONLINE — NINCS HELYI NPM / BAT SZÜKSÉG

Ez a verzió kifejezetten internetes hostingra készült.
Nem kell a Windowsodon npm installt futtatni, nem kell BAT fájlt indítani,
és a barátaid ugyanazt a publikus webcímet használhatják.

AJÁNLOTT: RENDER

A csomagban van render.yaml, amely létrehozza:
- a Node.js webszolgáltatást
- a PostgreSQL adatbázist
- JWT titkot
- az admin felhasználónevét: VenoriAdmin

Telepítéskor a Render egyetlen titkos értéket kér:
ADMIN_PASSWORD
Ide a SAJÁT admin jelszavadat írd.

A kódot először GitHub repositoryba kell feltölteni, majd Renderen
Blueprintként telepíteni a repositoryból.

Funkciók:
- regisztráció/bejelentkezés
- napi 5000 Coin
- saját Coin
- eljátszott Coin
- 1x/10x/100x nyitás
- 1000x letiltva
- jackpotok
- inventory
- ranglista
- játéktörténet
- külön adminpanel
- Coin adás/levonás
- tiltás/feloldás
- napi Coin/ládaár/közlemény/karbantartás
- PostgreSQL adatbázis

Admin URL:
https://A-TE-RENDER-CIMED.onrender.com/admin
