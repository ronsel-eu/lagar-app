"""Build the import fixtures from the original Lagar importer (app/importer.py).

    python3 tools/make_import_golden.py /path/to/lagar

Writes:
  src/lib/import/golden.json    what the original reads from ~30 CSV files, in English, Spanish and French
  src/lib/import/prompts.ts     the prompts for an AI assistant, copied from the original
  src/lib/import/messages.ts    the import messages with their Spanish and French text, copied from the original
"""
import base64
import json
import sqlite3
import sys
from pathlib import Path

LAGAR = Path(sys.argv[1]).expanduser().resolve()
sys.path.insert(0, str(LAGAR))
from app import db, i18n, importer  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "src" / "lib" / "import"
H = "name,vintage,bottles,type,producer,country,region,appellation,grapes,paid,purchase_date\n"

# wines already in the app (for the "new / update / same" check): (id, name, vintage or None, bottles now)
EXISTING = [
    (1, "Viña Tondonia Reserva", 2012, 3),
    (2, "Altamira Crianza", None, 0),
    (3, "Tio Pepe", None, 2),
    (4, "Rioja Blanco Reserva 2015", 2015, 1),
    (5, "Finca La Umbria", 2022, 4),
]

CASES = []


def case(label, data, existing=False):
    raw = data if isinstance(data, bytes) else data.encode("utf-8")
    CASES.append(dict(label=label, raw=raw, existing=existing))


sample = (OUT / "sample-cellar.csv").read_bytes()
case("template only", H)
case("sample cellar", sample)
case("sample cellar, checked against existing wines", sample, True)
case("empty file", "")
case("only a newline", "\n")
case("whitespace only", "   \n  \n")
case("missing columns", "wine,year\nTondonia,2012\n")
case("no columns I know", "foo,bar,baz\n1,2,3\n")
case("semicolons and Spanish headers", "Nombre;Añada;Botellas;Tipo;Bodega;País;Zona;Denominación;Uvas;Precio;Fecha de compra\n"
     "Viña Tondonia Reserva;2012;3;tinto;López de Heredia;Spain;La Rioja;Rioja;Tempranillo;38,50;14/03/2022\n"
     "Albariño Fillaboa;2022;6;blanco;Fillaboa;Spain;Galicia;Rías Baixas;Albariño;12,9;2024-05-02\n")
case("tabs and French headers", "nom\tmillésime\tbouteilles\tcouleur\tproducteur\tpays\tprix\n"
     "Chablis Premier Cru\t2019\t2\tblanc\tDauvissat\tFrance\t45,00\n")
case("BOM and Windows line ends", "﻿" + H.replace("\n", "\r\n") + "Wine A,2015,2,red,,,,,,10,2024-01-01\r\nWine B,NV,1,white,,,,,,,\r\n")
case("old Windows encoding (cp1252)", ("name,vintage,bottles,type\nViña Ardanza,2015,2,tinto\nAlbariño café,2020,1,blanco\n").encode("cp1252"))
case("quotes, commas and line breaks in a cell", H + '"Wine, with a comma",2018,2,red,"Producer ""One""",,,,,"12,50",\n'
     '"Two\nlines",2019,1,white,,,,,,,\n')
case("types", H + "A,2015,1,Tinto,,,,,,,\nB,2015,1,BLANCO,,,,,,,\nC,2015,1,Rosado,,,,,,,\nD,2015,1,Cava,,,,,,,\nE,2015,1,Rosé,,,,,,,\n"
     "F,2015,1,orange,,,,,,,\nG,2015,1,Sherry,,,,,,,\nH,2015,1,sidra,,,,,,,\nI,2015,1,,,,,,,,\nJ,2015,1,Dulce,,,,,,,\n")
case("dates", H + "A,2015,1,red,,,,,,,2024-05-03\nB,2015,1,red,,,,,,,03/05/2024\nC,2015,1,red,,,,,,,3-5-2024\nD,2015,1,red,,,,,,,03.05.2024\n"
     "E,2015,1,red,,,,,,,03/05/24\nF,2015,1,red,,,,,,,31/02/2024\nG,2015,1,red,,,,,,,yesterday\nH,2015,1,red,,,,,,,2024-5-3\nI,2015,1,red,,,,,,,03/05/70\n")
case("vintages", H + "A,NV,1,red,,,,,,,\nB,nv,1,red,,,,,,,\nC,,1,red,,,,,,,\nD,abc,1,red,,,,,,,\nE,1799,1,red,,,,,,,\nF,2101,1,red,,,,,,,\n"
     "G,2012.5,1,red,,,,,,,\nH, 2015 ,1,red,,,,,,,\nI,+2015,1,red,,,,,,,\nJ,1800,1,red,,,,,,,\nK,2100,1,red,,,,,,,\nL,Nv,1,red,,,,,,,\n")
case("bottles", H + "A,2015,,red,,,,,,,\nB,2015,0,red,,,,,,,\nC,2015,3.7,red,,,,,,,\nD,2015,-1,red,,,,,,,\nE,2015,-0.4,red,,,,,,,\n"
     "F,2015,abc,red,,,,,,,\nG,2015,\"1,5\",red,,,,,,,\nH,2015,1e2,red,,,,,,,\nI,2015, 6 ,red,,,,,,,\n")
case("prices", H + 'A,2015,1,red,,,,,,"12,50",\nB,2015,1,red,,,,,,12.5,\nC,2015,1,red,,,,,,€12,\nD,2015,1,red,,,,,,-3,\nE,2015,1,red,,,,,,0,\nF,2015,1,red,,,,,,1e1,\n')
case("no name", H + ",2015,1,red,,,,,,,\n  ,2015,1,red,,,,,,,\n")
case("duplicates inside the file", H + "Tondonia,2012,1,red,,,,,,,\nTondonia,2012,2,red,,,,,,,\nTondonia 2012,2012,1,red,,,,,,,\nTondonia,2013,1,red,,,,,,,\n"
     "Tondonia,NV,1,red,,,,,,,\nTondonia,NV,1,red,,,,,,,\nTONDONIA,2012,1,red,,,,,,,\n")
case("blank lines, short and long rows", H + "A,2015,1\n\nB,2016,2,red,P,C,R,Ap,G,5,2024-01-01,extra,cells\n   ,  ,  \n,,\nC,2017,3\n")
case("repeated and unknown columns", "name,Name,vintage,bottles,colour,type,comment\nA,B,2015,1,red,white,hello\n")
case("spaces in names and headers", " Name , Vintage , Bottles \n  Wine A  ,2015,1\n")
case("header aliases", "wine,year,qty,style,estate,pais,zona,DO,cepages,prix,date\nA,2015,1,red,E,Spain,Z,D,G,5,2024-01-01\n")
case("header with underscores", "wine name,cosecha,cantidad,purchase date\nA,2015,1,2024-01-01\n")
case("vintage in the name", H + "Viña Tondonia Reserva 2012,2012,1,red,,,,,,,\nViña Tondonia Reserva 2012,2013,1,red,,,,,,,\n")
case("existing wines: update, same, new", "name,vintage,bottles\nViña Tondonia Reserva,2012,2\nViña Tondonia Reserva,2013,1\nAltamira Crianza,NV,0\n"
     "Altamira Crianza,NV,5\nTio Pepe,NV,0\nRioja Blanco Reserva,2015,3\nFinca La Umbria,2022,0\nFinca La Umbria,2021,1\nNew Wine,2020,6\n", True)
case("existing wines, duplicate and error rows", "name,vintage,bottles\nTio Pepe,NV,1\nTio Pepe,NV,1\n,NV,1\nTio Pepe,x,1\n", True)
case("only blank rows after header", H + "\n\n,,,,,,,,,,\n")
case("one quote in the middle of a cell", H + 'Wine "Gran" Reserva,2015,1,red,,,,,,,\nWine 5" tall,2016,1,red,,,,,,,\n')
# (a file with CR-only line ends makes the original importer crash; the TypeScript one accepts it, see importer.test.ts)


def run(raw, lang, existing):
    rows, fatal = importer.read(raw, lang)
    if existing and rows:
        db_rows = EXISTING

        def fake_connect():
            con = sqlite3.connect(":memory:")
            con.row_factory = sqlite3.Row
            con.executescript("CREATE TABLE wines (id INTEGER, name TEXT, vintage INTEGER, is_nv INTEGER);"
                              "CREATE TABLE stock (wine_id INTEGER, bottles_now INTEGER);")
            for i, n, v, b in db_rows:
                con.execute("INSERT INTO wines VALUES (?,?,?,?)", (i, n, v, 1 if v is None else 0))
                con.execute("INSERT INTO stock VALUES (?,?)", (i, b))
            return con
        real, importer.db.connect = importer.db.connect, fake_connect
        try:
            rows = importer.check(rows, lang)
        finally:
            importer.db.connect = real
    return dict(fatal=fatal, rows=rows)


golden = []
for c in CASES:
    entry = dict(label=c["label"], rawBase64=base64.b64encode(c["raw"]).decode(), existing=c["existing"],
                 results={lang: run(c["raw"], lang, c["existing"]) for lang in ("en", "es", "fr")})
    golden.append(entry)
(OUT / "golden.json").write_text(json.dumps(golden, ensure_ascii=False, indent=1, default=str) + "\n", encoding="utf-8")
(OUT / "golden-existing.json").write_text(json.dumps([dict(id=i, name=n, vintage=v, bottles=b) for i, n, v, b in EXISTING], indent=1) + "\n")

# ---- the prompts and the messages, copied from the original
prompts = {lang: importer.prompt(lang) for lang in ("en", "es", "fr")}
(OUT / "prompts.ts").write_text(
    "// Generated by tools/make_import_golden.py from the original importer. Do not edit by hand.\n"
    "export const PROMPTS = " + json.dumps(prompts, ensure_ascii=False, indent=2) + " as const\n", encoding="utf-8")

KEYS = [
    "The file is too large (2 MB at most).", "The file is empty.",
    "The first row must be the column names. I could not find: {missing}. Download the template and use its columns.",
    "Too many rows (at most {n}).", "The file has column names but no wines.", "Type '{x}' not recognised; left empty.",
    "Date '{x}' not understood (use YYYY-MM-DD); left empty.", "The wine needs a name.",
    "The vintage must be a year, or empty / NV.", "Bottles, price paid, format and alcohol must be numbers.",
    "Bottles and price paid cannot be negative.", "The vintage is required: write a year, or NV for a non-vintage wine.",
    "Bottles is empty.", "Same wine and vintage as line {n}; this line is skipped.",
]
messages = {k: {lang: i18n.STRINGS[k][lang] if lang != "en" else k.split("|")[0] for lang in ("en", "es", "fr")} for k in KEYS}
(OUT / "messages.ts").write_text(
    "// Generated by tools/make_import_golden.py from the original interface texts. Do not edit by hand.\n"
    "// The key is the English sentence; {x}, {n} and {missing} are filled in when the message is shown.\n"
    "export const MESSAGES = " + json.dumps(messages, ensure_ascii=False, indent=2) + " as const\n"
    "\nexport type IssueKey = keyof typeof MESSAGES\n", encoding="utf-8")
print(len(golden), "files written to", OUT)
