#!/usr/bin/env python3
"""Fix unescaped embedded quotes in seed JSON files."""
import json
import sys
import glob

def fix_json_quotes(filepath):
    with open(filepath, 'r') as f:
        raw = f.read()

    try:
        json.loads(raw)
        return True
    except json.JSONDecodeError:
        pass

    lines = raw.split('\n')
    fixed_lines = []
    for line in lines:
        stripped = line.strip()
        indent = len(line) - len(stripped)

        if '": "' in stripped:
            quote_count = stripped.count('"')
            if quote_count > 4:
                colon_pos = stripped.index('": "')
                key_part = stripped[:colon_pos+3]
                value_and_rest = stripped[colon_pos+3:]
                if value_and_rest.endswith('",'):
                    inner = value_and_rest[1:-2]
                    suffix = '",'
                elif value_and_rest.endswith('"'):
                    inner = value_and_rest[1:-1]
                    suffix = '"'
                else:
                    fixed_lines.append(line)
                    continue
                parts = inner.split('"')
                if len(parts) > 1:
                    result = parts[0]
                    for idx in range(1, len(parts)):
                        if idx % 2 == 1:
                            result += '“' + parts[idx]
                        else:
                            result += '”' + parts[idx]
                    inner = result
                line = ' ' * indent + key_part + '"' + inner + suffix
        elif stripped.startswith('"') and not stripped.startswith('""'):
            quote_count = stripped.count('"')
            if quote_count > 2:
                if stripped.endswith('",'):
                    inner = stripped[1:-2]
                    suffix = '",'
                elif stripped.endswith('"'):
                    inner = stripped[1:-1]
                    suffix = '"'
                else:
                    fixed_lines.append(line)
                    continue
                parts = inner.split('"')
                if len(parts) > 1:
                    result = parts[0]
                    for idx in range(1, len(parts)):
                        if idx % 2 == 1:
                            result += '“' + parts[idx]
                        else:
                            result += '”' + parts[idx]
                    inner = result
                line = ' ' * indent + '"' + inner + suffix

        fixed_lines.append(line)

    content = '\n'.join(fixed_lines)
    try:
        data = json.loads(content)
        with open(filepath, 'w') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except json.JSONDecodeError as e:
        print(f"  FAILED to fix {filepath}: {e}")
        return False

if __name__ == '__main__':
    files = sorted(glob.glob('content/seed-library/*.json'))
    for f in files:
        try:
            data = json.load(open(f))
            print(f"  {f}: OK ({len(data)} questions)")
        except json.JSONDecodeError:
            print(f"  {f}: fixing...", end=' ')
            if fix_json_quotes(f):
                data = json.load(open(f))
                print(f"FIXED ({len(data)} questions)")
            else:
                print("FAILED")
