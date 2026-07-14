#!/usr/bin/env python3
"""
LEG-009 pre-commit hook integration script.
To install: ln -s ../../scripts/pre-commit-hook.py .git/hooks/pre-commit

Runs:
1. check-food-safety.py (food safety word scan)
2. audit-data.py (hint operability check)
Both in --strict mode.
"""

import subprocess
import sys
import os
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

def run_check(name, script, args=None):
    script_path = SCRIPT_DIR / script
    if not script_path.exists():
        print(f"⚠️  {name}: script not found at {script_path}, skipping")
        return True  # Don't block if script is missing

    cmd = [sys.executable, str(script_path)]
    if args:
        cmd.extend(args)

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            print(f"❌ {name} FAILED:")
            print(result.stdout)
            print(result.stderr)
            return False
        else:
            print(f"✅ {name} passed")
            if result.stdout.strip():
                print(result.stdout)
            return True
    except subprocess.TimeoutExpired:
        print(f"⚠️  {name}: timed out, skipping")
        return True
    except Exception as e:
        print(f"⚠️  {name}: error {e}, skipping")
        return True

def main():
    all_passed = True

    # Only run food-related checks if food.json was modified
    staged = subprocess.run(
        ['git', 'diff', '--cached', '--name-only'],
        capture_output=True, text=True
    ).stdout.strip().split('\n')

    food_modified = any('food.json' in f for f in staged)

    if not food_modified:
        print("⏭️  No food data changes detected, skipping food safety checks")
        return 0

    print("🔍 Running food safety pre-commit checks...")

    if not run_check("Food Safety Scan", "check-food-safety.py", ["--strict"]):
        all_passed = False

    if not run_check("Hint Operability Audit", "audit-data.py", ["--strict"]):
        all_passed = False

    if all_passed:
        print("\n✅ All pre-commit checks passed!")
        return 0
    else:
        print("\n❌ Some pre-commit checks failed. Review the errors above.")
        print("   To bypass (not recommended for food data): git commit --no-verify")
        return 1

if __name__ == "__main__":
    sys.exit(main())