import json
import re
import httpx
from typing import Dict, Any, List, Optional, Tuple
from ..db.session import get_connection
from .massive_thesaurus import MASSIVE_VEHICLE_DATABASE, get_thesaurus_matches

RULES_SETTINGS_KEY = "classifier_rules"

# Comprehensive Curated Technical, Military & Stormworks Vehicle Thesaurus
# Contains real-world vehicle classes, military designations, slang and popular vehicle models
DOMAIN_THESAURUS = {
    "helicopter": [
        "chopper", "helo", "rotorcraft", "whirlybird", "copter",
        # Iconic models & series
        "blackhawk", "uh-60", "sh-60", "mh-60", "chinook", "ch-47", "apache", "ah-64",
        "huey", "uh-1", "iroquois", "hind", "mi-24", "mi-8", "mi-17", "mi-28", "havoc",
        "ka-50", "ka-52", "alligator", "hokum", "cobra", "ah-1", "viper", "venom", "uh-1y",
        "sea king", "wildcat", "lynx", "merlin", "aw101", "ec135", "ec145", "nh90", "super stallion", "ch-53",
        "stallion", "king stallion", "skycrane", "tarhe", "s-64", "s64", "ch-54"
    ],
    "plane": [
        "airplane", "aircraft", "aeroplane", "airliner", "biplane", "monoplane",
        "fighter jet", "interceptor", "bomber", "bushplane", "taildragger", "cargo plane",
        # Iconic models & series
        "c-130", "hercules", "spitfire", "mustang", "p-51", "bf-109", "zero",
        "f-16", "fighting falcon", "f-15", "eagle", "f-18", "hornet", "f-22", "raptor",
        "f-35", "lightning", "f-14", "tomcat", "a-10", "warthog", "thunderbolt", "su-27", "su-30", "su-35", "su-57",
        "mig-21", "mig-29", "b-52", "stratofortress", "b-1b", "b-2", "spirit", "concorde", "cessna", "piper"
    ],
    "tiltrotor": [
        "tilt rotor", "tilt-rotor", "tiltwing", "tilt-wing",
        # Models
        "v-22", "osprey", "v-280", "valor", "aw609", "bell boeing", "cl-84", "xc-142"
    ],
    "vtol": [
        "stovl", "vertical takeoff", "jump jet",
        # Models
        "harrier", "av-8b", "sea harrier", "f-35b", "yak-38", "yak-141", "do 31"
    ],
    "seaplane": [
        "flying boat", "floatplane", "amphibian aircraft", "amphibious plane",
        # Models
        "catalina", "pby", "be-200", "altair", "cl-415", "shinmaywa us-2", "grumman goose", "albatross"
    ],
    "underwater": [
        "submarine", "sub", "submersible", "u-boat", "uboat", "ballistic sub", "attack submarine", "underwater craft",
        # Classes & models
        "typhoon class", "akula", "los angeles class", "virginia class", "seawolf", "ohio class",
        "kilo class", "borei class", "astute class", "vanguard class", "type vii", "type xxi"
    ],
    "rib": [
        "rhib", "rigid inflatable", "rigid hull inflatable", "zodiac boat", "inflatable boat",
        "assault boat", "crrc", "combat rubber raiding craft"
    ],
    "small boat": [
        "skiff", "dinghy", "speedboat", "single deck", "tender boat", "runabout", "dory", "jon boat", "rowboat"
    ],
    "medium boat": [
        "patrol boat", "cutter", "workboat", "crew boat", "tender", "patrol craft", "fast patrol boat",
        "damen", "stan patrol", "4207", "pilot boat", "harbor patrol"
    ],
    "large boat": [
        "corvette", "frigate", "destroyer", "cruiser", "large vessel", "bulk carrier", "opv",
        "offshore patrol vessel", "arleigh burke", "ticonderoga", "type 055", "type 23", "type 26", "sovremenny"
    ],
    "huge boat": [
        "ocean liner", "aircraft carrier", "supertanker", "container ship", "dreadnought", "battleship",
        "nimitz", "gerald ford", "queen elizabeth", "kuznetsov", "yamato", "bismarck", "iowa class", "panamax", "triple-e"
    ],
    "tank": [
        "mbt", "main battle tank", "panzer", "armored tank", "tracked armor",
        # Models
        "abrams", "m1a1", "m1a2", "leopard 2", "leopard", "t-72", "t-80", "t-90", "t-64", "t-55",
        "challenger 2", "challenger", "leclerc", "k2 black panther", "merkava", "type 99", "tiger tank", "sherman", "t-34"
    ],
    "armored_vehicle": [
        "apc", "ifv", "afv", "armored car", "spg", "infantry fighting vehicle", "personnel carrier",
        # Models
        "bradley", "m2 bradley", "bmp", "bmp-1", "bmp-2", "bmp-3", "btr", "btr-80", "btr-82", "stryker",
        "m113", "boxer", "patria amv", "warrior", "marder", "puma", "cv90", "fennek", "lav-25"
    ],
    "truck": [
        "lorry", "hauler", "semi truck", "flatbed truck", "dump truck", "tractor unit", "semi-tractor",
        # Models & makers
        "scania", "volvo fh", "actros", "mercedes actros", "man tgx", "peterbilt", "kenworth", "freightliner", "mack", "iveco", "kamaz", "kraz", "jelcz"
    ],
    "offroad_truck": [
        "all-terrain truck", "6x6 truck", "8x8 truck", "4x4 truck", "unimog", "heavy hauler",
        # Models
        "ural", "kamaz 6x6", "tatra", "hemtt", "oshkosh", "man kat", "kraz 255", "zil-131", "gaz-66"
    ],
    "pickup": [
        "pick-up", "ute", "utility vehicle", "light truck",
        # Models
        "ford f-150", "f-250", "f-350", "raptor", "silverado", "chevy c10", "ram 1500", "dodge ram", "toyota hilux", "hilux", "tacoma", "tundra", "ford ranger", "ranger"
    ],
    "passenger_car": [
        "sedan", "coupe", "hatchback", "wagon", "roadster", "supercar", "hypercar",
        # Models & makes
        "bmw", "mercedes", "audi", "porsche", "911", "ferrari", "lamborghini", "corvette", "mustang", "miata", "civic", "golf"
    ],
    "suv": [
        "crossover", "sport utility vehicle", "4x4 suv",
        # Models
        "land cruiser", "range rover", "defender", "land rover", "nissan patrol", "g-wagon", "g-class", "tahoe", "suburban", "cherokee"
    ],
    "offroad_car": [
        "rock crawler", "trophy truck", "mudder", "trail rig", "4x4 crawler", "pre-runner", "prerunner",
        # Models
        "wrangler", "jeep", "humvee", "hmmwv", "hummer h1", "bronco", "jimny", "suzuki samurai", "lada niva"
    ],
    "atv": [
        "quad", "quad bike", "utv", "sxs", "side-by-side", "side by side", "all-terrain vehicle",
        # Models & makers
        "polaris", "rzr", "can-am", "maverick", "yamaha yxz", "honda talon", "kawasaki mule", "arctic cat"
    ],
    "hovercraft": [
        "acv", "air cushion vehicle", "hover craft", "skimmer",
        # Models
        "lcac", "landing craft air cushion", "zubr class", "griffon hovercraft", "sr.n4", "sr.n6"
    ],
    "train": [
        "locomotive", "railway", "railroad", "diesel locomotive", "steam locomotive", "shunter", "train car",
        # Models & types
        "emd f7", "emd sd40", "ge dash 9", "tgv", "shinkansen", "intercity", "class 66", "big boy", "dr 16", "dv 15"
    ],
    "jetski": [
        "jet ski", "personal watercraft", "pwc", "waverunner", "seadoo", "sea-doo", "kawasaki standup", "superjet", "aquabike"
    ],
    "electric": [
        "all-electric", "fully electric", "pure electric", "battery electric", "electric motor powered", "ev",
        # Tech & brands
        "tesla", "electric drive", "battery powered", "zero emissions", "electric boat", "electric jet ski"
    ],
    "nuclear": [
        "atomic", "nuclear reactor", "uranium", "fission", "nuclear powered", "a1w reactor", "s9g reactor"
    ],
    "steam": [
        "steam engine", "steam boiler", "steam turbine", "coal fired", "coal-fired", "steamboat", "triple expansion"
    ],
    "hybrid": [
        "diesel-electric", "diesel electric", "serial hybrid", "series hybrid", "hybrid drive", "regenerative"
    ],
    "sar": [
        "search and rescue", "lifeboat", "rescue boat", "rescue helicopter", "coast guard", "o-sar", "rnav", "rnli"
    ],
    "firefighting": [
        "fire truck", "fire engine", "fireboat", "fire boat", "ladder truck", "fire tender", "brush truck", "water bomber"
    ],
    "police": [
        "cop car", "patrol car", "interceptor", "state trooper", "highway patrol", "sheriff", "police cruiser"
    ]
}

# Blacklist of food, household items, and generic irrelevant words returned by general web dictionaries
WEB_NOISE_BLACKLIST = {
    "sandwich", "lunch", "hoagie", "hero", "poor boy", "bread", "meat", "food",
    "cooler", "barrel", "chute", "pump", "cistern", "bucket", "pipe", "tube",
    "apparatus", "entity", "object", "thing", "device", "fixture", "utensil"
}

# Default base metric definitions and comprehensive default tag rules
DEFAULT_RULES = {
    "_settings": {
        "prune_parents_enabled": True
    },
    "Helicopter": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["helicopter", "chopper", "helo", "rotorcraft", "whirlybird", "copter", "apache", "ah-64", "blackhawk", "uh-60", "chinook", "ch-47", "huey", "uh-1", "hind", "mi-24", "mi-8", "mi-17", "mi-28", "ka-50", "ka-52", "cobra", "ah-1", "viper", "nh90", "super stallion"],
        "negative_keywords": ["plane", "airplane", "tiltrotor", "osprey"],
        "numeric_ranges": []
    },
    "Plane": {
        "is_mandatory_branch": False,
        "exclusions": {
            "Seaplane": {"priority": "lose", "cascade": False}
        },
        "keywords": ["plane", "airplane", "aircraft", "aeroplane", "airliner", "biplane", "monoplane", "fighter jet", "interceptor", "bomber", "bushplane", "c-130", "hercules", "f-16", "f-15", "f-18", "f-22", "f-35", "f-14", "a-10", "su-27", "su-35", "su-57", "mig-29"],
        "negative_keywords": ["helicopter", "rotorcraft"],
        "numeric_ranges": []
    },
    "Seaplane": {
        "is_mandatory_branch": False,
        "exclusions": {
            "Plane": {"priority": "win", "cascade": False},
            "Ship": {"priority": "win", "cascade": True}
        },
        "keywords": ["seaplane", "flying boat", "floatplane", "amphibian aircraft", "amphibious plane", "catalina", "pby", "be-200", "cl-415", "shinmaywa us-2", "grumman goose", "albatross"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Tiltrotor": {
        "is_mandatory_branch": False,
        "exclusions": {
            "VTOL": {"priority": "win", "cascade": False}
        },
        "keywords": ["tiltrotor", "tilt-rotor", "tilt rotor", "tiltwing", "tilt-wing", "v-22", "osprey", "v-280", "valor", "aw609", "bell boeing", "cl-84"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "VTOL": {
        "is_mandatory_branch": False,
        "exclusions": {
            "Tiltrotor": {"priority": "lose", "cascade": False}
        },
        "keywords": ["vtol", "stovl", "vertical takeoff", "jump jet", "harrier", "av-8b", "sea harrier", "f-35b", "yak-38", "yak-141"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Ship": {
        "is_mandatory_branch": False,
        "exclusions": {
            "Seaplane": {"priority": "lose", "cascade": True}
        },
        "keywords": ["ship", "boat", "vessel", "cutter", "watercraft"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Underwater": {
        "is_mandatory_branch": False,
        "exclusions": {
            "Small boat": {"priority": "equal", "cascade": False},
            "Medium boat": {"priority": "equal", "cascade": False}
        },
        "keywords": ["submarine", "sub", "submersible", "u-boat", "uboat", "ballistic sub", "attack submarine", "underwater craft", "typhoon class", "akula", "los angeles class", "virginia class", "seawolf", "ohio class", "kilo class", "borei class"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "RIB": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["rib", "rhib", "rigid inflatable", "rigid hull inflatable", "zodiac boat", "inflatable boat", "assault boat", "crrc", "combat rubber raiding craft"],
        "negative_keywords": ["huge boat", "ocean liner", "aircraft carrier"],
        "numeric_ranges": []
    },
    "Small boat": {
        "is_mandatory_branch": False,
        "exclusions": {
            "Underwater": {"priority": "equal", "cascade": False}
        },
        "keywords": ["small boat", "skiff", "dinghy", "speedboat", "single deck", "tender boat", "runabout", "dory", "jon boat", "rowboat", "boston whaler", "bayliner"],
        "negative_keywords": ["carrier", "frigate", "destroyer", "huge boat"],
        "numeric_ranges": [
            {"metric": "length", "min": 0, "max": 15, "unit": "m"}
        ]
    },
    "Medium boat": {
        "is_mandatory_branch": False,
        "exclusions": {
            "Underwater": {"priority": "equal", "cascade": False}
        },
        "keywords": ["medium boat", "patrol boat", "cutter", "workboat", "crew boat", "tender", "patrol craft", "fast patrol boat", "damen", "stan patrol", "4207", "pilot boat"],
        "negative_keywords": ["ocean liner", "aircraft carrier"],
        "numeric_ranges": [
            {"metric": "length", "min": 15, "max": 35, "unit": "m"}
        ]
    },
    "Large boat": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["large boat", "frigate", "destroyer", "corvette", "cruiser", "large ship", "bulk carrier", "opv", "offshore patrol vessel", "arleigh burke", "type 23", "fremm"],
        "negative_keywords": [],
        "numeric_ranges": [
            {"metric": "length", "min": 35, "max": 60, "unit": "m"}
        ]
    },
    "Huge boat": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["huge boat", "ocean liner", "aircraft carrier", "supertanker", "cargo ship", "container ship", "titanic", "dreadnought", "nimitz", "gerald ford", "yamato", "bismarck"],
        "negative_keywords": [],
        "numeric_ranges": [
            {"metric": "length", "min": 60, "max": 9999, "unit": "m"}
        ]
    },
    "Tank": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["mbt", "main battle tank", "panzer", "armored tank", "tracked armor", "battle tank", "abrams", "m1a1", "m1a2", "leopard 2", "leopard", "t-72", "t-80", "t-90", "t-64", "challenger 2", "leclerc", "k2 black panther", "merkava"],
        "negative_keywords": ["fuel tank", "water tank", "ballast tank", "tank container"],
        "numeric_ranges": []
    },
    "Armored_vehicle": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["armored vehicle", "apc", "ifv", "afv", "armored car", "spg", "infantry fighting vehicle", "personnel carrier", "mrap", "bradley", "bmp-1", "bmp-2", "bmp-3", "btr-80", "btr-82", "stryker", "boxer", "cv90", "humvee", "m113"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Truck": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["truck", "lorry", "hauler", "semi truck", "flatbed truck", "dump truck", "tractor unit", "scania", "volvo fh", "actros", "mercedes actros", "man tgx", "peterbilt", "kenworth", "freightliner", "mack"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Offroad_truck": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["offroad truck", "all-terrain truck", "6x6 truck", "8x8 truck", "4x4 truck", "unimog", "heavy offroad truck", "ural", "kamaz 6x6", "tatra", "hemtt", "oshkosh", "kraz 255"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Pickup": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["pickup", "pick-up", "ute", "ford f-150", "f-250", "f-350", "raptor", "silverado", "ram 1500", "toyota hilux", "hilux", "tacoma", "tundra", "ford ranger"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Passenger_car": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["passenger car", "sedan", "coupe", "hatchback", "saloon", "wagon", "roadster", "convertible", "supercar", "hypercar", "bmw", "mercedes", "audi", "porsche", "911", "ferrari", "lamborghini", "corvette", "mustang", "miata", "civic", "golf"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "SUV": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["suv", "crossover", "sport utility vehicle", "4x4 suv", "land cruiser", "range rover", "defender", "nissan patrol", "g-wagon", "tahoe", "suburban", "cherokee"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Offroad_car": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["offroad car", "rock crawler", "trophy truck", "mudder", "trail rig", "4x4 crawler", "prerunner", "wrangler", "jeep", "humvee", "bronco", "jimny", "lada niva"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "ATV": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["atv", "quad", "quad bike", "utv", "sxs", "side-by-side", "all-terrain vehicle", "polaris", "rzr", "can-am", "maverick", "yamaha yxz", "kawasaki mule"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Hovercraft": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["hovercraft", "acv", "air cushion vehicle", "skimmer", "lcac", "zubr", "griffon hovercraft", "sr.n4", "sr.n6", "ap1-88"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Train": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["train", "locomotive", "railway", "railroad", "diesel locomotive", "steam locomotive", "shunter", "switch engine", "rolling stock", "train car", "boxcar", "emd sd40", "ge dash 9", "tgv", "shinkansen"],
        "negative_keywords": ["power train", "powertrain", "drive train", "drivetrain"],
        "numeric_ranges": []
    },
    "Jetski": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["jetski", "jet ski", "personal watercraft", "pwc", "waverunner", "seadoo", "sea-doo", "aquabike", "superjet", "yamaha waverunner"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Electric": {
        "is_mandatory_branch": False,
        "exclusions": {
            "Hybrid": {"priority": "lose", "cascade": False}
        },
        "keywords": ["all-electric", "fully electric", "pure electric", "battery electric", "electric motor powered", "electric boat", "electric plane", "electric vehicle"],
        "negative_keywords": ["diesel-electric", "diesel electric", "serial hybrid", "series hybrid", "hybrid drive", "diesel"],
        "numeric_ranges": []
    },
    "Hybrid": {
        "is_mandatory_branch": False,
        "exclusions": {
            "Electric": {"priority": "win", "cascade": False}
        },
        "keywords": ["diesel-electric", "diesel electric", "serial hybrid", "series hybrid", "hybrid drive", "regenerative braking"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Nuclear": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["nuclear", "atomic", "nuclear reactor", "uranium", "fission", "nuclear powered", "a1w reactor", "s9g reactor"],
        "negative_keywords": ["nuclear option"],
        "numeric_ranges": []
    },
    "Steam": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["steam engine", "steam boiler", "steam turbine", "coal fired", "coal-fired", "steamboat", "triple expansion"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Combat": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["combat", "autocannon", "heavy autocannon", "battle cannon", "artillery", "howitzer", "torpedo", "missile", "machine gun", "turret", "ciws", "gunship", "interceptor", "dogfight", ".50 cal"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Support": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["military support", "troop transport", "military transport", "chinook", "ch-47", "ch-53", "super stallion", "skycrane", "c-130", "hercules", "c-17", "globemaster", "replenishment ship", "fleet replenishment", "awacs", "combat support", "aerial refueling", "ammunition carrier"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Commercial": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["commercial", "cargo", "freight", "container ship", "containership", "bulk carrier", "cargo ship", "freighter", "hauler", "cargo plane", "cargo aircraft", "delivery truck", "semi truck", "flatbed truck", "dump truck", "tanker ship", "oil tanker", "tugboat", "tug boat", "ferry", "car ferry", "barge"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "SAR": {
        "is_mandatory_branch": False,
        "exclusions": {
            "Firefighting": {"priority": "win", "cascade": False},
            "Medical": {"priority": "win", "cascade": False}
        },
        "keywords": ["sar", "search and rescue", "lifeboat", "rescue boat", "rescue helicopter", "coast guard", "coastguard", "o-sar", "rnli", "lifeguard"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Firefighting": {
        "is_mandatory_branch": False,
        "exclusions": {"SAR": {"priority": "lose", "cascade": False}},
        "keywords": ["firefighting", "fire truck", "fire engine", "fireboat", "fire boat", "ladder truck", "firefighter", "fire tender", "pumper truck", "brush truck", "water bomber"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Police": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["police", "cop car", "patrol car", "interceptor police", "state trooper", "highway patrol", "sheriff", "police cruiser", "law enforcement"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Medical": {
        "is_mandatory_branch": False,
        "exclusions": {"SAR": {"priority": "lose", "cascade": False}},
        "keywords": ["medical", "ambulance", "hospital ship", "medevac", "air ambulance", "paramedic", "mobile hospital"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Utility": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["utility", "snowplow", "street sweeper", "garbage truck", "service truck", "tow truck", "road maintenance", "cherry picker"],
        "negative_keywords": [],
        "numeric_ranges": []
    },
    "Personal": {
        "is_mandatory_branch": False,
        "exclusions": {},
        "keywords": ["personal", "camper", "motorhome", "rv", "private yacht", "luxury yacht", "pleasure craft", "personal vehicle", "daily driver", "personal boat"],
        "negative_keywords": [],
        "numeric_ranges": []
    }
}

def load_classifier_rules() -> Dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT value FROM app_settings WHERE key = ?", (RULES_SETTINGS_KEY,))
    row = cur.fetchone()
    conn.close()

    if not row or not row[0]:
        return DEFAULT_RULES

    try:
        user_rules = json.loads(row[0])
        merged = dict(DEFAULT_RULES)
        # Deep merge tag rules
        for k, v in user_rules.items():
            if k == "_settings":
                merged["_settings"] = {**DEFAULT_RULES.get("_settings", {}), **v}
            elif isinstance(v, dict):
                merged[k] = {**DEFAULT_RULES.get(k, {}), **v}
            else:
                merged[k] = v
        return merged
    except Exception:
        return DEFAULT_RULES

def parse_exclusion_entry(val: Any) -> Tuple[str, bool]:
    """Extract priority and cascade flag from string or dict exclusion representations."""
    if isinstance(val, dict):
        return str(val.get("priority", "win")), bool(val.get("cascade", False))
    elif isinstance(val, str):
        return val, False
    return "win", False

def save_classifier_rules(rules: Dict[str, Any]) -> None:
    """
    Saves classifier rules with symmetric synchronization of exclusions:
    - If A excludes B with 'win', then B excludes A with 'lose'
    - If A excludes B with 'lose', then B excludes A with 'win'
    - If A excludes B with 'equal', then B excludes A with 'equal'
    - If cascade is set on A vs B, mirror it to B vs A
    - If exclusion between A and B is removed, synchronize removal
    """
    synchronized_rules = dict(rules)
    
    # Mirror mapping
    mirror_map = {
        "win": "lose",
        "lose": "win",
        "equal": "equal"
    }

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT value FROM app_settings WHERE key = ?", (RULES_SETTINGS_KEY,))
    row = cur.fetchone()
    old_rules = {}
    if row and row[0]:
        try:
            old_rules = json.loads(row[0])
        except Exception:
            old_rules = {}

    # 1. Detect unilateral removals against previous saved state
    if old_rules:
        for tag_a, old_a in old_rules.items():
            if not isinstance(old_a, dict):
                continue
            old_ex_a = old_a.get("exclusions", {})
            new_ex_a = synchronized_rules.get(tag_a, {}).get("exclusions", {}) if isinstance(synchronized_rules.get(tag_a), dict) else {}
            for tag_b in old_ex_a:
                if tag_b not in new_ex_a:
                    # User removed tag_b from tag_a: clean up tag_a from tag_b as well
                    if tag_b in synchronized_rules and isinstance(synchronized_rules[tag_b], dict):
                        b_ex = synchronized_rules[tag_b].get("exclusions", {})
                        if tag_a in b_ex:
                            del b_ex[tag_a]

    # 2. Inspect all tag exclusions & mirror
    tag_names = [k for k in synchronized_rules.keys() if k != "_settings"]
    for tag_a in tag_names:
        rule_a = synchronized_rules.get(tag_a)
        if not isinstance(rule_a, dict):
            continue
        exclusions_a = rule_a.get("exclusions", {})
        
        for tag_b, ex_val in list(exclusions_a.items()):
            if tag_b not in synchronized_rules or not isinstance(synchronized_rules[tag_b], dict):
                continue
            
            priority_a, cascade_a = parse_exclusion_entry(ex_val)
            # Normalize tag_a's exclusion structure
            exclusions_a[tag_b] = {"priority": priority_a, "cascade": cascade_a}

            # Ensure tag_b has exclusions dict
            if "exclusions" not in synchronized_rules[tag_b]:
                synchronized_rules[tag_b]["exclusions"] = {}
                
            expected_priority_b = mirror_map.get(priority_a, "equal")
            synchronized_rules[tag_b]["exclusions"][tag_a] = {
                "priority": expected_priority_b,
                "cascade": cascade_a
            }

    cur.execute("""
        INSERT INTO app_settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    """, (RULES_SETTINGS_KEY, json.dumps(synchronized_rules)))
    conn.commit()
    conn.close()

async def fetch_synonyms_from_datamuse(word: str) -> List[str]:
    """
    Intelligent Technical & Public Thesaurus Lookup:
    1. First checks massive vehicle database (1,600+ real-world models, military codes, vehicles).
    2. Checks domain thesaurus mappings.
    3. Falls back to web Datamuse API only if insufficient terms found.
    """
    cleaned_word = re.sub(r"[^a-zA-Z0-9 _-]", "", word).strip().lower()
    normalized_key = cleaned_word.replace("-", " ").replace("_", " ")

    results: List[str] = []

    # 1. Check Massive Technical & Military Vehicle Thesaurus (Fast O(1) hash lookup)
    massive_matches = get_thesaurus_matches(cleaned_word)
    for m in massive_matches:
        if m != cleaned_word and m not in results:
            results.append(m)

    # 2. Check Curated Domain Thesaurus
    for key, terms in DOMAIN_THESAURUS.items():
        if key == normalized_key or key in normalized_key or normalized_key in key:
            for term in terms:
                if term != cleaned_word and term not in results:
                    results.append(term)

    # 3. If we already have rich technical terms, return immediately without web latency!
    if len(results) >= 8:
        return results[:50]

    # 4. Fallback / supplement from Datamuse with strict vehicle & transport filters
    try:
        url = f"https://api.datamuse.com/words?ml={cleaned_word}&topics=vehicles,transport,military&max=20"
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                for item in resp.json():
                    w = item.get("word", "").lower()
                    if (
                        w and
                        w != cleaned_word and
                        w not in results and
                        not any(noise in w for noise in WEB_NOISE_BLACKLIST) and
                        len(w) > 2
                    ):
                        results.append(w)
    except Exception as e:
        print(f"Web thesaurus lookup error for '{word}': {e}")

    return results[:50]
