/**
 * The 20 rare wrecks of Drift, each inspired by a real, much-visited shipwreck. Game placement is invented: a rare wreck sits at a
 * random spot of the seabed that suits its depth, looks like its real ship (hull type, size, colour, cargo, list) and rings a faint
 * brass bell. The pages are written for the Encyclopedia's Wrecks tab (src/encyclopedia/wrecks.js).
 *
 * entry: { id, name, sci (sub-title), hint (locked page), depth: [m, m] real, length, beam (m, real), seed, model (see wrecks/models.js), facts, sheet }
 * `wiki` is the English Wikipedia page title (checked against the REST summary API: every title has a lead image).
 * Figures are rounded from the Wikipedia articles; where unsure the text hedges.
 */
const W = (u) => 'https://en.wikipedia.org/wiki/' + u;

export const RARE_WRECKS = [
  {
    id: 'thistlegorm', name: 'SS Thistlegorm', sci: 'British cargo steamship, built 1940', depth: [16, 32], length: 126, beam: 17.7,
    hint: 'A steamship with lorries and locomotives in her holds lies broken-backed in a warm, bright sea.',
    facts: [['Length', '126 m'], ['Lost', '1941'], ['Where', 'Red Sea, Egypt']],
    model: { hull: 'freighter', tone: 'rust', cargo: 'trains', cargoN: 11, breakAt: { s: 0.32, gap: 3, pitch: 0.12 }, heel: 0.16 },
    sheet: {
      text: [
        'SS Thistlegorm was a British cargo steamship launched in 1940. In 1941 she was loaded with war supplies for the Allied forces in Egypt and, in the early hours of 6 October, was bombed while she lay at anchor in the Red Sea. The bombs fell into a rear hold, the blast tore the stern open, and she sank.',
        'She lies upright in about 30 m of water, shallow enough for ordinary scuba divers. Her holds are crammed with trucks, motorcycles, tracked carriers and ammunition, and two steam locomotives that were lashed to her deck were thrown clear by the explosion and lie beside the hull. Jacques Cousteau found her in the early 1950s; she was then forgotten for decades until sport divers found her again.',
        'In Drift she is only inspired by that ship: a long steel freighter whose back is broken behind the bridge, with locomotives and rows of trucks showing through her open holds. A small brass bell on a post near the bridge glows faintly, so you can tell her from an ordinary wreck.',
      ],
      fun: 'Thousands of rubber Wellington boots, part of the cargo, are still stacked in one of the holds and can be seen by divers.',
      wiki: 'SS Thistlegorm', links: [['Cargo ships', W('Cargo_ship')], ['Red Sea', W('Red_Sea')]],
    },
  },
  {
    id: 'yongala', name: 'SS Yongala', sci: 'Australian passenger steamship, built 1903', depth: [16, 30], length: 109, beam: 13.8,
    hint: 'A slender steamer with one funnel stands in the sand, wrapped in soft corals and watched by giant fish.',
    facts: [['Length', '109 m'], ['Lost', '1911'], ['Where', 'Coral Sea, Queensland']],
    model: { hull: 'liner', tone: 'black', funnels: 1, funnelBand: [0.55, 0.15, 0.1], heel: 0.1, coral: 1.5 },
    sheet: {
      text: [
        'SS Yongala was a passenger and cargo steamship built in England in 1903 for coastal service along the Australian coast. In March 1911 she ran into a violent cyclone off Queensland and disappeared with everyone aboard, 122 people. For years nobody knew where she had gone.',
        'A navy minesweeper snagged the wreck in 1943, and it was identified as Yongala some years later. She lies almost upright and amazingly complete, about 109 m long, with her upper parts roughly 16 m below the surface and the seabed about 30 m down. A protected zone reaches hundreds of metres around her, and the hull has become a crowded reef: soft corals, schools of fish, turtles and big groupers are regularly reported there.',
        'In Drift she appears as a slim steamer with one funnel and two decks of cabins, tilted gently into the sand and thick with coral. A faint glowing brass bell stands near her bridge.',
      ],
      fun: 'The wreck is protected as a historic site: nothing may be taken from it, and its protected zone extends for roughly 800 m in every direction.',
      wiki: 'SS Yongala', links: [['Great Barrier Reef', W('Great_Barrier_Reef')], ['Cyclones', W('Tropical_cyclone')]],
    },
  },
  {
    id: 'rhone', name: 'RMS Rhone', sci: 'Royal Mail steamship, built 1865', depth: [5, 26], length: 94, beam: 12,
    hint: 'A Victorian iron steamer with three masts lies in two pieces among bright reef fish.',
    facts: [['Length', '94 m'], ['Lost', '1867'], ['Where', 'British Virgin Islands']],
    model: { hull: 'liner', tone: 'rust', funnels: 1, breakAt: { s: 0.56, gap: 4, pitch: 0.2 }, heel: 0.2, coral: 1.3 },
    sheet: {
      text: [
        'RMS Rhone was an iron-hulled mail steamer of the Royal Mail Steam Packet Company, launched in 1865. She also carried sails, a common safety measure of the time. In October 1867 a hurricane caught her near the British Virgin Islands; she struck rocks off Salt Island, broke in two and sank quickly, with heavy loss of life.',
        'Today the wreck lies in two parts: the bow in about 24 m and the stern in far shallower water. It is one of the best-known wreck dives in the Caribbean, and it was used as a location for the 1977 film The Deep. Its shallow depth and the clear water mean sunlight reaches almost all of it.',
        'In Drift she is a Victorian steamer with a single funnel and two masts, split in two near the middle and tinted with coral, standing for the many mail packets that vanished in the hurricane season. A faint brass bell glows near her stern.',
      ],
      fun: 'The wreck sits within a national park, and part of the 1977 film The Deep was shot among its timbers.',
      wiki: 'RMS Rhone', links: [['Royal Mail Steam Packet Company', W('Royal_Mail_Steam_Packet_Company')], ['The Deep (1977 film)', W('The_Deep_(1977_film)')]],
    },
  },
  {
    id: 'coolidge', name: 'SS President Coolidge', sci: 'American ocean liner, built 1931', depth: [21, 73], length: 198, beam: 25,
    hint: 'A vast grey troopship lies on a long slope, its decks full of jeeps, guns and chandeliers.',
    facts: [['Length', 'about 200 m'], ['Lost', '1942'], ['Where', 'Espiritu Santo, Vanuatu']],
    model: { hull: 'liner', tone: 'grey', funnels: 2, cargo: 'trucks', heel: 0.4, coral: 1.2 },
    sheet: {
      text: [
        'SS President Coolidge was an American ocean liner finished in 1931, a floating luxury hotel with lounges, two swimming pools and chandeliers. In the Second World War she was painted grey and became a troopship. In October 1942 she steered into the harbour at Espiritu Santo in Vanuatu, which was ringed by defensive mines, and, without having been told where they lay, struck two allied mines. Thousands of soldiers got ashore, and only two lives were lost.',
        'She now lies on her side down a steep slope, her bow about 21 m below the surface and her stern near 73 m. Jeeps, trucks, helmets, guns and personal gear are still in her holds, along with a porcelain relief nicknamed The Lady and a mosaic-tiled fountain. She is one of the largest wrecks in the world that sport divers can explore.',
        'In Drift she is a long grey liner with two funnels, tilted down the slope with jeeps and trucks visible through her ragged decks and a faint brass bell glowing by her bridge.',
      ],
      fun: 'A porcelain relief of a lady riding a unicorn, called The Lady, is one of the wreck\'s best-known sights.',
      wiki: 'SS President Coolidge', links: [['Espiritu Santo', W('Espiritu_Santo')], ['Ocean liners', W('Ocean_liner')]],
    },
  },
  {
    id: 'zenobia', name: 'MS Zenobia', sci: 'Swedish-built roll-on roll-off ferry, 1979', depth: [16, 42], length: 172, beam: 28,
    hint: 'A huge ferry lies on its side, its car deck full of lorries, within sight of a harbour.',
    facts: [['Length', '172 m'], ['Lost', '1980'], ['Where', 'Larnaca, Cyprus']],
    model: { hull: 'ferry', tone: 'white', funnelBand: [0.15, 0.3, 0.6], cargo: 'trucks', cargoN: 14, heel: 1.0, sink: 1.1, coral: 0.7 },
    sheet: {
      text: [
        'MS Zenobia was a roll-on roll-off ferry built in Sweden and launched in 1979. On her first voyage a fault in the software that ran her ballast pumps filled her side tanks with seawater, and she began to lean. After days of trying to put her right she capsized and sank off Larnaca, Cyprus, in June 1980. Nobody was hurt, though a huge cargo of lorries went down with her.',
        'She rests on her side in roughly 42 m of water, about 1.5 km off shore. Dozens of lorries are still inside her vehicle decks, and divers swim through enormous empty rooms and a ship\'s bridge turned on its side. The Times and others have ranked her among the world\'s ten best wreck dives.',
        'In Drift she is a big slab-sided ferry heeled far over, a white hull with a blue-banded funnel and lorries scattered inside. A faint brass bell glows near her bridge.',
      ],
      fun: 'She sank because of a computer error: the automatic pumps kept filling one side with water, making the lean progressively worse.',
      wiki: 'MS Zenobia', links: [['Roll-on/roll-off', W('Roll-on/roll-off')], ['Larnaca', W('Larnaca')]],
    },
  },
  {
    id: 'spiegelgrove', name: 'USS Spiegel Grove', sci: 'US Navy dock landing ship, built 1956', depth: [18, 41], length: 155, beam: 26,
    hint: 'A grey navy ship, sunk on purpose, lies on a sand shoal as a reef for fish and divers.',
    facts: [['Length', 'about 155 m'], ['Sunk', '2002, as a reef'], ['Where', 'Florida Keys, USA']],
    model: { hull: 'warship', tone: 'grey', turrets: [], tower: 0.52, towerLen: 0.1, funnels: 1, aftCrane: true, cargo: 'crates', heel: 0.22, coral: 1.5 },
    sheet: {
      text: [
        'USS Spiegel Grove was a US Navy dock landing ship, a ship with a flooding well deck that could carry landing craft, in service for decades from 1956. In 2002 she was sunk on purpose off the Florida Keys to become an artificial reef and a tourist attraction for divers, but she sank hours too early and settled upside down. She was rolled onto her side with air pumped into her tanks, and a hurricane in 2005 later shifted her upright.',
        'She now rests on a sandy shoal. Her top deck is around 18 m below the surface and her hull reaches about 41 m, and she is about 155 m long. Her interior is a maze, but the outside is a tall reef of corals, sponges and fish; sport divers say you could dive her a hundred times and never see all of her.',
        'In Drift she is an angular grey navy hull with a tall tower, a crane at the stern and an open well, hung with young corals. A faint brass bell glows by her tower.',
      ],
      fun: 'The ship was named after the Ohio home of President Rutherford B. Hayes; Spiegel Grove is the name of the estate.',
      wiki: 'USS Spiegel Grove', links: [['Artificial reefs', W('Artificial_reef')], ['Florida Keys', W('Florida_Keys')]],
    },
  },
  {
    id: 'scylla', name: 'HMS Scylla', sci: 'Royal Navy frigate, built 1968', depth: [14, 24], length: 113, beam: 13,
    hint: 'A grey frigate stands on sand in cool green water, planted there to become a reef.',
    facts: [['Length', '113 m'], ['Sunk', '2004, as a reef'], ['Where', 'Whitsand Bay, Cornwall, UK']],
    model: { hull: 'warship', tone: 'grey', turrets: [[0.85, 2, 0.8]], tower: 0.5, towerLen: 0.11, funnels: 1, heel: 0.18, coral: 1.2 },
    sheet: {
      text: [
        'HMS Scylla was the last Leander-class frigate built for the Royal Navy. After she was taken out of service in the 1990s she was bought by an aquarium and, on 27 March 2004, deliberately sunk in Whitsand Bay off Cornwall to form the first artificial reef of its kind in Europe.',
        'She sits upright on a sandy seabed in about 24 m, about 113 m long. Within months the hull was covered in anemones, mussels and scallops, and sea urchins and starfish followed. Researchers have followed how a young reef grows on her, and divers visit to see the change.',
        'In Drift she is a slim grey frigate with a gun mount at the bow, a funnel and a tall mast, already dressed in coral. A faint brass bell glows beside her bridge.',
      ],
      fun: 'Within three months of sinking, anemones and mussels had settled on her; the ship was a nursery for a new reef from the start.',
      wiki: 'HMS Scylla (F71)', links: [['Royal Navy', W('Royal_Navy')], ['Artificial reefs', W('Artificial_reef')]],
    },
  },
  {
    id: 'rainbowwarrior', name: 'Rainbow Warrior', sci: 'Greenpeace flagship, built 1955', depth: [16, 26], length: 40, beam: 8.5,
    hint: 'A small green ship with a rainbow painted on her bow rests on a quiet reef bay.',
    facts: [['Length', 'about 40 m'], ['Sunk', '1985, scuttled 1987'], ['Where', 'Matauri Bay, New Zealand']],
    model: { hull: 'trawler', tone: 'green', rainbow: true, funnelBase: [0.1, 0.2, 0.2], heel: 0.15, coral: 1.5 },
    sheet: {
      text: [
        'Rainbow Warrior began life in the 1950s as a North Sea research trawler. Greenpeace bought her in the late 1970s and used her in campaigns against whaling, seal hunting and nuclear testing. In July 1985, while in Auckland harbour, she was sabotaged and sunk by two bombs planted by French intelligence agents; a photographer aboard lost his life. The affair led to a long diplomatic dispute.',
        'The ship was too damaged to repair. In December 1987 she was scuttled in Matauri Bay, in the Cavalli Islands of northern New Zealand, to become a dive site and an artificial reef. She lies upright in about 26 m of water, now draped in sponges and jewel anemones, and a memorial stands on the hill above the bay.',
        'In Drift she is a short, sturdy green trawler with two masts, a stern gantry and a painted rainbow arc on the bow. A faint brass bell glows beside her wheelhouse.',
      ],
      fun: 'The ship was named after a book called Warriors of the Rainbow, which one of the Greenpeace founders had been given.',
      wiki: 'Rainbow Warrior (1955)', links: [['Greenpeace', W('Greenpeace')], ['Cavalli Islands', W('Cavalli_Islands')]],
    },
  },
  {
    id: 'hilmahooker', name: 'Hilma Hooker', sci: 'Dutch-built cargo ship, launched 1951', depth: [18, 30], length: 73, beam: 11,
    hint: 'A small freighter lies on its side on a sandy slope, with a smuggler\'s past.',
    facts: [['Length', '73 m'], ['Sunk', '1984'], ['Where', 'Bonaire, Caribbean']],
    model: { hull: 'freighter', tone: 'rust', cargo: 'crates', cargoN: 6, heel: 0.7, coral: 1.2 },
    sheet: {
      text: [
        'Hilma Hooker was a cargo ship launched in the Netherlands in 1951 as Midsland. She changed her name and owner several times and in 1984 limped, with engine trouble, into the port of Kralendijk on Bonaire. Customs officials who inspected her found a false bulkhead holding a huge load of marijuana. She was kept tied to the pier for months, and one day in September 1984 she sank at anchor.',
        'She lies on her side in about 30 m of water on a sandy slope off the island, about 73 m long. Sponges and corals have covered her plates and her hold doors are open, so divers can look straight through her. The area is a marine park, and the ship is a favourite for photographers.',
        'In Drift she is a small rust-coloured freighter lying on her flank, with crates in her holds and a faint brass bell on her deckhouse.',
      ],
      fun: 'She had five different names in her life, and the last one, Hilma Hooker, is the one that stuck to the wreck.',
      wiki: 'Hilma Hooker', links: [['Bonaire', W('Bonaire')], ['Cargo ships', W('Cargo_ship')]],
    },
  },
  {
    id: 'bianca', name: 'Bianca C.', sci: 'Italian passenger liner, launched 1944', depth: [30, 50], length: 180, beam: 23,
    hint: 'A huge white liner, once called the Titanic of a tropical sea, sits upright off a sandy beach.',
    facts: [['Length', 'about 180 m'], ['Lost', '1961'], ['Where', 'Grenada, Caribbean']],
    model: { hull: 'liner', tone: 'white', funnels: 1, funnelBand: [0.1, 0.25, 0.5], breakAt: { s: 0.28, gap: 5, pitch: 0.22 }, heel: 0.1, coral: 1.3 },
    sheet: {
      text: [
        'MV Bianca C. had a troubled start: she was launched in France in 1944 under another name, sank at her yard before she was finished, was raised and rebuilt as a cruise ship, and finally entered service in 1949. In October 1961, off Grenada, an explosion and fire broke out in her engine room. One crew member died, and she was towed away from the busy anchorage, where she sank.',
        'The wreck lies upright in about 50 m of water, about two kilometres off Grand Anse beach, with her upper deck near 30 m. She was long the biggest shipwreck in the eastern Caribbean. In the early 1990s her stern third came loose and the hull began to break up, but she is still a vast reef covered with sponges, hard corals and schools of fish.',
        'In Drift she is a long white liner with one funnel, the stern third torn away and the rest overgrown with coral. A faint brass bell glows on her upper deck.',
      ],
      fun: 'She sank twice: once in 1944, before she was ever finished, and again 17 years later.',
      wiki: 'MV Bianca C.', links: [['Grenada', W('Grenada')], ['Ocean liners', W('Ocean_liner')]],
    },
  },
  {
    id: 'fujikawa', name: 'Fujikawa Maru', sci: 'Japanese refrigerated cargo ship, built 1938', depth: [12, 36], length: 133, beam: 17.7,
    hint: 'A big freighter in a quiet lagoon carries fighter planes in pieces in her forward holds.',
    facts: [['Length', 'about 133 m'], ['Lost', '1944'], ['Where', 'Chuuk Lagoon, Micronesia']],
    model: { hull: 'freighter', tone: 'olive', cargo: 'planes', cargoN: 9, heel: 0.2, coral: 1.5 },
    sheet: {
      text: [
        'Fujikawa Maru was a Japanese refrigerated cargo ship built in 1938. In the Second World War she was taken over as an aircraft transport and, on 17 and 18 February 1944, was sunk with many other ships in Chuuk Lagoon (Truk) during a large air raid known as Operation Hailstone. The lagoon is now a protected underwater museum, and, as with all such sites, visitors treat the wrecks with respect.',
        'She lies upright in roughly 30 to 35 m of water, with her masts and upper parts reaching much nearer the surface. In a forward hold divers find nine fighter aircraft packed in pieces, including the only known survivor of a type of Mitsubishi fighter. The lagoon\'s warm water has covered her with corals, sponges and fish.',
        'In Drift she is a large green-grey freighter with aircraft wings and fuselages visible in her open holds and thick soft coral on her derricks. A faint brass bell glows beside her bridge.',
      ],
      fun: 'One of the aircraft in her hold is a Mitsubishi A5M "Claude", described as the only known survivor of its type.',
      wiki: 'Fujikawa Maru', links: [['Chuuk Lagoon', W('Chuuk_Lagoon')], ['Operation Hailstone', W('Operation_Hailstone')]],
    },
  },
  {
    id: 'markgraf', name: 'SMS Markgraf', sci: 'German dreadnought battleship, launched 1913', depth: [36, 46], length: 175, beam: 29.5,
    hint: 'A capsized battleship with five big gun turrets lies in cold northern water.',
    facts: [['Length', 'about 175 m'], ['Scuttled', '1919'], ['Where', 'Scapa Flow, Scotland, UK']],
    model: { hull: 'warship', tone: 'grey', turrets: [[0.88, 2, 1.3], [0.76, 2, 1.3], [0.38, 2, 1.2], [0.25, 2, 1.3], [0.13, 2, 1.3]], tower: 0.58, towerLen: 0.09, funnels: 2, heel: 1.05, sink: 0.9, coral: 0.9 },
    sheet: {
      text: [
        'SMS Markgraf was a König-class battleship of the Imperial German Navy, launched in 1913, with ten 30.5 cm guns in five twin turrets. After the First World War the German fleet was interned in Scapa Flow, the sheltered anchorage in Orkney. On 21 June 1919 its commander ordered the ships scuttled so that the Allies could not take them; most of the fleet went down that day, and nine German sailors died in the confusion.',
        'Most of the sunken ships were raised and scrapped in the following decades, but Markgraf never was. She still rests on the bottom of the bay, reportedly upside down, in around 45 m of water, together with a couple of other battleships and some cruisers. Divers consider Scapa Flow one of the best wreck diving areas in Europe, though the cold and the depth make it demanding.',
        'In Drift she is a huge grey battleship heeled far over with five gun turrets, two funnels and a tower, leaning into the mud. A faint brass bell glows on her tower base.',
      ],
      fun: 'More than fifty warships went down in one morning in 1919, one of the largest deliberate mass sinkings in history.',
      wiki: 'SMS Markgraf', links: [['Scapa Flow', W('Scapa_Flow')], ['Dreadnoughts', W('Dreadnought')]],
    },
  },
  {
    id: 'lermontov', name: 'MS Mikhail Lermontov', sci: 'Soviet ocean liner, built 1972', depth: [12, 38], length: 176, beam: 23.6,
    hint: 'A white liner named for a poet lies on her side in a green sound with steep, wooded shores.',
    facts: [['Length', 'about 176 m'], ['Lost', '1986'], ['Where', 'Marlborough Sounds, New Zealand']],
    model: { hull: 'liner', tone: 'white', funnels: 1, funnelBand: [0.7, 0.15, 0.1], heel: 0.95, sink: 0.8, coral: 1.0 },
    sheet: {
      text: [
        'MS Mikhail Lermontov was a Soviet ocean liner built in East Germany in 1972, later used as a cruise ship; she was named after the Russian poet Mikhail Lermontov. In February 1986, travelling through the Marlborough Sounds, New Zealand, she struck rocks off Port Gore. The passengers and almost all of the crew were taken off safely, and a single crew member lost his life.',
        'She sank in shallow water near the shore and lies on her starboard side, with her upper side only about 12 m down and the seabed reaching about 38 m. At around 176 m, she is one of the largest intact passenger ships to be dived anywhere. The Sounds are home to cool-water fish, sponges and the occasional dolphin.',
        'In Drift she is a long white cruise liner leaning heavily, with a red-banded funnel and lifeboat davits, in the green water of a sheltered inlet. A faint brass bell glows by her bridge.',
      ],
      fun: 'She originally sailed the Leningrad to New York run before she was turned into a cruise ship.',
      wiki: 'MS Mikhail Lermontov', links: [['Marlborough Sounds', W('Marlborough_Sounds')], ['Ocean liners', W('Ocean_liner')]],
    },
  },
  {
    id: 'uluburun', name: 'Uluburun wreck', sci: 'Late Bronze Age trading ship, late 14th century BC', depth: [40, 52], length: 15, beam: 5,
    hint: 'A very old wooden ship lies in the dim blue with a pile of dull metal biscuits and big clay jars.',
    facts: [['Length', 'about 15 m'], ['Age', 'late 14th century BC'], ['Where', 'off Kaş, Turkey']],
    model: { hull: 'ancient', tone: 'wood', cargoN: 38, ingots: true, heel: 0.12, coral: 0.8 },
    sheet: {
      text: [
        'Over three thousand years ago a trading ship about 15 m long sailed along the south coast of what is now Turkey, carrying more than twenty tonnes of cargo, and sank off a cape called Uluburun. A local sponge diver, Mehmet Çakır, found the wreck in 1982 when he described "metal biscuits with ears" lying on the seabed; they turned out to be oxhide ingots of copper.',
        'Archaeologists excavated the site from 1984 to 1994 at a depth of over 40 m, an enormous undertaking. The ship carried copper and tin for making bronze, jars of resin, painted pottery, raw glass, ebony, ivory and many other things, as well as stone anchors and the possessions of the crew. It is the richest Bronze Age wreck known, and it shows how far goods travelled in those days.',
        'In Drift the Uluburun ship is a small, half-buried wooden hull, bare ribs showing, with dull copper ingots in stacks and a spill of clay jars. A faint brass bell, a modern sign of its importance, glows nearby.',
      ],
      fun: 'The ship carried 22 stone anchors, plus two smaller ones, weighing about 3.3 tonnes in all, the largest group of anchors ever found on a wreck.',
      wiki: 'Uluburun shipwreck', links: [['Oxhide ingots', W('Oxhide_ingot')], ['Bronze Age', W('Bronze_Age')]],
    },
  },
  {
    id: 'kronan', name: 'Kronan', sci: 'Swedish royal flagship, built 1672', depth: [20, 28], length: 53, beam: 12.9,
    hint: 'A great wooden warship with blown-open bows lies in cold, dark-green Baltic water.',
    facts: [['Length', 'about 53 m'], ['Lost', '1676'], ['Where', 'Baltic Sea, off Öland, Sweden']],
    model: { hull: 'galleon', tone: 'wood', breakAt: { s: 0.68, gap: 4, pitch: 0.18 }, heel: 0.55, coral: 0.6 },
    sheet: {
      text: [
        'Kronan was the flagship of the Swedish navy, one of the largest ships in the world when she was launched in 1672. On 1 June 1676, at the Battle of Öland, she made a sharp turn under too much sail and capsized; the gunpowder store blew up and tore away much of her bow. She sank with many of her crew.',
        'She lay forgotten until 1980, when the amateur researcher Anders Franzén, who had earlier found the warship Vasa, located her off the island of Öland, in about 26 m of water. Divers have raised cannons, personal belongings, navigational instruments and silver and gold coins. The cold, brackish Baltic water preserves wood well, because shipworms do not thrive there.',
        'In Drift she is a tall wooden ship lying on her side, her bow blown open, with cannon barrels poking from her gun ports and snapped mast stumps. A faint brass bell, the sign of a rare wreck, glows by her stern.',
      ],
      fun: 'Only about 40 men survived the sinking, and among the finds was a small table cabinet of navigational instruments that probably belonged to an officer.',
      wiki: 'Kronan (ship)', links: [['Vasa (ship)', W('Vasa_(ship)')], ['Baltic Sea', W('Baltic_Sea')]],
    },
  },
  {
    id: 'vrouwmaria', name: 'Vrouw Maria', sci: 'Dutch merchant ship, sank 1771', depth: [36, 44], length: 32, beam: 8.5,
    hint: 'A small, two-masted merchantman lies unspoiled in dark cold water with a cargo nobody has opened.',
    facts: [['Length', 'about 30 m'], ['Lost', '1771'], ['Where', 'Archipelago Sea, Finland']],
    model: { hull: 'galleon', tone: 'wood', merchant: true, masts: 2, cargoN: 8, heel: 0.1, coral: 0.4 },
    sheet: {
      text: [
        'Vrouw Maria ("Lady Mary") was a wooden Dutch merchant ship, two-masted and fairly small. In 1771 she was sailing from Amsterdam to Saint Petersburg with a cargo that included sugar, fabrics, dyes and valuable works of art for Catherine the Great, when she struck a reef off the coast of Finland and began to leak. The crew survived but the ship sank, and only some of the cargo was saved.',
        'The wreck was found in 1999 in the outer archipelago off Nagu, about 40 m down. The ship stands in remarkably good condition; the cold, dark, low-salt Baltic water holds back the shipworm that destroys wood elsewhere. Only a few objects have been brought up and the holds have not been disturbed, so what remains of the art cargo, if anything, is not yet known.',
        'In Drift she is a small, dark, almost intact wooden merchantman standing among the ribs of her own hull, with crates and barrels, two mast stumps and a faint brass bell on her afterdeck.',
      ],
      fun: 'Part of the ship\'s cargo was coffee beans, which clogged the pumps as the crew fought to keep her afloat.',
      wiki: 'Vrouw Maria', links: [['Catherine the Great', W('Catherine_the_Great')], ['Baltic Sea', W('Baltic_Sea')]],
    },
  },
  {
    id: 'u352', name: 'U-352', sci: 'German Type VIIC submarine, launched 1941', depth: [22, 36], length: 67, beam: 6.2,
    hint: 'A long, narrow submarine, its hatch open, lies on a sandy plain, heeled over.',
    facts: [['Length', '67 m'], ['Lost', '1942'], ['Where', 'off North Carolina, USA']],
    model: { hull: 'sub', tone: 'grey', heel: 0.78, coral: 1.0 },
    sheet: {
      text: [
        'U-352 was a Type VIIC submarine of the German Kriegsmarine, launched in 1941. On 9 May 1942, off the coast of North Carolina, she was sunk by depth charges from the US Coast Guard cutter Icarus; some of her crew were rescued from the water.',
        'Her wreck was found in 1975 about 42 km off Morehead City, in about 35 m of water. She sits on a sandy bottom at roughly a 45-degree list, still recognisable as a U-boat: the conning tower, the deck gun mount, the long casing. The nearby Gulf Stream brings a crowd of fish, so the wreck is popular with divers.',
        'In Drift she is a long grey submarine heeled over on the sand, with her conning tower, deck gun, periscope stubs and twin propellers, and a faint brass bell on the casing.',
      ],
      fun: 'A Type VIIC boat was about 67 m long but only 6 m wide: the crew of about 45 shared an interior only a little wider than a bus.',
      wiki: 'German submarine U-352', links: [['Type VII submarines', W('Type_VII_submarine')], ['Wreck diving', W('Wreck_diving')]],
    },
  },
  {
    id: 'umbria', name: 'SS Umbria', sci: 'Italian cargo ship, built 1912', depth: [20, 38], length: 152, beam: 17,
    hint: 'A big freighter lies on her side, the holds packed with bombs, in clear Red Sea water.',
    facts: [['Length', 'about 150 m'], ['Scuttled', '1940'], ['Where', 'Red Sea, Sudan']],
    model: { hull: 'freighter', tone: 'rust', cargo: 'bombs', cargoN: 14, heel: 0.8, coral: 1.4 },
    sheet: {
      text: [
        'SS Umbria was a cargo ship built in Hamburg in 1912 as Bahia Blanca, bought by Argentina and later by Italy, which renamed her Umbria. In June 1940 she was secretly carrying thousands of tonnes of bombs and munitions, apparently intended for Italian forces in East Africa, when Italy entered the Second World War. Rather than hand the cargo to the British, her captain had her scuttled off Sudan.',
        'She now lies on her port side in clear water to a depth of about 38 m, with her cargo still on board: rows of bombs and fuses stacked in her holds, along with three small Fiat cars. Her hull has been thickly covered with corals, and she is regularly named among the best wreck dives in the world.',
        'In Drift she is a long rust-brown freighter lying on her side with rows of bombs in her open holds and coral thick on her plating. A faint brass bell glows near her deckhouse.',
      ],
      fun: 'Besides the bombs, her cargo included 2,000 tonnes of cement and three Fiat 1100 cars, some of which divers still see.',
      wiki: 'SS Umbria', links: [['Cargo ships', W('Cargo_ship')], ['Red Sea', W('Red_Sea')]],
    },
  },
  {
    id: 'andreadoria', name: 'SS Andrea Doria', sci: 'Italian ocean liner, built 1951', depth: [49, 75], length: 212, beam: 27,
    hint: 'The grand liner of a famous collision lies far down in cold, dark, strong-current water.',
    facts: [['Length', '212 m'], ['Lost', '1956'], ['Where', 'off Nantucket, USA']],
    model: { hull: 'liner', tone: 'white', funnels: 1, funnelBand: [0.15, 0.4, 0.2], heel: 0.95, sink: 0.9, coral: 0.5 },
    sheet: {
      text: [
        'SS Andrea Doria was one of the most elegant Italian ocean liners, in service from 1953 and famous for her art and decor. On the foggy night of 25 July 1956, near Nantucket, she was struck by the Swedish liner Stockholm. She began to list at once, and after a night-long rescue she sank the next morning. 1,660 of the 1,706 people on board were saved; 46 died as a direct result of the collision.',
        'She lies on her starboard side in about 75 m of water, with the top of the wreck at around 49 m. The cold, murky water, the strong currents and the great depth make her very difficult; she has been called the Mount Everest of wreck diving. Her wreck is slowly collapsing. She is one of the great diving challenges, and only highly trained divers visit her.',
        'In Drift she is a huge white liner leaning on her side far below, with a single green-banded funnel and a faint brass bell glowing in the gloom, a ship for a deep-diving sub.',
      ],
      fun: 'The rescue of nearly all her passengers, helped by new radio and radar, is often cited as a sign that safety at sea was improving.',
      wiki: 'SS Andrea Doria', links: [['Ocean liners', W('Ocean_liner')], ['Nantucket', W('Nantucket')]],
    },
  },
  {
    id: 'dixiearrow', name: 'SS Dixie Arrow', sci: 'American oil tanker, built 1921', depth: [18, 30], length: 143, beam: 19,
    hint: 'A big black tanker\'s engine and bow rise from a flat sand plain, shadowed by shoals of fish.',
    facts: [['Length', 'about 143 m'], ['Lost', '1942'], ['Where', 'off Cape Hatteras, USA']],
    model: { hull: 'tanker', tone: 'black', funnelBand: [0.6, 0.14, 0.1], breakAt: { s: 0.5, gap: 3, pitch: 0.1 }, heel: 0.22, coral: 1.2 },
    sheet: {
      text: [
        'SS Dixie Arrow was an American steam tanker built in 1920 and 1921 in Camden, New Jersey, the last of a dozen Arrow-class tankers owned by Socony. On 26 March 1942, carrying a cargo of crude oil off Cape Hatteras, North Carolina, she was torpedoed by the German submarine U-71. The first torpedo set her deckhouse on fire. She sank that evening; 22 of her 33 crew survived.',
        'The wreck lies on a flat sand plain in about 27 m of water, about 24 km off the coast, and is a landmark of the "Graveyard of the Atlantic". The bow and stern stand up, and the boilers and engine are the largest features. Because of the depth and the abundant sea life it has become a popular dive site for biologists and recreational divers.',
        'In Drift she is a long black tanker split in the middle, with pipes along the deck, a stern deckhouse, a stubby funnel, and a faint brass bell on a post beside the bridge.',
      ],
      fun: 'The real ship\'s bell was recovered by US Navy divers in 1944, only two years after she sank.',
      wiki: 'SS Dixie Arrow', links: [['Oil tankers', W('Oil_tanker')], ['Cape Hatteras', W('Cape_Hatteras')]],
    },
  },
];

export const RARE_BY_ID = Object.fromEntries(RARE_WRECKS.map((w, i) => { w.seed = 11 + i * 7; return [w.id, w]; }));

/** in-game size of a rare wreck: a scaled-down version of the real ship, clamped to what the seabed pads and the colliders can handle */
export function gameDims(w) {
  const L = w.length, ratio = w.beam / L;
  const length = Math.max(24, Math.min(100, 30 + (L - 30) * 0.4));
  const beam = Math.max(w.model.hull === 'sub' ? 5 : 7, Math.min(22, length * ratio * 1.25));
  return { length, beam };
}
