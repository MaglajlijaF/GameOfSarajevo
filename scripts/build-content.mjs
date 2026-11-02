// Authoring script for campaign content. Writes stages.json, enemies.json,
// bosses.json, themes.json, sprites.json and merges names into lang files.
// The generated JSON is the source of truth at runtime and can be hand-edited;
// re-running this script overwrites those files.
import { readFileSync, writeFileSync } from 'node:fs';
const D = new URL('../src/data/', import.meta.url);
const w = (f, o) => writeFileSync(new URL(f, D), JSON.stringify(o, null, 1) + '\n');

// ---------- enemies: id → [behavior, hp, dmg, speed, xp, params, projectile?, recipe, bs, en] ----------
const R = (skin, hair, hairStyle, shirt, shirt2, pants, shoes, extra = {}) => ({ skin, hair, hairStyle, shirt, shirt2, pants, shoes, ...extra });
const E = {
  // Kovači
  prodavac: ['walker', 22, 10, 46, 3, { attackRange: 20, attackCooldown: 1.3, jumpPower: 300 }, null, R('skin2', 'hairBlack', 'bald', 'cream', 'tan', 'brownDark', 'brownDark', { accessory: 'tray', accessoryColor: 'copper' }), 'Prodavač suvenira', 'Souvenir Seller'],
  golubar: ['thrower', 16, 8, 38, 4, { keepDistance: 130, throwCooldown: 2.2, throwSpeed: 190, jumpPower: 280 }, 'corn', R('skin1', 'hairGrey', 'hat', 'olive', 'greenDark', 'greyDark', 'black', { accessory: 'cornbag', accessoryColor: 'khaki' }), 'Hranitelj golubova', 'Pigeon Feeder'],
  dostavljac: ['jumper', 18, 9, 70, 4, { hopCooldown: 1.1, hopPower: 340, hopSpeed: 120 }, null, R('skin3', 'hairBrown', 'cap', 'orange', 'red', 'navy', 'white', { accessory: 'parcel', accessoryColor: 'orange' }), 'Dostavljač', 'Delivery Runner'],
  nosac: ['charger', 46, 14, 34, 7, { chargeRange: 170, chargeSpeed: 210, windup: 0.55, chargeTime: 0.9, chargeCooldown: 2.4, jumpPower: 260 }, null, R('skin2', 'hairBrown', 'beanie', 'teal', 'tealDark', 'khaki', 'brownDark', { accessory: 'crate', accessoryColor: 'purple' }), 'Nosač sanduka', 'Crate Porter'],
  // Bistrik
  harmonikas: ['shooter', 24, 9, 34, 5, { keepDistance: 160, shotCooldown: 2.4, shotSpeed: 140, burst: 3, spread: 36, sine: 1 }, 'note', R('skin2', 'hairBlack', 'hat', 'redDark', 'black', 'black', 'black', { prop: 'accordion', accessory: 'vest', accessoryColor: 'black' }), 'Ulični harmonikaš', 'Street Accordionist'],
  vrtlarica: ['bomber', 22, 11, 36, 5, { keepDistance: 140, throwCooldown: 2.6, throwSpeed: 200, blast: 34 }, 'flowerpot', R('skin1', 'hairRed', 'bun', 'green', 'greenDark', 'khaki', 'brownDark', { accessory: 'apron', accessoryColor: 'olive', prop: 'flowerpot' }), 'Vrtlarica', 'Gardener'],
  dzoger: ['dasher', 24, 11, 64, 5, { chargeRange: 220, chargeSpeed: 310, chargeTime: 0.5, windup: 0.35, chargeCooldown: 1.8, jumpPower: 330 }, null, R('skin3', 'hairBrown', 'ponytail', 'pink', 'purple', 'black', 'white', { accessory: 'stripes', accessoryColor: 'white' }), 'Džogerica na stepenicama', 'Stair Jogger'],
  komsija: ['shielder', 40, 12, 32, 6, { attackCooldown: 1.6, windup: 0.4, jumpPower: 280 }, null, R('skin2', 'hairGrey', 'short', 'khaki', 'brown', 'greyDark', 'black', { accessory: 'mustache', prop: 'umbrella' }), 'Komšija s kišobranom', 'Neighbour with Umbrella'],
  // Skenderija
  skejter: ['dasher', 26, 12, 72, 5, { chargeRange: 260, chargeSpeed: 340, chargeTime: 0.6, windup: 0.3, chargeCooldown: 1.6, jumpPower: 340 }, null, R('skin1', 'hairBlond', 'beanie', 'yellow', 'orange', 'denim', 'black', { accessoryColor: 'red', prop: 'skateboard' }), 'Skejter', 'Skateboarder'],
  klizacica: ['spinner', 30, 12, 56, 6, { spinTime: 1.3, spinCooldown: 2.2, radius: 26 }, null, R('skin1', 'hairBlack', 'bun', 'teal', 'white', 'teal', 'white', { prop: 'skates' }), 'Klizačica', 'Figure Skater'],
  kokice: ['thrower', 26, 10, 40, 5, { keepDistance: 130, throwCooldown: 2.0, throwSpeed: 200, burst: 2 }, 'popcorn', R('skin2', 'hairBrown', 'cap', 'red', 'white', 'navy', 'black', { accessoryColor: 'red', prop: 'popcorn' }), 'Prodavač kokica', 'Popcorn Vendor'],
  grudvas: ['shooter', 20, 10, 50, 5, { keepDistance: 140, shotCooldown: 1.6, shotSpeed: 230 }, 'snowball', R('skin1', 'hairRed', 'beanie', 'blue', 'white', 'navy', 'black', { accessoryColor: 'green', accessory: 'scarf' }), 'Klinac s grudvama', 'Snowball Kid'],
  // Marijin Dvor
  sluzbenik: ['shooter', 30, 11, 40, 6, { keepDistance: 170, shotCooldown: 2.0, shotSpeed: 170, burst: 2, spread: 20, sine: 1 }, 'paper', R('skin2', 'hairBlack', 'short', 'white', 'blue', 'greyDark', 'black', { accessory: 'glasses', prop: 'folder' }), 'Službenik', 'Office Clerk'],
  romobil: ['dasher', 30, 13, 70, 6, { chargeRange: 260, chargeSpeed: 350, chargeTime: 0.55, windup: 0.3, chargeCooldown: 1.6 }, null, R('skin3', 'hairBrown', 'cap', 'green', 'greenDark', 'black', 'white', { accessoryColor: 'green', prop: 'scooter' }), 'Kurir na romobilu', 'Scooter Courier'],
  zastitar: ['shielder', 56, 14, 34, 8, { attackCooldown: 1.4, windup: 0.4 }, null, R('skin2', 'hairBlack', 'short', 'navy', 'black', 'navy', 'black', { accessory: 'vest', accessoryColor: 'yellow', prop: 'briefcase' }), 'Zaštitar', 'Security Guard'],
  stazistica: ['summoner', 26, 9, 38, 6, { keepDistance: 180, shotCooldown: 3.2, count: 2, turn: 2.6, life: 5 }, 'paper', R('skin1', 'hairAuburn', 'bob', 'purple', 'white', 'black', 'black', { accessory: 'glasses' }), 'Stažistica', 'Intern'],
  // Grbavica
  navijac: ['roller', 34, 12, 44, 6, { keepDistance: 120, throwCooldown: 1.8, throwSpeed: 200 }, 'ball', R('skin2', 'hairBrown', 'short', 'blue', 'white', 'denim', 'white', { accessory: 'scarf', accessoryColor: 'yellow' }), 'Navijač', 'Football Fan'],
  bubnjar: ['buffer', 36, 10, 36, 7, { keepDistance: 170, buffCooldown: 4, radius: 130, buffTime: 3 }, null, R('skin3', 'hairBlack', 'curly', 'white', 'blue', 'denim', 'black', { accessory: 'scarf', accessoryColor: 'blue', prop: 'drum' }), 'Bubnjar s tribine', 'Stand Drummer'],
  sudija: ['shooter', 32, 12, 48, 6, { keepDistance: 150, shotCooldown: 1.5, shotSpeed: 280 }, 'whistle', R('skin1', 'hairBlack', 'short', 'black', 'yellow', 'black', 'black', { accessory: 'stripes', accessoryColor: 'yellow' }), 'Sudija', 'Referee'],
  golman: ['jumper', 44, 14, 60, 7, { hopCooldown: 1.0, hopPower: 400, hopSpeed: 150 }, null, R('skin2', 'hairBlond', 'short', 'green', 'black', 'black', 'black', { prop: 'gloves' }), 'Golman', 'Goalkeeper'],
  // Malta
  kondukter: ['walker', 44, 14, 60, 7, { attackRange: 26, attackCooldown: 1.0, windup: 0.3, jumpPower: 320 }, null, R('skin2', 'hairGrey', 'cap', 'navy', 'blueDark', 'navy', 'black', { accessoryColor: 'navy', prop: 'ticketpunch', accessory: 'mustache' }), 'Kontrolor karata', 'Ticket Inspector'],
  mehanicar: ['bomber', 38, 14, 40, 7, { keepDistance: 150, throwCooldown: 2.4, throwSpeed: 210, blast: 40, burst: 2 }, 'oilcan', R('skin3', 'hairBrown', 'beanie', 'blueDark', 'navy', 'blueDark', 'black', { accessoryColor: 'orange', prop: 'wrench' }), 'Mehaničar', 'Tram Mechanic'],
  biciklista: ['dasher', 36, 14, 74, 7, { chargeRange: 280, chargeSpeed: 370, chargeTime: 0.6, windup: 0.3, chargeCooldown: 1.5 }, null, R('skin1', 'hairBlond', 'cap', 'yellow', 'black', 'black', 'black', { accessoryColor: 'yellow', prop: 'bike' }), 'Biciklista', 'Cyclist'],
  elektricar: ['sniper', 30, 16, 34, 8, { keepDistance: 230, aimTime: 0.8, shotSpeed: 480, shotCooldown: 2.6 }, 'bolt', R('skin2', 'hairBlack', 'cap', 'orange', 'navy', 'navy', 'black', { accessoryColor: 'yellow', prop: 'cable' }), 'Električar', 'Line Electrician'],
  // Čengić Vila
  baka: ['charger', 50, 15, 36, 8, { chargeRange: 200, chargeSpeed: 260, windup: 0.5, chargeTime: 1.0, chargeCooldown: 2.0 }, null, R('skin1', 'hairGrey', 'bun', 'purple', 'pink', 'brown', 'black', { accessory: 'glasses', prop: 'trolley' }), 'Baka s kolicima', 'Granny with Trolley'],
  balonas: ['bomber', 30, 14, 56, 7, { keepDistance: 130, throwCooldown: 1.9, throwSpeed: 210, blast: 32 }, 'balloon', R('skin2', 'hairBlack', 'curly', 'red', 'yellow', 'denim', 'white', { prop: 'balloon' }), 'Klinac s balonima', 'Water-balloon Kid'],
  sahista: ['thrower', 34, 14, 36, 8, { keepDistance: 160, throwCooldown: 2.2, throwSpeed: 220, burst: 3 }, 'pawn', R('skin2', 'hairGrey', 'bald', 'brown', 'tan', 'greyDark', 'black', { accessory: 'glasses' }), 'Šahista iz parka', 'Park Chess Player'],
  cvjecarka: ['summoner', 32, 12, 40, 8, { keepDistance: 170, shotCooldown: 3.0, count: 3, turn: 2.6, life: 5 }, 'petal', R('skin1', 'hairBlond', 'long', 'pink', 'green', 'green', 'white', { prop: 'flowers' }), 'Cvjećarka', 'Florist'],
  // Hrasno
  perac: ['dropper', 44, 17, 54, 9, { blast: 36, jumpPower: 300 }, null, R('skin2', 'hairBrown', 'cap', 'blue', 'yellow', 'blueDark', 'black', { accessoryColor: 'yellow', accessory: 'vest', prop: 'squeegee' }), 'Perač prozora', 'Window Cleaner'],
  moler: ['bomber', 40, 15, 42, 9, { keepDistance: 150, throwCooldown: 2.2, throwSpeed: 210, blast: 38 }, 'paint', R('skin1', 'hairBlack', 'hat', 'white', 'cream', 'white', 'grey', { accessoryColor: 'white', prop: 'paintroller' }), 'Moler', 'House Painter'],
  antenas: ['sniper', 36, 18, 38, 9, { keepDistance: 240, aimTime: 0.75, shotSpeed: 500, shotCooldown: 2.4 }, 'signal', R('skin3', 'hairBlack', 'beanie', 'olive', 'khaki', 'khaki', 'brownDark', { accessoryColor: 'red', prop: 'antenna' }), 'Majstor za antene', 'Antenna Installer'],
  domar: ['shielder', 70, 17, 38, 9, { attackCooldown: 1.3, windup: 0.35 }, null, R('skin2', 'hairGrey', 'short', 'blueDark', 'navy', 'blueDark', 'black', { accessory: 'mustache', prop: 'binlid' }), 'Domar', 'Caretaker'],
  // Pofalići
  planinar: ['walker', 60, 18, 50, 9, { attackRange: 32, attackCooldown: 1.1, windup: 0.3, jumpPower: 340 }, null, R('skin2', 'hairBrown', 'hat', 'red', 'redDark', 'khaki', 'brownDark', { accessoryColor: 'green', accessory: 'bag', prop: 'stick' }), 'Planinar', 'Hiker'],
  pcelar: ['summoner', 40, 13, 38, 10, { keepDistance: 180, shotCooldown: 2.6, count: 4, turn: 3.2, life: 5 }, 'bee', R('skin1', 'hairBrown', 'hat', 'white', 'cream', 'white', 'black', { accessoryColor: 'white', prop: 'smoker' }), 'Pčelar', 'Beekeeper'],
  berac: ['thrower', 40, 15, 44, 9, { keepDistance: 140, throwCooldown: 1.8, throwSpeed: 220, burst: 3 }, 'apple', R('skin3', 'hairBlack', 'short', 'green', 'greenDark', 'denim', 'brownDark', { prop: 'basket' }), 'Berač jabuka', 'Apple Picker'],
  trkacica: ['jumper', 46, 16, 70, 9, { hopCooldown: 0.8, hopPower: 400, hopSpeed: 170 }, null, R('skin1', 'hairRed', 'ponytail', 'orange', 'yellow', 'black', 'white', { accessory: 'stripes', accessoryColor: 'yellow' }), 'Trkačica po stazama', 'Trail Runner'],
  // Ciglane
  zidar: ['thrower', 48, 17, 40, 10, { keepDistance: 140, throwCooldown: 1.7, throwSpeed: 220, burst: 2 }, 'brick', R('skin2', 'hairBrown', 'cap', 'orange', 'brown', 'denim', 'brownDark', { accessoryColor: 'yellow', prop: 'brick' }), 'Zidar', 'Bricklayer'],
  daskas: ['spinner', 60, 18, 50, 10, { spinTime: 1.5, spinCooldown: 2.0, radius: 32 }, null, R('skin3', 'hairBlack', 'cap', 'green', 'greenDark', 'khaki', 'brownDark', { accessoryColor: 'yellow', prop: 'plank' }), 'Radnik s daskom', 'Plank Carrier'],
  geometar: ['sniper', 40, 20, 38, 10, { keepDistance: 250, aimTime: 0.7, shotSpeed: 520, shotCooldown: 2.2 }, 'signal', R('skin1', 'hairBlond', 'cap', 'yellow', 'orange', 'navy', 'black', { accessoryColor: 'orange', accessory: 'vest', prop: 'theodolite' }), 'Geometar', 'Surveyor'],
  skelas: ['dropper', 52, 19, 56, 10, { blast: 40 }, null, R('skin2', 'hairBlack', 'cap', 'blue', 'navy', 'denim', 'black', { accessoryColor: 'orange', accessory: 'vest' }), 'Radnik sa skele', 'Scaffold Worker'],
  // Koševo
  sprinter: ['dasher', 54, 19, 84, 11, { chargeRange: 320, chargeSpeed: 420, chargeTime: 0.6, windup: 0.25, chargeCooldown: 1.3, jumpPower: 360 }, null, R('skin4', 'hairBlack', 'short', 'red', 'white', 'red', 'white', { accessory: 'stripes', accessoryColor: 'white' }), 'Sprinter', 'Sprinter'],
  kopljasica: ['sniper', 46, 22, 40, 11, { keepDistance: 260, aimTime: 0.7, shotSpeed: 540, shotCooldown: 2.0 }, 'javelin', R('skin1', 'hairBrown', 'ponytail', 'blue', 'white', 'blue', 'white', { prop: 'javelin' }), 'Bacačica koplja', 'Javelin Thrower'],
  kuglas: ['bomber', 70, 21, 36, 12, { keepDistance: 150, throwCooldown: 2.2, throwSpeed: 200, blast: 46 }, 'shotput', R('skin2', 'hairBlack', 'bald', 'green', 'white', 'green', 'white', { prop: 'shotput', accessory: 'mustache' }), 'Bacač kugle', 'Shot Putter'],
  kladivas: ['spinner', 66, 21, 52, 12, { spinTime: 1.6, spinCooldown: 1.8, radius: 36 }, null, R('skin3', 'hairBrown', 'short', 'purple', 'white', 'purple', 'white', { prop: 'hammerball' }), 'Bacač kladiva', 'Hammer Thrower'],
  // Alipašino Polje
  kosarkas: ['roller', 64, 21, 58, 12, { keepDistance: 130, throwCooldown: 1.5, throwSpeed: 230, jumpPower: 400 }, 'basketball', R('skin4', 'hairBlack', 'curly', 'orange', 'white', 'orange', 'white', { prop: 'basketball' }), 'Košarkaš', 'Street Baller'],
  dj: ['buffer', 58, 18, 40, 12, { keepDistance: 180, buffCooldown: 3.2, radius: 150, buffTime: 3.5 }, null, R('skin2', 'hairBlack', 'cap', 'black', 'purple', 'black', 'white', { accessoryColor: 'purple', prop: 'boombox' }), 'DJ iz haustora', 'Block DJ'],
  grafiter: ['shooter', 52, 20, 48, 12, { keepDistance: 120, shotCooldown: 1.6, shotSpeed: 220, burst: 5, spread: 40 }, 'paint', R('skin1', 'hairRed', 'beanie', 'green', 'teal', 'denim', 'black', { accessoryColor: 'teal', prop: 'spraycan' }), 'Grafiter', 'Graffiti Artist'],
  plesacica: ['spinner', 60, 21, 62, 12, { spinTime: 1.4, spinCooldown: 1.6, radius: 30 }, null, R('skin3', 'hairBlack', 'cap', 'pink', 'purple', 'black', 'white', { accessoryColor: 'yellow' }), 'Brejk plesačica', 'Breakdancer'],
  // Dobrinja
  prtljag: ['roller', 76, 24, 46, 13, { keepDistance: 140, throwCooldown: 1.6, throwSpeed: 220 }, 'suitcase', R('skin2', 'hairBrown', 'cap', 'orange', 'yellow', 'navy', 'black', { accessoryColor: 'orange', accessory: 'vest', prop: 'suitcase' }), 'Rukovalac prtljagom', 'Baggage Handler'],
  stjuardesa: ['charger', 80, 25, 46, 13, { chargeRange: 240, chargeSpeed: 320, windup: 0.4, chargeTime: 0.9, chargeCooldown: 1.6 }, null, R('skin1', 'hairBlond', 'bun', 'navy', 'red', 'navy', 'black', { accessory: 'scarf', accessoryColor: 'red', prop: 'cart' }), 'Stjuardesa s kolicima', 'Flight Attendant'],
  marsal: ['sniper', 60, 26, 40, 13, { keepDistance: 250, aimTime: 0.6, shotSpeed: 560, shotCooldown: 1.9 }, 'signal', R('skin3', 'hairBlack', 'cap', 'orange', 'yellow', 'navy', 'black', { accessoryColor: 'white', accessory: 'vest', prop: 'wands' }), 'Navigator na pisti', 'Ramp Marshaller'],
  dronas: ['summoner', 56, 20, 42, 13, { keepDistance: 200, shotCooldown: 2.4, count: 3, turn: 3.6, life: 6 }, 'drone', R('skin1', 'hairBrown', 'short', 'grey', 'greyDark', 'black', 'black', { accessory: 'glasses', prop: 'controller' }), 'Pilot drona', 'Drone Pilot'],
};

// ---------- bosses ----------
const B = {
  kazandzija: { hp: 950, dmg: 18, xp: 40, proj: 'pot', summon: 'prodavac', color: '#c87a3a', phases: [['slam', 'charge', 'volley'], ['rain', 'shockwave', 'leap', 'charge', 'summon']], recipe: R('skin3', 'hairGrey', 'bald', 'redDark', 'brownDark', 'brownDark', 'black', { accessory: 'apron', accessoryColor: 'brown', prop: 'hammer' }), bs: ['Majstor Kazandžija', 'Niko ne kuca bakar glasnije od mene!'], en: ['Master Coppersmith', 'Nobody hammers copper louder than me!'] },
  cesmarka: { hp: 1050, dmg: 19, xp: 50, proj: 'drop', summon: 'vrtlarica', color: '#4aa3df', phases: [['barrage', 'trap', 'charge'], ['spiral', 'rain', 'trap', 'pull', 'leap']], recipe: R('skin1', 'hairAuburn', 'long', 'blue', 'blueDark', 'teal', 'black', { accessory: 'apron', accessoryColor: 'teal', prop: 'bucket' }), bs: ['Čuvarica česme', 'Ova voda je za piće, ne za tebe!'], en: ['Fountain Keeper', 'This water is for drinking, not for you!'] },
  trener_klizanja: { hp: 1100, dmg: 20, xp: 55, proj: 'puck', summon: 'klizacica', color: '#9ad0f0', phases: [['zigzag', 'spiral', 'trap'], ['zigzag', 'barrage', 'spiral', 'summon', 'teleport']], recipe: R('skin2', 'hairBlond', 'beanie', 'white', 'teal', 'navy', 'white', { accessoryColor: 'teal', accessory: 'scarf', prop: 'hockeystick' }), bs: ['Trener klizanja', 'Na led! Dvadeset krugova!'], en: ['Skating Coach', 'On the ice! Twenty laps!'] },
  direktorica: { hp: 1150, dmg: 21, xp: 60, proj: 'paper', summon: 'sluzbenik', color: '#e04a6a', phases: [['laser', 'barrage', 'summon'], ['laser', 'shield', 'meteor', 'zigzag', 'barrage']], recipe: R('skin1', 'hairBlack', 'bob', 'redDark', 'white', 'black', 'black', { accessory: 'glasses', prop: 'pointer' }), bs: ['Generalna direktorica', 'Sastanak je završen. Ti si otpušten!'], en: ['Chief Executive', 'This meeting is over. You are fired!'] },
  trener: { hp: 1200, dmg: 22, xp: 65, proj: 'ball', summon: 'navijac', color: '#5ad05a', phases: [['roll', 'pull', 'charge'], ['roll', 'shockwave', 'summon', 'barrage', 'charge']], recipe: R('skin2', 'hairGrey', 'short', 'greenDark', 'white', 'black', 'white', { accessory: 'mustache', prop: 'clipboard' }), bs: ['Trener s klupe', 'Presing! Svi u napad!'], en: ['Touchline Coach', 'Press! Everyone attack!'] },
  vozacica: { hp: 1300, dmg: 23, xp: 70, proj: 'bolt', summon: 'kondukter', color: '#f2d64b', phases: [['charge', 'laser', 'shockwave'], ['charge', 'zigzag', 'laser', 'rain', 'summon']], recipe: R('skin2', 'hairBrown', 'ponytail', 'blueDark', 'yellow', 'navy', 'black', { accessoryColor: 'navy', accessory: 'vest', prop: 'lever' }), bs: ['Vozačica tramvaja', 'Sljedeća stanica: poraz!'], en: ['Tram Driver', 'Next stop: defeat!'] },
  velemajstor: { hp: 1400, dmg: 24, xp: 75, proj: 'pawn', summon: 'sahista', color: '#f4f4f4', phases: [['teleport', 'spiral', 'laser'], ['teleport', 'barrage', 'laser', 'summon', 'shield']], recipe: R('skin1', 'hairGrey', 'curly', 'black', 'white', 'black', 'black', { accessory: 'glasses', prop: 'king' }), bs: ['Šahovski velemajstor', 'Šah-mat za tri poteza.'], en: ['Chess Grandmaster', 'Checkmate in three moves.'] },
  upravnik: { hp: 1500, dmg: 25, xp: 80, proj: 'flowerpot', summon: 'perac', color: '#b48ae0', phases: [['rain', 'trap', 'pull'], ['rain', 'teleport', 'shield', 'meteor', 'trap']], recipe: R('skin2', 'hairBlack', 'short', 'brown', 'tan', 'greyDark', 'black', { accessory: 'mustache', prop: 'keys' }), bs: ['Upravnik zgrade', 'Kućni red se poštuje!'], en: ['Building Manager', 'House rules must be obeyed!'] },
  pcelarka: { hp: 1650, dmg: 26, xp: 85, proj: 'honey', summon: 'pcelar', color: '#f2d64b', phases: [['spiral', 'meteor', 'summon'], ['spiral', 'pull', 'meteor', 'barrage', 'shield']], recipe: R('skin1', 'hairBlond', 'hat', 'yellow', 'white', 'white', 'black', { accessoryColor: 'white', prop: 'hive' }), bs: ['Glavna pčelarka', 'Moje pčele te već traže!'], en: ['Head Beekeeper', 'My bees are already looking for you!'] },
  majstor_zidar: { hp: 1800, dmg: 27, xp: 90, proj: 'brick', summon: 'zidar', color: '#c8503a', phases: [['trap', 'rain', 'leap'], ['shockwave', 'rain', 'trap', 'zigzag', 'summon', 'meteor']], recipe: R('skin3', 'hairGrey', 'cap', 'orange', 'brownDark', 'denim', 'black', { accessoryColor: 'yellow', accessory: 'vest', prop: 'trowel' }), bs: ['Majstor Zidar', 'Ja ću tebe uzidati!'], en: ['Master Builder', "I'll wall you in!"] },
  desetobojka: { hp: 1950, dmg: 28, xp: 95, proj: 'javelin', summon: 'sprinter', color: '#e8483a', phases: [['barrage', 'zigzag', 'leap'], ['meteor', 'zigzag', 'barrage', 'roll', 'shockwave', 'teleport']], recipe: R('skin3', 'hairBlack', 'ponytail', 'red', 'white', 'red', 'white', { accessory: 'stripes', accessoryColor: 'white', prop: 'javelin' }), bs: ['Desetobojka', 'Deset disciplina, jedan pobjednik!'], en: ['Decathlete', 'Ten events, one winner!'] },
  mc_bloka: { hp: 2100, dmg: 29, xp: 100, proj: 'vinyl', summon: 'plesacica', color: '#8a4ab8', phases: [['spiral', 'shockwave', 'pull'], ['spiral', 'laser', 'shield', 'summon', 'zigzag', 'barrage']], recipe: R('skin4', 'hairBlack', 'cap', 'purple', 'yellow', 'black', 'white', { accessoryColor: 'yellow', accessory: 'scarf', prop: 'mic' }), bs: ['MC Bloka', 'Pojačaj bas, blok se trese!'], en: ['Block MC', 'Turn up the bass, the block is shaking!'] },
  kapetanica: { hp: 2400, dmg: 30, xp: 120, proj: 'suitcase', summon: 'stjuardesa', color: '#3a6ad8', phases: [['zigzag', 'meteor', 'laser'], ['rain', 'laser', 'zigzag', 'shield', 'barrage'], ['spiral', 'meteor', 'teleport', 'laser', 'summon', 'charge']], recipe: R('skin2', 'hairBrown', 'bun', 'navy', 'yellow', 'navy', 'black', { accessoryColor: 'navy', prop: 'wings' }), bs: ['Kapetanica leta', 'Vežite se, slijeće turbulencija!'], en: ['Flight Captain', 'Fasten your seatbelt, turbulence ahead!'] },
};

// ---------- themes ----------
const T = {
  kovaci: { sky: ['#5fb4f0', '#ffd9a0'], far: '#4d8a5a', farDetail: '#6fae6a', mid: '#f0e2c4', midDetail: '#8a5a3a', roof: '#c8503a', groundTop: '#b8b0a0', ground: '#7d7466', groundDark: '#5a5246', platform: '#9a6a3a', platformDark: '#6a4422', hazardStyle: 'coals', backdrop: 'oldtown', groundStyle: 'cobble', platformStyle: 'wood' },
  bistrik: { sky: ['#f08a5a', '#ffd27a'], far: '#5a7a4a', farDetail: '#7a9a5a', mid: '#e8d8c0', midDetail: '#6a4a3a', roof: '#a8402a', groundTop: '#c8c0b0', ground: '#8a8478', groundDark: '#5e584e', platform: '#7a5a3a', platformDark: '#4a3422', hazardStyle: 'thorns', backdrop: 'hillside', groundStyle: 'stone', platformStyle: 'wood', accent: '#e85a8a' },
  skenderija: { sky: ['#a8c8e8', '#e8f0f8'], far: '#7a8a9a', farDetail: '#f4f4f4', mid: '#c8ccd4', midDetail: '#5a6270', roof: '#8a92a0', groundTop: '#e8f0f8', ground: '#a0a8b4', groundDark: '#6a7280', platform: '#8a94a4', platformDark: '#4a5260', hazardStyle: 'ice', backdrop: 'plaza', groundStyle: 'concrete', platformStyle: 'metal', snow: true, accent: '#4aa3df', hazardDamage: 14 },
  marijin_dvor: { sky: ['#3a3a7a', '#e88a6a'], far: '#4a5a6a', farDetail: '#6a7a8a', mid: '#5a7a9a', midDetail: '#2a3a4a', roof: '#3a4a5a', groundTop: '#8a8a92', ground: '#4a4a52', groundDark: '#2e2e36', platform: '#7a8290', platformDark: '#3a4250', hazardStyle: 'sparks', backdrop: 'modern', groundStyle: 'asphalt', platformStyle: 'metal', accent: '#7ad0f0' },
  grbavica: { sky: ['#8a9aaa', '#c8d0d8'], far: '#5a6a5a', farDetail: '#7a8a7a', mid: '#d8d0c0', midDetail: '#7a7268', roof: '#8a8278', groundTop: '#9a9a9a', ground: '#5a5a5e', groundDark: '#3a3a3e', platform: '#a0a0a4', platformDark: '#5a5a60', hazardStyle: 'tar', backdrop: 'blocks', groundStyle: 'asphalt', platformStyle: 'concrete', accent: '#4a8ad8' },
  malta: { sky: ['#0e1430', '#3a3a6a'], far: '#1e2a3a', farDetail: '#2e3a4a', mid: '#5a5050', midDetail: '#2a2424', roof: '#3a3030', groundTop: '#6a6a70', ground: '#3a3a40', groundDark: '#222228', platform: '#6a7280', platformDark: '#3a4250', hazardStyle: 'sparks', backdrop: 'industrial', groundStyle: 'asphalt', platformStyle: 'metal', night: true, accent: '#f2d64b' },
  cengic_vila: { sky: ['#6ab8e8', '#e8f4c8'], far: '#4a8a4a', farDetail: '#6aaa5a', mid: '#e8c8a0', midDetail: '#8a6a4a', roof: '#9a6a4a', groundTop: '#c0b8a8', ground: '#8a8274', groundDark: '#5e584e', platform: '#d83a3a', platformDark: '#8a2028', hazardStyle: 'water', backdrop: 'blocks', groundStyle: 'concrete', platformStyle: 'awning', accent: '#f2d64b' },
  hrasno: { sky: ['#4a3a6a', '#f0a070'], far: '#3a4a4a', farDetail: '#5a6a6a', mid: '#c0b8b0', midDetail: '#5a5250', roof: '#6a6260', groundTop: '#9a9a98', ground: '#5e5c5a', groundDark: '#3a3836', platform: '#8a8a90', platformDark: '#4a4a52', hazardStyle: 'paint', backdrop: 'towers', groundStyle: 'concrete', platformStyle: 'metal', accent: '#b48ae0', hazardDamage: 18 },
  pofalici: { sky: ['#4aa8f0', '#c8f0ff'], far: '#3a7a3a', farDetail: '#5a9a4a', mid: '#e8e0c8', midDetail: '#6a5a3a', roof: '#b84a2a', groundTop: '#6ab04a', ground: '#7a5a3a', groundDark: '#5a3e26', platform: '#8a6a3a', platformDark: '#5a4022', hazardStyle: 'thorns', backdrop: 'hillside', groundStyle: 'grass', platformStyle: 'wood', accent: '#f2d64b', hazardDamage: 20 },
  ciglane: { sky: ['#e8a85a', '#f8e0b0'], far: '#6a7a4a', farDetail: '#8a9a5a', mid: '#b8604a', midDetail: '#6a3020', roof: '#8a3a2a', groundTop: '#c87050', ground: '#a04a3a', groundDark: '#6a2a20', platform: '#b05a40', platformDark: '#6a3020', hazardStyle: 'cement', backdrop: 'terraces', groundStyle: 'brick', platformStyle: 'brick', accent: '#f2d64b', hazardDamage: 20 },
  kosevo: { sky: ['#0a1028', '#2a3a6a'], far: '#1a2a2a', farDetail: '#2a3a3a', mid: '#8a8a92', midDetail: '#4a4a52', roof: '#5a5a62', groundTop: '#d84a3a', ground: '#a83a2e', groundDark: '#6a2420', platform: '#9a9aa2', platformDark: '#5a5a62', hazardStyle: 'water', backdrop: 'stadium', groundStyle: 'track', platformStyle: 'concrete', night: true, accent: '#ffffff', hazardDamage: 22 },
  alipasino_polje: { sky: ['#1a0e2a', '#5a2a5a'], far: '#2a2030', farDetail: '#3a3040', mid: '#a8a0a8', midDetail: '#4a4450', roof: '#5a5460', groundTop: '#e0a050', ground: '#4a4448', groundDark: '#2e2a2e', platform: '#7a7a88', platformDark: '#44444e', hazardStyle: 'paint', backdrop: 'blocks', groundStyle: 'asphalt', platformStyle: 'metal', night: true, accent: '#ff5ac8', hazardDamage: 24 },
  dobrinja: { sky: ['#3a8ae8', '#e8f4ff'], far: '#5a7a6a', farDetail: '#7a9a8a', mid: '#d8dce4', midDetail: '#5a6270', roof: '#9aa2b0', groundTop: '#e8e8e0', ground: '#5a5c60', groundDark: '#3a3c40', platform: '#b0b8c4', platformDark: '#6a7280', hazardStyle: 'jet', backdrop: 'airport', groundStyle: 'tarmac', platformStyle: 'metal', accent: '#f2d64b', hazardDamage: 26 },
};

// ---------- stages ----------
const S = [
  ['kovaci', 'Kovači', 560, 118, ['prodavac', 'golubar', 'dostavljac', 'nosac'], 'kazandzija', { seed: 1000, tempo: 132, scale: 'hijaz', root: 57, lead: 'square', drums: 'march', style: 'sevdah' }],
  ['bistrik', 'Bistrik', 548, 196, ['harmonikas', 'vrtlarica', 'dzoger', 'komsija'], 'cesmarka', { seed: 2017, tempo: 116, scale: 'minor', root: 55, lead: 'triangle', drums: 'shuffle', style: 'waltz' }],
  ['skenderija', 'Skenderija', 458, 186, ['skejter', 'klizacica', 'kokice', 'grudvas'], 'trener_klizanja', { seed: 3031, tempo: 148, scale: 'major', root: 60, lead: 'pulse', drums: 'dance', style: 'arcade' }],
  ['marijin_dvor', 'Marijin Dvor', 404, 160, ['sluzbenik', 'romobil', 'zastitar', 'stazistica'], 'direktorica', { seed: 4049, tempo: 124, scale: 'dorian', root: 53, lead: 'saw', drums: 'halftime', style: 'funk' }],
  ['grbavica', 'Grbavica', 372, 214, ['navijac', 'bubnjar', 'sudija', 'golman'], 'trener', { seed: 5057, tempo: 140, scale: 'major', root: 55, lead: 'square', drums: 'march', style: 'anthem' }],
  ['malta', 'Malta', 318, 182, ['kondukter', 'mehanicar', 'biciklista', 'elektricar'], 'vozacica', { seed: 6067, tempo: 152, scale: 'minor', root: 50, lead: 'saw', drums: 'gallop', style: 'drive' }],
  ['cengic_vila', 'Čengić Vila', 276, 150, ['baka', 'balonas', 'sahista', 'cvjecarka'], 'velemajstor', { seed: 7079, tempo: 128, scale: 'major', root: 62, lead: 'pulse', drums: 'shuffle', style: 'polka' }],
  ['hrasno', 'Hrasno', 256, 218, ['perac', 'moler', 'antenas', 'domar'], 'upravnik', { seed: 8087, tempo: 136, scale: 'dorian', root: 52, lead: 'square', drums: 'breakbeat', style: 'funk' }],
  ['pofalici', 'Pofalići', 340, 112, ['planinar', 'pcelar', 'berac', 'trkacica'], 'pcelarka', { seed: 9091, tempo: 120, scale: 'hijaz', root: 57, lead: 'triangle', drums: 'waltz', style: 'waltz' }],
  ['ciglane', 'Ciglane', 420, 98, ['zidar', 'daskas', 'geometar', 'skelas'], 'majstor_zidar', { seed: 10103, tempo: 144, scale: 'minor', root: 53, lead: 'square', drums: 'march', style: 'drive' }],
  ['kosevo', 'Koševo', 470, 72, ['sprinter', 'kopljasica', 'kuglas', 'kladivas'], 'desetobojka', { seed: 11113, tempo: 160, scale: 'dorian', root: 55, lead: 'saw', drums: 'dance', style: 'anthem' }],
  ['alipasino_polje', 'Alipašino Polje', 168, 174, ['kosarkas', 'dj', 'grafiter', 'plesacica'], 'mc_bloka', { seed: 12127, tempo: 96, scale: 'minor', root: 50, lead: 'pulse', drums: 'breakbeat', style: 'hiphop' }],
  ['dobrinja', 'Dobrinja', 104, 240, ['prtljag', 'stjuardesa', 'marsal', 'dronas'], 'kapetanica', { seed: 13147, tempo: 168, scale: 'hijaz', root: 52, lead: 'saw', drums: 'gallop', style: 'drive' }],
];

const enemies = {}, sprites = {}, bosses = {};
const langBs = {}, langEn = {};
for (const [id, [behavior, hp, damage, speed, xp, params, projectile, recipe, bs, en]] of Object.entries(E)) {
  enemies[id] = { sprite: `enemy_${id}`, behavior, hp, damage, speed, xp, params, ...(projectile ? { projectile } : {}) };
  sprites[`enemy_${id}`] = recipe;
  langBs[`enemy.${id}`] = bs; langEn[`enemy.${id}`] = en;
}
for (const [id, b] of Object.entries(B)) {
  const n = b.phases.length;
  bosses[id] = {
    sprite: `boss_${id}`, hp: b.hp, damage: b.dmg, xp: b.xp, projectile: b.proj, summon: b.summon, color: b.color,
    phases: b.phases.map((attacks, i) => ({ hpBelow: i === 0 ? 1 : +(1 - i / n).toFixed(2), attacks, pause: +(1.2 - i * 0.35).toFixed(2), speed: 55 + i * 22 })),
  };
  sprites[`boss_${id}`] = b.recipe;
  langBs[`boss.${id}`] = b.bs[0]; langBs[`boss.${id}.intro`] = b.bs[1];
  langEn[`boss.${id}`] = b.en[0]; langEn[`boss.${id}.intro`] = b.en[1];
}

const order = S.map((s) => s[0]);
const stages = {};
S.forEach(([id, name, x, y, ens, boss, music], i) => {
  const growth = 1 + i * 0.12;              // more enemies per wave later
  const [a, b, c, d] = ens;
  const mix = [
    [[a, 5]], [[a, 4], [b, 3]], [[a, 3], [b, 3], [c, 4]], [[a, 3], [b, 3], [c, 3], [d, 3]], [[a, 4], [b, 4], [c, 4], [d, 5]],
  ];
  stages[id] = {
    name, map: { x, y }, theme: id,
    reward: 150 + i * 90 + i * i * 6, replayFactor: 0.35,
    enemies: ens, boss, bossLayout: `${id}_boss`, hazard: T[id].hazardStyle,
    difficulty: +(1.15 + i * 0.33).toFixed(2),
    music,
    waves: mix.map((m, wv) => ({
      layout: `${id}_${wv + 1}`,
      spawns: m.map(([enemy, count]) => ({ enemy, count: Math.round(count * growth) })),
      maxAlive: Math.min(18, Math.round((3 + wv * 2) * (1 + i * 0.07))),
      interval: +Math.max(0.35, 1.4 - wv * 0.16 - i * 0.04).toFixed(2),
    })),
  };
});

w('enemies.json', enemies);
w('bosses.json', bosses);
w('themes.json', T);
w('sprites.json', sprites);
w('stages.json', { order, stages });

for (const [file, add] of [['lang/bs.json', langBs], ['lang/en.json', langEn]]) {
  const cur = JSON.parse(readFileSync(new URL(file, D), 'utf8'));
  w(file, { ...cur, ...add });
}
console.log(`stages ${order.length}, enemies ${Object.keys(enemies).length}, bosses ${Object.keys(bosses).length}`);
