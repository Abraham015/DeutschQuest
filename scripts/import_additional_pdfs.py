from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCUMENTS = ROOT / "Documents"
OUTPUT = ROOT / "src" / "additionalVerbCards.ts"
CACHE_PATH = ROOT / "scripts" / "verb-translations.json"

sys.path.insert(0, str(ROOT / ".pdf-tools"))
from pypdf import PdfReader


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\t", " ").replace("\r", " ")).strip()


def pdf_named(fragment: str) -> Path:
    return next(path for path in DOCUMENTS.glob("*.pdf") if fragment in path.name)


def layout_lines(path: Path) -> list[str]:
    lines: list[str] = []
    for page in PdfReader(path).pages:
        text = page.extract_text(extraction_mode="layout") or ""
        lines.extend(text.replace("\r", "").replace("\u00a0", " ").splitlines())
    return lines


def translate(text: str, cache: dict[str, str]) -> str:
    if not text:
        return ""
    if text in cache:
        return cache[text]
    query = urllib.parse.urlencode({"client": "gtx", "sl": "de", "tl": "es", "dt": "t", "q": text})
    with urllib.request.urlopen(f"https://translate.googleapis.com/translate_a/single?{query}", timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    result = "".join(part[0] for part in payload[0] if part[0]).strip()
    cache[text] = result
    time.sleep(0.04)
    return result


def parse_object_verbs() -> list[dict[str, str]]:
    cards = []
    for line in layout_lines(pdf_named("deutsche_grammatik")):
        match = re.match(r"^(\S.*?)\s{2,}(\(?\+ [DA].*?)\s{2,}(.+)$", line)
        if not match:
            continue
        verb, case, example = map(clean, match.groups())
        case_label = case.replace("A", "Akkusativ").replace("D", "Dativ")
        if "D" in case and "A" in case:
            translation_query = f"jemandem etwas {verb}"
        elif "D" in case:
            translation_query = f"jemandem {verb}"
        else:
            translation_query = f"etwas {verb}"
        cards.append({"german": verb, "case": case_label, "example": example, "translationQuery": translation_query})
    return cards


def parse_perfect_verbs() -> list[dict[str, str]]:
    cards: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    for line in layout_lines(pdf_named("Perfekt_")):
        if not line.strip() or "Unregelmäßige Verben A1-B1" in line or "Infinitiv" in line:
            continue
        first = clean(line[0:27])
        fields = [clean(line[27:53]), clean(line[53:74]), clean(line[74:106]), clean(line[106:])]
        if first and re.match(r"^(?:\(s\.\) )?[a-zäöüß]", first):
            if current:
                cards.append(current)
            current = {"german": first, "spanish": fields[0], "present": fields[1], "perfect": fields[2], "example": fields[3]}
        elif current:
            for key, value in zip(("spanish", "present", "perfect", "example"), fields):
                if value:
                    current[key] = clean(f"{current[key]} {value}")
    if current:
        cards.append(current)
    return cards


def parse_basic_case_verbs() -> list[dict[str, str]]:
    cards: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    for raw in layout_lines(pdf_named("Verbos-con-Akkusativ")):
        line = raw.replace("\t", "")
        if not line.strip() or "VERBOS" in line or "AKKUSATIV" in line or line.lstrip().startswith("VERB"):
            continue
        verb = clean(line[0:39])
        case_region = clean(line[39:58])
        akk = "AKK" if "AKK" in case_region else ""
        dat = "DAT" if "DAT" in case_region else ""
        example = clean(line[58:128])
        example_spanish = clean(line[128:])
        starts_record = bool(verb and example and re.match(r"^[a-zäöüß]", verb))
        if starts_record:
            if current:
                cards.append(current)
            cases = " + ".join(value for value in (akk, dat) if value)
            current = {"german": verb, "spanish": "", "case": cases or "Sin indicación", "example": example, "exampleSpanish": example_spanish}
        elif current:
            if verb:
                current["spanish"] = clean(f'{current["spanish"]} {verb}')
            if example:
                current["example"] = clean(f'{current["example"]} {example}')
            if example_spanish:
                current["exampleSpanish"] = clean(f'{current["exampleSpanish"]} {example_spanish}')
    if current:
        cards.append(current)
    source_fixes = {"aufmachen": "abrir", "brauchen": "necesitar", "wünschen": "desear", "zahlen": "pagar"}
    for card in cards:
        card["exampleSpanish"] = re.sub(r"\s+[1-4]$", "", card["exampleSpanish"]).strip()
        if card["german"] in source_fixes:
            card["spanish"] = source_fixes[card["german"]]
    return cards


def ts(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def main() -> None:
    cache = json.loads(CACHE_PATH.read_text(encoding="utf-8")) if CACHE_PATH.exists() else {}
    groups = [
        ("object-case", "extras-object-case-verbs", parse_object_verbs()),
        ("perfect", "a1-b1-irregular-perfect", parse_perfect_verbs()),
        ("basic-case", "extras-basic-case-verbs", parse_basic_case_verbs()),
    ]
    lines = ['import type { Flashcard } from "./types";', "", "export const additionalVerbCards: Flashcard[] = ["]
    for prefix, folder_id, cards in groups:
        print(prefix, len(cards))
        for index, card in enumerate(cards, start=1):
            spanish = card.get("spanish") or translate(card.get("translationQuery", card["german"]), cache)
            example_spanish = card.get("exampleSpanish") or translate(card["example"], cache)
            note = card.get("case") or clean(f'Präsens: {card.get("present", "")} · Perfekt: {card.get("perfect", "")}')
            lines.append(
                "  { "
                f"id: {ts(prefix + '-' + str(index))}, folderId: {ts(folder_id)}, german: {ts(card['german'])}, "
                f"spanish: {ts(spanish)}, example: {ts(card['example'])}, exampleSpanish: {ts(example_spanish)}, "
                f'kind: "Verbo", note: {ts(note)}'
                " },"
            )
    lines.extend(("];", ""))
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
