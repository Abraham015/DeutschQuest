from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "Documents" / "Verbosconpreposicion.pdf"
OUTPUT_PATH = ROOT / "src" / "verbsWithPrepositions.ts"
CACHE_PATH = ROOT / "scripts" / "verb-translations.json"

TRANSLATION_OVERRIDES = {
    "etwas/nichts ändern an|an + Dativ": "cambiar algo de algo",
    "arbeiten an|an + Dativ": "trabajar en algo",
    "jn./etw. erkennen an|an + Dativ": "reconocer a alguien/algo por algo",
    "erkranken an|an + Dativ": "enfermar de algo",
    "jm. fehlen an (es)|an + Dativ": "faltarle algo a alguien",
    "forschen an|an + Dativ": "investigar sobre algo",
    "gewinnen an|an + Dativ": "ganar o aumentar en algo",
    "jn. hindern an|an + Dativ": "impedir a alguien hacer algo",
    "liegen an|an + Dativ": "deberse a algo/alguien",
    "mangeln an|an + Dativ": "carecer de algo",
    "sich orientieren an|an + Dativ": "orientarse o guiarse por algo",
    "sterben an|an + Dativ": "morir de algo",
    "zweifeln an|an + Dativ": "dudar de algo",
    "appellieren an|an + Akkusativ": "hacer un llamamiento a alguien",
    "sich/jn. erinnern an|an + Akkusativ": "recordar a alguien/algo",
    "sich halten an|an + Akkusativ": "atenerse a algo; dirigirse a alguien",
    "sich machen an|an + Akkusativ": "ponerse a hacer algo",
    "sich/etw. richten an|an + Akkusativ": "dirigirse a alguien; dirigir algo a alguien",
    "sich wenden an|an + Akkusativ": "dirigirse o recurrir a alguien",
    "basieren auf|auf + Dativ": "basarse en algo",
    "beharren auf|auf + Dativ": "insistir en algo",
    "beruhen auf|auf + Dativ": "basarse en algo",
    "bestehen auf|auf + Dativ": "insistir o exigir algo",
    "achten auf|auf + Akkusativ": "prestar atención a algo",
    "ankommen auf (es)|auf + Akkusativ": "depender de algo",
    "jm. antworten auf|auf + Akkusativ": "responder a alguien sobre algo",
    "aufpassen auf|auf + Akkusativ": "cuidar o vigilar algo/alguien",
    "sich berufen auf|auf + Akkusativ": "invocar o remitirse a algo",
    "jn. bringen auf|auf + Akkusativ": "hacer que alguien piense en algo",
    "drängen auf|auf + Akkusativ": "presionar para conseguir algo",
    "eingehen auf|auf + Akkusativ": "abordar o responder a algo",
    "sich einlassen auf|auf + Akkusativ": "involucrarse o aceptar algo",
    "sich einstellen auf|auf + Akkusativ": "prepararse o adaptarse a algo",
    "jn. hinweisen auf|auf + Akkusativ": "señalar o advertir algo a alguien",
    "hoffen auf|auf + Akkusativ": "esperar algo",
    "hören auf|auf + Akkusativ": "escuchar o hacer caso a alguien",
    "kommen auf|auf + Akkusativ": "ocurrírsele algo a alguien",
    "sich/etw. richten auf|auf + Akkusativ": "dirigirse o dirigir algo hacia algo",
    "schießen auf|auf + Akkusativ": "disparar contra algo/alguien",
    "schwören auf|auf + Akkusativ": "confiar plenamente en algo",
    "stehen auf|auf + Akkusativ": "gustarle o atraerle alguien/algo",
    "steigen auf|auf + Akkusativ": "subir hasta una cantidad",
    "verschieben auf|auf + Akkusativ": "aplazar hasta una fecha o momento",
    "verzichten auf|auf + Akkusativ": "renunciar a algo",
    "sich/jn. vorbereiten auf|auf + Akkusativ": "prepararse o preparar a alguien para algo",
    "warten auf|auf + Akkusativ": "esperar a alguien/algo",
    "wirken auf|auf + Akkusativ": "afectar o causar una impresión en alguien/algo",
    "machen aus|aus + Dativ": "hacer algo de algo",
    "ersehen aus|aus + Dativ": "deducir de algo",
    "schließen aus|aus + Dativ": "deducir de algo",
    "sich bedanken bei|bei + Dativ": "dar las gracias a alguien",
    "jm. helfen bei|bei + Dativ": "ayudar a alguien con algo",
    "jm. zugucken bei|bei + Dativ": "observar a alguien mientras hace algo",
    "jm. zuschauen bei|bei + Dativ": "observar a alguien mientras hace algo",
    "jm. zusehen bei|bei + Dativ": "observar a alguien mientras hace algo",
    "sich bedanken für|für + Akkusativ": "dar las gracias por algo",
    "demonstrieren für|für + Akkusativ": "manifestarse a favor de algo",
    "sich eignen für|für + Akkusativ": "ser adecuado para algo",
    "geradestehen für|für + Akkusativ": "responder o hacerse responsable de algo",
    "jn./etwas/sich halten für|für + Akkusativ": "considerar a alguien/algo como algo",
    "sein für|für + Akkusativ": "estar a favor de algo",
    "sorgen für|für + Akkusativ": "cuidar de alguien; encargarse de algo",
    "sprechen für|für + Akkusativ": "hablar a favor de algo",
    "sich verwenden für|für + Akkusativ": "interceder por alguien",
    "handeln gegen|gegen + Akkusativ": "actuar contra algo",
    "stoßen gegen|gegen + Akkusativ": "chocar contra algo",
    "bestehen in|in + Dativ": "consistir en algo",
    "sich täuschen in|in + Dativ": "equivocarse respecto a alguien/algo",
    "geraten in|in + Akkusativ": "meterse o caer en una situación",
    "aufhören mit|mit + Dativ": "dejar o parar de hacer algo",
    "sich austauschen mit|mit + Dativ": "intercambiar ideas con alguien",
    "sich begnügen mit|mit + Dativ": "conformarse con algo",
    "kämpfen mit|mit + Dativ": "luchar o lidiar con algo",
    "rechnen mit|mit + Dativ": "contar con algo; prever algo",
    "zu tun haben mit|mit + Dativ": "tener que ver con algo/alguien",
    "umgehen mit|mit + Dativ": "tratar o manejar algo/alguien",
    "zögern mit|mit + Dativ": "demorarse o vacilar en hacer algo",
    "sich richten nach|nach + Dativ": "guiarse por algo/alguien",
    "sich sehnen nach|nach + Dativ": "anhelar algo/alguien",
    "sich aufregen über|über + Akkusativ": "enfadarse o alterarse por algo",
    "sich erschrecken über|über + Akkusativ": "asustarse por algo",
    "sich freuen über|über + Akkusativ": "alegrarse por algo",
    "nachdenken über|über + Akkusativ": "reflexionar sobre algo",
    "sich wundern über|über + Akkusativ": "sorprenderse por algo",
    "sich ängstigen um|um + Akkusativ": "preocuparse por alguien/algo",
    "sich bemühen um|um + Akkusativ": "esforzarse por conseguir algo",
    "jn. betrügen um|um + Akkusativ": "estafar a alguien una cantidad",
    "sich drehen um|um + Akkusativ": "tratarse de algo; girar en torno a algo",
    "gehen um|um + Akkusativ": "tratarse de algo",
    "sich handeln um|um + Akkusativ": "tratarse de algo/alguien",
    "sich kümmern um|um + Akkusativ": "ocuparse o cuidar de algo/alguien",
    "sich schlagen um|um + Akkusativ": "pelearse por algo",
    "werben um|um + Akkusativ": "buscar o cortejar para conseguir algo",
    "wetten um|um + Akkusativ": "apostar algo",
    "wissen um|um + Akkusativ": "ser consciente de algo",
    "verstehen unter|unter + Dativ": "entender por algo",
    "abschreiben von|von + Dativ": "copiar de alguien/algo",
    "erfahren von|von + Dativ": "enterarse de algo",
    "sich ernähren von|von + Dativ": "alimentarse de algo",
    "halten von|von + Dativ": "opinar sobre alguien/algo",
    "handeln von|von + Dativ": "tratar sobre algo",
    "schreiben von|von + Dativ": "escribir sobre algo",
    "jn. anhalten zu|zu + Dativ": "instar a alguien a hacer algo",
    "jn. bestimmen zu|zu + Dativ": "designar a alguien para algo",
    "jn. bewegen zu|zu + Dativ": "persuadir a alguien para hacer algo",
    "jn. bringen zu|zu + Dativ": "hacer que alguien haga algo",
    "jn. drängen zu|zu + Dativ": "presionar a alguien para hacer algo",
    "halten zu|zu + Dativ": "apoyar o ser leal a alguien",
    "passen zu|zu + Dativ": "combinar o encajar con algo/alguien",
    "rechnen zu|zu + Dativ": "contar o clasificar entre algo",
    "taugen zu|zu + Dativ": "servir o ser apto para algo",
    "verwenden zu|zu + Dativ": "utilizar para algo",
    "werden zu|zu + Dativ": "convertirse en algo",
    "zählen zu|zu + Dativ": "pertenecer o contarse entre algo",
}

TRANSLATION_OVERRIDES.update({
    "ruhen auf|auf + Dativ": "reposar o descansar sobre algo/alguien",
    "sich beschränken auf|auf + Akkusativ": "limitarse a algo",
    "sich besinnen auf|auf + Akkusativ": "centrarse o volver a apoyarse en algo",
    "(sich) erhöhen auf|auf + Akkusativ": "aumentar hasta una cantidad",
    "sich freuen auf|auf + Akkusativ": "esperar algo con ilusión",
    "reagieren auf|auf + Akkusativ": "reaccionar ante algo",
    "schimpfen auf|auf + Akkusativ": "despotricar contra alguien/algo",
    "sinken auf|auf + Akkusativ": "bajar o hundirse hasta algo",
    "sich ergeben aus|aus + Dativ": "derivarse de algo",
    "übersetzten aus|aus + Dativ": "traducir de un idioma",
    "sich beklagen bei|bei + Dativ": "quejarse ante alguien",
    "sich beschweren bei|bei + Dativ": "presentar una queja ante alguien",
    "sich erkundigen bei|bei + Dativ": "informarse o preguntar a alguien",
    "mitwirken bei|bei + Dativ": "participar o colaborar en algo",
    "ausgeben für|für + Akkusativ": "gastar en algo",
    "sich/jn. begeistern für|für + Akkusativ": "entusiasmarse por algo; entusiasmar a alguien",
    "sich engagieren für|für + Akkusativ": "comprometerse o implicarse por algo",
    "sich entscheiden für|für + Akkusativ": "decidirse por algo",
    "sich rächen für|für + Akkusativ": "vengarse por algo",
    "sich schämen für|für + Akkusativ": "avergonzarse de algo",
    "(sich) entscheiden gegen|gegen + Akkusativ": "decidirse contra algo",
    "kämpfen gegen|gegen + Akkusativ": "luchar contra algo/alguien",
    "sein gegen|gegen + Akkusativ": "estar en contra de algo",
    "sprechen gegen|gegen + Akkusativ": "hablar o ser un argumento contra algo",
    "treten gegen|gegen + Akkusativ": "dar una patada contra algo",
    "verstoßen gegen|gegen + Akkusativ": "infringir o violar algo",
    "sich irren in|in + Dativ": "equivocarse respecto a algo",
    "sich üben in|in + Dativ": "practicar algo",
    "jn. unterrichten in|in + Dativ": "enseñar a alguien una materia",
    "einwilligen in|in + Akkusativ": "consentir o aceptar algo",
    "sich fügen in|in + Akkusativ": "resignarse o someterse a algo",
    "investieren in|in + Akkusativ": "invertir en algo",
    "teilen in|in + Akkusativ": "dividir en partes",
    "jn./etw./sich verwandeln in|in + Akkusativ": "transformar o convertirse en algo",
    "jn. beauftragen mit|mit + Dativ": "encargar a alguien una tarea",
    "reden mit|mit + Dativ": "hablar con alguien",
    "schimpfen mit|mit + Dativ": "regañar a alguien",
    "spielen mit|mit + Dativ": "jugar con alguien/algo",
    "vereinbaren mit|mit + Dativ": "acordar algo con alguien",
    "fahnden nach|nach + Dativ": "buscar a alguien perseguido",
    "forschen nach|nach + Dativ": "investigar o buscar algo",
    "greifen nach|nach + Dativ": "agarrar o intentar alcanzar algo",
    "rufen nach|nach + Dativ": "llamar o pedir a alguien/algo",
    "stinken nach|nach + Dativ": "oler mal a algo",
    "suchen nach|nach + Dativ": "buscar algo/alguien",
    "urteilen nach|nach + Dativ": "juzgar según algo",
    "verlangen nach|nach + Dativ": "pedir o exigir algo/alguien",
    "sich erregen über|über + Akkusativ": "alterarse o indignarse por algo",
    "berichten über|über + Akkusativ": "informar sobre algo",
    "referieren über|über + Akkusativ": "dar una ponencia sobre algo",
    "siegen über|über + Akkusativ": "vencer a alguien",
    "verfügen über|über + Akkusativ": "disponer de algo",
    "weinen über|über + Akkusativ": "llorar por algo",
    "spielen um|um + Akkusativ": "jugarse o competir por algo",
    "erzählen von|von + Dativ": "contar o hablar de algo",
    "hören von|von + Dativ": "oír hablar de algo/alguien",
    "verlangen von|von + Dativ": "exigir algo a alguien",
    "anmerken zu|zu + Dativ": "comentar algo sobre un tema",
    "kommen zu|zu + Dativ": "llegar u obtener algo",
    "sagen zu|zu + Dativ": "decir o comentar algo sobre un tema",
})

PREPOSITIONS = {
    "an", "auf", "aus", "bei", "für", "gegen", "in", "mit", "nach",
    "über", "um", "unter", "von", "vor", "zu", "zwischen",
}
HEADING_RE = re.compile(r"^([a-zäöüß]+) \+ (Dativ|Akkusativ)$")
PAGE_RE = re.compile(r"^\d+/32$")


def load_reader():
    local_tools = ROOT / ".pdf-tools"
    if local_tools.exists():
        sys.path.insert(0, str(local_tools))
    from pypdf import PdfReader

    return PdfReader(PDF_PATH)


def is_noise(line: str) -> bool:
    prefixes = (
        "Verben mit Präposition", "Listen, Erklärungen", "Deutsch lernen mit",
        "A1-C2", "https:", "Erklärungen und Übungen", "Übungen zum",
        "Version 01", "© ", "Dieses Dokument", "Es ist nicht erlaubt",
        "Das Dokument darf", "Listen nach", "Unsere Seiten",
    )
    return not line or PAGE_RE.match(line) is not None or line.startswith(prefixes)


def is_verb_line(line: str, preposition: str) -> bool:
    question_words = (
        "Woran ", "Worauf ", "Woraus ", "Wobei ", "Wofür ", "Wogegen ",
        "Worin ", "Womit ", "Wonach ", "Worüber ", "Worum ", "Wovon ",
        "Wovor ", "Wozu ",
    )
    if line.startswith(question_words):
        return False
    looks_like_infinitive = line[0].islower() or line.startswith(("Bescheid wissen ", "(sich) "))
    return looks_like_infinitive and re.search(rf"\b{re.escape(preposition)}(?: \(es\))?$", line) is not None


def first_example(lines: list[str]) -> str:
    text = " ".join(line.strip() for line in lines if not is_noise(line.strip()))
    text = re.sub(r"\s+", " ", text).strip()
    match = re.match(r"^.*?[.!?](?:\s|$)", text)
    return match.group(0).strip() if match else text


def extract_cards() -> list[dict[str, str]]:
    cards: list[dict[str, str]] = []
    section: tuple[str, str] | None = None
    active: dict[str, str] | None = None
    example_lines: list[str] = []

    def finish_active() -> None:
        nonlocal active, example_lines
        if active:
            example = first_example(example_lines)
            if example:
                active["example"] = example
                cards.append(active)
        active = None
        example_lines = []

    for page in load_reader().pages:
        for raw_line in (page.extract_text() or "").splitlines():
            line = raw_line.strip()
            heading = HEADING_RE.match(line)
            if heading and heading.group(1) in PREPOSITIONS:
                finish_active()
                section = (heading.group(1), heading.group(2))
                continue
            if not section or is_noise(line):
                continue
            if is_verb_line(line, section[0]):
                finish_active()
                active = {"german": line, "preposition": section[0], "case": section[1]}
            elif active:
                example_lines.append(line)

    finish_active()
    return cards


def translate(text: str, cache: dict[str, str]) -> str:
    if text in cache:
        return cache[text]
    query = urllib.parse.urlencode(
        {"client": "gtx", "sl": "de", "tl": "es", "dt": "t", "q": text}
    )
    url = f"https://translate.googleapis.com/translate_a/single?{query}"
    with urllib.request.urlopen(url, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    result = "".join(part[0] for part in payload[0] if part[0]).strip()
    cache[text] = result
    time.sleep(0.04)
    return result


def expanded_verb_phrase(text: str) -> str:
    replacements = {
        "jn./etw.": "jemanden/etwas",
        "jn./sich": "jemanden/sich",
        "sich/jn.": "sich/jemanden",
        "sich/etw.": "sich/etwas",
        "jn.": "jemanden",
        "jm.": "jemandem",
        "etw.": "etwas",
    }
    for abbreviation, expanded in replacements.items():
        text = text.replace(abbreviation, expanded)
    return text


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_typescript(cards: list[dict[str, str]]) -> None:
    cache = json.loads(CACHE_PATH.read_text(encoding="utf-8")) if CACHE_PATH.exists() else {}
    output = [
        'import type { Flashcard } from "./types";',
        "",
        "export const verbsWithPrepositions: Flashcard[] = [",
    ]
    for index, card in enumerate(cards, start=1):
        override_key = f'{card["german"]}|{card["preposition"]} + {card["case"]}'
        spanish = TRANSLATION_OVERRIDES.get(override_key)
        if spanish is None:
            spanish = translate(expanded_verb_phrase(card["german"]), cache)
        example_spanish = translate(card["example"], cache)
        output.append(
            "  { "
            f'id: "verb-prep-{index}", folderId: "extras-verb-prepositions", '
            f"german: {ts_string(card['german'])}, spanish: {ts_string(spanish)}, "
            f"example: {ts_string(card['example'])}, exampleSpanish: {ts_string(example_spanish)}, "
            f'kind: "Verbo", note: {ts_string(card["preposition"] + " + " + card["case"])}'
            " },"
        )
        if index % 20 == 0:
            CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Translated {index}/{len(cards)}")
    output.extend(("];", ""))
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    OUTPUT_PATH.write_text("\n".join(output), encoding="utf-8")


if __name__ == "__main__":
    extracted = extract_cards()
    print(f"Extracted {len(extracted)} verb/preposition cards")
    write_typescript(extracted)
