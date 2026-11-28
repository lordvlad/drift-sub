/**
 * Bestiary fact sheets for the open-ocean and cave / wreck / reef-labyrinth species (src/groups/pelagic.js).
 * `wiki` is the English Wikipedia page title (checked against the REST summary API); same shape as src/bestiary-data.js.
 */
export const PELAGIC_SHEETS = {
  yellowfin: {
    sci: 'Thunnus albacares', wiki: 'Yellowfin tuna',
    text: [
      'The yellowfin tuna is a fast, torpedo-shaped fish of warm open water. Schools patrol hundreds of kilometres of blue ocean, often along drop-offs and seamounts where food is concentrated, and they dive to a few hundred metres and back in a single day.',
      'Its body is built for speed: the eyes sit flush with the skin, fins fold into grooves, and a row of small finlets along the tail stock keeps the water flowing smoothly. Tunas are among the few fishes that keep their muscles warmer than the sea around them, which gives them a powerful, sustained sprint.',
      'Adults grow long yellow second dorsal and anal fins that sweep back like sickles; young fish and females have shorter ones. A school hunting at the surface can be spotted from afar by the birds that follow it.',
    ],
    fun: 'A tuna has to keep swimming to breathe: it has no gill pump, so water must flow over the gills as it moves. It can cruise for years without ever stopping.',
  },
  mahi: {
    sci: 'Coryphaena hippurus', wiki: 'Mahi-mahi',
    text: [
      'The mahi-mahi, also called dorado or common dolphinfish, is a bright surface dweller of warm seas. It follows drifting weed lines and floating debris, where small fish gather, and hunts flying fish by leaping after them in long, flat arcs.',
      'Males carry a tall, blunt forehead that gives the fish its square-headed profile, and a single dorsal fin runs from head to tail. Its colours are electric: blue and green on the back, gold on the flanks, and spots of bright blue. They fade within minutes of leaving the water, but flash brightly while the fish is excited.',
      'Mahi-mahi live fast. They grow to a metre or more within a year, breed again and again, and rarely live beyond four or five years, travelling in small groups of a handful of fish.',
    ],
    fun: 'Despite the old nickname "dolphin", it is a fish, not a mammal. The Hawaiian name mahi-mahi simply means "very strong".',
  },
  gbarracuda: {
    sci: 'Sphyraena barracuda', wiki: 'Great barracuda',
    text: [
      'The great barracuda is a long, silver ambush hunter of reefs, wrecks and open water. Adults often hang almost motionless near the surface or beside a wreck, facing the current, then dart forward in a flash to seize a fish crosswise in a mouth full of fangs.',
      'The jaws are long and underslung, with a jutting lower jaw and two kinds of teeth: small ones for gripping and large, dagger-like ones for cutting prey in half. Dark blotches on the lower flank and faint bars on the back break up its outline in the dappled light.',
      'Young barracudas live in seagrass and mangroves; large adults are mostly solitary, though loose groups of half-grown fish gather near structures. They are curious and will follow a diver at a distance, drawn by shiny objects.',
    ],
    fun: 'A barracuda can sprint at more than 40 km/h over a short distance, and it is attracted to anything that flashes, like a bright piece of metal.',
  },
  sailfish: {
    sci: 'Istiophorus platypterus', wiki: 'Sailfish',
    text: [
      'The sailfish is the fastest fish in the sea in short bursts, with a spear-like bill and a giant sail-shaped dorsal fin that can be folded down into a groove along its back. It is a bright, cobalt-blue hunter of surface waters, with pale vertical bars across its flanks.',
      'It hunts schools of sardines and mackerel. Several sailfish may work together, circling a bait ball with their sails raised to herd it tight, then slashing through the school with their bills to stun fish before eating them one at a time.',
      'Sailfish can change colour in an instant: bright blue stripes light up when they are hunting and fade to a dull brown when they relax.',
    ],
    fun: 'Sailfish have been reported sprinting at around 100 km/h in short bursts, which would make them one of the fastest animals in the ocean.',
  },
  hammerhead: {
    sci: 'Sphyrna lewini', wiki: 'Scalloped hammerhead',
    text: [
      'The scalloped hammerhead is a shark whose head is stretched sideways into a broad "hammer", with an eye at each tip and two gentle notches in front that give it a scalloped look. The wide head spreads its senses wider, so it can sweep the seabed for prey like a metal detector, and sense the faint electric fields of buried fish and rays.',
      'By day, hundreds of scalloped hammerheads may gather in huge schools around seamounts, islands and drop-offs, hanging in the current and moving slowly in the manner of a stately parade. At dusk the schools break up and each shark swims off alone to feed in open water, returning at dawn.',
      'They are shy of divers and swim away when approached quickly, though a slow, quiet approach lets a diver watch for a long time. The species is now endangered because of overfishing, so every school is a rare sight.',
    ],
    fun: 'The hammer gives it unusually sharp vision: its eyes are so far apart that it can see all the way around, above and below, with almost no blind spots.',
  },
  moray: {
    sci: 'Gymnothorax funebris', wiki: 'Green moray',
    text: [
      'The green moray is the largest moray eel of the Atlantic, reaching two metres or more. It lives in crevices and holes in reefs, rocks and wrecks, with only its head sticking out, and its mouth gaping open and closing in a steady rhythm. It is not threatening: it is just pumping water over its gills.',
      'The eel looks green, but its skin is actually dark brown. A layer of yellow mucus on its surface, which protects it from scrapes and parasites, mixes with the blue-grey skin to make it look olive green. It has poor eyesight and relies on its excellent sense of smell, using tube-like nostrils to track prey.',
      'At night it leaves its den to hunt fish, crabs and octopuses along the reef, slipping into holes that no other predator can reach. A cleaner shrimp may groom its skin and even its teeth.',
    ],
    fun: 'A moray has a second set of jaws in its throat. When it bites, the "pharyngeal jaws" shoot forward into the mouth, grab the prey and drag it down.',
  },
  goliath: {
    sci: 'Epinephelus itajara', wiki: 'Atlantic goliath grouper',
    text: [
      'The Atlantic goliath grouper is one of the largest reef fish in the world, reaching over two metres and several hundred kilos. It spends most of its life close to one patch of reef, wreck or cave, usually lingering near the opening and in plain sight of passing divers.',
      'Its huge head, small eyes and mottled olive-brown colours give it a heavy, dignified look. It gulps prey whole with a sudden rush of its enormous mouth, sucking in crabs, lobsters and small fish. It rarely chases anything.',
      'It is curious and tolerant of a slow, calm approach; a fast swimmer making a sudden move will send it backing off into its cave with a booming thump from its swim bladder. It was once fished almost to extinction and is now protected.',
    ],
    fun: 'When threatened, a goliath grouper can make a deep, rumbling "boom" by vibrating its swim bladder, loud enough to be felt through a diver\'s chest.',
  },
  hawksbill: {
    sci: 'Eretmochelys imbricata', wiki: 'Hawksbill sea turtle',
    text: [
      'The hawksbill is a small, graceful sea turtle with a narrow, pointed head shaped like a bird\'s beak. It uses this beak to reach into cracks and crevices on the reef, where it feeds almost entirely on sponges, including some that are toxic to other animals.',
      'Its shell is made of overlapping amber and brown plates, with a serrated rear edge, giving it the "tortoiseshell" look. Hawksbills move with slow, powerful strokes of their front flippers, gliding over a reef while sleeping underneath ledges at night, but they must surface every so often for air.',
      'Females return to the very beach where they were born to lay their eggs. The hawksbill is critically endangered, because its beautiful shell was long traded for jewellery and ornaments.',
    ],
    fun: 'By eating sponges, hawksbills stop them from overgrowing and smothering the coral, so a reef with turtles is healthier for it.',
  },
  octopus: {
    sci: 'Octopus vulgaris', wiki: 'Common octopus',
    text: [
      'The common octopus is a soft-bodied hunter of rocky reefs and rubble, with eight arms lined with suckers and no bones, apart from a hard beak. It can squeeze through any gap larger than its beak, and it spends the day tucked into a den, built from rocks and shells, and comes out to hunt crabs and shellfish at dusk.',
      'Thousands of colour cells in its skin let it change colour and texture in a fraction of a second, blending in with algae, sand or coral. A startled octopus flushes red or pale, squirts a cloud of dark ink to confuse its enemy, and jets away by squirting water through its funnel.',
      'Octopuses are among the smartest of invertebrates. They can solve puzzles, unscrew jars and recognise individual people. Their lives are short, only a year or two.',
    ],
    fun: 'An octopus has three hearts and blue blood: two pump blood through the gills, and a third pumps it around the body.',
  },
  bannerfish: {
    sci: 'Heniochus acuminatus', wiki: 'Pennant coralfish',
    text: [
      'The pennant coralfish, also called the longfin bannerfish, is a disc-shaped relative of the butterflyfish with two broad black bands across a white body, a yellow tail and a long white banner trailing from its dorsal fin. Pairs and small groups glide slowly in and out of reef passages, caves and wreck corridors.',
      'The black band through the eye hides the real eye from predators and breaks up the fish\'s outline. The long "banner" is an extension of the dorsal fin; it can be as long as the whole body, and the fish waves it gently as it swims.',
      'Bannerfish feed on plankton and small invertebrates in the water just above the coral, and young ones sometimes clean larger fish. They often swim in pairs and are thought to stay together on the same reef for years.',
    ],
    fun: 'Its long dorsal banner can be as long as the whole fish, and it waves it gently as it swims.',
  },
};
