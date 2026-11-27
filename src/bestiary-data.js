/**
 * Bestiary fact sheets. `wiki` is the English Wikipedia page title: its lead image is fetched at runtime
 * (REST summary API, CORS-enabled) and it is also the first "further reading" link.
 */
export const SHEETS = {
  anthias: {
    sci: 'Pseudanthias squamipinnis', wiki: 'Sea goldie',
    text: [
      'The lyretail anthias, also called sea goldie, is one of the most common reef fish of the Indo-Pacific. Large groups hover in the current just above coral heads, picking zooplankton out of the water.',
      'Colonies are organised as harems: a single magenta-purple male with long fin extensions guards a crowd of smaller orange females.',
      'When the male dies or disappears, the dominant female changes sex and takes his place within a couple of weeks.',
    ],
    fun: 'Every lyretail anthias starts life as a female. Being male is a promotion.',
  },
  tang: {
    sci: 'Zebrasoma flavescens', wiki: 'Yellow tang',
    text: [
      'The yellow tang is a bright, disc-shaped surgeonfish found mostly around Hawaii. It grazes algae off rocks and coral, helping keep reefs from being overgrown.',
      'Like all surgeonfish it carries a sharp, scalpel-like spine on each side of the tail, which it can flick at rivals.',
    ],
    fun: 'At night the yellow tang fades to a duller colour with a pale horizontal stripe, which brightens again at sunrise.',
  },
  chromis: {
    sci: 'Chromis cyanea', wiki: 'Blue chromis',
    text: [
      'The blue chromis is a small, electric-blue damselfish of Caribbean reefs. Loose groups feed on plankton a few metres above the coral and dive into crevices when threatened.',
      'Its deeply forked tail makes it a quick, agile swimmer in open water above the reef.',
    ],
    fun: 'Males prepare a nest on the reef and guard the eggs themselves until they hatch.',
  },
  damsel: {
    sci: 'Chromis viridis', wiki: 'Chromis viridis',
    text: [
      'The blue-green chromis forms shimmering clouds over branching corals in the Indo-Pacific. The whole group feeds in the water column and vanishes into the coral branches at once when danger approaches.',
      'Because they live so closely with their coral, a healthy colony of these fish is a good sign of a healthy reef.',
    ],
    fun: 'A single coral head can shelter a school of hundreds of these fish, all diving inside together.',
  },
  wrasse: {
    sci: 'Thalassoma lunare', wiki: 'Moon wrasse',
    text: [
      'The moon wrasse is a busy, green-and-magenta reef fish named for the crescent-shaped tail of adults. It swims by rowing with its pectoral fins rather than beating its tail.',
      'It is a restless predator of small invertebrates and often follows other fish that stir up the sand.',
    ],
    fun: 'Wrasses sleep at night: many bury themselves in sand or wedge into crevices until morning.',
  },
  snapper: {
    sci: 'Lutjanus sebae', wiki: 'Lutjanus sebae',
    text: [
      'The emperor red snapper is a striking red-and-white fish of Indo-Pacific reefs and nearby open bottoms. Young fish shelter among the spines of sea urchins, while adults roam deeper reef slopes.',
      'Its bold bands fade with age, and large adults are a more uniform deep red.',
    ],
    fun: 'Red is one of the first colours to disappear underwater, so a "red" fish at depth actually looks dark grey to its predators.',
  },
  basslet: {
    sci: 'Gramma loreto', wiki: 'Royal gramma',
    text: [
      'The royal gramma is a tiny Caribbean reef fish, half vivid purple and half golden yellow. It lives along ledges and in caves, often hanging upside down beneath overhangs.',
      'Males build nests from algae inside crevices, and pairs defend a small home territory.',
    ],
    fun: 'Royal grammas orient to the nearest surface, so under a ledge they swim belly-up as if the ceiling were the floor.',
  },
  sardine: {
    sci: 'Sardina pilchardus and relatives', wiki: 'Sardine',
    text: [
      'Sardines are small, oily, silver fish that travel in enormous schools in coastal and open waters, filtering plankton as they swim.',
      'Their schools are a moving feast: sharks, dolphins, seabirds, tuna and whales all depend on them.',
    ],
    fun: 'Each winter South Africa sees the "Sardine Run", a shoal migration so large it can be seen from aircraft.',
  },
  trevally: {
    sci: 'Gnathanodon speciosus', wiki: 'Golden trevally',
    text: [
      'The golden trevally is a fast jack of tropical waters. Juveniles are bright yellow with dark bars and often swim right in front of sharks, groupers or even divers, riding their bow wave.',
      'Adults turn more silvery and feed by sucking invertebrates from the sand with their protrusible, toothless jaws.',
    ],
    fun: 'Young golden trevally act as "pilots", escorting much larger animals that protect them from predators.',
  },
  mackerel: {
    sci: 'Scomber australasicus', wiki: 'Blue mackerel',
    text: [
      'The blue mackerel is a streamlined schooling fish of the western Pacific, with wavy dark stripes on a blue-green back.',
      'It is built for endurance: a firm torpedo body and small finlets near the tail reduce drag while cruising.',
    ],
    fun: 'Mackerel have no swim bladder, so they must keep swimming to avoid sinking.',
  },
  fusilier: {
    sci: 'Caesio cuning', wiki: 'Caesio cuning',
    text: [
      'The redbelly yellowtail fusilier swims in large, fast schools along Indo-Pacific reef edges, picking zooplankton out of passing water.',
      'Fusiliers are related to snappers but built for open water, with forked tails and slender bodies.',
    ],
    fun: 'Fusiliers often visit "cleaning stations" where small wrasses pick parasites off them.',
  },
  ghost: {
    sci: 'Pempheris spp.', wiki: 'Pempheris',
    text: [
      'Sweepers are small, deep-bodied, almost translucent fish that hide in caves and under ledges in dense groups by day.',
      'At night they leave their shelters and spread out over the reef to feed on zooplankton.',
    ],
    fun: 'Their huge eyes are an adaptation to hunting in near-darkness.',
  },
  prism: {
    sci: 'Elagatis bipinnulata', wiki: 'Rainbow runner',
    text: [
      'The rainbow runner is a sleek, fast-swimming jack of warm oceans, named for the blue and yellow stripes along its sides.',
      'It roams open water and outer reef slopes, often around floating objects, hunting small fish and squid.',
    ],
    fun: 'Rainbow runners sometimes rub against sharks, probably to scrape parasites off their skin.',
  },
  reefsquid: {
    sci: 'Sepioteuthis lessoniana', wiki: 'Bigfin reef squid',
    text: [
      'The bigfin reef squid has fins running along almost its whole mantle, which make it look like a cuttlefish. It hovers over reefs and seagrass in small groups.',
      'Its skin is packed with colour cells that it can expand and contract in a fraction of a second to signal or to vanish.',
    ],
    fun: 'Bigfin reef squid are among the fastest-growing invertebrates: they can reach adult size in a few months.',
  },
  firefly: {
    sci: 'Watasenia scintillans', wiki: 'Firefly squid',
    text: [
      'The firefly squid is only a few centimetres long but covered in light-producing organs called photophores.',
      'It spends the day deep down and rises toward the surface at night. In spring, huge numbers gather to spawn in Toyama Bay, Japan, where the shore glows blue.',
    ],
    fun: 'Counter-illumination: the lights on its belly match the faint light from above, erasing its silhouette.',
  },
  blacktip: {
    sci: 'Carcharhinus melanopterus', wiki: 'Blacktip reef shark',
    text: [
      'The blacktip reef shark is a small, timid shark of shallow Indo-Pacific reefs, easy to recognise by the black tips on its fins.',
      'It often patrols lagoons and reef flats in water so shallow that its dorsal fin breaks the surface.',
    ],
    fun: 'Blacktip reef sharks usually keep their distance from divers, they are shyer than their reputation.',
  },
  greyreef: {
    sci: 'Carcharhinus amblyrhynchos', wiki: 'Grey reef shark',
    text: [
      'The grey reef shark is one of the most common sharks on Indo-Pacific reefs, often found near drop-offs and channels with strong currents.',
      'By day groups rest along reef slopes; at night they hunt fish and squid.',
    ],
    fun: 'Before it bites in defence, a grey reef shark performs a threat display: back arched, pectoral fins lowered and swimming in exaggerated zigzags. A good signal to back away slowly.',
  },
  tiger: {
    sci: 'Galeocerdo cuvier', wiki: 'Tiger shark',
    text: [
      'The tiger shark is a large predator of tropical seas, named for the dark stripes that are clearest on young animals and fade with age.',
      'It has a very broad diet, from fish, sea turtles and seabirds to carrion, and is known for swallowing indigestible objects.',
    ],
    fun: 'Its serrated, cockscomb-shaped teeth can cut through turtle shell.',
  },
  manta: {
    sci: 'Mobula birostris / Mobula alfredi', wiki: 'Manta ray',
    text: [
      'Manta rays are the largest rays, with wingspans that can exceed 7 metres. They glide through the water flapping their pectoral fins like wings and filter plankton through their gills.',
      'Mantas regularly visit cleaning stations on the reef where small fish remove parasites, and the spot patterns on their bellies identify individuals.',
    ],
    fun: 'Mantas have one of the largest brains relative to body size of any fish, and some appear to recognise themselves in a mirror.',
  },
  dolphin: {
    sci: 'Tursiops truncatus', wiki: 'Common bottlenose dolphin',
    text: [
      'The common bottlenose dolphin lives in warm and temperate waters worldwide, in social groups of a few to many dozens of animals.',
      'It hunts with echolocation, sending out clicks and listening for echoes, and many populations have invented their own cooperative hunting techniques.',
    ],
    fun: 'Each dolphin develops a unique "signature whistle" that works like a name, and others use it to call that individual.',
  },
  orca: {
    sci: 'Orcinus orca', wiki: 'Orca',
    text: [
      'The orca or killer whale is the largest member of the dolphin family and a top predator found in every ocean.',
      'Orcas live in tight family groups led by older females. Different populations specialise in different prey, from fish to seals to other whales, and pass their hunting methods on to the young.',
    ],
    fun: 'Some orca populations have their own dialects of calls that are passed from mother to calf.',
  },
  giantsquid: {
    sci: 'Architeuthis dux', wiki: 'Giant squid',
    text: [
      'The giant squid is a deep-sea squid that can reach about 12–13 metres including its two long feeding tentacles. For centuries it was known only from carcasses and sailors\' stories.',
      'It was first filmed alive in its natural habitat in 2012, deep in the Pacific off Japan. Its main predator is the sperm whale.',
    ],
    fun: 'Its eyes can be as large as a dinner plate, among the largest of any animal.',
  },
  humpback: {
    sci: 'Megaptera novaeangliae', wiki: 'Humpback whale',
    text: [
      'The humpback whale is a baleen whale known for its extremely long pectoral fins, the knobs on its head and its acrobatic breaches.',
      'Humpbacks migrate thousands of kilometres between cold feeding grounds and warm breeding waters, where males sing long, complex songs.',
    ],
    fun: 'Groups of humpbacks hunt by "bubble-net feeding": they spiral upward blowing a ring of bubbles that traps fish.',
  },
  blue: {
    sci: 'Balaenoptera musculus', wiki: 'Blue whale',
    text: [
      'The blue whale is the largest animal known to have ever lived, reaching around 30 metres in length.',
      'Despite its size it feeds almost entirely on krill, taking in enormous gulps of water and straining it through its baleen plates.',
    ],
    fun: 'A blue whale\'s calls are so loud and low that they can travel hundreds of kilometres through the ocean.',
  },
};
