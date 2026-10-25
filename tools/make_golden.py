"""Build the golden fixtures for the advice engine.

Runs the original Python engine (scripts/advice.py from the Lagar repository) on a list of wines and saves what it
answers. The TypeScript engine must give exactly the same answers (src/lib/advice/advice.test.ts).

    python3 tools/make_golden.py /path/to/lagar

Only the style rules are covered: no critic windows and no shop pages, which the public app does not have.
The notes are reworded for the public app: the owner's table wording is dropped.
"""
import csv
import importlib.util
import json
import re
import sys
from pathlib import Path

LAGAR = Path(sys.argv[1]).expanduser().resolve()
OUT = Path(__file__).resolve().parent.parent / "src" / "lib" / "advice" / "golden.json"

spec = importlib.util.spec_from_file_location("advice", LAGAR / "scripts" / "advice.py")
advice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(advice)

YEAR = 2026
CASES = []


def c(name, type, vintage, app=None, region=None, grapes=None, producer=None, bought=None, year=YEAR, country=None, label=None):
    CASES.append(dict(label=label or name, year=year, input=dict(
        name=name, type=type, vintage=vintage, producer=producer, country=country, region=region,
        appellation=app, grapes=grapes, purchaseDate=bought)))


# ---- sherry (Consejo Regulador table)
c("Tio Pepe", "fortified", "NV", app="Jerez-Xérès-Sherry", bought="2025-06-10")
c("Fino en Rama", "fortified", "NV", bought="2025-06-10")
c("La Guita Manzanilla", "fortified", "NV", bought="2023-05-01")
c("Barbadillo Florpower", "fortified", "NV", bought="2025-02-01")
c("Manzanilla Pasada Pastrana", "fortified", "NV", bought="2024-02-02")
c("Lustau Amontillado VORS 30 anos", "fortified", "NV", bought="2020-01-01")
c("Amontillado Napoleon", "fortified", "NV", bought="2022-01-10")
c("Fino VOS Rarity", "fortified", "NV", bought="2022-01-10")
c("Equipo Navazos La Bota de Palo Cortado 50", "fortified", "NV", bought="2021-09-09")
c("Oloroso Alfonso Dry", "fortified", "NV", bought="2019-03-03")
c("Oloroso Sibarita VORS", "fortified", "NV", bought="2019-03-03")
c("Pedro Ximenez Triana", "sweet", "NV", bought="2024-04-04")
c("PX Viejisimo", "sweet", "NV", bought="2024-04-04")
c("Ximenez Spinola Exceptional Harvest", "sweet", 2019)
c("Moscatel Dorado", "sweet", "NV", bought="2023-01-01")
c("Solera Dulce 1927", "sweet", "NV", producer="Pedro Ximenez Hermanos", label="PX found through the producer")
c("Cream Harveys Bristol", "fortified", "NV", bought="2024-03-03")
c("Medium Dry Sherry", "fortified", "NV", bought="2024-03-03")
c("Fino en Rama Saca de marzo 2025", "fortified", "NV", bought="2025-05-05")
c("Fino Saca 2024", "fortified", "NV", bought="2025-05-05")
c("Fino Saca invierno 2023", "fortified", "NV", bought="2025-05-05")
c("Navazos Fino MMXV", "fortified", "NV", bought="2025-05-05")
c("Navazos Fino MMIX", "fortified", "NV", bought="2025-05-05")
c("Fino Sin Fecha", "fortified", "NV")
c("Fino Fecha Rara", "fortified", "NV", bought="not-a-date")
c("Fino Fecha Imposible", "fortified", "NV", bought="2025-02-30")
c("Vendimia Tardia Moscatel", "sweet", 2018)
c("Fino 2030", "fortified", "NV", bought="2025-06-01", year=2030, label="Fino bought 2025, year 2030")
# ---- port, madeira, vermouth, other fortified, cider
c("Taylor's Late Bottled Vintage LBV", "fortified", 2017)
c("LBV no vintage", "fortified", "NV", bought="2023-02-02")
c("Niepoort Colheita Port", "fortified", 2005, bought="2024-01-01")
c("Colheita Without Date Port", "fortified", "NV")
c("Tawny 10 Years Porto", "fortified", "NV", bought="2023-06-06")
c("Ruby Reserve Port", "fortified", "NV", bought="2024-06-06")
c("Graham's Vintage Port", "fortified", 2011)
c("Quinta do Noval Port", "fortified", "NV", bought="2022-02-02")
c("Vermut Yzaguirre Rojo", "fortified", "NV")
c("Madeira Blandy's 10 anos", "fortified", "NV")
c("Rancio Seco Garnacha", "fortified", 2000)
c("Fondillon Gran Reserva", "fortified", 1990, app="Alicante")
c("Fondillon Monastrell", "sweet", 1995, app="Alicante")
c("Sidra Natural Trabanco", "cider", "NV")
c("Sidra Vintage", "cider", 2024)
# ---- sweet
c("Tostado do Ribeiro", "sweet", 2015, app="Ribeiro")
c("Chateau Climens", "sweet", 2015, app="Sauternes")
c("Chateau Coutet", "sweet", 2010, app="Barsac")
c("Sauternes sin anada", "sweet", "NV", app="Sauternes")
c("Tokaji Aszu 5 Puttonyos", "sweet", 2013)
c("Late Harvest Zinfandel", "red", 2019)
c("Vino Dulce Natural", "sweet", "NV")
c("Chateau Dulce Blaye", "sweet", 2015, app="Blaye")
# ---- sparkling
c("Dom Perignon", "sparkling", 2012, app="Champagne")
c("Cristal Roederer", "sparkling", 2014, app="Champagne")
c("Champagne Bollinger La Grande Annee", "sparkling", 2012, app="Champagne")
c("Champagne Brut", "sparkling", "NV", app="Champagne", bought="2024-12-01")
c("Champagne Sans Date", "sparkling", "NV", app="Champagne")
c("Krug Grande Cuvee", "sparkling", "NV", app="Champagne", bought="2023-11-20")
c("Recaredo Terrers Cava de Paraje Calificado", "sparkling", 2015, app="Cava")
c("Gran Reserva Brut Nature", "sparkling", 2018, app="Cava")
c("Cava Reserva Brut", "sparkling", 2019, app="Cava")
c("Brut Joven", "sparkling", 2023, app="Cava")
c("Brut Nature NV", "sparkling", "NV", app="Cava", bought="2025-01-01")
c("Brut Nature sin compra", "sparkling", "NV", app="Cava")
c("Cava Frizzante Valencia", "sparkling", 2022, app="Valencia")
c("Espumoso Brut Nature", "sparkling", 2020, app="Utiel-Requena")
c("Prosecco Frizzante", "sparkling", 2023, app="Prosecco")
c("Espumoso Gran Reserva Brut", "sparkling", 2017, app="Penedès")
c("Espumoso Reserva", "sparkling", "NV", app="Penedès")
c("Cremant de Loire", "sparkling", 2022, app="Crémant de Loire")
c("Cremant sin anada", "sparkling", "NV")
c("Riesling Sekt Brut", "sparkling", 2019)
# ---- Riesling
c("Riesling Trockenbeerenauslese", "sweet", 2015, app="Mosel")
c("Riesling Eiswein", "sweet", 2016)
c("Riesling BA", "sweet", 2011)
c("Riesling Auslese Wehlener", "sweet", 2018)
c("Riesling Spatlese Feinherb", "white", 2019, app="Mosel")
c("Riesling Kabinett", "white", 2021, app="Mosel")
c("Riesling Grosses Gewachs Pechstein", "white", 2018, app="Pfalz")
c("Riesling Alsace Grand Cru Schlossberg", "white", 2017, app="Alsace")
c("Riesling Trocken", "white", 2023, app="Pfalz")
c("Selbach Estate", "white", 2022, grapes="100% Riesling", label="Riesling found through the grapes")
c("Riesling Kabinett Future", "white", 2028)
c("Riesling sin anada", "white", "NV")
c("Riesling Red Oddity", "red", 2020)
# ---- no vintage, no colour, future vintage
c("Vino Tinto Sin Anada", "red", "NV")
c("Unknown Colour Wine", None, 2018)
c("Rioja Reserva Future", "red", 2030, app="Rioja")
# ---- Bordeaux
c("Chateau Generic", "red", 2018, app="Bordeaux Supérieur")
c("Chateau Lynch-Bages", "red", 2010, app="Pauillac")
c("Chateau Smith Haut Lafitte Blanc", "white", 2016, app="Pessac-Léognan")
c("Chateau Bonnet", "white", 2022, app="Entre-Deux-Mers")
c("Chateau Saint-Emilion", "red", 2015, app="Saint-Émilion Grand Cru")
c("Pavillon Rouge", "red", 2030, app="Margaux")
c("Chateau Region Only", "red", 2012, region="Bordeaux")
c("Rosado de Bordeaux", "rosé", 2024, app="Bordeaux")
# ---- rosé
c("Tondonia Rosado Gran Reserva", "rosé", 2009, app="Rioja")
c("Rosado Joven", "rosé", 2025, app="Navarra")
c("Rosado 2023", "rosé", 2023, label="Rosado 2023 (young vintage, window over)")
c("Rosado 2022", "rosé", 2022, label="Rosado 2022 (not young, window over)")
# ---- Bierzo
c("Petalos", "red", 2021, app="Bierzo")
c("Bierzo Clarete", "red", 2024, app="Bierzo")
c("Godello", "white", 2022, app="Bierzo")
c("Rosado del Bierzo", "rosé", 2024, app="Bierzo")
c("Valtuille Cepas Centenarias", "red", 2015, app="Bierzo")
c("Villa Mencia", "red", 2018, app="Bierzo")
c("Mencia Joven", "red", 2023, app="Bierzo")
# ---- Utiel-Requena, Valencia, Alicante
c("Utiel Rosado", "rosé", 2024, app="Utiel-Requena")
c("Bobal Reserva", "red", 2015, app="Utiel-Requena")
c("Bobal Crianza", "red", 2019, app="Utiel-Requena")
c("Bobal Barrica", "red", 2019, app="Utiel-Requena")
c("Bobal Joven", "red", 2024, app="Utiel-Requena")
c("Valencia Gran Reserva", "red", 2010, app="Valencia")
c("Valencia Reserva", "red", 2014, app="Valencia")
c("Valencia Crianza", "red", 2018, app="Valencia")
c("Valencia Joven", "red", 2024, app="Valencia")
c("Valencia Blanco", "white", 2024, app="Valencia")
c("Valencia Rosado", "rosé", 2024, app="Valencia")
c("Fondillon Tinto", "red", 1998, app="Alicante")
c("Alicante Monastrell", "red", 2020, app="Alicante")
# ---- Italy
c("Barbera Castellinaldo", "red", 2019, app="Barbera d'Alba")
c("Barbera Superiore", "red", 2018, app="Barbera d'Asti")
c("Barbera Basic", "red", 2022, app="Barbera d'Alba")
c("Barolo Riserva", "red", 2012, app="Barolo")
c("Barolo Cannubi", "red", 2016, app="Barolo")
c("Langhe Nebbiolo", "red", 2021, app="Langhe Nebbiolo")
c("Barbaresco Asili", "red", 2015, app="Barbaresco")
c("Brunello di Montalcino", "red", 2016, app="Brunello di Montalcino")
c("Chianti Classico Gran Selezione", "red", 2018, app="Chianti Classico")
c("Chianti Classico Riserva", "red", 2017, app="Chianti Classico")
c("Chianti Classico", "red", 2021, app="Chianti Classico")
c("Chianti Rufina Superiore", "red", 2019, app="Chianti Rufina")
c("Chianti", "red", 2023, app="Chianti")
# ---- Priorat, Manchuela, Ribeiro, Rias Baixas
c("Priorat Blanc", "white", 2022, app="Priorat")
c("Finca Dofi", "red", 2018, app="Priorat")
c("Vi de Vila Gratallops", "red", 2019, app="Priorat")
c("Priorat Negre", "red", 2021, app="Priorat")
c("Manchuela Viejas", "red", 2018, app="Manchuela")
c("Manchuela Joven", "red", 2024, app="Manchuela")
c("Manchuela Tinto", "red", 2021, app="Manchuela")
c("Manchuela Blanco Crianza", "white", 2021, app="Manchuela")
c("Manchuela Blanco", "white", 2024, app="Manchuela")
c("Manchuela Rosado", "rosé", 2024, app="Manchuela")
c("Ribeiro Tinto", "red", 2021, app="Ribeiro")
c("Ribeiro Lias", "white", 2021, app="Ribeiro")
c("Ribeiro Treixadura", "white", 2020, app="Ribeiro", grapes="100% Treixadura")
c("Ribeiro Tostado Blanco", "white", 2020, app="Ribeiro")
c("Ribeiro Blanco", "white", 2024, app="Ribeiro")
c("Rias Baixas Barrica", "white", 2020, app="Rías Baixas")
c("Rias Baixas Lias", "white", 2021, app="Rías Baixas")
c("Albarino Clasico", "white", 2024, app="Rías Baixas")
# ---- other whites
c("Arbois Vin Jaune", "white", 2012, app="Arbois")
c("Chateau Chalon", "white", 2010, app="Château-Chalon")
c("Tondonia Blanco Reserva", "white", 2008, app="Rioja")
c("Gravonia", "white", 2014, app="Rioja")
c("Rioja Blanco Gran Reserva", "white", 2005, app="Rioja")
c("Rioja Blanco Reserva", "white", 2015, app="Rioja")
c("Rioja Blanco Crianza", "white", 2018, app="Rioja")
c("Rioja Blanco Fermentado en Barrica", "white", 2020, app="Rioja")
c("Rioja Blanco Joven", "white", 2024, app="Rioja")
c("Rueda Barrica", "white", 2021, app="Rueda")
c("Rueda Lias", "white", 2022, app="Rueda")
c("Rueda Verdejo", "white", 2024, app="Rueda")
c("Savennieres Chenin", "white", 2018, app="Savennières")
c("Chardonnay Fermentado en Barrica", "white", 2020, app="Burgundy")
c("Chardonnay Reserva", "white", 2019, app="Penedès")
c("Fresh Albarino", "white", 2024, app="Penedès")
# ---- reds: Rioja, Jumilla, Ribera, the rest
c("Rioja Gran Reserva", "red", 2008, app="Rioja")
c("Rioja Reserva", "red", 2015, app="Rioja")
c("Rioja Crianza", "red", 2019, app="Rioja")
c("Rioja Joven", "red", 2024, app="Rioja")
c("Rioja Cosecha", "red", 2024, app="Rioja")
c("Rioja Tinto", "red", 2021, app=None, region="La Rioja")
c("Vina Tondonia Reserva", "red", 2010, app="Rioja")
c("Ardanza", "red", 2015, app="Rioja")
c("La Rioja Alta Gran Reserva 904", "red", 2011, app="Rioja")
c("Jumilla Gran Reserva", "red", 2010, app="Jumilla")
c("Jumilla Reserva", "red", 2015, app="Jumilla")
c("Jumilla Crianza", "red", 2019, app="Jumilla")
c("Jumilla Monastrell", "red", 2023, app="Jumilla")
c("Ribera Gran Reserva", "red", 2009, app="Ribera del Duero")
c("Ribera Reserva", "red", 2015, app="Ribera del Duero")
c("Ribera Crianza", "red", 2019, app="Ribera del Duero")
c("Ribera Roble", "red", 2022, app="Ribera del Duero")
c("Ribera Joven", "red", 2023, app="Ribera del Duero")
c("Ribera Tinto", "red", 2021, app="Ribera del Duero")
c("Unico Vega Sicilia Gran Reserva", "red", 2009, app="Ribera del Duero")
c("Toro Gran Reserva", "red", 2010, app="Toro")
c("Toro Reserva", "red", 2015, app="Toro")
c("Toro Crianza", "red", 2018, app="Toro")
c("Toro Joven Roble", "red", 2023, app="Toro")
c("Toro Tinto", "red", 2021, app="Toro")
c("Montsant Style Priorat Garnacha", "red", 2018, app="Montsant")
c("Cepas Centenarias Garnacha", "red", 2017, app="Calatayud")
# ---- the year is a parameter, not today's date
c("Rioja Reserva", "red", 2015, app="Rioja", year=2030, label="Rioja Reserva, year 2030")
c("Brut Nature", "sparkling", 2018, app="Cava", year=2030, label="Cava, year 2030")

# ---- the sample cellar of the Lagar repository
with open(LAGAR / "data" / "sample" / "cellar.csv", encoding="utf-8-sig", newline="") as f:
    for row in csv.DictReader(f):
        v = row["vintage"].strip()
        c(row["name"], row["type"].strip() or None, "NV" if v.upper() == "NV" else int(v),
          app=row["appellation"] or None, region=row["region"] or None, grapes=row["grapes"] or None,
          producer=row["producer"] or None, country=row["country"] or None, bought=row["purchase_date"] or None,
          label="sample: " + row["name"])


def reword(note):
    """Public-app wording: no 'owner's table'."""
    note = re.sub(r" \(owner's table, ([^)]*)\)", r" (\1)", note)
    return note.replace(" (owner's table)", "")


def to_python(case):
    i = case["input"]
    v = None if i["vintage"] == "NV" else i["vintage"]
    return dict(id=1, name=i["name"], colour=i["type"], vintage=v, is_nv=1 if v is None else 0, producer=i["producer"],
                country=i["country"], region=i["region"], appellation=i["appellation"], grapes=i["grapes"],
                last_purchase=i["purchaseDate"], source_type="", ageing=None, vinification=None,
                short_description=None, tasting_palate=None, tasting_nose=None)


# line coverage of the original engine, to show which rules the cases do not reach
all_lines = set()
src = (LAGAR / "scripts" / "advice.py").read_text()
def collect(code):
    all_lines.update(l for _, _, l in code.co_lines() if l)
    for k in code.co_consts:
        if hasattr(k, "co_lines"):
            collect(k)
collect(compile(src, str(LAGAR / "scripts" / "advice.py"), "exec"))
executed = set()
path = str(LAGAR / "scripts" / "advice.py")
def tracer(frame, event, arg):
    if frame.f_code.co_filename != path:
        return None
    if event == "line":
        executed.add(frame.f_lineno)
    return tracer
sys.settrace(tracer)

golden = []
for case in CASES:
    rows = advice.compute([to_python(case)], {}, year=case["year"])
    _id, status, a, b, keeps, source, note, quote = rows[0]
    assert source == "rule", (case["label"], source)
    golden.append(dict(**case, expected=dict(status=status, fromYear=a, toYear=b, keeps=keeps, note=reword(note))))
sys.settrace(None)

OUT.write_text(json.dumps(golden, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"{len(golden)} cases written to {OUT}")

# which rule lines no case reached (the style rules only: lines 33-576, minus the shop-page and critic code)
lines = src.splitlines()
missing = sorted(l for l in all_lines if 33 <= l <= 577 and l not in executed)
shown = [l for l in missing if lines[l - 1].strip() and not lines[l - 1].strip().startswith(("#", '"""', "def ", "class "))]
print(f"{len(shown)} rule lines not reached by any case:")
for l in shown:
    print(f"  {l}: {lines[l - 1].strip()[:110]}")
