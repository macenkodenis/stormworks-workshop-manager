import re
import functools
from typing import Dict, Any, List, Set, Tuple, Optional

# BBCode stripping regex
BBCODE_PATTERN = re.compile(r"\[/?(?:b|i|u|h1|h2|h3|url|quote|code|list|\*|table|tr|th|td|img|previewimg)[^\]]*\]", re.IGNORECASE)

# Drive formula patterns
FOUR_BY_FOUR = re.compile(r"\b(?:4\s*[xX*]\s*4|4wd|awd|all[- ]wheel[- ]drive)\b", re.IGNORECASE)
HEAVY_ALL_WHEEL = re.compile(r"\b(?:6\s*[xX*]\s*6|8\s*[xX*]\s*8|10\s*[xX*]\s*10)\b", re.IGNORECASE)

# Parent -> Children relationships for pruning
PARENT_PRUNE_RULES = {
    'Vehicle': {'Air', 'Sea', 'Land', 'Underwater', 'Plane', 'Helicopter', 'Tiltrotor', 'VTOL', 'Ship', 'Small boat', 'Medium boat', 'Large boat', 'Huge boat', 'RIB', 'Jetski', 'Car', 'Cars', 'Passenger_car', 'SUV', 'Pickup', 'Offroad_car', 'Truck', 'Offroad_truck', 'Van', 'Kei_truck', 'Bus', 'ATV', 'Hovercraft', 'Train', 'Armored_vehicle', 'Trailer', 'Semi-trailer', 'Light Trailer', 'Heavy Trailer', 'Gooseneck Trailer', 'Loaders', 'UAV', 'USV', 'UUV', 'UGV', 'Ekranoplan', 'Barge', 'Oil Rig', 'Tugboat', 'Ferry', 'Tanker', 'OSV', 'Seaplane', 'Tank', 'Crane', 'Locomotive', 'Railcar', 'Service_railcar', 'Multiple Units', 'Experimental_train', 'Amphibious', 'Tracked'},
    'Air': {'Plane', 'Helicopter', 'Tiltrotor', 'VTOL', 'UAV', 'Seaplane', 'Experimental'},
    'Plane': {'Seaplane', 'VTOL'},
    'Helicopter': set(),
    'Sea': {'Ship', 'Small boat', 'Medium boat', 'Large boat', 'Huge boat', 'RIB', 'Jetski', 'USV', 'Ekranoplan', 'Barge', 'Oil Rig', 'Tugboat', 'Ferry', 'Tanker', 'OSV', 'Catamaran', 'Hydrofoil'},
    'Ship': {'Small boat', 'Medium boat', 'Large boat', 'Huge boat', 'RIB', 'Tugboat', 'Ferry', 'Tanker', 'OSV', 'Catamaran', 'Hydrofoil', 'Jetski'},
    'Land': {'Terrestrial', 'Cars', 'Trucks', 'Light_trucks', 'Passenger_car', 'SUV', 'Pickup', 'Offroad_car', 'Truck', 'Offroad_truck', 'Van', 'Kei_truck', 'Bus', 'ATV', 'Hovercraft', 'Train', 'Armored_vehicle', 'Trailer', 'Semi-trailer', 'Light Trailer', 'Heavy Trailer', 'Gooseneck Trailer', 'Loaders', 'UGV', 'Tank', 'Crane', 'Locomotive', 'Railcar', 'Service_railcar', 'Multiple Units', 'Experimental_train', 'Amphibious', 'Tracked'},
    'Terrestrial': {'Cars', 'Trucks', 'Light_trucks', 'Passenger_car', 'SUV', 'Pickup', 'Offroad_car', 'Truck', 'Offroad_truck', 'Van', 'Kei_truck', 'Bus', 'ATV', 'Hovercraft', 'Train', 'Armored_vehicle', 'Trailer', 'Semi-trailer', 'Light Trailer', 'Heavy Trailer', 'Gooseneck Trailer', 'Loaders', 'UGV', 'Tank', 'Crane', 'Amphibious', 'Locomotive', 'Railcar', 'Service_railcar', 'Multiple Units', 'Experimental_train', 'Tracked'},
    'Cars': {'Passenger_car', 'SUV', 'Pickup', 'Offroad_car', 'ATV', 'Ute'},
    'Trucks': {'Truck', 'Offroad_truck', 'Bus', 'Truck_addon'},
    'Truck': {'Offroad_truck'},
    'Light_trucks': {'Van', 'Kei_truck'},
    'Trailer': {'Semi-trailer', 'Light Trailer', 'Heavy Trailer', 'Gooseneck Trailer'},
    'Train': {'Locomotive', 'Railcar', 'Service_railcar', 'Multiple Units', 'Experimental_train'},
    'Underwater': {'UUV'},
    'Subassembly': {'Drivetrain', 'Engine', 'Gearbox', 'Vehicle_module', 'Truck_modules', 'Heli_Modules', 'Attachment', 'Generator', 'Weapon', 'Equipment', 'Crane_arm'},
    'Drivetrain': {'Engine', 'Gearbox'},
    'Vehicle_module': {'Truck_modules', 'Heli_Modules'},
    'Container': {'Container Carrier'},
    'Mod': {'Parts', 'XML_modded', 'Hand weapons'},
    'Microcontroller': {'Engine controller', 'Monitor controller', 'Autopilot', 'WaterJet controller', 'Winch controller'},
    'Role': {'Military', 'Combat', 'Support', 'Emergency', 'SAR', 'Firefighting', 'Police', 'Medical', 'Commercial', 'Comercial', 'Farming', 'Construction', 'Industrial', 'Fishing', 'Civilian', 'Utility', 'Research', 'Personal'},
    'Military': {'Combat', 'Support'},
    'Emergency': {'SAR', 'Firefighting', 'Police', 'Medical'},
    'Commercial': {'Farming', 'Construction', 'Industrial', 'Fishing'},
    'Comercial': {'Farming', 'Construction', 'Industrial', 'Fishing'},
    'Civilian': {'Utility', 'Research'}
}

# Domain tag sets for strict cross-domain isolation
AIR_TAGS = {
    'Air', 'Plane', 'Helicopter', 'Tiltrotor', 'VTOL', 'UAV', 'Seaplane', 'Experimental'
}
SEA_TAGS = {
    'Sea', 'Ship', 'Small boat', 'Medium boat', 'Large boat', 'Huge boat',
    'RIB', 'Jetski', 'Barge', 'Oil Rig', 'Ekranoplan', 'USV',
    'Tugboat', 'Ferry', 'Tanker', 'OSV', 'Catamaran', 'Hydrofoil'
}
LAND_TAGS = {
    'Land', 'Terrestrial', 'Cars', 'Passenger_car', 'SUV', 'Pickup', 'Offroad_car', 'ATV', 'Ute',
    'Light_trucks', 'Van', 'Truck_addon', 'Trucks', 'Truck', 'Offroad_truck', 'Bus',
    'Trailer', 'Light Trailer', 'Heavy Trailer', 'Semi-trailer', 'Gooseneck Trailer', 'Loaders', 'Armored_vehicle', 'Amphibious', 'Tracked',
    'Train', 'Hovercraft', 'UGV', 'Tank', 'Crane', 'Locomotive', 'Railcar', 'Service_railcar', 'Multiple Units', 'Experimental_train'
}
UNDERWATER_TAGS = {
    'Underwater', 'UUV'
}

# Allowed dual role pairs (all other role pairs are strictly disallowed)
ALLOWED_DUAL_ROLES = {
    frozenset({'Military', 'SAR'}),
    frozenset({'Combat', 'SAR'}),
    frozenset({'Research', 'Support'}),
}

# Outdated mod patterns (Title and Description)
OUTDATED_TITLE_PATTERNS = re.compile(
    r"(?:\[|\(|\b)(?:outdated|deprecated|discontinued|obsolete|replaced|broken|do\s+not\s+use|no\s+longer\s+working|defunct|abandoned|legacy|old|застарілий|не\s+працює|устарел)(?:\]|\)|\b)",
    re.IGNORECASE
)
OUTDATED_DESC_PATTERNS = re.compile(
    r"(?:\b(?:this\s+(?:mod|creation|vehicle|craft|addon|item|project)\s+is\s+(?:outdated|deprecated|discontinued|obsolete|abandoned|defunct|no\s+longer\s+(?:supported|maintained|working)))\b|"
    r"\[h1\]\s*(?:outdated|deprecated|discontinued|obsolete|legacy)\b|"
    r"^\s*(?:\[b\])?(?:outdated|deprecated|discontinued|obsolete|legacy|no\s+longer\s+(?:supported|working))\b|"
    r"\bbroken\s+(?:by|after)\s+(?:the\s+)?(?:game\s+)?update\b|"
    r"\b(?:no\s+longer\s+supported|no\s+longer\s+maintained|no\s+longer\s+working)\b|"
    r"\b(?:do\s+not\s+use|legacy\s+vehicle\s*[-—:]\s*this\s+vehicle\s+is\s+not\s+being\s+maintained)\b)",
    re.IGNORECASE | re.MULTILINE
)

# Vehicle type families for cross-category ambiguity detection
# Any creation having tags from 2 or more distinct families (unless allowed hybrid like Amphibious/Service_railcar)
# must be classified as Uncertain.
VEHICLE_TYPE_FAMILIES = {
    'air_plane': {'Plane', 'VTOL', 'Seaplane'},
    'air_heli': {'Helicopter', 'Tiltrotor'},
    'sea_watercraft': {'Ship', 'Small boat', 'Medium boat', 'Large boat', 'Huge boat', 'RIB', 'Jetski', 'Barge', 'Oil Rig', 'Ekranoplan', 'USV', 'Tugboat', 'Ferry', 'Tanker', 'OSV', 'Catamaran', 'Hydrofoil'},
    'underwater': {'Underwater', 'UUV'},
    'land_truck': {'Trucks', 'Truck', 'Offroad_truck', 'Light_trucks', 'Van', 'Kei_truck'},
    'land_car': {'Cars', 'Passenger_car', 'SUV', 'Pickup', 'Offroad_car', 'ATV', 'Ute'},
    'land_bus': {'Bus'},
    'land_train': {'Train', 'Locomotive', 'Railcar', 'Multiple Units', 'Experimental_train'},
    'land_armor': {'Armored_vehicle', 'Tank'},
    'land_trailer': {'Trailer', 'Semi-trailer', 'Light Trailer', 'Heavy Trailer', 'Gooseneck Trailer'},
    'land_special': {'Hovercraft', 'UGV', 'Crane', 'Loaders'}
}

@functools.lru_cache(maxsize=128)
def get_all_descendants(tag: str) -> Set[str]:
    """Recursively fetch all descendant tags from PARENT_PRUNE_RULES."""
    descendants = set()
    to_visit = list(PARENT_PRUNE_RULES.get(tag, []))
    while to_visit:
        curr = to_visit.pop()
        if curr not in descendants:
            descendants.add(curr)
            to_visit.extend(PARENT_PRUNE_RULES.get(curr, []))
    return descendants

def clean_text(text: Optional[str]) -> str:
    if not text:
        return ""
    # Strip full [url]...[/url] blocks first, so anchor text of external links doesn't leak into body
    t = re.sub(r"\[url[^\]]*\].*?\[/url\]", " ", text, flags=re.IGNORECASE | re.DOTALL)
    t = re.sub(r"https?://\S+", " ", t)
    cleaned = BBCODE_PATTERN.sub(" ", t)
    cleaned = re.sub(r"[\r\n\t]+", " ", cleaned)
    return cleaned.strip()

@functools.lru_cache(maxsize=2048)
def _get_word_regex(pattern: str) -> re.Pattern:
    return re.compile(r"\b" + pattern + r"\b", re.IGNORECASE)

def match_word(pattern: str, text: str) -> bool:
    """Exact word match case-insensitive."""
    return bool(_get_word_regex(pattern).search(text))

def match_train_word(text: str) -> bool:
    """
    Match 'train' as a standalone railway vehicle keyword,
    strictly ignoring 'power train', 'powertrain', 'drive train', 'drivetrain', 'gear train'.
    """
    # Replace powertrain / drivetrain / gear train with placeholders first
    sanitized = re.sub(r"\b(?:power|drive|gear)\s*[-_ ]?\s*trains?\b", " ", text, flags=re.IGNORECASE)
    return bool(_get_word_regex("train").search(sanitized) or _get_word_regex("trains").search(sanitized))

def count_matches(patterns: List[str], text: str) -> int:
    """Count how many patterns match in text."""
    score = 0
    for p in patterns:
        if _get_word_regex(p).search(text):
            score += 1
    return score

def strip_credits_and_urls(text: str) -> str:
    """Remove web links and authorship/credits sections to avoid false positive matches."""
    # Strip BBCode [url]...[/url] blocks completely to eliminate anchor-text link leaks
    t = re.sub(r"\[url[^\]]*\].*?\[/url\]", " ", text, flags=re.IGNORECASE | re.DOTALL)
    t = re.sub(r"https?://\S+", " ", t)
    # Cut off footer sections: credits, links to other creations, discord
    t = re.split(r"\b(?:credits?|special thanks|acknowledgements?|check out my other|check out his mod|join our discord|join my discord|discord server|other projects?|similar creations?)\b", t, flags=re.IGNORECASE)[0]
    return t

def prune_parents(tags: List[str]) -> List[str]:
    """Remove any parent tag if any of its children are present."""
    tags_set = set(tags)
    pruned = set(tags)
    for parent, children in PARENT_PRUNE_RULES.items():
        if parent in pruned:
            if any(c in tags_set for c in children):
                pruned.remove(parent)
    return [t for t in tags if t in pruned]

# -------------------------------------------------------------
# Metric Extraction (Length, Mass, Capacity, Speed)
# -------------------------------------------------------------
def extract_vehicle_metrics(text: str) -> Dict[str, Optional[float]]:
    """
    Extract numeric metrics from vehicle description:
    - length (meters)
    - mass (kg)
    - capacity (seats/passengers)
    - speed (km/h)
    """
    metrics: Dict[str, Optional[float]] = {
        "length": None,
        "mass": None,
        "capacity": None,
        "speed": None
    }
    lower = text.lower()

    # 1. Length
    # Meters: 14m, 14 meters, 14 metres, length: 14 m
    m_len = re.search(r"(?:length|long)[^\d\n\r]{0,10}(\d+(?:\.\d+)?)\s*(?:m|meters|metres)\b", lower)
    if not m_len:
        m_len = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:m|meters|metres)\s+(?:long|length)\b", lower)
    if m_len:
        try:
            metrics["length"] = float(m_len.group(1))
        except:
            pass

    # Feet: 30ft, 46 foot, 46 feet -> convert to meters (1 ft = 0.3048 m)
    if metrics["length"] is None:
        m_ft = re.search(r"(?:length|long)[^\d\n\r]{0,10}(\d+(?:\.\d+)?)\s*(?:ft|feet|foot)\b", lower)
        if not m_ft:
            m_ft = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:ft|feet|foot)\s+(?:tender|boat|ship|long|length|craft)\b", lower)
        if m_ft:
            try:
                metrics["length"] = float(m_ft.group(1)) * 0.3048
            except:
                pass

    # 2. Mass / Weight
    # kg: mass: 1200 kg, weight: 3500kg
    m_mass = re.search(r"(?:mass|weight)[^\d\n\r]{0,10}(\d+(?:[,\s]\d+)?(?:\.\d+)?)\s*(?:kg|ton|tons|tonnes|lbs)?\b", lower)
    if m_mass:
        raw_val = m_mass.group(1).replace(",", "").replace(" ", "")
        try:
            val = float(raw_val)
            # check unit
            snippet = lower[m_mass.start():m_mass.end() + 10]
            if "ton" in snippet:
                val *= 1000
            elif "lbs" in snippet:
                val *= 0.453592
            metrics["mass"] = val
        except:
            pass

    # 3. Capacity (Passengers / Seats)
    m_cap = re.search(r"(?:passenger seats|passengers?|seats?|crew capacity|personnel)[^\d\n\r]{0,10}(\d+)\b", lower)
    if m_cap:
        try:
            metrics["capacity"] = float(m_cap.group(1))
        except:
            pass

    # 4. Speed (km/h, knots, mph)
    m_spd = re.search(r"(?:top speed|max speed|speed)[^\d\n\r]{0,10}(\d+(?:\.\d+)?)\s*(?:knots|kts|knot|km/h|kph|mph)\b", lower)
    if m_spd:
        try:
            val = float(m_spd.group(1))
            snippet = lower[m_spd.start():m_spd.end() + 10]
            if "knot" in snippet or "kts" in snippet:
                val *= 1.852 # convert to km/h
            elif "mph" in snippet:
                val *= 1.60934 # convert to km/h
            metrics["speed"] = val
        except:
            pass

    return metrics


class AutoClassifier:
    """
    Intelligent heuristic classifier for Stormworks Workshop items.
    Supports user custom rules, synonyms, and dynamic numeric ranges (Length, Mass, Capacity, Speed).
    """

    @staticmethod
    def classify_item(
        item_id: str,
        title: str,
        description: str,
        original_steam_tags: List[str],
        known_tags_set: Set[str],
        tag_aliases: Optional[Dict[str, str]] = None,
        custom_rules: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        tag_aliases = tag_aliases or {}
        custom_rules = custom_rules or {}
        raw_title = title or ""
        clean_desc = clean_text(description or "")
        lower_title = raw_title.lower()
        lower_desc = clean_desc.lower()
        full_text = f"{lower_title} {lower_desc}"
        body_no_credits = strip_credits_and_urls(clean_desc).lower()
        full_no_credits = f"{lower_title} {body_no_credits}"

        # Extract metrics (length, mass, capacity, speed)
        extracted_metrics = extract_vehicle_metrics(clean_desc)

        # -------------------------------------------------------------
        # 1. CUSTOM RULES EVALUATION (Keywords & Numeric Ranges)
        # -------------------------------------------------------------
        custom_matched_tags: List[str] = []

        for rule_tag, rule_data in custom_rules.items():
            keywords = rule_data.get("keywords", [])
            negative_keywords = rule_data.get("negative_keywords", [])
            numeric_ranges = rule_data.get("numeric_ranges", [])

            # Check negative keywords first
            has_negative = any(match_word(neg, full_text) for neg in negative_keywords)
            if has_negative:
                continue

            # Check textual keywords
            if rule_tag in ["Train", "Locomotive", "Railcar"]:
                # Exclude occurrences of 'train' that are part of powertrain / drive train / gear train
                has_keyword = False
                for kw in keywords:
                    if kw.lower() == "train":
                        if match_train_word(full_text):
                            has_keyword = True
                            break
                    else:
                        if match_word(kw, full_text):
                            has_keyword = True
                            break
            else:
                has_keyword = any(match_word(kw, full_text) for kw in keywords)

            # Check numeric ranges
            numeric_matches = False
            if numeric_ranges:
                for nr in numeric_ranges:
                    metric_name = nr.get("metric")
                    val = extracted_metrics.get(metric_name)
                    if val is not None:
                        min_val = float(nr.get("min", 0))
                        max_val = float(nr.get("max", 999999))
                        if min_val <= val <= max_val:
                            numeric_matches = True
                            break

            # If either explicit keyword matched or numeric range matched
            if has_keyword or numeric_matches:
                custom_matched_tags.append(rule_tag)

        # -------------------------------------------------------------
        # 2. POWERTRAIN / MODIFIERS (Nuclear, Steam, Hybrid, Electric)
        # -------------------------------------------------------------
        assigned_modifiers: List[str] = []

        # Nuclear
        if any(match_word(w, full_no_credits) for w in ["nuclear", "reactor", "atomic", "uranium", "fission"]):
            if not match_word("nuclear option", full_no_credits):
                assigned_modifiers.append("Nuclear")

        # Steam
        if any(match_word(w, full_no_credits) for w in ["steam engine", "steam boiler", "steam turbine", "coal fired", "coal-fired", "steamboat", "steam powered"]):
            assigned_modifiers.append("Steam")

        # Hybrid (series hybrid / diesel-electric traction)
        hybrid_matches = [
            "diesel-electric", "diesel electric", "serial hybrid", "series hybrid",
            "hybrid drive", "all-electric mode", "silent running on battery"
        ]
        is_hybrid = any(match_word(w, full_no_credits) for w in hybrid_matches)
        if is_hybrid:
            assigned_modifiers.append("Hybrid")

        # Electric (strictly pure electric, not hybrid)
        if not is_hybrid:
            electric_matches = [
                "all-electric", "fully electric", "pure electric", "battery electric",
                "electric motor powered", "electric boat", "electric plane", "electric vehicle",
                "electric sar jet ski", "electric 6x6", "electric 4x4", "electric 8x8"
            ]
            if any(match_word(w, full_no_credits) for w in electric_matches):
                assigned_modifiers.append("Electric")

        # Outdated / Deprecated mod recognition
        is_outdated = bool(
            OUTDATED_TITLE_PATTERNS.search(raw_title) or
            OUTDATED_DESC_PATTERNS.search(clean_desc)
        )
        if is_outdated:
            assigned_modifiers.append("Outdated")

        # -------------------------------------------------------------
        # 3. MICROCONTROLLER & SUBASSEMBLY / DEMO FILTER
        # -------------------------------------------------------------
        orig_steam_set = set(t.lower() for t in (original_steam_tags or []))
        is_steam_mc = "microcontroller" in orig_steam_set
        is_steam_vehicle = "vehicle" in orig_steam_set
        is_steam_subassembly = "subassembly" in orig_steam_set

        # Check for demo / example craft of a microcontroller/logic or logic subassembly
        is_demo_craft = False
        if is_steam_vehicle or is_steam_subassembly:
            if any(m in lower_title for m in ["example vehicle", "example craft", "demonstrator", "testbed", "test bed", "test stand", "test bench"]):
                is_demo_craft = True
            elif "example" in lower_title and any(w in lower_title for w in ["dashboard", "finder", "engine", "controller", "rov", "microcontroller", "logic"]):
                is_demo_craft = True
            elif any(m in full_text for m in ["example vehicle for this controller", "spawning this demo", "this is a demo vehicle", "demonstration vehicle for"]):
                is_demo_craft = True
            elif is_steam_subassembly and any(w in lower_title for w in ["autopilot panel", "nav display", "instrument panel", "direction finder", "data & gps map", "gps map", "engine data"]):
                is_demo_craft = True

        # Check for standalone microcontroller
        is_standalone_mc = False
        if is_steam_mc and not is_steam_vehicle and not is_demo_craft:
            is_standalone_mc = True
        elif not is_demo_craft and (
            any(match_word(w, lower_title) for w in ["microcontroller", "micro-controller", "ecu", "pid controller", "composite logic", "hud", "artificial horizon", "pid tuner", "hmds", "avionics suite", "transponder locator"]) or
            (is_steam_subassembly and any(match_word(w, lower_title) for w in ["hud", "display", "screen", "monitor", "horizon", "avionics", "tuner", "controller", "mascot", "gauges"])) or
            ("[lua]" in lower_title and any(match_word(w, lower_title) for w in ["hud", "display", "screen", "monitor", "horizon", "mascot", "instrument", "map", "nav"]))
        ):
            if not any(v in lower_title for v in ["patrol boat", "cutter", "destroyer", "frigate", "tank", "helicopter", "semi truck", "passenger car", "corvette", "warship"]):
                is_standalone_mc = True

        if is_standalone_mc or is_demo_craft:
            subtags = []
            # 1. Engine controller
            if any(match_word(w, lower_title) for w in [
                "ecu", "engine controller", "engine control", "modular engine", "jet engine controller",
                "throttle controller", "ecm", "pid controller", "pid tuner", "clutch"
            ]) or ("engine" in lower_title and any(w in lower_title for w in ["unit", "controller", "control", "afec", "pid"])):
                subtags.append("Engine controller")

            # 2. Monitor controller
            is_monitor = False
            if any(match_word(w, lower_title) for w in [
                "display", "monitor", "screen", "dashboard", "hud", "artificial horizon",
                "navball", "indicator", "mfd", "lua instrument", "vision", "alarm panel", "mascot", "hmds"
            ]):
                is_monitor = True
            elif "alarm" in lower_title and any(w in full_text for w in ["monitor", "screen", "display"]):
                is_monitor = True
            elif any(match_word(w, lower_title) for w in ["map", "transponder locator", "radar & sonar map", "radar and transponder"]) and any(w in full_text for w in ["monitor", "screen", "display", "renders a", "displays the result", "lua"]):
                is_monitor = True
            elif "[lua]" in lower_title and any(match_word(w, full_text) for w in ["screen", "monitor", "display", "hud", "draw", "render", "pixel"]):
                is_monitor = True
            if is_monitor:
                subtags.append("Monitor controller")

            # 3. Autopilot
            if any(match_word(w, lower_title) for w in ["autopilot", "heading hold", "gyro", "flight controller", "heli fc", "heading/rate of turn"]):
                subtags.append("Autopilot")

            # 4. WaterJet controller
            if any(match_word(w, lower_title) for w in ["water jet", "waterjet", "water-jet", "water jets"]):
                subtags.append("WaterJet controller")

            # 5. Winch controller
            if any(match_word(w, lower_title) for w in ["winch controller", "winch control", "winch"]):
                subtags.append("Winch controller")

            # Avoid accumulation: max 2 subtags
            if len(subtags) > 2:
                subtags = subtags[:2]

            assigned = []
            if is_demo_craft:
                assigned.append("Subassembly")
                if subtags:
                    assigned.extend(subtags)
                else:
                    assigned.append("Microcontroller")
            else:
                # Rule: For microcontrollers with child tags, do NOT add parent Microcontroller tag
                if subtags:
                    assigned = subtags
                else:
                    assigned = ["Microcontroller"]

            if is_outdated and "Outdated" not in assigned:
                assigned.append("Outdated")

            return {
                "item_id": item_id,
                "title": title,
                "status": "Autosorted",
                "is_sorted": True,
                "assigned_tags": assigned,
                "core_tags": assigned,
                "deactivated_tags": list(set(original_steam_tags or [])),
                "new_tags_detected": []
            }

        # -------------------------------------------------------------
        # 3.4 MODS & HAND WEAPONS / PARTS
        # -------------------------------------------------------------
        is_steam_mod = "mod" in orig_steam_set
        is_explicit_xml = (
            any(match_word(w, lower_title) for w in [
                "xml edit", "xml edits", "xml block", "xml blocks", "xml pack",
                "xml ladder", "xml bundle", "xml part", "xml parts", "xml mod",
                "xml modded", "xml-modded", "xml_cleanplate", "some xml"
            ]) or
            (match_word("xml", lower_title) and not any(match_word(w, lower_title) for w in [
                "car", "truck", "boat", "plane", "helicopter", "ship", "tank", "train"
            ]))
        )

        if is_explicit_xml:
            assigned = ["XML_modded"]
            if is_steam_subassembly or any(w in lower_title for w in ["subassembly", "pack", "blocks", "ladder", "edits"]):
                assigned.append("Subassembly")
            if is_outdated and "Outdated" not in assigned:
                assigned.append("Outdated")
            return {
                "item_id": item_id,
                "title": title,
                "status": "Autosorted",
                "is_sorted": True,
                "assigned_tags": assigned,
                "core_tags": assigned,
                "deactivated_tags": list(set(original_steam_tags or [])),
                "new_tags_detected": []
            }

        if is_steam_mod and not is_steam_vehicle:
            is_hand_weapon = any(match_word(w, lower_title) for w in [
                "kriss vector", "vector", "g36", "g36c", "honey badger", "msbs grot", "grot",
                "taurus ct9", "taurus", "assault rifle", "handgun", "pistol", "shotgun", "smg",
                "submachine gun", "hand weapon", "hand weapons", "rifle", "firearm", "carbine"
            ]) or any(match_word(w, full_text) for w in ["handheld weapon", "hand weapon", "personal firearm"])

            is_xml_mod = any(match_word(w, lower_title) for w in ["xml", "xml-modded", "xml modded", "xml edit", "xml editing"]) or "xml" in lower_title

            is_shader_or_overhaul = any(match_word(w, lower_title) for w in [
                "shader", "weather", "fog", "dark mode", "sound overhaul", "greenifier", "physics mod", "buoyancy overhaul", "aerodynamics"
            ])

            if is_hand_weapon:
                assigned = ["Hand weapons"]
            elif is_xml_mod:
                assigned = ["XML_modded"]
            elif is_shader_or_overhaul:
                assigned = ["Mod"]
            elif any(match_word(w, lower_title) for w in [
                "parts", "expansion", "pack", "engines", "pipes", "monitors", "sensors", "doors", "door",
                "wheels", "benches", "pumps", "components", "hitboxes", "shafts",
                "workbenches", "headlights", "wedges", "props", "oddities", "mechanics",
                "port", "pipe port", "kit", "analog kit", "dial kit", "gauge", "turbo", "turbocharger"
            ]):
                assigned = ["Parts"]
            else:
                assigned = ["Mod"]

            if is_outdated and "Outdated" not in assigned:
                assigned.append("Outdated")

            return {
                "item_id": item_id,
                "title": title,
                "status": "Autosorted",
                "is_sorted": True,
                "assigned_tags": assigned,
                "core_tags": assigned,
                "deactivated_tags": list(set(original_steam_tags or [])),
                "new_tags_detected": []
            }

        # -------------------------------------------------------------
        # 3.42 LANGUAGE, MISSIONS & ENVIRONMENT MODS
        # -------------------------------------------------------------
        if "language" in orig_steam_set or any(match_word(w, lower_title) for w in ["українізатор", "ukrainian translation", "ukrainian language"]):
            assigned = ["Language"]
            if is_outdated and "Outdated" not in assigned:
                assigned.append("Outdated")
            return {
                "item_id": item_id,
                "title": title,
                "status": "Autosorted",
                "is_sorted": True,
                "assigned_tags": assigned,
                "core_tags": assigned,
                "deactivated_tags": list(set(original_steam_tags or [])),
                "new_tags_detected": []
            }

        if ("environment mod" in orig_steam_set or "mission" in orig_steam_set) and not is_steam_vehicle:
            assigned = ["Environment Mod"] if "environment mod" in orig_steam_set else ["Mission"]
            if is_outdated and "Outdated" not in assigned:
                assigned.append("Outdated")
            return {
                "item_id": item_id,
                "title": title,
                "status": "Autosorted",
                "is_sorted": True,
                "assigned_tags": assigned,
                "core_tags": assigned,
                "deactivated_tags": list(set(original_steam_tags or [])),
                "new_tags_detected": []
            }

        is_component_addon = (
            any(w in lower_title for w in [
                "tsu wedge corners", "tsu window slanted", "tsu window panoramic", "tsu components",
                "component mod", "component pack", "component version", "component edition",
                "component ver", "component ed"
            ]) or
            bool(re.search(r'\bcomponent\s+(?:mod|pack|version|edition|ver|ed)\b', lower_title))
        )
        is_paste_or_mounting_part = (
            is_steam_subassembly and (
                bool(re.search(r'paste\s+(?:in|into)\s+(?:your\s+)?creation', lower_desc)) or
                any(match_word(w, full_text) for w in ["selection grid", "paste with selection grid"]) or
                any(match_word(w, lower_title) for w in [
                    "parts pack", "props pack", "blocks pack", "letters pack", "character pack",
                    "alphabet pack", "decor pack", "letters", "lettering"
                ])
            ) and not any(match_word(w, lower_title) for w in ["controller", "renderer", "lua", "screen", "monitor", "engine", "gearbox", "crane", "tank", "boat", "plane", "car", "helicopter"])
        )
        if is_component_addon or is_paste_or_mounting_part:
            assigned = ["Parts"]
            if is_outdated and "Outdated" not in assigned:
                assigned.append("Outdated")
            return {
                "item_id": item_id,
                "title": title,
                "status": "Autosorted",
                "is_sorted": True,
                "assigned_tags": assigned,
                "core_tags": assigned,
                "deactivated_tags": list(set(original_steam_tags or [])),
                "new_tags_detected": []
            }

        # -------------------------------------------------------------
        # 3.45 STRUCTURES & BUILDINGS
        # -------------------------------------------------------------
        is_steam_structure = "structure" in orig_steam_set or ("stationary" in orig_steam_set and not is_steam_vehicle and not is_steam_subassembly)
        is_explicit_structure = any(match_word(w, lower_title) for w in [
            "academy", "dive pool", "lighthouse", "hangar", "building", "terminal", "bunker",
            "harbor", "harbour", "seaport", "airport", "depot", "train station", "subway station"
        ])
        is_crane_component = any(match_word(w, lower_title) for w in ["knuckle boom", "crane arm", "boom crane"])
        if (is_steam_structure or is_explicit_structure) and not is_steam_subassembly and not is_crane_component:
            # Check if it is a real mobile vehicle craft
            is_mobile_vehicle = any(match_word(w, lower_title) for w in [
                "boat", "ship", "plane", "helicopter", "truck", "car", "sub", "rover", "crawler", "hauler"
            ])
            if not is_mobile_vehicle:
                assigned = ["Structure"]
                if is_outdated and "Outdated" not in assigned:
                    assigned.append("Outdated")
                return {
                    "item_id": item_id,
                    "title": title,
                    "status": "Autosorted",
                    "is_sorted": True,
                    "assigned_tags": assigned,
                    "core_tags": assigned,
                    "deactivated_tags": list(set(original_steam_tags or [])),
                    "new_tags_detected": []
                }

        # -------------------------------------------------------------
        # 3.5 SUBASSEMBLIES & STANDALONE CONTAINERS
        # -------------------------------------------------------------
        title_clean = re.sub(r"\((?:modular\s+)?engine\)", " ", lower_title)
        title_clean = re.sub(r"\bw(?:ith)?/\s*(?:modular\s+)?engine\b", " ", title_clean)

        is_explicit_component = (
            any(match_word(w, lower_title) for w in [
                "transmission", "gearbox", "marine engine", "truck engine", "diesel engine",
                "outboard engine", "upfit", "frame addon", "frame addons", "modular bodywork",
                "attachment:", "qtach attachment", "grabber", "mag-all", "bambi bucket", "firefighting bucket",
                "weapons pack", "weapon pack", "equipment pack", "seat module", "modgen",
                "knuckle boom", "crane arm", "boom crane", "iso crane addon", "crane addon",
                "tank module", "diesel tank module", "fuel tank module", "water tank module",
                "rescue pod", "fire rescue pod", "s92 fire rescue pod"
            ]) or
            ("engine" in title_clean and not any(w in title_clean for w in ["fire engine", "fire-engine", "engineering vehicle", "truck", "lorry", "car", "boat", "plane", "helicopter", "ship", "vessel", "platform"])) or
            ("diesel v8" in lower_title)
        )
        is_real_vehicle_craft = False
        if not is_explicit_component:
            is_real_vehicle_craft = any(match_word(w, lower_title) for w in [
                "trailer", "semi-trailer", "semitrailer", "hitch trailer", "gooseneck",
                "railcar", "boxcar", "barge", "ship", "boat", "vessel", "platform", "cutter", "corvette", "frigate",
                "destroyer", "cruiser", "patrol", "skiff", "dinghy", "yacht", "trawler", "tugboat",
                "car", "truck", "van", "bus", "suv", "pickup", "forklift", "telehandler",
                "helicopter", "plane", "fighter", "bomber", "tiltrotor", "vtol", "uav", "usv", "uuv",
                "rov", "auv", "drone", "rhib", "rib", "diving bell", "seabike", "crawler", "minisub"
            ])

        # A. Standalone Containers (excluding weapon pods and carrier vehicles)
        is_weapon_pod = any(w in lower_title for w in ["rocket pod", "gun pod", "missile pod", "weapon pod", "torpedo pod", "cannon pod"])
        if not is_weapon_pod and not is_real_vehicle_craft:
            is_container = False
            if any(w in lower_title for w in [
                "unicon cargo:", "unicon crate:", "unicon quick load cargo", "unicon cargo/crate",
                "universal cargo system", "ucs standard template", "h4 standard connector",
                "mobile office - iso container", "living quarters - iso container", "research lab - iso container",
                "iso container nuclear reactor", "jet power generator container", "container generator",
                "fluid container", "unicon compatible", "ucs compatible", "living pod", "survivor seats (o-sar)",
                "unicon crate", "iso container"
            ]):
                is_container = True
            elif "unicon cargo" in lower_title:
                is_container = True

            if is_container:
                assigned = ["Container"]
                # Additional subtag if it's a generator inside a container
                if any(w in lower_title for w in ["generator", "nuclear reactor", "modgen"]):
                    assigned.append("Generator")
                if is_outdated and "Outdated" not in assigned:
                    assigned.append("Outdated")
                return {
                    "item_id": item_id,
                    "title": title,
                    "status": "Autosorted",
                    "is_sorted": True,
                    "assigned_tags": assigned,
                    "core_tags": assigned,
                    "deactivated_tags": list(set(original_steam_tags or [])),
                    "new_tags_detected": []
                }

        # B. Static Subassemblies (when not a full vehicle/craft)
        if not is_real_vehicle_craft:
            subassembly_tag = None
            # 1. Drivetrain -> Engine
            if not any(w in lower_title for w in ["fire engine", "fire-engine", "engineering"]):
                if any(match_word(w, lower_title) for w in [
                    "marine engine", "truck engine", "outboard engine", "racing outboard", "cruiser outboard",
                    "modular engine", "compact modular engine", "modular engines", "diesel engine pack", "heavyline engines",
                    "diesel engine", "turbo diesel", "diesel v8"
                ]) or ((match_word("engine", lower_title) or match_word("engines", lower_title)) and not any(w in lower_title for w in ["ecu", "ecm", "controller", "display", "reader", "sound", "pitch", "mod", "parts", "vessel", "platform", "boat", "ship"])):
                    subassembly_tag = "Engine"

            # 2. Drivetrain -> Gearbox
            if not subassembly_tag and any(match_word(w, lower_title) for w in ["gearbox", "transmission", "speed manual", "speed automatic", "speed automated"]):
                subassembly_tag = "Gearbox"

            # 3. Vehicle_module -> Truck_modules
            if not subassembly_tag and any(w in lower_title for w in [
                "cab upfit", "sleeper upfit", "frame addon", "frame addons", "glider kit",
                "modular bodywork", "flatbed module", "sleeper apu", "tank module", "diesel tank module", "fuel tank module", "water tank module"
            ]):
                subassembly_tag = "Truck_modules"

            # 4. Vehicle_module -> Heli_Modules
            if not subassembly_tag and any(w in lower_title for w in [
                "waterbombing module", "deepsea recovery module", "sar module", "wing tank", "droptank",
                "bambi bucket", "firefighting bucket", "searchlight addon", "refueling probe addon",
                "iso crane addon", "crew military pod", "tarhe crew", "rescue pod", "fire rescue pod", "s92 fire rescue pod"
            ]):
                subassembly_tag = "Heli_Modules"

            # 5. Attachment
            if not subassembly_tag and any(w in lower_title for w in [
                "attachment:", "qtach attachment", "unicon grabber", "iso container grabber",
                "mag-all", "front weight", "counterweight for", "duck-eye attachment", "duck-tank attachment"
            ]):
                subassembly_tag = "Attachment"

            # 6. Generator
            if not subassembly_tag and any(w in lower_title for w in [
                "modgen", "compact nuclear reactor", "marine nuclear reactor", "nuclear reactor 1.1", "fuel rods for"
            ]):
                subassembly_tag = "Generator"

            # 7. Weapon
            if not subassembly_tag and any(w in lower_title for w in [
                "weapons pack", "weapon pack", "pylon extensions", "modular pylon", "lrasm-er", "agm-158c", "missile pack"
            ]):
                subassembly_tag = "Weapon"

            # 8. Equipment
            if not subassembly_tag and any(w in lower_title for w in [
                "seat module", "seat module 8 pack", "equipment pack", "payloads of sea king"
            ]):
                subassembly_tag = "Equipment"

            # 8.5 Subassembly -> Crane_arm
            if not subassembly_tag and (
                any(match_word(w, lower_title) for w in ["crane arm", "knuckle boom", "boom crane", "iso crane addon", "crane addon"]) or
                ("crane" in lower_title and (is_steam_subassembly or any(w in lower_title for w in ["addon", "subassembly", "arm", "pack", "module", "plug and play", "plug & play", "attachment"])))
            ):
                subassembly_tag = "Crane_arm"

            # 9. Generic Subassembly fallback
            if not subassembly_tag and is_steam_subassembly and not is_steam_vehicle:
                subassembly_tag = "Subassembly"

            if subassembly_tag:
                assigned = [subassembly_tag]
                if subassembly_tag == "Crane_arm":
                    if any(match_word(w, full_text) for w in ["microcontroller", "controller", "composite logic", "logic", "micro-controller", "ecu", "remote control", "helm and remote", "lua"]):
                        assigned.append("Microcontroller")
                # Diagnostic check: is there competition with Mod/Parts? (e.g. contains words from Mod branch like 'pack', 'parts', 'engines', 'expansion')
                is_sub_competing = any(match_word(w, lower_title) for w in ["pack", "bundle", "parts", "engines", "expansion"])
                if is_outdated and "Outdated" not in assigned:
                    assigned.append("Outdated")
                return {
                    "item_id": item_id,
                    "title": title,
                    "status": "Uncertain" if is_sub_competing else "Autosorted",
                    "is_sorted": True,
                    "assigned_tags": assigned,
                    "core_tags": assigned,
                    "deactivated_tags": list(set(original_steam_tags or [])),
                    "new_tags_detected": []
                }

        # -------------------------------------------------------------
        # 4. PRIMARY DOMAIN DETECTION & VEHICLE CLASSIFICATION
        # -------------------------------------------------------------
        air_score = 0
        sea_score = 0
        land_score = 0
        underwater_score = 0
        is_road_train = False

        air_title_kw = [
            "helicopter", "heli", "chopper", "rotorcraft", "helo", "plane", "airplane", "aircraft",
            "jet", "fighter", "bomber", "tiltrotor", "tilt-rotor", "tilt rotor", "lutr", "vtol", "uav", "seaplane", "flying boat",
            "biplane", "bushplane", "spitfire", "falcon", "hornet", "blackhawk", "chinook", "apache",
            "jayhawk", "seahawk", "huey", "flanker", "tomcat", "h175", "racer", "ec135", "ec145",
            "nh90", "super stallion", "king stallion", "stallion", "skycrane", "tarhe", "s-64", "twin otter", "cessna", "piper", "concorde", "c-130", "hercules", "glider", "motor glider",
            "v-22", "osprey", "puma", "h225", "wildcat", "aw159", "dragonfly", "firefly"
        ]
        sea_title_kw = [
            "boat", "ship", "vessel", "cutter", "corvette", "frigate", "destroyer", "cruiser",
            "yacht", "trawler", "tugboat", "ferry", "patrol boat", "rib", "rhib", "jetski", "jet ski",
            "barge", "lifeboat", "opv", "watercraft", "skiff", "dinghy", "catamaran", "speedboat",
            "hydrofoil", "carrier", "battleship"
        ]
        land_title_kw = [
            "car", "truck", "lorry", "train", "locomotive", "railcar", "boxcar", "shunter", "van", "suv", "jeep", "tank", "panzer",
            "apc", "ifv", "mbt", "atv", "quad", "trailer", "bus", "crawler", "hovercraft", "semitrailer",
            "pickup", "ute", "sedan", "coupe", "wagon", "roadster", "4x4", "6x6", "8x8", "lcac", "loader", "skid steer",
            "road train", "roadtrain", "road-train", "road trains", "roadtrains", "автопоїзд", "автопоезд"
        ]
        underwater_title_kw = [
            "submarine", "submersible", "u-boat", "uboat", "uuv", "rov", "auv",
            "underwater", "subsea", "minisub", "diving bell", "seabed crawler"
        ]

        # Title stripped of daughter deployable craft (e.g. "Helicopter w/ Underwater ROV" -> "Helicopter")
        title_main_craft = re.split(r'\b(?:w/|with|carrying|\+)\b', lower_title, maxsplit=1)[0].strip()
        if not title_main_craft:
            title_main_craft = lower_title

        for w in air_title_kw:
            if match_word(w, title_main_craft): air_score += 12
        for w in sea_title_kw:
            if match_word(w, title_main_craft): sea_score += 12
        if match_word("tanker", title_main_craft) and not any(match_word(w, title_main_craft) for w in ["truck", "lorry", "semi", "trailer", "car", "van", "railcar", "rail", "wagon", "train"]):
            sea_score += 12

        for w in land_title_kw:
            if w == "tank":
                if match_word("tank", title_main_craft) and not any(match_word(t, title_main_craft) for t in [
                    "water tank", "fuel tank", "diesel tank", "slurry tank", "vacuum tank", "hydrovac", "tank module", "wing tank", "drop tank"
                ]):
                    land_score += 12
            else:
                if match_word(w, title_main_craft): land_score += 12

        for w in underwater_title_kw:
            if match_word(w, title_main_craft): underwater_score += 15

        # Surface vessels with deployables (DSV, motherships, exploration ships) should be Sea domain, not Underwater
        if any(match_word(w, title_main_craft) for w in ["ship", "vessel", "mothership", "boat", "cutter", "dsv", "d.s.v.", "catamaran", "yacht", "barge"]):
            underwater_score = 0
            if sea_score < 12:
                sea_score += 15

        # Aircraft with deployables should be Air domain, not Underwater
        if any(match_word(w, title_main_craft) for w in ["helicopter", "heli", "plane", "aircraft", "tiltrotor", "vtol"]):
            underwater_score = 0
            if air_score < 12:
                air_score += 15

        # Dedicated trailers (including boat trailers, plane trailers, gooseneck trailers) should be Land domain
        if any(match_word(w, title_main_craft) for w in ["trailer", "semi-trailer", "semitrailer", "semi trailer", "gooseneck", "lowboy", "dolly"]):
            if not any(match_word(b, title_main_craft) for b in ["ship", "yacht", "cutter", "ferry", "carrier"]):
                sea_score = 0
                air_score = 0
                if land_score < 12:
                    land_score += 15

        if re.search(r"\b(?:uh|ah|ch|sh|mh)[- ]?\d+", title_main_craft): air_score += 15
        if re.search(r"\b(?:6x6|8x8|4x4)\b", title_main_craft): land_score += 10

        # Description evidence (always computed)
        for w in ["helicopter", "rotorcraft", "wingspan", "propeller aircraft", "main rotor", "tail rotor"]:
            if match_word(w, lower_desc): air_score += 3
        for w in ["boat", "ship", "vessel", "hull", "rough seas", "knots top speed", "buoyancy", "patrol vessel", "response boat", "fluid jets", "water cannons"]:
            if match_word(w, lower_desc): sea_score += 3
        for w in ["truck", "car", "suspension", "differential", "tires", "tyres", "gearbox"]:
            if match_word(w, lower_desc): land_score += 3
        for w in ["submarine", "submersible", "underwater", "diving depth", "ballast tank", "periscope", "subsea", "uuv", "rov", "auv"]:
            if match_word(w, lower_desc): underwater_score += 4

        # Steam tags evidence
        steam_domains_present = sum(1 for d in ["air", "sea", "land", "underwater"] if any(d in ot.lower() for ot in original_steam_tags))
        if steam_domains_present < 3:
            for ot in original_steam_tags:
                ot_l = ot.lower()
                if any(x in ot_l for x in ["plane", "helicopter", "air"]): air_score += 8
                if any(x in ot_l for x in ["boat", "ship", "sea"]): sea_score += 8
                if any(x in ot_l for x in ["car", "truck", "land", "train"]): land_score += 8
                if any(x in ot_l for x in ["underwater", "submarine"]): underwater_score += 8

        # Primary domain decision & Conflict Threshold
        domain_ranking = sorted([
            ("underwater", underwater_score),
            ("air", air_score),
            ("sea", sea_score),
            ("land", land_score)
        ], key=lambda x: x[1], reverse=True)

        top_domain, top_score = domain_ranking[0]
        second_domain, second_score = domain_ranking[1]

        primary_domain = top_domain if top_score > 0 else "unknown"

        # Domain Conflict Detection with strict threshold (preventing false alarms on single noise words)
        is_domain_conflict = False
        if top_score >= 12 and second_score >= 12:
            score_diff = top_score - second_score
            if score_diff <= 6:
                is_domain_conflict = True
            else:
                title_favors_second = False
                if second_domain == "air" and any(match_word(w, lower_title) for w in air_title_kw): title_favors_second = True
                elif second_domain == "sea" and any(match_word(w, lower_title) for w in sea_title_kw): title_favors_second = True
                elif second_domain == "land" and any(match_word(w, lower_title) for w in land_title_kw): title_favors_second = True

                steam_favors_top = any(top_domain in ot.lower() for ot in original_steam_tags)
                if title_favors_second and steam_favors_top and second_score >= 15:
                    is_domain_conflict = True

        assigned_vehicles: List[str] = ["Vehicle"]
        is_unsure = is_domain_conflict

        if primary_domain == "underwater":
            assigned_vehicles.append("Underwater")
            if any(match_word(w, full_text) for w in ["uuv", "rov", "auv", "drone", "unmanned", "uncrewed", "autonomous", "remote control", "rc", "remotely operated"]):
                assigned_vehicles.append("UUV")
            elif any(match_word(w, full_text) for w in ["seabed crawler", "underwater crawler", "bottom crawler"]):
                assigned_vehicles.append("UGV")

        elif primary_domain == "air":
            assigned_vehicles.append("Air")
            if any(match_word(w, full_text) for w in ["tiltrotor", "tilt-rotor", "tilt rotor", "v-22", "osprey", "v-280", "v280", "aw280", "valor", "aw609", "lutr"]):
                assigned_vehicles.append("Tiltrotor")
            elif (
                any(match_word(w, lower_title) for w in [
                    "helicopter", "helicopters", "heli", "helis", "chopper", "choppers", "rotorcraft", "helo",
                    "blackhawk", "chinook", "apache", "jayhawk", "seahawk", "huey", "hind", "racer",
                    "h125", "h135", "h145", "h160", "h175", "h200", "h225", "h265", "ec135", "ec145",
                    "nh90", "skycrane", "tarhe", "stallion", "s-64", "s64", "s-92", "s92", "s-76", "s76",
                    "sea king", "wildcat", "super puma", "merlin", "alouette", "little bird", "gyrocopter",
                    "bell 407", "bell 206", "bell 212", "bell 412", "bo-105", "bo105", "bk-117", "bk117",
                    "ka-50", "ka-52", "mi-8", "mi-24", "mi-28"
                ]) or
                re.search(r"\b(?:uh|ah|ch|sh|mh)[- ]?\d+", lower_title) or
                (any(match_word(w, lower_desc) for w in ["helicopter", "helicopters", "rotorcraft", "chopper"]) and not any(match_word(v, full_text) for v in ["vtol", "drone", "uav", "tiltrotor"]))
            ):
                is_experimental = any(match_word(w, full_text) for w in ["pusher rotor", "compound helicopter", "pusher prop", "v-rotor", "flettner", "k-max", "intermeshing", "transverse rotor"])
                if is_experimental:
                    assigned_vehicles.extend(["Helicopter", "Experimental"])
                else:
                    assigned_vehicles.append("Helicopter")
            elif any(match_word(w, full_text) for w in ["seaplane", "flying boat", "floatplane", "amphibian aircraft", "amphibious plane", "catalina"]):
                assigned_vehicles.extend(["Plane", "Seaplane"])
            elif any(match_word(w, full_text) for w in ["vtol", "stovl", "vertical takeoff", "harrier", "f-35b", "yak-38", "jump jet"]):
                assigned_vehicles.extend(["Plane", "VTOL"])
            elif any(match_word(w, full_text) for w in ["uav", "quadcopter", "fpv", "recon drone", "surveillance drone", "drone", "unmanned aerial", "uncrewed aerial", "autonomous aircraft"]):
                assigned_vehicles.append("UAV")
            else:
                is_explicit_plane = (
                    any(match_word(w, full_text) for w in [
                        "plane", "airplane", "aeroplane", "aircraft", "jet", "fighter", "bomber",
                        "biplane", "monoplane", "glider", "airliner", "cessna", "spitfire", "mustang",
                        "corsair", "interceptor", "wingspan", "fixed wing", "fixed-wing", "propeller aircraft",
                        "turboprop", "airframe", "cargo plane", "transport plane"
                    ]) or
                    any("plane" in ot.lower() for ot in (original_steam_tags or []))
                )
                if is_explicit_plane:
                    assigned_vehicles.append("Plane")
                else:
                    is_unsure = True

        elif primary_domain == "sea":
            assigned_vehicles.append("Sea")
            is_surface_craft = any(match_word(w, lower_title) for w in [
                "ship", "boat", "vessel", "cutter", "mothership", "rsv", "r.s.v.",
                "yacht", "catamaran", "barge", "ferry", "tanker", "trawler", "carrier", "tugboat", "tug"
            ])
            is_carried_rib = any(match_word(w, lower_desc) for w in ["deployable rhib", "deployable rib", "tender rhib", "carried rhib", "stern ramp for rhib", "small rhib on deck", "comes with a small deployable"])
            if any(match_word(w, full_text) for w in ["jetski", "jet ski", "personal watercraft", "pwc", "waverunner", "seadoo"]):
                assigned_vehicles.append("Jetski")
            elif not is_surface_craft and (
                any(match_word(w, lower_title) for w in ["submarine", "submersible", "u-boat", "uboat", "ballistic sub", "underwater craft"]) or
                (any(match_word(w, full_text) for w in ["submarine", "submersible", "u-boat", "uboat", "ballistic sub", "underwater craft"]) and not any(match_word(d, lower_title) for d in ["minisub", "rov", "diving bell", "submersible"]))
            ):
                assigned_vehicles = ["Vehicle", "Underwater"]
                if any(match_word(w, full_text) for w in ["uuv", "rov", "auv", "drone", "unmanned", "uncrewed", "autonomous"]):
                    assigned_vehicles.append("UUV")
            elif not is_carried_rib and not any(match_word(w, title_main_craft) for w in ["mothership", "ship", "cutter", "yacht", "carrier", "cruiser", "destroyer", "frigate", "rsv", "r.s.v."]) and (
                any(match_word(w, title_main_craft) for w in ["rib", "rhib"]) or
                any(match_word(w, lower_desc) for w in ["rigid hull inflatable", "rigid inflatable"])
            ):
                assigned_vehicles.extend(["Ship", "RIB"])
            elif any(match_word(w, full_text) for w in ["ekranoplan", "ground effect", "wig craft"]):
                assigned_vehicles.append("Ekranoplan")
            elif any(match_word(w, full_text) for w in ["barge", "floating platform"]) and not any(match_word(w, lower_title) for w in ["tugboat", "tug boat", "harbor tug", "pusher tug", "pusher tugboat", "tug", "towboat", "pusher"]):
                assigned_vehicles.append("Barge")
            elif any(match_word(w, full_text) for w in ["oil rig", "drilling platform", "offshore rig"]):
                assigned_vehicles.append("Oil Rig")
            elif any(match_word(w, full_text) for w in ["usv", "unmanned surface vessel", "drone boat", "autonomous boat", "unmanned boat", "drone ship"]):
                assigned_vehicles.append("USV")
            else:
                assigned_vehicles.append("Ship")
                # Boat sizing: strictly ONE size
                boat_size_assigned = None
                for size_tag in ["Small boat", "Medium boat", "Large boat", "Huge boat"]:
                    if size_tag in custom_matched_tags:
                        boat_size_assigned = size_tag
                        break
                if not boat_size_assigned:
                    len_m = extracted_metrics.get("length")
                    mass_kg = extracted_metrics.get("mass")
                    if mass_kg is not None and mass_kg >= 100000:
                        boat_size_assigned = "Huge boat"
                    elif any(match_word(w, lower_title) for w in ["mothership", "ocean liner", "aircraft carrier", "supertanker", "cargo ship", "container ship", "titanic", "dreadnought", "battleship"]) and (mass_kg is not None and mass_kg >= 50000):
                        boat_size_assigned = "Huge boat"
                    elif len_m is not None and not (mass_kg is not None and mass_kg >= 50000 and len_m < 20):
                        if len_m < 15: boat_size_assigned = "Small boat"
                        elif 15 <= len_m <= 35: boat_size_assigned = "Medium boat"
                        elif 35 < len_m <= 60: boat_size_assigned = "Large boat"
                        else: boat_size_assigned = "Huge boat"
                    else:
                        if mass_kg is not None:
                            if mass_kg < 10000: boat_size_assigned = "Small boat"
                            elif 10000 <= mass_kg <= 30000: boat_size_assigned = "Medium boat"
                            elif 30000 < mass_kg < 100000: boat_size_assigned = "Large boat"
                            else: boat_size_assigned = "Huge boat"
                        elif any(match_word(w, full_text) for w in ["ocean liner", "aircraft carrier", "supertanker", "cargo ship", "container ship", "titanic", "dreadnought", "battleship"]):
                            boat_size_assigned = "Huge boat"
                        elif any(match_word(w, full_text) for w in ["large boat", "frigate", "destroyer", "corvette", "cruiser", "bulk carrier", "large ship", "opv", "large cutter", "mothership"]):
                            boat_size_assigned = "Large boat"
                        elif any(match_word(w, full_text) for w in ["small boat", "skiff", "dinghy", "speedboat", "single deck", "starter boat"]):
                            boat_size_assigned = "Small boat"
                        else:
                            boat_size_assigned = "Medium boat"
                assigned_vehicles.append(boat_size_assigned)

                # Sea sub-types and modifiers
                if any(match_word(w, full_text) for w in ["tugboat", "tug boat", "harbor tug", "pusher tug", "pusher tugboat", "towboat"]) or any(match_word(w, lower_title) for w in ["tug", "pusher"]):
                    assigned_vehicles.append("Tugboat")
                if any(match_word(w, full_text) for w in ["ferry", "car ferry", "passenger ferry"]):
                    assigned_vehicles.append("Ferry")
                if any(match_word(w, full_text) for w in ["oil tanker", "chemical tanker", "fuel barge", "supertanker"]):
                    assigned_vehicles.append("Tanker")
                if any(match_word(w, full_text) for w in ["osv", "offshore supply", "platform supply", "anchor handler"]):
                    assigned_vehicles.append("OSV")
                if any(match_word(w, full_text) for w in ["catamaran", "twin hull", "dual hull", "multihull", "multi-hull"]):
                    assigned_vehicles.append("Catamaran")
                if any(match_word(w, full_text) for w in ["hydrofoil", "foilcraft", "submerged foil"]):
                    assigned_vehicles.append("Hydrofoil")

        elif primary_domain == "land":
            assigned_vehicles.extend(["Land", "Terrestrial"])
            is_loader = (
                any(match_word(w, lower_title) for w in [
                    "skid steer", "skid-steer", "skidsteer", "front loader", "front-end loader", "front-loader",
                    "wheel loader", "wheelloader", "track loader", "tracked loader", "crawler loader",
                    "forklift", "telehandler", "backhoe", "backhoe loader", "uniload", "qtach", "q1load", "q9load",
                    "лоадер", "навантажувач", "погрузчик"
                ]) or
                (any(match_word(w, lower_desc) for w in ["skid steer", "front loader", "wheel loader", "track loader", "forklift", "telehandler"]) and not any(match_word(w, lower_title) for w in ["trailer", "semi-trailer", "semitrailer", "barge", "ship", "boat"]))
            )
            is_flying = any(match_word(w, full_text) for w in ["skycrane", "tarhe", "s-64", "helicopter", "heli", "plane", "aircraft", "vtol", "drone", "airlift"])

            # 1. Bus / Articulated bus (must precede Train to prevent Ikarus being classified as train)
            is_bus = (
                any(match_word(w, lower_title) for w in ["bus", "coach", "city bus", "transit bus", "school bus", "ikarus", "orion ikarus", "bendibus", "articulated bus", "autobus", "автобус", "shuttle"]) or
                (match_word("touring", lower_title) and any(match_word(w, full_text) for w in ["bus", "coach", "passengers", "passenger"])) or
                any(match_word(w, lower_desc) for w in ["bus/coach", "city bus", "transit bus", "coach bus", "tour bus", "touring bus", "school bus", "passenger bus", "bendy bus", "articulated bus"]) or
                (match_word("bus", lower_desc) and match_word("coach", lower_desc))
            )

            # 2. Road Train (highway multi-trailer truck / road combination; must precede Train & Rail)
            is_road_train = (
                any(match_word(w, lower_title) for w in ["road train", "roadtrain", "road-train", "road trains", "roadtrains", "автопоїзд", "автопоезд"]) or
                match_word("roadtrain", full_text) or
                (match_word("road train", full_text) and not any(match_word(w, lower_title) for w in ["rail", "railway", "railroad", "locomotive"]))
            )

            # 3. Land Train / Overland Train (off-rail terrestrial or amphibious)
            is_land_train = (
                any(match_word(w, lower_title) for w in ["landcrawler", "land crawler", "land train", "overland train", "land-train"]) or
                ("nomad" in lower_title and not any(match_word(w, lower_title) for w in ["car", "rally", "drone"])) or
                (match_word("land train", full_text) and not any(match_word(w, lower_title) for w in ["rail", "railway", "railroad", "locomotive"]))
            )

            # 4. Standalone Crane on land (excluding auxiliary crane arm mounted on service vehicle)
            title_no_aux_crane = re.sub(r'\(?\s*\bw(?:ith)?/\s*crane\b\s*\)?', ' ', lower_title)
            is_standalone_crane = (
                any(match_word(w, lower_title) for w in ["loader crane", "mobile crane", "truck crane", "crawler crane", "all-terrain crane"]) or
                (match_word("crane", title_no_aux_crane) and not any(match_word(w, lower_title) for w in ["skycrane", "s-64", "s64", "air crane", "train", "railcar", "hi-rail", "road-rail"]))
            )

            # 5. Rail vehicles / Trains on rails
            rail_title_words = [
                "train", "locomotive", "railway", "railroad", "wagon", "carriage", "tram", "railcar", "boxcar", "shunter", "hi-rail", "road-rail"
            ]
            has_rail_title_match = False
            for rw in rail_title_words:
                if rw == "train":
                    if match_train_word(lower_title):
                        has_rail_title_match = True
                        break
                elif match_word(rw, lower_title):
                    has_rail_title_match = True
                    break

            is_rail_vehicle = (
                not is_road_train and not is_land_train and not is_bus and (
                    has_rail_title_match or
                    ("train" in orig_steam_set)
                )
            )

            if is_loader and not is_flying:
                assigned_vehicles.append("Loaders")
            elif is_bus:
                assigned_vehicles.extend(["Trucks", "Bus"])
                if any(match_word(w, full_text) for w in ["amphibian", "amphibious", "amphicar", "swimming bus"]):
                    assigned_vehicles.append("Amphibious")
            elif is_road_train:
                is_trailer_part = any(match_word(w, lower_title) for w in ["trailer", "semi-trailer", "semitrailer", "dolly", "b-double", "b-triple", "converter dolly", "tanker"])
                is_truck_part = any(match_word(w, lower_title) for w in ["truck", "prime mover", "tractor", "hauler", "kenworth", "mack", "western star", "scania", "volvo", "man", "peterbilt", "titan"])
                if is_trailer_part and not is_truck_part:
                    assigned_vehicles.append("Trailer")
                    if any(match_word(w, full_text) for w in ["semi-trailer", "semitrailer", "b-double", "b-triple"]):
                        assigned_vehicles.append("Semi-trailer")
                    else:
                        assigned_vehicles.append("Heavy Trailer")
                elif is_truck_part and is_trailer_part:
                    assigned_vehicles.extend(["Trucks", "Truck", "Trailer", "Heavy Trailer"])
                else:
                    assigned_vehicles.extend(["Trucks", "Truck"])
                    if bool(FOUR_BY_FOUR.search(full_text) or HEAVY_ALL_WHEEL.search(full_text)):
                        assigned_vehicles.append("Offroad_truck")
            elif is_land_train:
                is_amphibious = (
                    any(match_word(w, full_text) for w in ["amphibious", "amphibian", "floating", "buoyancy", "swims", "swimming"]) or
                    "sea" in orig_steam_set or "fishing" in orig_steam_set
                )
                if is_amphibious:
                    assigned_vehicles.append("Amphibious")
                    if "Terrestrial" in assigned_vehicles:
                        assigned_vehicles.remove("Terrestrial")
                if any(match_word(w, lower_title) for w in ["trailer", "semi-trailer", "semitrailer"]):
                    assigned_vehicles.append("Trailer")
                # If not amphibious, Terrestrial remains assigned. Train is never assigned.
            elif is_rail_vehicle:
                # Experimental train
                is_exp_train = any(match_word(w, full_text) for w in ["rocket train", "jet train", "experimental train", "supersonic train", "thrust powered train", "turbine train"])
                # Service railcar / Maintenance / Road-rail / Hi-rail
                is_service_railcar = (
                    any(match_word(w, lower_title) for w in ["hi-rail", "road-rail", "maintenance", "repair", "service railcar", "crane railcar", "track repair", "track maintenance", "shunting truck", "shunter truck"]) or
                    ("crane" in lower_title and "railcar" in lower_title) or
                    ("handler" in lower_title and "railcar" in lower_title)
                )
                # Multiple Units
                is_mu_trainset = any(match_word(w, lower_title) for w in ["multiple-unit", "multiple unit", "dmu", "emu", "tram", "streetcar", "flexity", "trainset", "train set", "passenger train consist"])
                is_mu_locomotive = any(match_word(w, lower_title) for w in ["multiple-unit train", "multiple unit train", "booster unit", "b-unit", "a-unit", "twin locomotive", "mu locomotive"])

                if is_exp_train:
                    assigned_vehicles.append("Experimental_train")
                elif is_service_railcar:
                    assigned_vehicles.append("Service_railcar")
                    if any(match_word(w, lower_title) for w in ["truck", "rodeo", "convoy"]):
                        assigned_vehicles.append("Trucks")
                        assigned_vehicles.append("Offroad_truck" if bool(FOUR_BY_FOUR.search(full_text) or HEAVY_ALL_WHEEL.search(full_text)) else "Truck")
                elif is_mu_locomotive and any(match_word(w, lower_title) for w in ["locomotive", "diesel locomotive", "electric locomotive"]):
                    assigned_vehicles.extend(["Locomotive", "Multiple Units"])
                elif is_mu_trainset:
                    assigned_vehicles.append("Multiple Units")
                elif any(match_word(w, lower_title) for w in ["locomotive", "shunter", "diesel-electric locomotive", "steam locomotive", "electric locomotive", "switcher"]):
                    assigned_vehicles.append("Locomotive")
                elif any(match_word(w, lower_title) for w in ["railcar", "boxcar", "tanker railcar", "hopper", "flatcar", "rail wagon", "cargo railcar", "logging railcar", "passenger railcar", "sleeper railcar"]):
                    assigned_vehicles.append("Railcar")
                else:
                    assigned_vehicles.append("Train")
            elif is_standalone_crane:
                assigned_vehicles.append("Crane")
            elif any(match_word(w, full_text) for w in ["ugv", "unmanned ground vehicle", "ground drone", "rover", "unmanned rover", "crawler drone", "seabed crawler", "underwater crawler"]):
                assigned_vehicles.append("UGV")
            elif any(match_word(w, full_text) for w in ["hovercraft", "acv", "air cushion vehicle", "lcac"]):
                assigned_vehicles.append("Hovercraft")
            elif (
                any(match_word(w, lower_title) for w in [
                    "panzer", "radpanzer", "apc", "ifv", "mbt", "armored car", "spg", "abrams", "t-72", "t-80", "t-90", "leopard", "afv",
                    "armored personnel carrier", "mrap", "armored vehicle", "infantry fighting vehicle", "battle tank"
                ]) or
                (match_word("tank", lower_title) and not any(match_word(w, lower_title) for w in [
                    "tanker", "tank truck", "water tank", "fuel tank", "diesel tank", "slurry tank", "vacuum tank",
                    "hydrovac", "trailer", "semi", "tank module", "tank addon", "wing tank", "drop tank", "external tank", "cargo tank"
                ])) or
                any(match_word(w, lower_desc) for w in [
                    "main battle tank", "battle tank", "light tank", "panzer", "armored personnel carrier", "infantry fighting vehicle",
                    "mrap", "armored fighting vehicle", "tracked apc", "wheeled apc"
                ])
            ):
                assigned_vehicles.append("Armored_vehicle")
            elif (
                (not (bool(re.search(r'\b(?:semi[- ]?)?trailer[- ](?:truck|pickup|hauler|tractor|lorry)\b', lower_title)) and not bool(re.search(r'\btrailer\s+(?:for|to|behind|w/|with)\b', lower_title)))) and
                any(match_word(w, lower_title) for w in ["trailer", "semitrailer", "semi-trailer", "semi trailer", "dolly", "lowboy", "gooseneck"])
            ):
                assigned_vehicles.append("Trailer")
                if any(match_word(w, full_text) for w in ["gooseneck", "goose neck", "rgn", "гусак", "гусенек"]):
                    assigned_vehicles.append("Gooseneck Trailer")
                elif any(match_word(w, full_text) for w in ["semi-trailer", "semitrailer", "semi trailer", "5th wheel", "fifth wheel", "kingpin", "saddle hitch", "напівпричіп", "полуприцеп"]):
                    assigned_vehicles.append("Semi-trailer")
                elif any(match_word(w, full_text) for w in ["light trailer", "car trailer", "small trailer", "boat trailer"]):
                    assigned_vehicles.append("Light Trailer")
                else:
                    assigned_vehicles.append("Heavy Trailer")
                if any(match_word(w, full_text) for w in ["amphibious", "amphibian", "floating", "buoyancy", "swims"]):
                    assigned_vehicles.append("Amphibious")
            elif any(match_word(w, full_text) for w in ["atv", "quad", "quad bike", "utv", "sxs", "side-by-side", "rzr", "polaris", "can-am"]):
                assigned_vehicles.extend(["Cars", "ATV"])
            elif any(match_word(w, full_text) for w in ["van", "minibus", "cargo van", "campervan", "sprinter", "panel van"]):
                assigned_vehicles.extend(["Light_trucks", "Van"])
            elif any(match_word(w, full_text) for w in ["kei truck", "kei-truck", "kei car", "mini truck"]):
                assigned_vehicles.extend(["Light_trucks", "Kei_truck"])
            elif (
                any(match_word(w, lower_title) for w in ["truck", "lorry", "hauler", "semi truck", "flatbed truck", "dump truck", "tractor unit", "semi-tractor", "tow truck", "box truck"]) or
                any(match_word(w, full_text) for w in [
                    "scania", "volvo fh", "actros", "man tgx", "peterbilt", "kenworth", "freightliner", "mack",
                    "kamaz", "kraz", "tatra", "ural", "hemtt", "oshkosh", "unimog", "semi-tractor", "logging truck", "haul truck"
                ]) or
                bool(HEAVY_ALL_WHEEL.search(full_text)) or
                count_matches(["truck", "hauler", "cargo bay", "fifth wheel", "flatbed"], lower_desc) >= 2
            ):
                assigned_vehicles.append("Trucks")
                is_offroad = bool(FOUR_BY_FOUR.search(full_text) or HEAVY_ALL_WHEEL.search(full_text) or match_word("offroad", full_text) or match_word("all-terrain", full_text))
                assigned_vehicles.append("Offroad_truck" if is_offroad else "Truck")
            elif any(match_word(w, lower_title) for w in ["pickup", "pick-up", "ute"]):
                assigned_vehicles.extend(["Cars", "Pickup"])
            elif any(match_word(w, full_text) for w in ["suv", "crossover", "sport utility", "range rover", "defender", "nissan patrol", "g-wagon"]):
                assigned_vehicles.extend(["Cars", "SUV"])
            else:
                assigned_vehicles.append("Cars")
                is_offroad = bool(FOUR_BY_FOUR.search(full_text) or match_word("offroad", full_text) or match_word("crawler", full_text) or match_word("jeep", full_text))
                assigned_vehicles.append("Offroad_car" if is_offroad else "Passenger_car")

            # Amphibious check for all land vehicles
            if any(match_word(w, full_text) for w in ["amphibian", "amphibious", "amphicar", "swims", "swimming", "floating vehicle", "амфібія"]):
                if "Amphibious" not in assigned_vehicles:
                    assigned_vehicles.append("Amphibious")

            # Tracked check for all land vehicles (Terrestrial child)
            is_tank_craft = (
                any(match_word(w, lower_title) for w in ["mbt", "main battle tank", "battle tank", "panzer"]) or
                (match_word("tank", lower_title) and not any(match_word(w, lower_title) for w in [
                    "tanker", "tank truck", "water tank", "fuel tank", "diesel tank", "slurry tank", "vacuum tank",
                    "hydrovac", "trailer", "semi", "tank module", "tank addon", "wing tank", "drop tank", "external tank", "cargo tank"
                ]))
            )
            is_wheeled = any(match_word(w, full_text) for w in ["wheeled", "wheels", "8x8", "6x6", "4x4", "radpanzer", "radkampfwagen"])
            is_tracked = (
                (is_tank_craft and not is_wheeled) or
                any(match_word(w, full_text) for w in [
                    "tracked", "caterpillar", "half-track", "halftrack",
                    "continuous tracks", "continuous track", "tank tracks", "rubber tracks",
                    "caterpillar tracks", "гусеничний", "гусениці", "гусеницы", "гусеничный"
                ]) or
                (match_word("crawler", full_text) and not any(match_word(rc, full_text) for rc in ["rock crawler", "rock-crawler"])) or
                bool(re.search(r"\b(?:on|with)\s+tracks\b", full_text)) or
                bool(re.search(r"\btracks\b", lower_title) and not any(match_word(x, lower_title) for x in ["soundtrack", "race track", "racetrack", "train track", "rail track", "rail tracks"]))
            )
            if is_tracked and not is_rail_vehicle:
                if "Tracked" not in assigned_vehicles:
                    assigned_vehicles.append("Tracked")

            if "Amphibious" in assigned_vehicles:
                if "Terrestrial" in assigned_vehicles:
                    assigned_vehicles.remove("Terrestrial")
                if "Land" in assigned_vehicles:
                    assigned_vehicles.remove("Land")

        # Check Container Carrier capability for vehicles/transports
        is_container_carrier = (
            any(match_word(w, lower_title) for w in [
                "container ship", "containership", "boxship", "container truck", "container transport",
                "container transporter", "unicon truck", "unicon box truck", "unicon cargo van", "unicon trailer",
                "container semi trailer", "unicon semi trailer", "unicon box semi trailer", "unicon gooseneck trailer",
                "unicon hitch trailer", "container railcar", "unicon railcar", "unicon boxcar", "container handler",
                "unicon forklift", "unicon loader", "unicon uld lifter", "unicon quick lift", "container grabber",
                "unicon grabber", "20ft self loader semi trailer", "multilift"
            ]) or
            ("unicon" in lower_title and any(w in lower_title for w in ["truck", "van", "trailer", "railcar", "loader", "forklift", "lifter"])) or
            ("container" in lower_title and any(w in lower_title for w in ["truck", "transporter", "carrier", "handler", "trailer", "railcar", "semi trailer"]))
        )
        if is_container_carrier:
            assigned_vehicles.append("Container Carrier")

        # -------------------------------------------------------------
        # 5. MERGE CUSTOM VEHICLE RULES (STRICT DOMAIN CONFINED)
        # -------------------------------------------------------------
        allowed_domain_set = AIR_TAGS if primary_domain == "air" else (UNDERWATER_TAGS if primary_domain == "underwater" else (SEA_TAGS if primary_domain == "sea" else LAND_TAGS))
        for c_tag in custom_matched_tags:
            if c_tag in allowed_domain_set and c_tag not in assigned_vehicles:
                # Exclusivity guards
                if primary_domain == "air":
                    if "Helicopter" in assigned_vehicles and c_tag in ["Plane", "VTOL", "Seaplane"]: continue
                    if "Plane" in assigned_vehicles and c_tag in ["Helicopter", "Tiltrotor"]: continue
                elif primary_domain == "sea":
                    if any(t in assigned_vehicles for t in ["Small boat", "Medium boat", "Large boat", "Huge boat", "RIB"]):
                        if c_tag in ["Small boat", "Medium boat", "Large boat", "Huge boat", "RIB"]: continue
                elif primary_domain == "land":
                    is_trailer = any(t in assigned_vehicles for t in ["Trailer", "Semi-trailer", "Light Trailer", "Heavy Trailer", "Gooseneck Trailer"])
                    is_standalone_trailer = is_trailer and not (is_road_train and is_truck_part) and not any(match_word(w, lower_title) for w in ["truck", "lorry", "tractor", "prime mover"])
                    if is_standalone_trailer:
                        if c_tag in ["Truck", "Trucks", "Offroad_truck", "Passenger_car", "Cars", "SUV", "Pickup", "Van", "Bus"]:
                            continue
                    if "Bus" in assigned_vehicles and c_tag in ["Truck", "Offroad_truck", "Trucks", "Light_trucks", "Van"]:
                        continue
                    if any(t in assigned_vehicles for t in ["Truck", "Offroad_truck", "Trucks", "Light_trucks", "Van"]) and c_tag == "Bus":
                        continue
                    if any(t in assigned_vehicles for t in ["Truck", "Offroad_truck", "Bus", "Van"]):
                        if c_tag in ["Passenger_car", "SUV", "Pickup", "Offroad_car", "Cars"]: continue
                    if any(t in assigned_vehicles for t in ["Passenger_car", "SUV", "Pickup", "Offroad_car"]):
                        if c_tag in ["Truck", "Offroad_truck", "Bus", "Trucks"]: continue
                assigned_vehicles.append(c_tag)

        # Final domain sanitize: remove ANY vehicle tag that leaks across domain
        assigned_vehicles = [
            t for t in assigned_vehicles
            if t == "Vehicle" or t in allowed_domain_set or t in ["Nuclear", "Steam", "Hybrid", "Electric", "Container Carrier"]
        ]
        if "Bus" in assigned_vehicles:
            for trk in ["Truck", "Offroad_truck", "Trucks", "Light_trucks", "Van"]:
                if trk in assigned_vehicles:
                    assigned_vehicles.remove(trk)

        # -------------------------------------------------------------
        # 6. ROLE SCORING ENGINE (SINGLE PRIMARY ROLE + RARE DUAL EXCEPTION)
        # -------------------------------------------------------------
        role_scores: Dict[str, int] = {
            "Combat": 0, "Support": 0, "SAR": 0, "Firefighting": 0,
            "Police": 0, "Medical": 0, "Commercial": 0, "Fishing": 0, "Research": 0,
            "Farming": 0, "Construction": 0, "Industrial": 0, "Utility": 0,
            "Personal": 0
        }

        # Dedicated role boosts for specific vehicle classes
        if "Crane" in assigned_vehicles or "Service_railcar" in assigned_vehicles:
            role_scores["Utility"] += 15
        if is_road_train:
            role_scores["Commercial"] += 15

        # Title Scoring (+12 to +14)
        if any(match_word(w, lower_title) for w in [
            "combat", "gunship", "interceptor", "bomber", "fighter jet", "attack heli", "warfare",
            "battleship", "destroyer", "torpedo boat", "mbt", "panzer", "warship",
            "defense", "defence", "attack", "armed", "coastal defense", "artillery", "patrol gunboat"
        ]):
            role_scores["Combat"] += 14
        if any(match_word(w, lower_title) for w in [
            "military support", "troop transport", "military transport", "chinook", "ch-47", "mh-47",
            "ch-53", "super stallion", "king stallion", "ch-54", "tarhe", "skycrane", "s-64", "s64",
            "c-130", "hercules", "c-17", "globemaster", "il-76", "an-12", "an-26", "an-124", "v-22", "osprey",
            "replenishment ship", "fleet replenishment", "ammunition carrier", "combat support", "military logistics",
            "awacs", "air refueling tanker", "aerial refueling", "heavy lift helicopter", "heavy-lift helicopter",
            "cargo helicopter", "transport helicopter", "heavy cargo plane", "military recovery"
        ]):
            role_scores["Support"] += 12
        if any(match_word(w, lower_title) for w in [
            "commercial", "cargo", "freight", "container ship", "containership", "bulk carrier", "cargo ship",
            "freighter", "hauler", "cargo plane", "cargo aircraft", "delivery truck", "semi truck", "flatbed truck",
            "dump truck", "tanker ship", "oil tanker", "tugboat", "tug boat", "ferry", "car ferry", "barge",
            "ore carrier", "box truck", "cargo van", "logistics",
            "road train", "roadtrain", "road-train", "road trains", "roadtrains", "автопоїзд", "автопоезд",
            "personnel transport", "passenger transport", "passenger bus", "transit bus"
        ]):
            role_scores["Commercial"] += 12
        if any(match_word(w, lower_title) for w in ["sar", "search and rescue", "lifeboat", "rescue boat", "rescue helicopter", "rescue ship", "coast guard", "coastguard", "o-sar", "rnli", "lifeguard", "fast response", "uscg"]):
            role_scores["SAR"] += 12
        if any(match_word(w, lower_title) for w in [
            "fire truck", "fire engine", "fireboat", "fire boat", "fire fighting", "firefighting",
            "firefighter", "fire tender", "p-2700", "pumper truck", "ladder truck", "brush truck", "water bomber",
            "water cannon", "fire drone", "fire rescue"
        ]):
            role_scores["Firefighting"] += 14
        if any(match_word(w, lower_title) for w in [
            "police", "sheriff", "cop car", "state trooper", "highway patrol", "interceptor police",
            "prisoner transport", "prison transport"
        ]):
            role_scores["Police"] += 14
        if any(match_word(w, lower_title) for w in ["ambulance", "hospital ship", "medevac", "paramedic", "air ambulance", "mobile hospital", "hospital boat", "medical evacuation"]):
            role_scores["Medical"] += 12
        if any(match_word(w, lower_title) for w in ["trawler", "fishing boat", "seiner", "crab boat", "longliner", "fisher"]):
            role_scores["Fishing"] += 12
        if any(match_word(w, lower_title) for w in ["research vessel", "survey vessel", "oceanographic", "exploration vessel", "exploration", "explorer", "research", "rsv", "r.s.v.", "research mothership"]):
            role_scores["Research"] += 12
        if any(match_word(w, lower_title) for w in ["tractor", "harvester", "combine", "agriculture", "farming"]):
            role_scores["Farming"] += 12
        if any(match_word(w, lower_title) for w in ["excavator", "bulldozer", "construction crane", "dumper", "wheel loader"]):
            role_scores["Construction"] += 12
        if any(match_word(w, lower_title) for w in ["mining truck", "oil platform", "drilling rig"]):
            role_scores["Industrial"] += 12
        if any(match_word(w, lower_title) for w in ["snowplow", "street sweeper", "garbage truck", "service truck", "tow truck", "road maintenance", "cherry picker"]):
            role_scores["Utility"] += 12
        if any(match_word(w, lower_title) for w in ["pilot boat", "pilot vessel", "harbor pilot", "harbour pilot", "workboat", "work boat", "utility boat", "maintenance boat"]):
            role_scores["Utility"] += 12
        if any(match_word(w, lower_title) for w in ["crew boat", "crewboat", "crew transfer vessel", "ctv"]):
            role_scores["Commercial"] += 12
        if any(match_word(w, lower_title) for w in ["camper", "motorhome", "rv", "private yacht", "pleasure craft", "daily driver", "personal boat", "personal watercraft"]):
            role_scores["Personal"] += 12

        # Description Scoring (+3 to +8)
        if any(match_word(w, lower_desc) for w in [
            "autocannon", "heavy autocannon", "battle cannon", "missile", "missiles", "phosphor missiles",
            "torpedo", "depth charge", "ciws", "bombs", "guided missiles", "rotary autocannon"
        ]):
            role_scores["Combat"] += 8
        if any(match_word(w, lower_desc) for w in ["troop transport", "military logistics", "refueling boom", "troop seats", "cargo bay for vehicles", "vehicle ramp for tanks", "airlift capability"]):
            role_scores["Support"] += 4
        if any(match_word(w, lower_desc) for w in ["cargo hold", "intermodal container", "iso container", "commercial transport", "bulk cargo", "pallet cargo", "cargo capacity", "shipping container", "freight transport"]):
            role_scores["Commercial"] += 4
        if any(match_word(w, lower_desc) for w in ["search and rescue", "coast guard", "rescue response", "rescue winch", "life raft", "survivor seats"]):
            role_scores["SAR"] += 4
        if any(match_word(w, lower_desc) for w in ["fire department", "fire truck", "fire engine", "firefighting equipment", "fire fighting equipment", "structural firefighting", "wildland firefighting", "fire response", "foam system for firefighting", "water monitor", "firefighting water cannon"]) and not any(match_word(w, lower_title) for w in ["bus", "coach", "transit"]):
            role_scores["Firefighting"] += 4
        if any(match_word(w, lower_desc) for w in ["police lights", "police siren", "police interceptor", "law enforcement"]):
            role_scores["Police"] += 4
        if any(match_word(w, lower_desc) for w in ["intensive care unit", "paramedic vehicle", "medical transport", "surgical suite", "operating theater", "patient transport ambulance"]):
            role_scores["Medical"] += 4
        if any(match_word(w, lower_desc) for w in ["fishing nets", "fish hold", "trawl gear"]):
            role_scores["Fishing"] += 4
        if any(match_word(w, lower_desc) for w in ["research equipment", "sonar survey", "ocean mapping", "scientific instruments", "exploration vehicle", "exploration base", "exploration mission", "exploration missions"]):
            role_scores["Research"] += 4

        # Custom rules role matches
        for c_tag in custom_matched_tags:
            if c_tag in role_scores:
                role_scores[c_tag] += 6
            elif c_tag == "Comercial":
                role_scores["Commercial"] += 6

        # Exclusivity: SAR suppresses Firefighting, Medical, and non-military Support
        if role_scores["SAR"] > 0:
            role_scores["Firefighting"] = 0
            if role_scores["Medical"] >= 12 and role_scores["SAR"] < 12:
                role_scores["SAR"] = 0
            else:
                role_scores["Medical"] = 0
            # SAR suppresses Support unless explicit military context
            if role_scores["Combat"] == 0 and not any(match_word(w, full_text) for w in ["military", "navy", "air force", "army", "armed forces", "usaf"]):
                role_scores["Support"] = 0

        # Exclusivity: Combat vs Support (strictly mutually exclusive)
        if role_scores["Combat"] > 0 and role_scores["Support"] > 0:
            if role_scores["Combat"] >= role_scores["Support"]:
                role_scores["Support"] = 0
            else:
                role_scores["Combat"] = 0

        # Combat suppresses civilian service, commercial and personal roles
        if role_scores["Combat"] > 0:
            for r in ["Firefighting", "Police", "Medical", "Personal", "Utility", "Commercial", "Fishing", "Research", "Farming", "Construction", "Industrial"]:
                role_scores[r] = 0

        # Heavy transport, military, cargo or service vehicle suppresses Personal
        if any(role_scores[r] > 0 for r in ["Combat", "Support", "Commercial", "Industrial", "Construction", "Farming", "Police", "Firefighting", "SAR"]):
            role_scores["Personal"] = 0
        if any(match_word(w, full_text) for w in [
            "chinook", "ch-47", "mh-47", "ch-53", "stallion", "skycrane", "tarhe", "c-130", "hercules",
            "c-17", "globemaster", "cargo", "freight", "container", "tanker", "tugboat", "ferry",
            "warship", "battleship", "destroyer", "carrier", "frigate", "corvette", "military"
        ]):
            role_scores["Personal"] = 0

        # Rank candidate roles
        sorted_roles = sorted([(r, s) for r, s in role_scores.items() if s >= 3], key=lambda x: x[1], reverse=True)
        assigned_roles: List[str] = []

        # Check for Diving Support Vessel (D.S.V.)
        is_dsv = (
            any(match_word(w, lower_title) for w in ["dsv", "d.s.v."]) or
            any(match_word(w, full_text) for w in ["diving support", "diver support", "diving mothership", "dive support"])
        )
        if is_dsv:
            is_military_dsv = any(match_word(w, full_text) for w in ["combat", "military", "navy", "naval", "warfare", "armed forces", "torpedo", "combat diver"])
            if is_military_dsv:
                assigned_roles = ["Research", "Support"]
            else:
                assigned_roles = ["Research"]
        # Check if vehicle is an Underwater craft (submarines, UUV)
        elif any(t in assigned_vehicles for t in ["Underwater", "UUV"]):
            has_explicit_military = any(match_word(w, full_text) for w in ["combat", "military", "warfare", "torpedo", "weapon", "navy", "naval warfare", "patrol", "attack submarine", "ballistic sub"])
            has_explicit_commercial = any(match_word(w, full_text) for w in ["commercial", "cargo", "mining", "drilling", "survey", "offshore", "industrial", "freight"])
            has_explicit_personal = any(match_word(w, full_text) for w in ["personal", "yacht", "recreational", "private", "luxury", "pleasure"])
            if not (has_explicit_military or has_explicit_commercial or has_explicit_personal):
                assigned_roles = ["Utility"]
            elif sorted_roles:
                assigned_roles = [sorted_roles[0][0]]
            else:
                assigned_roles = ["Utility"]
        elif sorted_roles:
            primary_role = sorted_roles[0][0]
            assigned_roles.append(primary_role)
            # Check if second role is permitted by ALLOWED_DUAL_ROLES
            if len(sorted_roles) > 1 and sorted_roles[1][1] >= 4:
                secondary_role = sorted_roles[1][0]
                pair = frozenset({primary_role, secondary_role})
                if pair in ALLOWED_DUAL_ROLES:
                    assigned_roles.append(secondary_role)
        else:
            # Fallback based on vehicle category
            if any(t in assigned_vehicles for t in ["Underwater", "UUV", "UAV", "UGV", "USV"]):
                assigned_roles = ["Utility"]
            elif any(t in assigned_vehicles for t in ["Loaders"]):
                assigned_roles = ["Construction"]
            elif any(t in assigned_vehicles for t in ["Crane"]):
                assigned_roles = ["Utility"]
            elif any(t in assigned_vehicles for t in ["Hovercraft"]):
                assigned_roles = ["Utility"]
            elif any(t in assigned_vehicles for t in ["Service_railcar"]):
                assigned_roles = ["Utility"]
            elif any(t in assigned_vehicles for t in ["Train", "Locomotive", "Railcar", "Multiple Units", "Experimental_train"]):
                assigned_roles = ["Commercial"]
            elif any(t in assigned_vehicles for t in ["Truck", "Offroad_truck", "Trucks", "Light_trucks", "Van", "Kei_truck", "Bus", "Trailer", "Semi-trailer", "Gooseneck Trailer", "Tugboat", "Ferry", "Tanker", "Barge"]):
                assigned_roles = ["Commercial"]
            elif any(t in assigned_vehicles for t in ["Armored_vehicle"]):
                assigned_roles = ["Combat"]
            elif any(t in assigned_vehicles for t in ["Passenger_car", "SUV", "Pickup", "Ute", "Offroad_car", "ATV", "Jetski"]):
                assigned_roles = ["Personal"]
            elif any(t in assigned_vehicles for t in ["Small boat", "RIB", "Hydrofoil", "Catamaran"]):
                assigned_roles = ["Personal"]
            elif any(t in assigned_vehicles for t in ["Medium boat"]):
                # Medium boat fallback: Commercial unless explicitly personal
                is_personal_boat = any(match_word(w, full_text) for w in ["yacht", "speedster", "speedboat", "pleasure", "recreation", "personal", "cabin cruiser", "sport"])
                assigned_roles = ["Personal"] if is_personal_boat else ["Commercial"]
            elif any(t in assigned_vehicles for t in ["Large boat", "Huge boat", "Ship"]):
                assigned_roles = ["Commercial"]
            elif any(t in assigned_vehicles for t in ["Plane", "Helicopter", "VTOL", "Tiltrotor", "Seaplane"]):
                if any(match_word(w, full_text) for w in ["chinook", "stallion", "skycrane", "tarhe", "hercules", "c-130", "c-17", "heavy lift", "cargo"]):
                    assigned_roles = ["Support"]
                elif any(match_word(w, full_text) for w in ["airliner", "airbus", "boeing", "passenger", "cargo", "commercial", "transport", "freight"]):
                    assigned_roles = ["Commercial"]
                else:
                    assigned_roles = ["Personal"]
            else:
                # If role could not be determined at all -> mark as Uncertain
                is_unsure = True
                assigned_roles = []

        # Add parent roles to tree so prune_parents can normalize correctly
        parent_roles = []
        for r in assigned_roles:
            if r in ["Combat", "Support"]: parent_roles.append("Military")
            elif r in ["SAR", "Firefighting", "Police", "Medical"]: parent_roles.append("Emergency")
            elif r in ["Fishing", "Farming", "Construction", "Industrial"]:
                parent_roles.append("Commercial")
            elif r in ["Utility", "Research"]: parent_roles.append("Civilian")
        assigned_roles.extend(parent_roles)

        # -------------------------------------------------------------
        # 7. ASSEMBLE, EVALUATE MUTUAL EXCLUSIONS & PRUNE PARENTS
        # -------------------------------------------------------------
        raw_assigned_tags = list(dict.fromkeys(assigned_vehicles + assigned_roles + assigned_modifiers))

        # Check user-configured exclusions and priorities (supporting cascading across child branches)
        excluded_tags_set = set()
        for rule_tag, rule_def in custom_rules.items():
            if not isinstance(rule_def, dict) or "exclusions" not in rule_def:
                continue
            for other_tag, ex_info in rule_def["exclusions"].items():
                if isinstance(ex_info, dict):
                    priority = ex_info.get("priority", "win")
                    cascade = bool(ex_info.get("cascade", False))
                else:
                    priority = str(ex_info)
                    cascade = False

                if cascade:
                    cluster_a = {rule_tag} | get_all_descendants(rule_tag)
                    cluster_b = {other_tag} | get_all_descendants(other_tag)
                else:
                    cluster_a = {rule_tag}
                    cluster_b = {other_tag}

                active_a = [t for t in cluster_a if t in raw_assigned_tags and t not in excluded_tags_set]
                active_b = [t for t in cluster_b if t in raw_assigned_tags and t not in excluded_tags_set]

                if active_a and active_b:
                    if priority == "win":
                        for b_tag in active_b:
                            excluded_tags_set.add(b_tag)
                    elif priority == "lose":
                        for a_tag in active_a:
                            excluded_tags_set.add(a_tag)
                    elif priority == "equal":
                        is_unsure = True

        raw_assigned_tags = [t for t in raw_assigned_tags if t not in excluded_tags_set]

        # Check for domain conflicts (e.g. car + boat)
        domains_detected = set()
        if any(t in raw_assigned_tags for t in ["Air", "Plane", "Helicopter", "Tiltrotor", "UAV", "Seaplane"]):
            domains_detected.add("air")
        if any(t in raw_assigned_tags for t in ["Sea", "Ship", "RIB", "USV", "Jetski"]):
            domains_detected.add("sea")
        if any(t in raw_assigned_tags for t in ["Land", "Terrestrial", "Cars", "Trucks", "Train", "Hovercraft", "UGV", "Loaders"]):
            domains_detected.add("land")
        if any(t in raw_assigned_tags for t in ["Underwater", "UUV"]):
            domains_detected.add("underwater")

        if len(domains_detected) > 1 and "Seaplane" not in raw_assigned_tags and "Hovercraft" not in raw_assigned_tags:
            is_unsure = True

        # Check domain clash between Steam vehicle domain and assigned vehicle domain (e.g. plane/heli vs car/truck hybrid)
        if ("plane" in orig_steam_set or "helicopter" in orig_steam_set) and any(t in raw_assigned_tags for t in ["Cars", "Passenger_car", "Offroad_car", "Truck", "Trucks", "Terrestrial"]):
            is_unsure = True
        elif ("car" in orig_steam_set or "truck" in orig_steam_set) and any(t in raw_assigned_tags for t in ["Plane", "Helicopter", "Tiltrotor"]):
            is_unsure = True

        # Prune parent tags according to global setting (defaults to True)
        settings_cfg = custom_rules.get("_settings", {})
        prune_enabled = settings_cfg.get("prune_parents_enabled", True) if isinstance(settings_cfg, dict) else True
        if prune_enabled:
            pruned_core_tags = prune_parents(raw_assigned_tags)
        else:
            pruned_core_tags = raw_assigned_tags

        # Apply user tag aliases (e.g. Kei_truck -> Van)
        final_assigned_tags = []
        new_tags_detected = []

        for tag in pruned_core_tags:
            remapped = tag_aliases.get(tag, tag)
            final_assigned_tags.append(remapped)
            if remapped not in known_tags_set:
                new_tags_detected.append(remapped)

        final_assigned_tags = list(dict.fromkeys(final_assigned_tags))

        # Check for cross-category vehicle type conflicts (e.g. Train + Truck, Car + Tank, Plane + Helicopter)
        # Any intersection of 2 or more distinct vehicle type families makes the craft Uncertain.
        active_families = set()
        for fam_name, fam_tags in VEHICLE_TYPE_FAMILIES.items():
            if any(t in fam_tags for t in final_assigned_tags):
                active_families.add(fam_name)

        # Allow genuine dual categories:
        # - Amphibious crafts can combine watercraft with land car/truck/special
        # - Road trains / trucks with trailers
        # - Hi-rail / Service railcar can be both rail and truck
        is_hybrid_amphibious = "Amphibious" in final_assigned_tags
        is_hybrid_hirail = "Service_railcar" in final_assigned_tags
        is_truck_with_trailer = ('land_trailer' in active_families) and bool(active_families & {'land_truck', 'land_car', 'land_special'})

        effective_conflict_families = set(active_families)
        if is_hybrid_amphibious:
            effective_conflict_families.discard('sea_watercraft')
        if is_hybrid_hirail:
            effective_conflict_families.discard('land_truck')
            effective_conflict_families.discard('land_train')
        if is_truck_with_trailer:
            effective_conflict_families.discard('land_trailer')

        if len(effective_conflict_families) > 1:
            is_unsure = True

        # Check mandatory branches from custom rules
        mandatory_tags_configured = [
            t for t, r in custom_rules.items()
            if isinstance(r, dict) and r.get("is_mandatory_branch")
        ]
        if mandatory_tags_configured:
            # For each mandatory branch configured by user, check that at least one tag
            # from that branch or its descendants is present in final_assigned_tags
            for m_branch in mandatory_tags_configured:
                branch_cluster = {m_branch} | get_all_descendants(m_branch)
                if not any(t in branch_cluster for t in final_assigned_tags):
                    is_unsure = True
                    break
        else:
            # Fallback to default mandatory role check
            role_candidates = {
                "Combat", "Support", "SAR", "Firefighting", "Police", "Medical",
                "Farming", "Construction", "Industrial", "Fishing", "Commercial",
                "Utility", "Research", "Personal", "Military", "Emergency", "Civilian"
            }
            if not any(r in final_assigned_tags for r in role_candidates):
                is_unsure = True

        # -------------------------------------------------------------
        # 8. DETERMINE FINAL STATUS
        # -------------------------------------------------------------
        t_lower = lower_title.strip()
        d_lower = clean_desc.strip()

        # Systematic craft / technical indicators:
        # Terms indicating the creation has identifiable vehicle, machinery, component or build content
        craft_terms = [
            "car", "truck", "plane", "aircraft", "heli", "helicopter", "boat", "ship", "sub", "submarine",
            "train", "trailer", "tank", "drone", "rover", "chassis", "hull", "fuselage", "cockpit", "cabin",
            "seater", "seat", "preset", "testbed", "template", "prototype", "wip", "addon", "module",
            "engine", "motor", "gearbox", "clutch", "battery", "generator", "radar", "sonar", "controller",
            "hud", "display", "screen", "dial", "gauge", "wheel", "track", "rudder", "propeller", "rotor",
            "winch", "crane", "pivot", "door", "weapon", "cannon", "missile", "torpedo", "rocket",
            "pump", "pipe", "fluid", "speed", "knot", "km/h", "mph", "startup", "controls", "mass", "fuel"
        ]
        has_craft_evidence = any(match_word(w, t_lower) for w in craft_terms) or count_matches(craft_terms, d_lower) >= 1

        # Completely unidentifiable or deleted Steam drafts
        is_empty_or_deleted = (
            not t_lower or
            t_lower in ["none", "untitled"] or
            bool(re.match(r"^mod\s*#\d+$", t_lower))
        ) and len(d_lower) < 30 and len(original_steam_tags) == 0

        # Only generic fallback tag with no domain/type identified
        has_only_generic_vehicle = (
            not final_assigned_tags or
            final_assigned_tags == ["Vehicle"] or
            (len(final_assigned_tags) == 1 and final_assigned_tags[0] in ["Vehicle", "Terrestrial"])
        )

        # Framework-based unidentifiable:
        # Has only generic fallback, no role assigned, and zero craft/technical evidence anywhere in title or description
        is_unidentifiable_non_craft = (
            has_only_generic_vehicle and
            not has_craft_evidence and
            not any(r in final_assigned_tags for r in [
                "Combat", "Support", "SAR", "Firefighting", "Police", "Medical",
                "Farming", "Construction", "Industrial", "Fishing", "Commercial",
                "Utility", "Research", "Personal"
            ])
        )

        if is_empty_or_deleted or is_unidentifiable_non_craft:
            final_status = "Very Uncertain"
            final_tags = []
            is_sorted = False
        elif is_unsure or has_only_generic_vehicle:
            final_status = "Uncertain"
            final_tags = final_assigned_tags
            is_sorted = True
        else:
            final_status = "Autosorted"
            final_tags = final_assigned_tags
            is_sorted = True

        tags_to_deactivate = list(set(original_steam_tags or []))

        return {
            "item_id": item_id,
            "title": title,
            "status": final_status,
            "is_sorted": is_sorted,
            "assigned_tags": final_tags,
            "core_tags": final_assigned_tags,
            "deactivated_tags": tags_to_deactivate,
            "new_tags_detected": list(set(new_tags_detected)),
            "extracted_metrics": extracted_metrics
        }
