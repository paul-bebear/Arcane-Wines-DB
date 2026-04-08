// ─────────────────────────────────────────────────────────────────────────────
// Local Natural Language Query Parser
//
// Converts plain-text questions → PostgREST filter arrays.
// No API call required — runs entirely client-side in ~0ms.
//
// Supported concepts (EN + IT):
//   Wine type · Price range · Vintage · Region · Grape variety
//   In-stock · Reserved list · Takeaway · Producer (heuristic)
//   Table routing (wine_catalog / btg_margin_analysis / inventory_movements)
//   Sort order
// ─────────────────────────────────────────────────────────────────────────────

// ── REGION MAP ─────────────────────────────────────────────────────────────
// { canonical DB value → [keyword aliases] }
// More specific entries first to avoid substring collisions.
const REGION_MAP = [
  ["Alto Adige",        ["alto adige", "südtirol", "sudtirol"]],
  ["Friuli",            ["friuli", "fvg"]],
  ["Emilia-Romagna",    ["emilia romagna", "emilia-romagna", "emilia"]],
  ["Piemonte",          ["piemonte", "piedmont", "piémont"]],
  ["Toscana",           ["toscana", "tuscany"]],
  ["Veneto",            ["veneto"]],
  ["Sicilia",           ["sicilia", "sicily"]],
  ["Sardegna",          ["sardegna", "sardinia"]],
  ["Campania",          ["campania"]],
  ["Lombardia",         ["lombardia", "lombardy"]],
  ["Trentino",          ["trentino"]],
  ["Umbria",            ["umbria"]],
  ["Lazio",             ["lazio"]],
  ["Puglia",            ["puglia", "apulia"]],
  ["Calabria",          ["calabria"]],
  ["Basilicata",        ["basilicata"]],
  ["Abruzzo",           ["abruzzo"]],
  ["Marche",            ["marche"]],
  ["Liguria",           ["liguria"]],
  ["Bourgogne",         ["borgogna", "bourgogne", "burgundy"]],
  ["Bordeaux",          ["bordeaux"]],
  ["Champagne",         ["champagne region", "from champagne"]],
  ["Alsace",            ["alsace", "alsazia"]],
  ["Rhône",             ["rhone", "rhône"]],
  ["Loire",             ["loire"]],
  ["Provence",          ["provence", "provenza"]],
  ["Rioja",             ["rioja"]],
  ["Ribera del Duero",  ["ribera del duero", "ribera"]],
  ["Priorat",           ["priorat", "priorato"]],
  ["Galicia",           ["galicia", "galizia"]],
  ["Mosel",             ["mosel", "mosella"]],
  ["Rheingau",          ["rheingau"]],
  ["Douro",             ["douro"]],
  ["Alentejo",          ["alentejo"]],
  ["Barossa",           ["barossa"]],
  ["Napa",              ["napa valley", "napa"]],
  ["Sonoma",            ["sonoma"]],
  ["Willamette",        ["willamette"]],
];

// ── GRAPE MAP ──────────────────────────────────────────────────────────────
const GRAPE_MAP = [
  // Italian reds
  ["Nebbiolo",           ["nebbiolo"]],
  ["Sangiovese",         ["sangiovese"]],
  ["Barbera",            ["barbera"]],
  ["Dolcetto",           ["dolcetto"]],
  ["Montepulciano",      ["montepulciano"]],
  ["Primitivo",          ["primitivo"]],
  ["Nero d'Avola",       ["nero d'avola", "nero davola"]],
  ["Nerello Mascalese",  ["nerello"]],
  ["Aglianico",          ["aglianico"]],
  ["Corvina",            ["corvina"]],
  ["Cannonau",           ["cannonau"]],
  ["Lagrein",            ["lagrein"]],
  ["Schiava",            ["schiava", "vernatsch"]],
  // Italian whites
  ["Vermentino",         ["vermentino"]],
  ["Fiano",              ["fiano"]],
  ["Greco",              ["greco di tufo", "greco"]],
  ["Falanghina",         ["falanghina"]],
  ["Garganega",          ["garganega"]],
  ["Trebbiano",          ["trebbiano"]],
  ["Arneis",             ["arneis"]],
  ["Timorasso",          ["timorasso"]],
  ["Pinot Grigio",       ["pinot grigio", "pinot gris"]],
  ["Gewürztraminer",     ["gewurztraminer", "gewürztraminer", "traminer"]],
  // International reds
  ["Pinot Noir",         ["pinot noir", "pinot nero"]],
  ["Cabernet Sauvignon", ["cabernet sauvignon", "cabernet"]],
  ["Merlot",             ["merlot"]],
  ["Syrah",              ["syrah", "shiraz"]],
  ["Mourvèdre",          ["mourvèdre", "mourvedre", "monastrell"]],
  ["Malbec",             ["malbec"]],
  ["Tempranillo",        ["tempranillo"]],
  ["Touriga Nacional",   ["touriga"]],
  ["Zinfandel",          ["zinfandel", "zin"]],
  ["Grenache",           ["grenache", "garnacha"]],
  // International whites
  ["Chardonnay",         ["chardonnay"]],
  ["Sauvignon Blanc",    ["sauvignon blanc", "sauvignon"]],
  ["Riesling",           ["riesling"]],
  ["Chenin Blanc",       ["chenin blanc", "chenin"]],
  ["Viognier",           ["viognier"]],
  ["Grüner Veltliner",   ["grüner veltliner", "grüner", "gruner"]],
  ["Albariño",           ["albarino", "albariño", "alvarinho"]],
];

// ── CHIP LABELS ────────────────────────────────────────────────────────────
// Maps filter string prefixes → human-readable chip label function
const CHIP_LABEL_MAP = [
  ["wine_type=in.",           (v) => `Type: ${v.replace(/[()]/g, "").split(",")[0]}`],
  ["wine_type=eq.",           (v) => `Type: ${v}`],
  ["table_price=lte.",        (v) => `Max €${v}`],
  ["table_price=gte.",        (v) => `Min €${v}`],
  ["vintage=eq.",             (v) => `Vintage: ${v}`],
  ["bottle_count=gt.0",       ()  => "In stock"],
  ["reserved_list=eq.true",   ()  => "Reserved"],
  ["takeaway_available=eq.true", () => "Takeaway"],
  ["region_name=ilike.*",     (v) => `Region: ${v.replace(/\*/g, "")}`],
  ["grapes=ilike.*",          (v) => `Grape: ${v.replace(/\*/g, "")}`],
  ["producer_name=ilike.*",   (v) => `Producer: ${v.replace(/\*/g, "")}`],
];

const ORDER_LABELS = {
  "table_price.asc":  "↑ Price",
  "table_price.desc": "↓ Price",
  "vintage.asc":      "↑ Vintage",
  "vintage.desc":     "↓ Vintage",
  "wine_name.asc":    "A–Z",
};

/** Converts raw filter array + order string → human-readable chip labels */
export function buildChips(filters = [], order) {
  const chips = [];
  for (const f of filters) {
    for (const [prefix, fn] of CHIP_LABEL_MAP) {
      if (f === prefix || f.startsWith(prefix)) {
        chips.push(fn(f.slice(prefix.length)));
        break;
      }
    }
  }
  if (order && ORDER_LABELS[order]) chips.push(ORDER_LABELS[order]);
  return chips;
}

/**
 * Parse a natural-language wine query into a PostgREST-compatible query object.
 *
 * @param {string} input - Raw user query (EN or IT)
 * @returns {{ table, select, filters, order, limit, _chips }}
 */
export function parseNLQuery(input) {
  const text = input.toLowerCase().trim();
  const filters = [];
  let table = "wine_catalog";
  let order = null;
  let regionFound = false;

  // ── TABLE ROUTING ────────────────────────────────────────────────────────
  if (/\b(movement|moviment|restock|acquisto)\b/.test(text)) {
    table = "inventory_movements";
  } else if (/\b(btg|by the glass|al calice|margin|margine)\b/.test(text)) {
    table = "btg_margin_analysis";
  }

  // ── WINE TYPE ────────────────────────────────────────────────────────────
  // Supports both full names (Rosso/Bianco/…) and single-letter codes (R/W/S/O/D/P/C)
  // depending on how the Supabase view exposes wine_type.
  // Champagne the beverage = Bollicine/S, unless user says "from Champagne" (region).
  if (/\bchampagne\b/.test(text) && !/\bfrom champagne\b|\bchampagne region\b/.test(text)) {
    filters.push("wine_type=in.(Bollicine,S)");
  } else {
    // Map: [full-name, letter-code, keywords...]
    const TYPE_MAP = [
      ["Rosso",       "R", ["rosso", "red", "rouge", "tinto"]],
      ["Bianco",      "W", ["bianco", "white", "blanc", "blanco"]],
      ["Rosato",      null, ["rosato", "rosé", "rose", "rosado"]],
      ["Bollicine",   "S", ["bollicine", "sparkling", "spumante", "prosecco",
                            "cava", "crémant", "cremant", "fizz", "bubbly", "pétillant", "petillant"]],
      ["Orange",      "O", ["orange wine", "vino arancione", "skin contact",
                            "macerato", "macerated", "ramato", "orange"]],
      ["Dolce",       "D", ["dolce", "dessert", "sweet", "beerenauslese",
                            "trockenbeerenauslese", "sauternes", "eiswein"]],
      ["Passito",     "P", ["passito", "appassimento", "recioto", "amarone"]],
      ["Birra/Cidre",   "C",   ["birra", "beer", "cidre", "cider", "gueuze",
                                "lambic", "kriek", "saison"]],
      ["Zero Alcohol",  null,  ["zero alcohol", "analcolico", "non-alcoholic",
                                "alcohol free", "alcohol-free", "dealcoolizzato",
                                "senza alcol", "0%"]],
    ];
    for (const [fullName, code, kws] of TYPE_MAP) {
      if (kws.some((k) => text.includes(k))) {
        // Use IN so it works whether the view stores the letter or the full name
        const inList = code ? `(${fullName},${code})` : `(${fullName})`;
        filters.push(`wine_type=in.${inList}`);
        break;
      }
    }
  }

  // ── PRICE RANGE ──────────────────────────────────────────────────────────
  const betweenMatch = text.match(
    /between\s*[€$]?\s*(\d+)\s*(?:and|e|a|-)\s*[€$]?\s*(\d+)/i
  );
  if (betweenMatch) {
    filters.push(`table_price=gte.${betweenMatch[1]}`);
    filters.push(`table_price=lte.${betweenMatch[2]}`);
  } else {
    const ceilMatch = text.match(
      /(?:under|below|less\s+than|max|sotto|meno\s+di|fino\s+a|entro|cheaper\s+than|<)\s*[€$]?\s*(\d+)/i
    );
    if (ceilMatch) filters.push(`table_price=lte.${ceilMatch[1]}`);

    const floorMatch = text.match(
      /(?:over|above|more\s+than|oltre|più\s+di|almeno|at\s+least|>)\s*[€$]?\s*(\d+)/i
    );
    if (floorMatch) filters.push(`table_price=gte.${floorMatch[1]}`);
  }

  // ── VINTAGE ──────────────────────────────────────────────────────────────
  const vintageMatch = text.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  if (vintageMatch) filters.push(`vintage=eq.${vintageMatch[1]}`);

  // ── FLAGS ────────────────────────────────────────────────────────────────
  if (/\b(in stock|available|disponibil|giacenza|stock)\b/.test(text))
    filters.push("bottle_count=gt.0");

  if (/\b(reserved|riservat|lista riservata|special list)\b/.test(text))
    filters.push("reserved_list=eq.true");

  if (/\b(takeaway|take.?away|asporto|to go|take home)\b/.test(text))
    filters.push("takeaway_available=eq.true");

  // ── REGIONS ──────────────────────────────────────────────────────────────
  for (const [canonical, kws] of REGION_MAP) {
    if (kws.some((k) => text.includes(k))) {
      filters.push(`region_name=ilike.*${canonical}*`);
      regionFound = true;
      break;
    }
  }

  // ── GRAPE VARIETIES ──────────────────────────────────────────────────────
  for (const [canonical, kws] of GRAPE_MAP) {
    if (kws.some((k) => text.includes(k))) {
      filters.push(`grapes=ilike.*${canonical}*`);
      break;
    }
  }

  // ── PRODUCER HEURISTIC ───────────────────────────────────────────────────
  // Only fires if a region wasn't already parsed from the same "from/by/da" clause
  if (!regionFound) {
    const producerMatch = text.match(
      /(?:by|di|da|from|produttore|producer|winery|cantina)\s+([a-zà-ü][a-zà-ü'\s]{2,30}?)(?=\s+(?:wine|vino|red|white|rosso|bianco|from|in|under|over|sotto|€|\d)|$)/i
    );
    if (producerMatch) {
      const p = producerMatch[1].trim();
      if (p.length > 2) filters.push(`producer_name=ilike.*${p}*`);
    }
  }

  // ── SORT ORDER ───────────────────────────────────────────────────────────
  if (/\b(cheap|economico|affordable|cheapest|lowest price|price asc)\b/.test(text)) {
    order = "table_price.asc";
  } else if (/\b(expensive|costoso|luxury|priciest|highest price|most expensive)\b/.test(text)) {
    order = "table_price.desc";
  } else if (/\b(newest|recent|latest|youngest|annata recente)\b/.test(text)) {
    order = "vintage.desc";
  } else if (/\b(oldest|oldest vintage|annata vecchia)\b/.test(text)) {
    order = "vintage.asc";
  } else if (/\b(alphabetical|a-z|by name)\b/.test(text)) {
    order = "wine_name.asc";
  }

  return {
    table,
    select: "*",
    filters: filters.length > 0 ? filters : undefined,
    order: order || undefined,
    limit: "50",
    _chips: buildChips(filters, order),
  };
}
