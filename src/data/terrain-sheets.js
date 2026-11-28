/**
 * Terrain encyclopedia pages (the "Terrain" tab): landforms, volcanic features, caves & arches, reefs and open areas.
 * Plain data, in page order. `criterion` documents when a page unlocks; the checks themselves are implemented in
 * src/encyclopedia/terrain-pages.js. `depth` = [min, max] metres as the sea in Drift shows them.
 * `sheet.wiki` = verified English Wikipedia page title (with a lead image).
 */
export const TERRAIN_ENTRIES = [
  // ---------------------------------------------------------------- Landforms
  { id: 'seamount', group: 'Landforms', name: 'Seamount Ridge',
    hint: 'A long, rounded hill rising out of the seabed. Look for its crest.', depth: [20, 70],
    facts: [['Depth', '20–70 m'], ['Found by', 'Barracuda sub'], ['Hazard', 'none']],
    criterion: 'a seamount landmark within 160 m of the camera and filling ≥ 30 % of frame height',
    sheet: {
      text: [
        'A seamount is an underwater mountain that rises from the sea floor without ever reaching the surface. Most are old volcanoes that built themselves up from the deep and then went quiet. Some stand alone, and others line up in long chains that can stretch for hundreds of kilometres.',
        'Seamounts steer the water around them. Currents bend up their flanks and carry cold, nutrient-rich water toward the light, which often feeds plankton. Corals, sponges and sea fans cling to the rock, and fish and sharks are thought to gather there to feed or rest. Because so many seamounts are unexplored, new species are still being found on them.',
        'In Drift a seamount appears as a long, rounded ridge. Its crest sits about 16 to 30 m under the waves and the whole ridge can run for 180 to 260 m, so it is easiest to spot from a distance. The Barracuda sub, which cruises along the shelf, finds them most often.',
      ],
      fun: 'Scientists estimate there are tens of thousands of seamounts in the oceans, and only a small share of them have ever been visited.',
      wiki: 'Seamount',
      links: [['Wikipedia: Seamount', 'https://en.wikipedia.org/wiki/Seamount'], ['NOAA Ocean Exploration', 'https://oceanexplorer.noaa.gov/']],
    } },

  { id: 'dropoff', group: 'Landforms', name: 'Drop-off',
    hint: 'The seabed ends in a sheer edge. Peek over it and the floor vanishes.', depth: [20, 90],
    facts: [['Depth', '20–90 m'], ['Found by', 'Barracuda sub'], ['Real world', 'Shelf edges']],
    criterion: 'a drop-off landmark within 110 m, ≥ 30 % of frame',
    sheet: {
      text: [
        'A drop-off is a place where a flat, shallow shelf of seabed suddenly gives way to a steep wall. Divers love them: you swim over sand or reef in good light, and then the bottom simply falls away into blue. Real drop-offs are often small parts of something much bigger, the edge of a continental shelf.',
        'Around the world the shelf is a gently sloping apron of seabed that surrounds the land. At its outer edge, the shelf break, the slope usually steepens and runs down toward the deep ocean. Currents rise along these walls and bring food, so ledges and crevices can be covered in sponges, corals and gorgonians, with schools of fish passing in the open water beside them.',
        'In Drift a drop-off is a wall about 35 m tall, where a raised shelf falls away by roughly 30 to 50 m. The Barracuda sub finds them most often. Hover near the top and look down along the face for the best view.',
      ],
      fun: 'The edge of the continental shelf lies, on average, at a depth of around 130 m, though it varies a lot from place to place.',
      wiki: 'Continental shelf',
      links: [['Wikipedia: Continental shelf', 'https://en.wikipedia.org/wiki/Continental_shelf'], ['NOAA Ocean Service', 'https://oceanservice.noaa.gov/']],
    } },

  { id: 'canyon', group: 'Landforms', name: 'Submarine Canyon',
    hint: 'A winding, steep-sided crack in the seabed. Narrow and shadowy.', depth: [25, 70],
    facts: [['Depth', '25–70 m'], ['Found by', 'Manta sub'], ['Hazard', 'Tight squeeze']],
    criterion: 'a canyon landmark within 90 m, ≥ 25 % of frame',
    sheet: {
      text: [
        'A submarine canyon is a steep-sided valley cut into the sea floor, like a river canyon that has been flooded. Real ones can be enormous. Some are deeper and longer than famous canyons on land, and many begin close to the coast and run out across the shelf to the deep ocean.',
        'They are thought to be carved mostly by turbidity currents, fast avalanches of sediment-laden water that scour the bed as they race downhill. Rivers may also have cut parts of them when the sea level was lower. Canyon walls offer shelter and food, so they often hold dense life, from sponges and corals to fish that hide in the shade and wait for drifting prey.',
        'In Drift a canyon is a winding gorge 13 to 27 m deep, about 170 to 260 m long and only 13 to 20 m wide. The walls close in, so the small Manta sub is the best explorer. Steer gently and keep to the middle.',
      ],
      fun: 'Some submarine canyons, such as Monterey Canyon off California, are thought to rival well-known canyons on land in size.',
      wiki: 'Submarine canyon',
      links: [['Wikipedia: Submarine canyon', 'https://en.wikipedia.org/wiki/Submarine_canyon'], ['NOAA Ocean Exploration', 'https://oceanexplorer.noaa.gov/']],
    } },

  { id: 'trench', group: 'Landforms', name: 'Trench',
    hint: 'A long, dark trough in the deep seabed. The floor lies far below.', depth: [60, 150],
    facts: [['Depth', '60–150 m'], ['Found by', 'Squid sub'], ['Hazard', 'Deep and dark']],
    criterion: 'a trench landmark within 130 m, ≥ 30 % of frame',
    sheet: {
      text: [
        'An oceanic trench is a long, narrow trough in the sea floor, and it holds the deepest places on Earth. The Mariana Trench in the western Pacific reaches roughly eleven kilometres down. Trenches run for hundreds or even thousands of kilometres, usually in curved lines near chains of volcanoes.',
        'They mark the places where one great plate of the ocean floor slides beneath another, in a process called subduction. The sinking plate drags the sea floor into a deep furrow. Pressure there is crushing and sunlight never arrives, yet life has found a way: pale amphipods, sea cucumbers and other hardy animals live on food that drifts down from above.',
        'In Drift a trench is a long gash dropping 28 to 90 m below the surrounding seabed. The Squid sub, which dives to about 92 m, finds them most often. Switch on the lamps before you follow the wall down.',
      ],
      fun: 'The deepest known point of the oceans is in the Mariana Trench, deeper below sea level than Mount Everest is high above it.',
      wiki: 'Oceanic trench',
      links: [['Wikipedia: Oceanic trench', 'https://en.wikipedia.org/wiki/Oceanic_trench'], ['NOAA Ocean Exploration', 'https://oceanexplorer.noaa.gov/']],
    } },

  { id: 'stacks', group: 'Landforms', name: 'Sea Stack Forest',
    hint: 'Tall, lonely pillars in a crowd. Their tops look grassy.', depth: [20, 60],
    facts: [['Depth', '20–60 m'], ['Found by', 'Manta sub'], ['Rarity', 'Rare']],
    criterion: 'a sea-stack landmark within 70 m, ≥ 20 % of frame',
    sheet: {
      text: [
        'A sea stack is a tall, free-standing pillar of rock rising from the sea close to a coast. Stacks are the survivors of an old headland. Waves slowly worked at weaknesses in the cliff until the rock was cut into a cave, then an arch, and finally the arch collapsed and left a tower standing on its own.',
        'Stacks do not last. Waves, rain and frost keep wearing them down, until they shrink into stumps and finally vanish. Seabirds love the ledges on top, and below the waterline the rock is often wrapped in seaweed, barnacles and mussels, with fish sheltering at the base. Where the sea has risen over old land, a stack can sit entirely under water.',
        'In Drift a sea stack forest is a rare sight: a crowd of tall rock pillars, 10 to 25 m high, with grassy-looking tops. The Manta sub finds them most often. Glide slowly between the pillars as though through a quiet wood.',
      ],
      fun: 'Many sea stacks are temporary landmarks: some have been known to collapse within a lifetime.',
      wiki: 'Stack (geology)',
      links: [['Wikipedia: Stack (geology)', 'https://en.wikipedia.org/wiki/Stack_(geology)'], ['NOAA Ocean Service', 'https://oceanservice.noaa.gov/']],
    } },

  { id: 'bluehole', group: 'Landforms', name: 'Blue Hole',
    hint: 'A dark, round eye in the seabed, rimmed by a pale ring.', depth: [20, 70],
    facts: [['Depth', '20–70 m'], ['Found by', 'Lemon or Manta sub'], ['Rarity', 'Rare'], ['Hazard', 'Drifting down']],
    criterion: 'a blue-hole landmark within 90 m, ≥ 20 % of frame',
    sheet: {
      text: [
        'A blue hole is a huge, nearly round sinkhole in the sea floor or a reef flat. Seen from above, it looks like a deep blue eye in the middle of pale shallows. The Great Blue Hole off Belize is the most famous: it is more than 100 m deep and wide enough to be seen from space.',
        'Most blue holes are thought to be limestone caves and sinkholes that formed on dry land, back when the sea level was much lower. When the ice ages ended and the sea rose, the roofs fell in and the holes filled with water. The deep, still water is often short of oxygen, so the lowest parts are usually quiet, while the rim and walls can be busy with fish, corals and sharks.',
        'In Drift a blue hole is a rare find. A pale ring of rim surrounds a dark, deep centre much lower than the seabed around it. It is easy to drift downward without noticing, so check your depth gauge and keep your lamps handy.',
      ],
      fun: 'Divers have found stalactites in some blue holes, which could only have grown when the holes were dry caves above the sea.',
      wiki: 'Blue hole',
      links: [['Wikipedia: Blue hole', 'https://en.wikipedia.org/wiki/Blue_hole'], ['Smithsonian Ocean', 'https://ocean.si.edu/']],
    } },

  { id: 'terrace', group: 'Landforms', name: 'Terraced Rock Pools',
    hint: 'A stairway of flat ledges climbing a slope. Each step shimmers.', depth: [20, 60],
    facts: [['Depth', '20–60 m'], ['Found by', 'Barracuda or Squid sub'], ['Rarity', 'Rare'], ['Real world', 'Turkey, USA']],
    criterion: 'a terrace landmark within 60 m, ≥ 20 % of frame',
    sheet: {
      text: [
        'Some slopes turn into staircases. On land, hot springs rich in dissolved minerals can build terraces of travertine, a pale stone. Water spills over each lip, leaves a thin crust of mineral behind, and slowly raises a low wall that holds a shallow pool. Pamukkale in Turkey and Mammoth Hot Springs in the United States are well-known examples.',
        'The sea has stepped landscapes of its own. Waves can cut flat shelves into a rocky shore, and reef flats can form stair-like levels as sea level changes. Such flat ledges often hold small pools that are warmer, brighter and calmer than the open water, and they fill with algae, snails, shrimps and young fish.',
        'In Drift a terrace is a rare formation: a stairway of flat stepped ledges climbing a slope, each one holding a bright, pool-like patch. The Barracuda and Squid subs come across them now and then. Take the shot from a little way back so the whole staircase fits.',
      ],
      fun: 'Travertine terraces can be built remarkably quickly by geological standards, with new rims sometimes growing in a matter of years.',
      wiki: 'Travertine',
      links: [['Wikipedia: Travertine', 'https://en.wikipedia.org/wiki/Travertine'], ['USGS', 'https://www.usgs.gov/']],
    } },

  { id: 'garden', group: 'Landforms', name: 'Rock Garden',
    hint: 'Weathered spires and leaning slabs, dotted with colourful fans.', depth: [18, 60],
    facts: [['Depth', '18–60 m'], ['Found by', 'Manta sub'], ['Hazard', 'none']],
    criterion: 'a rock-garden landmark within 60 m, ≥ 20 % of frame',
    sheet: {
      text: [
        'Divers use the word garden for a patch of rock that is crowded with life, and rocky reefs often have spires and pinnacles that rise from the bed like tall, thin towers. These pinnacles are older rock that survived while the softer stone around it was worn away.',
        'Currents sweep round the spires and carry plankton past, which suits animals that filter it from the water. Sea fans and other gorgonians, sponges, soft corals and anemones grow on the sides that face the flow. Small fish shelter in the gaps, and larger ones patrol the edges for a meal. In a good garden almost every surface is covered with something alive.',
        'In Drift a rock garden is a patch 28 to 70 m across, of weathered spires and leaning slabs 6 to 10 m tall, scattered with sea fans. The Manta sub finds them most often. Slip between the slabs slowly and look at both sides.',
      ],
      fun: 'A single sea fan colony can live for decades, growing slowly into a flat lace that faces the current.',
      wiki: 'Pinnacle (geology)',
      links: [['Wikipedia: Pinnacle (geology)', 'https://en.wikipedia.org/wiki/Pinnacle_(geology)'], ['Smithsonian Ocean', 'https://ocean.si.edu/']],
    } },

  { id: 'mushroom', group: 'Landforms', name: 'Mushroom Rocks',
    hint: 'Rocks balanced on thin stems under wide caps. They come in groups.', depth: [20, 60],
    facts: [['Depth', '20–60 m'], ['Found by', 'Manta or Squid sub'], ['Rarity', 'Rare']],
    criterion: 'a mushroom-rock landmark within 45 m, ≥ 15 % of frame',
    sheet: {
      text: [
        'A mushroom rock, also called a pedestal rock, is a block of stone with a thin stem and a wide cap on top. It looks like it should topple over, but it has simply been shaped that way by erosion. Famous ones stand in deserts, where windblown sand wears the base of a rock faster than the top.',
        'Under water other forces do the sculpting. Waves and currents scour the lower part of a rock, and animals help: snails and urchins graze at the stone, and some creatures drill into it, which is called bioerosion. Where the base is softer or is attacked more, a cap of tougher rock is left sitting on a slimming stalk.',
        'In Drift mushroom rocks are a rare find, small clusters of five to nine balanced rocks with thin stems and broad caps. The Manta and Squid subs spot them most often. They are small, so come close and take a shot of the group.',
      ],
      fun: 'Famous mushroom rocks stand in deserts, where wind-blown sand wears away the base of the rock faster than the top.',
      wiki: 'Mushroom rock',
      links: [['Wikipedia: Mushroom rock', 'https://en.wikipedia.org/wiki/Mushroom_rock'], ['USGS', 'https://www.usgs.gov/']],
    } },

  // ---------------------------------------------------------------- Volcanic
  { id: 'volcano', group: 'Volcanic', name: 'Submarine Volcano',
    hint: 'A dark cone with a crater on top. Glowing streams run down its sides.', depth: [20, 90],
    facts: [['Depth', '20–90 m'], ['Found by', 'Squid sub'], ['Hazard', 'Hot water']],
    criterion: 'a volcano landmark within 120 m, ≥ 15 % of frame',
    sheet: {
      text: [
        'Most volcanoes on Earth are hidden under the sea. Submarine volcanoes erupt through the sea floor, often along ridges and above hot spots, and many have never been seen. Over time the lava and ash pile up into a cone. A few grow tall enough to break the surface and become islands, as Hawaii did.',
        'Water changes how an eruption looks and behaves. Lava chills quickly into rounded lumps and glass, and hot water jets out through cracks around the vent. Dissolved minerals feed unusual communities of microbes, worms and shrimps. In time the cone cools and becomes the foundation for coral reefs, and old volcanoes can become the seamounts of the deep.',
        'In Drift a submarine volcano is a dark ash-grey cone that rises 40 to 90 m, with a crater on top whose rim lies 17 to 55 m below the surface. Glowing lava rivers run down its flanks. The Squid sub finds them most often. The water near live lava is warm, so keep your distance if you are shy of the heat.',
      ],
      fun: 'Kavachi, in the Solomon Islands, is a very active submarine volcano that has sometimes built a temporary island and then lost it to the waves.',
      wiki: 'Submarine volcano',
      links: [['Wikipedia: Submarine volcano', 'https://en.wikipedia.org/wiki/Submarine_volcano'], ['NOAA Ocean Exploration', 'https://oceanexplorer.noaa.gov/']],
    } },

  { id: 'caldera', group: 'Volcanic', name: 'Caldera & Lava Lake',
    hint: 'A bowl in a volcano’s summit, glowing below. Look in from above.', depth: [20, 90],
    facts: [['Depth', '20–90 m'], ['Found by', 'Squid sub'], ['Hazard', 'Hot water'], ['Real world', 'Hawaii, Ethiopia']],
    criterion: 'a volcano landmark within 45 m (look into the crater)',
    sheet: {
      text: [
        'A caldera is a large bowl-shaped hollow at the top of a volcano. Many calderas form when a magma chamber below the volcano empties, perhaps in a huge eruption, and the roof above it no longer has support. The summit sinks or collapses and leaves a wide basin behind.',
        'A few volcanoes hold a lake of molten rock that stays liquid for years, which is called a lava lake. They are rare. Kīlauea in Hawaii and Erta Ale in Ethiopia have both had well-known ones. A lava lake glows red, with crusts of dark rock forming and cracking across the surface, because lava is hotter than anything else in the landscape.',
        'In Drift the crater of a submarine volcano is a bowl about 5 m deep in the summit, and most volcanoes, around 85 in every 100, hold a glowing lava lake. Drift the Squid sub over the rim and look straight down into it. The water around is gently warm.',
      ],
      fun: 'A lava lake is a rare sight: only a handful of volcanoes on Earth are known to hold one for long periods.',
      wiki: 'Lava lake',
      links: [['Wikipedia: Lava lake', 'https://en.wikipedia.org/wiki/Lava_lake'], ['USGS', 'https://www.usgs.gov/']],
    } },

  { id: 'magma', group: 'Volcanic', name: 'Magma Rift',
    hint: 'A glowing crack in black ground. Lava seeps from the seam.', depth: [20, 70],
    facts: [['Depth', '20–70 m'], ['Found by', 'Squid sub'], ['Hazard', 'Hot water']],
    criterion: 'a magma-rift landmark within 100 m, ≥ 12 % of frame',
    sheet: {
      text: [
        'A rift is a place where the Earth’s crust is being pulled apart. Under the sea, this happens along the mid-ocean ridges, the longest mountain chain in the world. There, new sea floor is made when molten rock rises into the gap, cools and hardens, and the plates move slowly away on either side.',
        'Along a rift zone lava does not always come out of a single mountain. It can seep or burst from long cracks called fissures. The rock around them is mostly black basalt, broken into blocks and ropes. The heat drives water through the crust, which feeds vents and the unusual life around them.',
        'In Drift a magma rift is a glowing fissure 80 to 210 m long, set in black ground and basalt blocks. The Squid sub finds them most often. The water over the lava is warm, so a short photo stop is the best plan.',
      ],
      fun: 'The sea floor is thought to be spreading at about the speed that fingernails grow, yet over millions of years that builds entire oceans.',
      wiki: 'Rift zone',
      links: [['Wikipedia: Rift zone', 'https://en.wikipedia.org/wiki/Rift_zone'], ['NOAA Ocean Exploration', 'https://oceanexplorer.noaa.gov/']],
    } },

  { id: 'pillow', group: 'Volcanic', name: 'Pillow Lava',
    hint: 'Black, lumpy rocks piled like soft cushions around warm lava.', depth: [20, 80],
    facts: [['Depth', '20–80 m'], ['Found by', 'Squid sub'], ['Hazard', 'Hot water']],
    criterion: 'in the lava zone (biome magma ≥ 0.5) or a magma/volcano landmark within 35 m',
    sheet: {
      text: [
        'Pillow lava is what you get when lava erupts under water. As soon as the molten rock meets the cold sea it forms a skin. More lava pushes out through the crust like toothpaste, makes a rounded lobe, chills in turn, and the cycle repeats. The result is a heap of rounded blobs that look like piled pillows.',
        'Pillows are common. Because most of the Earth’s volcanism happens on the sea floor, a great part of the ocean crust is thought to be made of them. The skin cools into volcanic glass, and the inside cools more slowly. Over time, microbes and small animals settle on the black rock, and sponges and corals can follow.',
        'In Drift, pillow lava is the lumpy black rock heaped around the lava. The Squid sub gets closest to it. Use the lamps to bring out the rounded shapes in the dark rock.',
      ],
      fun: 'Pillow lavas can be recognised in very old rocks on land, which shows geologists that the rock once erupted under an ancient sea.',
      wiki: 'Pillow lava',
      links: [['Wikipedia: Pillow lava', 'https://en.wikipedia.org/wiki/Pillow_lava'], ['USGS', 'https://www.usgs.gov/']],
    } },

  { id: 'basalt', group: 'Volcanic', name: 'Basalt Columns',
    hint: 'A field of tall, many-sided stone posts, rising in steps.', depth: [20, 65],
    facts: [['Depth', '20–65 m'], ['Found by', 'Squid sub'], ['Rarity', 'Rare'], ['Real world', 'Ireland, Scotland']],
    criterion: 'a basalt-column landmark within 60 m, ≥ 20 % of frame',
    sheet: {
      text: [
        'Basalt columns are tall, many-sided pillars of dark rock packed tightly together like a honeycomb. They are most often six-sided, though they come with four to eight sides. The Giant’s Causeway in Northern Ireland and Fingal’s Cave in Scotland are famous examples, where the sea laps at a staircase of stone.',
        'They form as a thick flow of lava cools and shrinks. The cooling rock cracks, and the cracks tend to spread in a pattern of joints that cut the flow into columns. This is called columnar jointing. The patterns look so regular that people have long imagined they were built, and many stories about giants grew up around them.',
        'In Drift basalt columns are a rare find: a field of stone posts of different heights that step up and down like stairs. The Squid sub finds them most often. Their edges are close together, so go gently through the gaps.',
      ],
      fun: 'The Giant’s Causeway has about forty thousand columns, according to many sources, and legend says that a giant built it as a path to Scotland.',
      wiki: 'Columnar jointing',
      links: [['Wikipedia: Columnar jointing', 'https://en.wikipedia.org/wiki/Columnar_jointing'], ['USGS', 'https://www.usgs.gov/']],
    } },

  { id: 'blacksmoker', group: 'Volcanic', name: 'Black Smoker Vent Field',
    hint: 'Tall mineral chimneys puffing dark water, with pale mats and worms.', depth: [50, 95],
    facts: [['Depth', '50–95 m'], ['Found by', 'Squid sub'], ['Hazard', 'Hot water'], ['Real world', 'Mid-ocean ridges']],
    criterion: 'a vent landmark within 70 m, camera deeper than 50 m',
    sheet: {
      text: [
        'A black smoker is a chimney on the sea floor that spouts hot, dark water. The fluid is rich in dissolved metals, and when it meets cold seawater the minerals drop out as fine black particles that look like smoke. The chimney grows taller as more of the minerals settle around the opening.',
        'Black smokers are often found along mid-ocean ridges, where sea water seeps into the crust, is heated by the magma below and rises again. The water coming out can be hundreds of degrees warm. Sunlight never reaches these places, so life there is built on chemosynthesis: microbes make food from chemicals such as hydrogen sulphide, and tubeworms, shrimps and snails live on them or with them.',
        'In Drift a vent field is found deeper than about 50 m, with mineral chimneys, tubeworms and pale microbial mats. The Squid sub finds them most often. The water near the vents is warm, and the dark is real, so bring your lamps.',
      ],
      fun: 'Vent communities were discovered in 1977, and they surprised scientists because they showed that whole ecosystems can live without sunlight.',
      wiki: 'Hydrothermal vent',
      links: [['Wikipedia: Hydrothermal vent', 'https://en.wikipedia.org/wiki/Hydrothermal_vent'], ['NOAA Ocean Exploration', 'https://oceanexplorer.noaa.gov/']],
    } },

  { id: 'shallowvent', group: 'Volcanic', name: 'Shallow Vents',
    hint: 'Small, crusty vents bubbling warm water in brighter, shallower water.', depth: [30, 50],
    facts: [['Depth', '30–50 m'], ['Found by', 'Squid or Lemon sub'], ['Hazard', 'Hot water'], ['Real world', 'Greece, Taiwan']],
    criterion: 'a vent landmark within 60 m, camera shallower than 50 m',
    sheet: {
      text: [
        'Not every hydrothermal vent is deep. Where the crust is hot and close to the surface, warm water and gas can seep out of the sea floor in the shallows. Divers have visited such vents near volcanic islands, for example off Milos in Greece and off a small island in Taiwan, where bubbles stream out of cracks and the sand is stained with minerals.',
        'These vents are close to the light, so their communities are a mix: some animals rely on chemicals from the vent, as in the deep sea, while others make use of sunshine, like algae and the animals that graze on them. Minerals can build crusts of yellow, orange and white on the rocks. Bubbles and warm water can also change how the nearby seabed looks and who lives there.',
        'In Drift, shallow vents are small, mineral-crusted openings that bubble warm water, found in less than 50 m. The Squid and Lemon subs both come across them. Take care, because the water close to the vent is a little hot.',
      ],
      fun: 'Shallow vents are easier to study than deep ones, so scientists can sometimes reach them with ordinary scuba gear.',
      wiki: 'Hydrothermal vent',
      links: [['Wikipedia: Hydrothermal vent', 'https://en.wikipedia.org/wiki/Hydrothermal_vent'], ['Woods Hole', 'https://www.whoi.edu/']],
    } },

  // ---------------------------------------------------------------- Caves & arches
  { id: 'arch', group: 'Caves & arches', name: 'Rock Arch',
    hint: 'A stone doorway in the sea. Pink and green growth lines the underside.', depth: [16, 60],
    facts: [['Depth', '16–60 m'], ['Found by', 'Manta sub'], ['Hazard', 'Tight squeeze']],
    criterion: 'an arch landmark within 60 m, ≥ 10 % of frame',
    sheet: {
      text: [
        'A natural arch is a rock with a hole worn right through it, so it looks like a doorway or a bridge. Sea arches form on rocky coasts. Waves attack cracks in a headland until they open into a cave, and the cave deepens until it breaks through to the other side.',
        'Arches are fleeting in geological terms. Waves keep working at the span, and in the end it falls and leaves a stack standing alone. While they last, arches are good places for life: the shaded underside can be coated in coralline algae, sponges and sea squirts, and fish like to shelter in the cool shade, or glide through the gap.',
        'In Drift a rock arch is 15 to 25 m wide and 9 to 14 m high, with pink and green growth along the underside. The Manta sub, being small, finds them most often. The opening is not huge, so line up carefully before you glide through.',
      ],
      fun: 'Durdle Door in Dorset, England, is one of the best-known sea arches, and visitors often swim in the cove beside it.',
      wiki: 'Durdle Door',
      links: [['Wikipedia: Durdle Door', 'https://en.wikipedia.org/wiki/Durdle_Door'], ['NOAA Ocean Service', 'https://oceanservice.noaa.gov/']],
    } },

  { id: 'bridge', group: 'Caves & arches', name: 'Natural Bridge',
    hint: 'A broad stone span held up by a middle pier, with two openings.', depth: [16, 60],
    facts: [['Depth', '16–60 m'], ['Found by', 'Manta sub'], ['Rarity', 'Rare'], ['Hazard', 'Tight squeeze']],
    criterion: 'a natural-bridge landmark within 70 m, ≥ 15 % of frame',
    sheet: {
      text: [
        'A natural bridge is a close cousin of the arch: a span of stone that rises over an opening, which water, wind or waves have carved through solid rock. Some are single and some are double, with two openings side by side, separated by a pier of rock in the middle.',
        'The sea makes double arches when waves cut through a headland at two weak spots, or when a single arch is split by the collapse of part of its roof. Each opening acts like a separate doorway, and the pier between them is where life often gathers, with sponges, sea fans and anemones on the stone and fish drifting in and out.',
        'In Drift a natural bridge is a rare, broad, double-span arch with a middle pier and two openings. The Manta sub finds them most often. Try a photo through each opening, then step back to take them both in at once.',
      ],
      fun: 'Because waves keep wearing the rock away, a double arch is only a temporary shape; one span will eventually fall and leave the other.',
      wiki: 'Natural arch',
      links: [['Wikipedia: Natural arch', 'https://en.wikipedia.org/wiki/Natural_arch'], ['USGS', 'https://www.usgs.gov/']],
    } },

  { id: 'cave', group: 'Caves & arches', name: 'Sea Cave',
    hint: 'A dark tunnel through a rocky mound, with thin shafts of light.', depth: [16, 60],
    facts: [['Depth', '16–60 m'], ['Found by', 'Manta sub'], ['Hazard', 'Tight squeeze, dark']],
    criterion: 'a cave landmark within 50 m, ≥ 10 % of frame',
    sheet: {
      text: [
        'A sea cave is a hollow cut into a cliff or rock by the force of waves. Waves hurl water, sand and stones into cracks in the rock again and again, and the cracks widen into a cave. Some caves are just shallow notches, and others run far into the rock. Many were carved when the sea stood at a different level and now lie under the waves.',
        'Caves have zones, just like the sea does. Near the mouth there is plenty of light and the walls are covered in algae and sponges. Further in, only animals that can cope with dim light remain, such as sponges, sea squirts and shy fish. Deep in the dark, the walls can look bare, and the water stays still and cool.',
        'In Drift a sea cave is a tunnel about 28 to 42 m long through a rock mound, with skylights in the roof. Some end in a chamber, and some come out the other side. The Manta sub finds them most often. Light is limited inside, so turn on the lamps.',
      ],
      fun: 'Fingal’s Cave in Scotland is a sea cave famous for its echoing sound, which inspired a well-known piece of music.',
      wiki: 'Sea cave',
      links: [['Wikipedia: Sea cave', 'https://en.wikipedia.org/wiki/Sea_cave'], ['Smithsonian Ocean', 'https://ocean.si.edu/']],
    } },

  // ---------------------------------------------------------------- Reefs
  { id: 'bigreef', group: 'Reefs', name: 'Great Reef (Spur and Groove)',
    hint: 'A huge, bright reef with fingers of coral and lanes of sand between.', depth: [8, 40],
    facts: [['Depth', '8–40 m'], ['Found by', 'Lemon or Manta sub'], ['Real world', 'Great Barrier Reef']],
    criterion: 'a big-reef landmark within 160 m, ≥ 30 % of frame',
    sheet: {
      text: [
        'Coral reefs are built by tiny animals, the coral polyps, that lay down skeletons of limestone. Over thousands of years the skeletons pile up into reefs big enough to shape coasts and shelter islands. The Great Barrier Reef off Australia is the largest, a chain of thousands of reefs that can be seen from space.',
        'On the outer edge of many reefs, the coral grows into ridges, called spurs, that run out toward the open sea. Lanes of sand and rubble, called grooves, lie in between. The pattern is thought to help the reef cope with waves: water surges through the grooves and drains the energy of the surf. Corals, fish, turtles, rays and countless other animals live among the spurs.',
        'In Drift a great reef is a bright coral garden 70 to 185 m wide, with spurs and sandy grooves running out toward the reef edge. Both the Lemon and Manta subs find them often. Follow a groove out to the edge and watch the reef from above.',
      ],
      fun: 'Corals get most of their colour and a good part of their food from tiny algae that live inside their tissues.',
      wiki: 'Great Barrier Reef',
      links: [['Wikipedia: Great Barrier Reef', 'https://en.wikipedia.org/wiki/Great_Barrier_Reef'], ['NOAA Ocean Service', 'https://oceanservice.noaa.gov/']],
    } },

  { id: 'lagoon', group: 'Reefs', name: 'Reef Lagoon',
    hint: 'A calm basin of pale sand, circled by a ring of coral.', depth: [10, 25],
    facts: [['Depth', '10–25 m'], ['Found by', 'Lemon sub'], ['Hazard', 'none']],
    criterion: 'inside a big reef that has a lagoon (camera within 90 % of its radius)',
    sheet: {
      text: [
        'A lagoon is a shallow body of water that is partly cut off from the open sea by a barrier, such as a reef, a bar of sand or a ring of low islands. Coral atolls are the classic case: a ring of reef around a calm, pale-green pool. Lagoons are often warmer and quieter than the sea outside.',
        'The still, shallow water suits many animals. Sand and seagrass patches are home to rays, shrimps and young fish that are safer there from larger predators. Coral heads pop up from the floor in patches, and a lagoon can be an important nursery for the wider reef. The reef ring takes the force of the waves, which keeps the inside calm.',
        'In Drift a reef lagoon is a calm, pale-sand basin about 18 m deep in the middle of a big reef, ringed by coral. The Lemon sub finds them most often. It is a relaxed place to stop and let the fish come to you.',
      ],
      fun: 'Charles Darwin suggested that atoll lagoons form as a volcanic island slowly sinks while the coral reef around it keeps growing upward.',
      wiki: 'Lagoon',
      links: [['Wikipedia: Lagoon', 'https://en.wikipedia.org/wiki/Lagoon'], ['NOAA Ocean Service', 'https://oceanservice.noaa.gov/']],
    } },

  { id: 'maze', group: 'Reefs', name: 'Coral Labyrinth',
    hint: 'Twisting walls of coral with narrow channels. Easy to lose your way.', depth: [10, 40],
    facts: [['Depth', '10–40 m'], ['Found by', 'Manta sub'], ['Hazard', 'Tight squeeze']],
    criterion: 'inside a labyrinth reef (camera within its radius)',
    sheet: {
      text: [
        'Some reefs do not form a ring or a line but a tangle. Patch reefs are small, isolated reefs that rise from a sandy floor, and in some places they join into winding networks of coral walls with narrow channels between them. Divers sometimes call these mazes, and they are thought to form where corals grow along old ridges or in patterns shaped by currents.',
        'The channels are shelters. Small fish dart in and out of the walls, shrimps and crabs hide in the gaps, and larger animals patrol the lanes. Corals grow quickly on the sunlit top edges and slowly on the shaded sides, which gives the walls their uneven, ragged shape.',
        'In Drift a coral labyrinth is a reef of twisting walls and channels 62 to 110 m wide. The small Manta sub is the best explorer. Take it slow in the channels, and remember where you started.',
      ],
      fun: 'Patch reefs can be rich in life for their size, with fish gathering in the sheltered channels around them.',
      wiki: 'Coral reef',
      links: [['Wikipedia: Coral reef', 'https://en.wikipedia.org/wiki/Coral_reef'], ['Smithsonian Ocean', 'https://ocean.si.edu/']],
    } },

  // ---------------------------------------------------------------- Areas
  { id: 'open', group: 'Areas', name: 'Open Blue Water',
    hint: 'Mid-water, far from the bottom. Shafts of light and drifting schools.', depth: [12, 60],
    facts: [['Depth', '12–60 m'], ['Found by', 'Any sub'], ['Hazard', 'none']],
    criterion: 'open-water biome ≥ 0.55, camera ≥ 14 m above the seabed, deeper than 12 m',
    sheet: {
      text: [
        'Most of the ocean is open water, far from any shore or seabed. Scientists call it the oceanic zone, or the pelagic realm. The top layer, where enough sunlight arrives for plants and algae to grow, is called the epipelagic or sunlit zone. It usually reaches down about 200 m.',
        'In clear water the light falls in slanting beams, and the colour shifts from green-blue to deep blue as you go down. There is no place to hide, so many animals live in groups. Schools of fish turn together, jellyfish and plankton drift with the current, and hunters such as tuna and sharks cruise through the blue.',
        'In Drift open water is the mid-water space far above the seabed, at least 14 m up, in deep enough water. Any sub can find it. Hold still, wait for a school to pass and watch the beams of light.',
      ],
      fun: 'Much of the open ocean’s tiny floating life, the plankton, is thought to make a large share of the oxygen we breathe.',
      wiki: 'Oceanic zone',
      links: [['Wikipedia: Oceanic zone', 'https://en.wikipedia.org/wiki/Oceanic_zone'], ['NOAA Ocean Service', 'https://oceanservice.noaa.gov/']],
    } },

  { id: 'sandplain', group: 'Areas', name: 'Sandy Plains',
    hint: 'Low swells of pale sand and very little life. Quiet and open.', depth: [10, 60],
    facts: [['Depth', '10–60 m'], ['Found by', 'Any sub'], ['Hazard', 'none']],
    criterion: 'open biome ≥ 0.45, camera ≤ 9 m above the seabed, deeper than 10 m, fewer than 6 corals in frame',
    sheet: {
      text: [
        'Much of the sea floor is not reef or rock but plain sand and mud. These broad plains can look empty at first, yet they are full of life that has learned to hide. Many animals bury themselves, and the surface is shaped into ripples by currents and waves.',
        'Look carefully and you may notice small mounds, holes and tracks. Worms, clams and shrimps live below the surface. Rays and flatfish settle on the sand and cover themselves with a thin layer, which makes them hard to see. Where they are dense, sandy bottoms feed a food web that includes many fish.',
        'In Drift sandy plains are low swells of pale sand with few animals, found at any depth from about 10 m downward. Any sub can find them. Cruise just above the bottom and watch for a shape that moves.',
      ],
      fun: 'A flatfish such as a flounder can change its colour and pattern to match the sand it rests on.',
      wiki: 'Seabed',
      links: [['Wikipedia: Seabed', 'https://en.wikipedia.org/wiki/Seabed'], ['NOAA Ocean Service', 'https://oceanservice.noaa.gov/']],
    } },

  { id: 'reefflat', group: 'Areas', name: 'Coral Flats',
    hint: 'A patchwork of low corals on the shelf, outside the great reefs.', depth: [8, 40],
    facts: [['Depth', '8–40 m'], ['Found by', 'Lemon sub'], ['Hazard', 'none']],
    criterion: 'reef biome ≥ 0.45, not inside a big reef, ≥ 6 corals in frame',
    sheet: {
      text: [
        'A reef flat is the broad, shallow, fairly level part of a reef, often just behind its outer edge. Fringing reefs, which grow right beside a coast, usually have a wide reef flat. Corals there form a patchwork with sand, rock and algae, and they cope with strong sun and changing water.',
        'Because the water is shallow and well lit, corals grow in many forms: low mounds, plates and branching clumps. Small fish dart between them, and sea cucumbers, urchins and snails graze across the bed. Healthy flats keep the coast safer by softening the waves that reach the shore.',
        'In Drift coral flats are patchworks of corals on the shelf, outside the great reefs. The Lemon sub finds them most often. If you see six or more corals in one view, you are in the right place.',
      ],
      fun: 'Some corals on reef flats can cope with a short time out of the water at very low tides.',
      wiki: 'Fringing reef',
      links: [['Wikipedia: Fringing reef', 'https://en.wikipedia.org/wiki/Fringing_reef'], ['NOAA Ocean Service', 'https://oceanservice.noaa.gov/']],
    } },

  { id: 'meadow', group: 'Areas', name: 'Seagrass Meadow',
    hint: 'A thick green lawn swaying under the water. Soft, grassy and busy.', depth: [8, 40],
    facts: [['Depth', '8–40 m'], ['Found by', 'Lemon or Manta sub'], ['Hazard', 'none']],
    criterion: '≥ 20 seaweed plants in frame, over a thick weed bed (weed density ≥ 0.55 at the camera)',
    sheet: {
      text: [
        'Seagrasses are flowering plants that have returned to the sea. They have roots, leaves, flowers and seeds, and they grow in shallow, sunlit water in great meadows, mostly on sand or mud. They are not the same as seaweeds, which are algae.',
        'Meadows are some of the most useful habitats in the ocean. They are thought to be important nurseries for young fish, and they feed turtles, manatees and dugongs. The roots hold the sand in place and the leaves slow the water, which keeps it clearer. Seagrass beds also store carbon in the mud below them.',
        'In Drift a seagrass meadow is a thick lawn of seagrass and weed. The Lemon and Manta subs find them often. Move slowly over the meadow, and watch for small fish that hide among the blades.',
      ],
      fun: 'Some seagrass meadows are thought to be thousands of years old, because a single plant can spread slowly into a huge colony.',
      wiki: 'Seagrass',
      links: [['Wikipedia: Seagrass', 'https://en.wikipedia.org/wiki/Seagrass'], ['NOAA Ocean Service', 'https://oceanservice.noaa.gov/']],
    } },

  { id: 'deepdark', group: 'Areas', name: 'The Deep Dark',
    hint: 'Where the blue fades to black. Only your lamps show the way.', depth: [55, 95],
    facts: [['Depth', '55–95 m'], ['Found by', 'Squid sub'], ['Hazard', 'Dark']],
    criterion: 'deep biome ≥ 0.6 and depth ≥ 40 m',
    sheet: {
      text: [
        'Sunlight does not travel far through water. Red light fades within the first ten or so metres, and by a few hundred metres down only a faint blue is left. Below about a thousand metres it is completely dark. The twilight band, the mesopelagic zone, and the darkness beneath, the aphotic zone, make up most of the ocean’s living space.',
        'Life in the dark has found ways to cope. Many animals have large eyes, red or black skin, or no eyes at all. A great number make their own light, called bioluminescence, to attract prey, find a mate or confuse a predator. Some animals swim up at night to feed near the surface and sink back before dawn.',
        'In Drift the light fades to blue-black below about 50 m. The Squid sub, which dives to about 92 m, finds the dark most often. Your lamps matter here: switch them on and see what looks back.',
      ],
      fun: 'Many animals in the deep sea make their own light, and it is often blue, the colour that travels furthest in seawater.',
      wiki: 'Bioluminescence',
      links: [['Wikipedia: Bioluminescence', 'https://en.wikipedia.org/wiki/Bioluminescence'], ['NOAA Ocean Exploration', 'https://oceanexplorer.noaa.gov/']],
    } },

  { id: 'trenchfloor', group: 'Areas', name: 'Trench Floor',
    hint: 'The very bottom of a deep trough. Dark silt, steep walls, silence.', depth: [60, 150],
    facts: [['Depth', '60–150 m'], ['Found by', 'Squid sub'], ['Hazard', 'Deep and dark']],
    criterion: 'trench biome ≥ 0.5, depth ≥ 40 m and a trench landmark within 60 m',
    sheet: {
      text: [
        'The hadal zone is the deepest part of the ocean, named after Hades, the Greek underworld. It begins at around six thousand metres and takes in the deep trenches. Few people have ever been there. It is cold, dark and under enormous pressure.',
        'The floor of a trench is often soft silt that slides down the walls, and food falls from far above in a slow rain of dead plankton and other debris. Life is sparse but real: small crustaceans called amphipods, sea cucumbers, worms and some fish can live there. Animals are often pale and slow, and the whole place is thought to be very quiet.',
        'In Drift the floor of a trench is dark silt between steep walls and is almost silent. The Squid sub finds it most often. Follow the trench down, stay near the walls and give your eyes time to adjust.',
      ],
      fun: 'Even at the bottom of the deepest trench scientists have found animals, which shows how far life reaches.',
      wiki: 'Hadal zone',
      links: [['Wikipedia: Hadal zone', 'https://en.wikipedia.org/wiki/Hadal_zone'], ['NOAA Ocean Exploration', 'https://oceanexplorer.noaa.gov/']],
    } },
];
