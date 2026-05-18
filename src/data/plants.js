// Maps food id (generic or brand) to the plant species it contributes
// to a "plant variety" weekly count. Animal products and refined foods
// without a meaningful plant component are absent from this map (and so
// don't count). One food can contribute multiple plants when it
// contains them in recognisable quantities (e.g. "wholegrain bread"
// counts as wheat; "trail mix" would count as several seeds + nuts).
//
// Counted plants include: fruits, vegetables, nuts, seeds, legumes,
// pulses, whole grains, herbs and spices used in non-trivial amounts,
// plus tea, coffee and cocoa (consistent with the standard "plant
// diversity" framework popularised by gut-microbiome research).

export const PLANT_TAGS = {
  // ----- FRUITS -----
  apple: ['apple'],
  banana: ['banana'],
  blueberries: ['blueberry'],
  raspberries: ['raspberry'],
  strawberries: ['strawberry'],
  blackberries: ['blackberry'],
  grapes: ['grape'],
  orange: ['orange'],
  mandarin: ['mandarin'],
  lemon: ['lemon'],
  lime: ['lime'],
  pear: ['pear'],
  peach: ['peach'],
  nectarine: ['nectarine'],
  plum: ['plum'],
  apricot: ['apricot'],
  cherry: ['cherry'],
  cherries: ['cherry'],
  pineapple: ['pineapple'],
  mango: ['mango'],
  papaya: ['papaya'],
  kiwi: ['kiwi'],
  watermelon: ['watermelon'],
  rockmelon: ['rockmelon'],
  honeydew: ['honeydew'],
  passionfruit: ['passionfruit'],
  fig: ['fig'],
  figs: ['fig'],
  pomegranate: ['pomegranate'],
  date: ['date'],
  dates: ['date'],
  raisins: ['grape'],
  sultanas: ['grape'],
  dried_apricot: ['apricot'],
  dried_cranberries: ['cranberry'],

  // ----- VEGETABLES -----
  spinach: ['spinach'],
  kale: ['kale'],
  silverbeet: ['silverbeet'],
  rocket: ['rocket'],
  lettuce: ['lettuce'],
  cos_lettuce: ['lettuce'],
  cabbage: ['cabbage'],
  red_cabbage: ['cabbage'],
  broccoli: ['broccoli'],
  broccolini: ['broccoli'],
  cauliflower: ['cauliflower'],
  brussels_sprouts: ['brussels sprout'],
  asparagus: ['asparagus'],
  zucchini: ['zucchini'],
  cucumber: ['cucumber'],
  capsicum: ['capsicum'],
  red_capsicum: ['capsicum'],
  carrot: ['carrot'],
  beetroot: ['beetroot'],
  parsnip: ['parsnip'],
  celery: ['celery'],
  fennel: ['fennel'],
  leek: ['leek'],
  onion: ['onion'],
  red_onion: ['onion'],
  spring_onion: ['spring onion'],
  garlic: ['garlic'],
  ginger: ['ginger'],
  mushroom: ['mushroom'],
  mushrooms: ['mushroom'],
  potato: ['potato'],
  sweet_potato: ['sweet potato'],
  pumpkin: ['pumpkin'],
  butternut: ['butternut'],
  tomato: ['tomato'],
  cherry_tomato: ['tomato'],
  eggplant: ['eggplant'],
  corn: ['corn'],
  corn_cob: ['corn'],
  peas: ['pea'],
  green_beans: ['green bean'],
  snow_peas: ['snow pea'],
  edamame: ['soybean'],
  bok_choy: ['bok choy'],
  pak_choy: ['bok choy'],
  artichoke: ['artichoke'],
  radish: ['radish'],
  turnip: ['turnip'],
  swede: ['swede'],
  okra: ['okra'],
  avocado: ['avocado'],

  // ----- LEGUMES & PULSES -----
  chickpeas: ['chickpea'],
  lentils: ['lentil'],
  red_lentils: ['lentil'],
  black_beans: ['black bean'],
  kidney_beans: ['kidney bean'],
  cannellini_beans: ['cannellini bean'],
  butter_beans: ['butter bean'],
  borlotti_beans: ['borlotti bean'],
  baked_beans: ['navy bean'],
  edamame_pod: ['soybean'],
  tofu_firm: ['soybean'],
  tofu_silken: ['soybean'],
  tempeh: ['soybean'],

  // ----- NUTS -----
  almonds: ['almond'],
  walnuts: ['walnut'],
  cashews: ['cashew'],
  hazelnuts: ['hazelnut'],
  pecans: ['pecan'],
  pistachios: ['pistachio'],
  macadamias: ['macadamia'],
  brazil_nuts: ['brazil nut'],
  pine_nuts: ['pine nut'],
  peanut_butter: ['peanut'],
  almond_butter: ['almond'],

  // ----- SEEDS -----
  chia_seeds: ['chia seed'],
  flax_seeds: ['flax seed'],
  sunflower_seeds: ['sunflower seed'],
  pumpkin_seeds: ['pumpkin seed'],
  sesame_seeds: ['sesame seed'],
  tahini: ['sesame seed'],

  // ----- WHOLE GRAINS -----
  oats: ['oats'],
  porridge: ['oats'],
  rolled_oats: ['oats'],
  rice_brown: ['rice'],
  rice_white: ['rice'],
  rice_basmati: ['rice'],
  rice_jasmine: ['rice'],
  rice_wild: ['wild rice'],
  quinoa: ['quinoa'],
  buckwheat: ['buckwheat'],
  barley: ['barley'],
  freekeh: ['wheat'],
  bulgur: ['wheat'],
  couscous: ['wheat'],
  pasta: ['wheat'],
  pasta_wholemeal: ['wheat'],
  bread_sourdough: ['wheat'],
  bread_wholegrain: ['wheat'],
  bread_white: ['wheat'],
  bagel: ['wheat'],
  tortilla_wheat: ['wheat'],
  noodles_rice: ['rice'],
  noodles_egg: ['wheat'],
  noodles_soba: ['buckwheat'],

  // ----- FATS THAT ARE PLANTS -----
  olive_oil: ['olive'],
  coconut_oil: ['coconut'],
  // (butter, ghee are dairy — not counted)

  // ----- HERBS / SPICES (counted when used as an ingredient) -----
  basil: ['basil'],
  parsley: ['parsley'],
  coriander: ['coriander'],
  mint: ['mint'],
  rosemary: ['rosemary'],
  thyme: ['thyme'],
  oregano: ['oregano'],
  dill: ['dill'],
  sage: ['sage'],
  chilli: ['chilli'],
  turmeric: ['turmeric'],
  cinnamon: ['cinnamon'],
  cumin: ['cumin'],

  // ----- DRINKS -----
  coffee_black: ['coffee'],
  coffee: ['coffee'],
  espresso: ['coffee'],
  latte: ['coffee'],
  flat_white: ['coffee'],
  cappuccino: ['coffee'],
  tea: ['tea'],
  green_tea: ['tea'],
  herbal_tea: ['herbs'],
  kombucha: ['tea'],

  // ----- CONDIMENTS WITH PLANT CONTENT -----
  pesto: ['basil', 'pine nut'],
  hummus: ['chickpea', 'sesame seed'],
  olives: ['olive'],
  olives_kalamata: ['olive'],
  olives_green: ['olive'],

  // ----- MIXED ITEMS THAT CARRY PLANTS -----
  bircher: ['oats'],
  overnight_oats: ['oats'],
  avocado_toast: ['avocado', 'wheat'],
  protein_bowl: ['rice', 'quinoa'],
  sushi_roll: ['rice', 'nori', 'cucumber', 'avocado'],
  fried_rice: ['rice'],
  pad_thai: ['rice'],
  curry_chicken: ['onion', 'tomato'],
  stir_fry: ['soybean'],
  salad_caesar: ['lettuce'],
  salad_greek: ['tomato', 'cucumber', 'olive'],
  shakshuka: ['tomato', 'capsicum'],
  soup_pumpkin: ['pumpkin'],

  // ----- BRAND FOODS (curated AU) -----
  sanitarium_weetbix_original: ['wheat'],
  uncle_tobys_quick_oats: ['oats'],
  carmans_original_muesli: ['oats', 'almond', 'sunflower seed', 'pumpkin seed'],
  sanitarium_upngo_choc_ice: ['wheat', 'cocoa'],
  helgas_wholemeal_mixed_grain: ['wheat'],
  tiptop_sunblest_white: ['wheat'],
  mountain_bread_wholemeal_wraps: ['wheat'],
  mayver_smooth_peanut_butter: ['peanut'],
  arnotts_tim_tam_original: ['wheat', 'cocoa'],
  arnotts_salada_original: ['wheat'],
  cobs_lightly_salted_popcorn: ['corn'],
  bounce_almond_protein_ball: ['almond'],
  lindt_excellence_70: ['cocoa'],
  sogood_almond_unsweetened: ['almond'],
  vitasoy_soy_milky_lite: ['soybean'],
  sunrice_jasmine_microwave: ['rice'],
};

// Returns array of plant names contributed by an entry.
// Looks up by foodId first, then brandFoodId.
export function plantsForEntry(entry) {
  if (!entry) return [];
  if (entry.foodId && PLANT_TAGS[entry.foodId])      return PLANT_TAGS[entry.foodId];
  if (entry.brandFoodId && PLANT_TAGS[entry.brandFoodId]) return PLANT_TAGS[entry.brandFoodId];
  return entry.manualPlants || [];   // user-added free-form plants
}

// Aggregates the unique set of plants across a list of entries
// (typically the last 7 days). Returns { plants: ['oats','banana',...],
// byPlant: { 'oats': 3, 'banana': 1 } } where the count is how many
// times the plant appeared (not weight — frequency).
export function aggregatePlants(entries) {
  const byPlant = {};
  for (const e of entries) {
    for (const p of plantsForEntry(e)) {
      byPlant[p] = (byPlant[p] || 0) + 1;
    }
  }
  const plants = Object.keys(byPlant).sort((a, b) => byPlant[b] - byPlant[a] || a.localeCompare(b));
  return { plants, byPlant };
}
