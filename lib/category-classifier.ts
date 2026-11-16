/**
 * Deterministic Ad Category Classifier
 * Production classification engine for AdsHunting catalog enrichment and runtime categorization.
 * 
 * Rules:
 * 1. Strict keyword boundary matching.
 * 2. Explicit negative term exclusions (e.g. "game changer", "skin game", "lust game", "slim fit").
 * 3. Provenance and confidence scoring (0.0 - 1.0).
 * 4. Honest "Unknown" assignment when evidence is ambiguous or weak.
 */

export interface CategoryClassificationResult {
  category: string;
  nicheId: string;
  confidence: number;
  provenance: "curated" | "brand_rule" | "url_rule" | "headline_rule" | "body_rule" | "unclassified";
}

export interface AdClassificationInput {
  advertiserName?: string | null;
  headline?: string | null;
  body?: string | null;
  landingPageUrl?: string | null;
  existingCategory?: string | null;
}

interface ClassificationRule {
  category: string;
  nicheId: string;
  brandMatches: RegExp[];
  strongTerms: RegExp[];
  urlMatches: RegExp[];
  negativeTerms: RegExp[];
}

// Invalid legacy maturity badges that were incorrectly placed into category fields
const LEGACY_MATURITY_BADGES = new Set([
  "testing",
  "proven long runner",
  "high-confidence winner",
  "standard",
  "emerging winner",
  "unknown",
]);

export function isValidCuratedCategory(category?: string | null): boolean {
  if (!category || typeof category !== "string") return false;
  const trimmed = category.trim().toLowerCase();
  if (trimmed === "" || LEGACY_MATURITY_BADGES.has(trimmed)) return false;
  return true;
}

const RULES: ClassificationRule[] = [
  {
    category: "Gaming",
    nicheId: "gaming",
    brandMatches: [
      /\blegacy of lithas\b/i,
      /\brazer\b/i,
      /\blogitech g\b/i,
      /\bplaystation\b/i,
      /\bxbox\b/i,
      /\bnintendo\b/i,
      /\bepic games\b/i,
      /\bblizzard entertainment\b/i,
      /\briot games\b/i,
    ],
    strongTerms: [
      /\bgaming controller\b/i,
      /\bgaming console\b/i,
      /\bvideo game[s]?\b/i,
      /\bpc gaming\b/i,
      /\bgaming headset\b/i,
      /\bgaming mouse\b/i,
      /\bgaming keyboard\b/i,
      /\brpg game\b/i,
      /\besports\b/i,
      /\bmobile game\b/i,
      /\bgaming accessories\b/i,
      /\bplay-to-earn\b/i,
      /\bgameplay\b/i,
      /\bgaming gear\b/i,
    ],
    urlMatches: [
      /play\.google\.com\/store\/apps\/details\?id=.*(?:game|rpg|gaming)/i,
      /itunes\.apple\.com\/app\/id1611276680/i,
    ],
    negativeTerms: [
      /\bskin game\b/i,
      /\blust game\b/i,
      /\bgame changer\b/i,
      /\bname of the game\b/i,
      /\bseduce\b/i,
      /\bdramabox\b/i,
      /\breelshort\b/i,
      /\bshortmax\b/i,
      /\bmind games\b/i,
    ],
  },
  {
    category: "Fitness",
    nicheId: "fitness",
    brandMatches: [
      /\bcrossfit\b/i,
      /\bgymshark\b/i,
      /\bpeloton\b/i,
      /\baumnie\b/i,
    ],
    strongTerms: [
      /\bworkout\b/i,
      /\bgym\b/i,
      /\bexercise equipment\b/i,
      /\brunning shoes\b/i,
      /\btreadmill\b/i,
      /\bdumbbells\b/i,
      /\byoga mat\b/i,
      /\bcrossfit\b/i,
      /\bpilates\b/i,
      /\bfitness tracker\b/i,
      /\bactivewear\b/i,
      /\bdri-fit\b/i,
      /\bworkout program[s]?\b/i,
      /\bgym gear\b/i,
    ],
    urlMatches: [
      /\/sport\/running/i,
      /\/fitness/i,
      /\/workout/i,
      /\/gym\b/i,
    ],
    negativeTerms: [
      /\bslim fit\b/i,
      /\brelaxed fit\b/i,
      /\bloose fit\b/i,
      /\bperfect fit\b/i,
      /\bcustom fit\b/i,
      /\bgreat fit\b/i,
      /\bfit into\b/i,
      /\brunning ads\b/i,
      /\brunning days\b/i,
    ],
  },
  {
    category: "Beauty & Skincare",
    nicheId: "beauty-skincare",
    brandMatches: [
      /\bfoxtale\b/i,
      /\blets hyphen\b/i,
      /\btreatwell\b/i,
      /\bmaybelline\b/i,
      /\bloreal\b/i,
      /\bsephora\b/i,
      /\bcerave\b/i,
      /\bthe ordinary\b/i,
      /\bclinique\b/i,
      /\bkylie cosmetics\b/i,
    ],
    strongTerms: [
      /\bskincare\b/i,
      /\bmoisturizer\b/i,
      /\bsunscreen\b/i,
      /\bserum[s]?\b/i,
      /\bcleanser\b/i,
      /\bcosmetics\b/i,
      /\blipstick\b/i,
      /\bmakeup\b/i,
      /\banti-aging\b/i,
      /\bface wash\b/i,
      /\bniacinamide\b/i,
      /\bhyaluronic acid\b/i,
      /\bretinol\b/i,
      /\bspf 50\b/i,
      /\btoner\b/i,
      /\bskin game\b/i,
      /\bpigmentation\b/i,
    ],
    urlMatches: [
      /\/skincare/i,
      /\/products\/.*sunscreen/i,
      /\/pigmentation-range/i,
      /\/cosmetics/i,
      /treatwell\.co/i,
    ],
    negativeTerms: [],
  },
  {
    category: "Apparel & Fashion",
    nicheId: "apparel-fashion",
    brandMatches: [
      /\bnike\b/i,
      /\badidas\b/i,
      /\basos\b/i,
      /\bfoot locker\b/i,
      /\bbare wear\b/i,
      /\bshoes on clearance deals\b/i,
      /\bflo\b/i,
      /\breality racing co\b/i,
      /\bshein\b/i,
      /\bzara\b/i,
      /\bh&m\b/i,
      /\bamazon fashion\b/i,
    ],
    strongTerms: [
      /\bshoes\b/i,
      /\bt-shirt[s]?\b/i,
      /\bclothing\b/i,
      /\bapparel\b/i,
      /\bdress(?:es)?\b/i,
      /\boutfit[s]?\b/i,
      /\bsneakers\b/i,
      /\bhoodie[s]?\b/i,
      /\bjacket[s]?\b/i,
      /\bpants\b/i,
      /\bjeans\b/i,
      /\bwomenswear\b/i,
      /\bmenswear\b/i,
      /\bfootwear\b/i,
      /\bbraless\b/i,
      /\bnipple pasties\b/i,
      /\bswimwear\b/i,
      /\bsandals\b/i,
      /\bterlik\b/i,
    ],
    urlMatches: [
      /\/collections\/all/i,
      /\/clothing/i,
      /\/fashion/i,
      /\/shoes/i,
      /\/apparel/i,
      /\/senna-signature-helmet-tee/i,
      /barewear\.in/i,
    ],
    negativeTerms: [],
  },
  {
    category: "Health & Wellness",
    nicheId: "health-wellness",
    brandMatches: [
      /\bfrido\b/i,
      /\bmyfrido\b/i,
      /\bthe blood pressure journal\b/i,
      /\bmasster plus\b/i,
    ],
    strongTerms: [
      /\bornthotics\b/i,
      /\binsoles\b/i,
      /\bfoot pain\b/i,
      /\bblood pressure\b/i,
      /\bposture corrector\b/i,
      /\borthopedic\b/i,
      /\bergonomics\b/i,
      /\bpain relief\b/i,
      /\bwellness tracker\b/i,
    ],
    urlMatches: [
      /myfrido\.me/i,
      /\/health/i,
      /\/wellness/i,
    ],
    negativeTerms: [],
  },
  {
    category: "Supplements",
    nicheId: "supplements",
    brandMatches: [
      /\bnutraholic\b/i,
      /\bnutritienda\b/i,
      /\bmyprotein\b/i,
      /\bgnc\b/i,
      /\bvetain\b/i,
    ],
    strongTerms: [
      /\bcreatine\b/i,
      /\bwhey protein\b/i,
      /\bmultivitamin[s]?\b/i,
      /\bsupplement[s]?\b/i,
      /\bdietary supplement\b/i,
      /\bomega 3\b/i,
      /\bcollagen peptides\b/i,
      /συμπληρώματα/i,
      /κρεατίνη/i,
    ],
    urlMatches: [
      /\/supplements/i,
      /\/productpromo\/box/i,
      /nutraholic\.com/i,
    ],
    negativeTerms: [],
  },
  {
    category: "Food & Beverage",
    nicheId: "food-beverage",
    brandMatches: [
      /\bbud france\b/i,
      /\bbudweiser\b/i,
      /\bcoca-cola\b/i,
      /\bpepsi\b/i,
      /\bfreedent france\b/i,
      /\bnespresso\b/i,
      /\bstarbucks\b/i,
      /\bzomato\b/i,
      /\buber eats\b/i,
    ],
    strongTerms: [
      /\bbeer\b/i,
      /\bbière\b/i,
      /\bwine\b/i,
      /\bcoffee\b/i,
      /\btea\b/i,
      /\bsnack[s]?\b/i,
      /\bbeverage[s]?\b/i,
      /\bdrinks\b/i,
      /\bchocolate\b/i,
      /\bpizza\b/i,
      /\bburger\b/i,
      /\bbrewery\b/i,
      /\bchewing gum\b/i,
    ],
    urlMatches: [
      /bud\.fr/i,
      /\/food/i,
      /\/beverage/i,
    ],
    negativeTerms: [],
  },
  {
    category: "Home & Furniture",
    nicheId: "home-furniture",
    brandMatches: [
      /\blayerstory\b/i,
      /\brentomojo\b/i,
      /\bikea\b/i,
      /\bwayfair\b/i,
      /\bjohn lewis & partners\b/i,
    ],
    strongTerms: [
      /\bfurniture\b/i,
      /\blamp[s]?\b/i,
      /\bdesk calendar\b/i,
      /\bsofa[s]?\b/i,
      /\bmattress(?:es)?\b/i,
      /\bdining table\b/i,
      /\bbedding\b/i,
      /\bcushion[s]?\b/i,
      /\bhome decor\b/i,
      /\bstudio lamp\b/i,
      /\blighting\b/i,
    ],
    urlMatches: [
      /layerstory\.com/i,
      /\/studio-lamps/i,
      /\/products\/flipframe/i,
    ],
    negativeTerms: [],
  },
  {
    category: "Consumer Electronics",
    nicheId: "consumer-electronics",
    brandMatches: [
      /\blenovo\b/i,
      /\bapple\b/i,
      /\bsamsung\b/i,
      /\bsony\b/i,
      /\bdell\b/i,
      /\bhp\b/i,
    ],
    strongTerms: [
      /\blaptop[s]?\b/i,
      /\bsmartphone[s]?\b/i,
      /\bsmartwatch(?:es)?\b/i,
      /\bwireless earbuds\b/i,
      /\bheadphones\b/i,
      /\bbluetooth speaker\b/i,
      /\btablet[s]?\b/i,
      /\bmonitor[s]?\b/i,
    ],
    urlMatches: [
      /lenovo\.com/i,
    ],
    negativeTerms: [],
  },
  {
    category: "SaaS",
    nicheId: "saas",
    brandMatches: [
      /\bshopify\b/i,
      /\bhubspot\b/i,
      /\bslack\b/i,
      /\bsalesforce\b/i,
      /\bnotion\b/i,
      /\bstripe\b/i,
    ],
    strongTerms: [
      /\bsoftware\b/i,
      /\bcrm\b/i,
      /\bfree trial\b/i,
      /\bb2b software\b/i,
      /\bcloud platform\b/i,
      /\banalytics platform\b/i,
      /\bapi\b/i,
      /\bdashboard\b/i,
      /\bautomate your workflow\b/i,
      /\bvendez gratuitement sur shopify\b/i,
    ],
    urlMatches: [
      /shopify\.com/i,
    ],
    negativeTerms: [],
  },
  {
    category: "Travel & Hospitality",
    nicheId: "travel-hospitality",
    brandMatches: [
      /\bbooking\.com\b/i,
      /\bairbnb\b/i,
      /\bexpedia\b/i,
      /\btripadvisor\b/i,
    ],
    strongTerms: [
      /\bhotel[s]?\b/i,
      /\bflights\b/i,
      /\bvacation\b/i,
      /\bresort[s]?\b/i,
      /\bbooking\b/i,
      /\btravel guide\b/i,
      /\bairline[s]?\b/i,
    ],
    urlMatches: [
      /booking\.com/i,
    ],
    negativeTerms: [],
  },
  {
    category: "Media & Entertainment",
    nicheId: "media-entertainment",
    brandMatches: [
      /\bdramabox\b/i,
      /\breelshort\b/i,
      /\bnetflix\b/i,
      /\bshortmax\b/i,
      /\bne-yo\b/i,
      /\breel dramas\b/i,
    ],
    strongTerms: [
      /\bstreaming\b/i,
      /\bmovies\b/i,
      /\bepisodes\b/i,
      /\bweb series\b/i,
      /\bdrama series\b/i,
      /\breels\b/i,
      /\bcinema\b/i,
      /\bconcert\b/i,
      /\btour\b/i,
    ],
    urlMatches: [
      /dramabox\.com/i,
      /story\.tv\.drama\.reels/i,
    ],
    negativeTerms: [],
  },
  {
    category: "Education",
    nicheId: "education",
    brandMatches: [
      /\bdomestika\b/i,
      /\bcoursera\b/i,
      /\budemy\b/i,
      /\bskillshare\b/i,
    ],
    strongTerms: [
      /\bonline course[s]?\b/i,
      /\blearn to\b/i,
      /\bmasterclass\b/i,
      /\bcertification\b/i,
      /\bstudy\b/i,
      /\bbootcamp\b/i,
    ],
    urlMatches: [
      /domestika\.org/i,
      /coursera\.org/i,
    ],
    negativeTerms: [],
  },
  {
    category: "E-commerce",
    nicheId: "e-commerce",
    brandMatches: [
      /\bwhatnot\b/i,
      /\bshopee\b/i,
      /\bwalmart\b/i,
      /\bamazon\.com\b/i,
      /\bdepop\b/i,
      /\bflipkart\b/i,
      /\bcdiscount\b/i,
      /\bharbor freight\b/i,
    ],
    strongTerms: [
      /\bmarketplace\b/i,
      /\bauction[s]?\b/i,
      /\bonline shopping\b/i,
    ],
    urlMatches: [
      /whatnot\.com/i,
      /itunes\.apple\.com\/app\/id1488269261/i,
      /shopee/i,
      /walmart\.com/i,
      /depop\.com/i,
      /flipkart\.com/i,
    ],
    negativeTerms: [],
  },
  {
    category: "Fintech",
    nicheId: "fintech",
    brandMatches: [
      /\bbybit\b/i,
      /\bbinance\b/i,
      /\bcoinbase\b/i,
      /\brobinhood\b/i,
      /\bpaypal\b/i,
    ],
    strongTerms: [
      /\bcrypto\b/i,
      /\btrading platform\b/i,
      /\binvestment[s]?\b/i,
      /\bstock trading\b/i,
      /\bcredit card\b/i,
    ],
    urlMatches: [
      /bybit\.com/i,
      /binance\.com/i,
    ],
    negativeTerms: [],
  },
  {
    category: "Apps & Software",
    nicheId: "apps-software",
    brandMatches: [
      /\bicontrol: easy widgets themes\b/i,
      /\bfocusos launcher\b/i,
    ],
    strongTerms: [
      /\blauncher\b/i,
      /\bwidgets themes\b/i,
      /\bmobile app\b/i,
      /\bkeyboard app\b/i,
    ],
    urlMatches: [
      /com\.oslauncher\.focus/i,
    ],
    negativeTerms: [],
  },
];

export function classifyAdCategory(input: AdClassificationInput): CategoryClassificationResult {
  // If an ad already has a verified, curated category that is not a legacy maturity badge, preserve it
  if (isValidCuratedCategory(input.existingCategory)) {
    const matchedRule = RULES.find(
      (r) => r.category.toLowerCase() === input.existingCategory!.trim().toLowerCase()
    );
    return {
      category: input.existingCategory!.trim(),
      nicheId: matchedRule ? matchedRule.nicheId : "other",
      confidence: 1.0,
      provenance: "curated",
    };
  }

  const adv = (input.advertiserName || "").trim();
  const h = (input.headline || "").trim();
  const b = (input.body || "").trim();
  const u = (input.landingPageUrl || "").trim();
  const fullText = `${adv} ${h} ${b}`.toLowerCase();

  for (const rule of RULES) {
    // 1. Check negative terms to prevent false positives
    if (rule.negativeTerms.some((re) => re.test(fullText) || (u && re.test(u)))) {
      continue;
    }

    // 2. High-confidence brand match
    if (adv && rule.brandMatches.some((re) => re.test(adv))) {
      return {
        category: rule.category,
        nicheId: rule.nicheId,
        confidence: 0.95,
        provenance: "brand_rule",
      };
    }

    // 3. High-confidence URL structure match
    if (u && rule.urlMatches.some((re) => re.test(u))) {
      return {
        category: rule.category,
        nicheId: rule.nicheId,
        confidence: 0.90,
        provenance: "url_rule",
      };
    }

    // 4. Headline match (prominent marketing signal)
    if (h && rule.strongTerms.some((re) => re.test(h))) {
      return {
        category: rule.category,
        nicheId: rule.nicheId,
        confidence: 0.85,
        provenance: "headline_rule",
      };
    }

    // 5. Body match with word boundary
    if (b && rule.strongTerms.some((re) => re.test(b))) {
      return {
        category: rule.category,
        nicheId: rule.nicheId,
        confidence: 0.75,
        provenance: "body_rule",
      };
    }
  }

  // 6. Unknown fallback for ambiguous or weak matches
  return {
    category: "Unknown",
    nicheId: "unknown",
    confidence: 0,
    provenance: "unclassified",
  };
}
