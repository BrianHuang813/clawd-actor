#!/usr/bin/env python3
"""Which test files a change needs, for CI: reads changed paths on stdin, prints the tests to run.

Prints nothing when only docs changed, ALL when something it cannot place changed. A test runs
when it imports (directly or through hooks/) a changed file; a test that imports nothing from
hooks/ loads the whole mod through hooks/register.tsx, so it depends on all of it.
"""
from typing import List, Optional, Set, Union
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = re.compile(r'(\.md$|^assets/|^tools/|^LICENSE$|^\.gitignore$)')
IMPORT = re.compile(r"""from '(\.\.?/[^']+)'""")


def resolve(frm: Path, spec: str) -> Optional[Path]:
    base = (frm.parent / spec).resolve()
    for p in (base, base.with_name(base.name + '.ts'), base.with_name(base.name + '.tsx')):
        if p.is_file():
            return p
    return None


def closure(start: Path) -> Set[str]:
    """`start` and every file it imports, as paths relative to ROOT."""
    seen: Set[str] = set()
    todo = [start]
    while todo:
        f = todo.pop()
        rel = f.relative_to(ROOT).as_posix()
        if rel in seen:
            continue
        seen.add(rel)
        todo += [p for p in (resolve(f, spec) for spec in IMPORT.findall(f.read_text())) if p]
    return seen


def deps(test: Path) -> Set[str]:
    found = closure(test)
    if not any(d.startswith('hooks/') for d in found):  # loads the mod as Claude Code does
        found |= closure(ROOT / 'hooks/register.tsx') | {'hooks/hooks.json'}
    return found


def pick(changed: List[str]) -> Union[List[str], str]:
    tests = sorted(ROOT.glob('tests/*.test.ts*'))
    out: Set[str] = set()
    for path in filter(None, changed):
        if DOCS.search(path):
            continue
        hits = [t for t in tests if path in deps(t)]
        if not hits:
            return 'ALL'  # a file no test is known to cover, or one that was deleted: be safe
        out |= {t.relative_to(ROOT).as_posix() for t in hits}
    return sorted(out)


if __name__ == '__main__':
    r = pick(sys.stdin.read().split())
    print(r if isinstance(r, str) else '\n'.join(r))
