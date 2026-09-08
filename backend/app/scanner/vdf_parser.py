import re
from typing import Any, Dict

def parse_vdf(content: str) -> Dict[str, Any]:
    """
    Robust lightweight parser for Valve KeyValues format (VDF/ACF).
    """
    tokens = re.findall(r'"([^"]*)"|([{}]|\[.*?\])', content)
    # Flat token list
    token_list = []
    for t1, t2 in tokens:
        if t1 != "":
            token_list.append(t1)
        elif t2 != "":
            if not t2.startswith('['): # ignore conditionals
                token_list.append(t2)

    def parse_block(idx: int):
        node = {}
        while idx < len(token_list):
            key = token_list[idx]
            if key == "}":
                return node, idx + 1
            idx += 1
            if idx >= len(token_list):
                break
            val = token_list[idx]
            if val == "{":
                sub_node, idx = parse_block(idx + 1)
                node[key] = sub_node
            else:
                node[key] = val
                idx += 1
        return node, idx

    parsed, _ = parse_block(0)
    return parsed

def dumps_vdf(data: Dict[str, Any], indent_level: int = 0) -> str:
    """
    Serializes a Python dictionary to Valve KeyValues VDF format.
    """
    lines = []
    prefix = "\t" * indent_level
    for k, v in data.items():
        if isinstance(v, dict):
            lines.append(f'{prefix}"{k}"')
            lines.append(f'{prefix}{{')
            lines.append(dumps_vdf(v, indent_level + 1))
            lines.append(f'{prefix}}}')
        else:
            lines.append(f'{prefix}"{k}"\t\t"{v}"')
    return "\n".join(lines)

