"""PetLive: importa lugares pet de fontes abertas para a tabela places.

Fontes (grátis, sem chave):
  - OpenStreetMap (Overpass, ODbL): clínicas, petshops, banho e tosa,
    hotelzinhos e o pet friendly marcado com dog=yes/leashed ou dog_park.
  - Overture Maps (places, CDLA-Permissive-2.0; inclui dados da Meta,
    Microsoft e Foursquare, Apache-2.0): clínicas, petshops, banho e tosa,
    creches, hotelzinhos e parques para cães.

Junta as duas, tira repetidos (mesma categoria, até 100 m e nome parecido;
o OpenStreetMap ganha e recebe telefone, site e endereço que faltarem) e
gera um upsert idempotente em supabase/seeds/places-rio.sql.

Uso:
  pip install duckdb
  python scripts/importar-lugares.py                       # Rio de Janeiro
  python scripts/importar-lugares.py --bbox=-23.10,-43.80,-22.74,-43.10
  npx supabase db query --local -f supabase/seeds/places-rio.sql
"""

import argparse
import json
import math
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

import duckdb

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "supabase" / "seeds" / "places-rio.sql"
BBOX_RIO = "-23.10,-43.80,-22.74,-43.10"  # sul, oeste, norte, leste
CONFIANCA_MINIMA = 0.5  # Overture: abaixo disso há muito lugar errado ou fechado
RAIO_REPETIDO_M = 100

# Cidades da região metropolitana: endereço de outra cidade com ponto no Rio
# é erro de geocodificação (ex.: "Natividade/RJ").
CIDADES = {
    "rio de janeiro", "niteroi", "sao goncalo", "duque de caxias", "nova iguacu",
    "sao joao de meriti", "nilopolis", "mesquita", "belford roxo", "itaguai",
    "seropedica", "marica", "queimados", "japeri", "barra da tijuca",
}

ENDPOINTS_OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def sem_acento(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


# ------------------------------------------------------------------ OSM


def consulta_osm(bbox: str) -> str:
    cao = '["dog"~"^(yes|leashed)$"]'
    return f"""
[out:json][timeout:180];
(
  nwr["amenity"="veterinary"]({bbox});
  nwr["shop"="pet"]({bbox});
  nwr["shop"="pet_grooming"]({bbox});
  nwr["amenity"="animal_boarding"]({bbox});
  nwr["leisure"="dog_park"]({bbox});
  nwr["leisure"="park"]{cao}({bbox});
  nwr["natural"="beach"]{cao}({bbox});
  nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream)$"]{cao}({bbox});
  nwr["tourism"~"^(hotel|guest_house|hostel|motel)$"]{cao}({bbox});
);
out center tags;
""".strip()


def buscar_osm(bbox: str) -> list[dict]:
    corpo = urllib.parse.urlencode({"data": consulta_osm(bbox)}).encode()
    espera, erro = 2, None
    for _ in range(4):
        for endpoint in ENDPOINTS_OVERPASS:
            try:
                pedido = urllib.request.Request(endpoint, data=corpo, headers={"User-Agent": "PetLive/1.0 (import de lugares pet)"})
                with urllib.request.urlopen(pedido, timeout=200) as resposta:
                    return json.load(resposta)["elements"]
            except Exception as e:  # noqa: BLE001 — tenta o próximo endpoint
                erro = f"{endpoint}: {e}"
        print(f"Overpass falhou ({erro}); de novo em {espera}s")
        time.sleep(espera)
        espera *= 2
    raise SystemExit(f"Overpass sem resposta: {erro}")


def categoria_osm(tags: dict) -> str | None:
    nome = sem_acento((tags.get("name") or "").lower())
    if tags.get("amenity") == "veterinary":
        return "clinica"
    if tags.get("shop") == "pet_grooming":
        return "banho_tosa"
    if tags.get("amenity") == "animal_boarding":
        return "creche" if "creche" in nome else "hotelzinho"
    if tags.get("shop") == "pet":
        return "petshop"
    if tags.get("leisure") in ("dog_park", "park"):
        return "parque"
    if tags.get("natural") == "beach":
        return "praia"
    if tags.get("amenity"):
        return "restaurante"
    if tags.get("tourism"):
        return "hotel"
    return None


def endereco_osm(tags: dict) -> str | None:
    if tags.get("addr:full"):
        return tags["addr:full"]
    if not tags.get("addr:street"):
        return None
    numero = f", {tags['addr:housenumber']}" if tags.get("addr:housenumber") else ""
    bairro = f" — {tags['addr:suburb']}" if tags.get("addr:suburb") else ""
    return f"{tags['addr:street']}{numero}{bairro}"


def lugares_osm(elementos: list[dict]) -> list[dict]:
    lugares, vistos = [], set()
    for el in elementos:
        tags = el.get("tags", {})
        nome = tags.get("name") or tags.get("name:pt")
        lat = el.get("lat", el.get("center", {}).get("lat"))
        lng = el.get("lon", el.get("center", {}).get("lon"))
        categoria = categoria_osm(tags)
        chave = f"{el['type']}/{el['id']}"
        if not nome or lat is None or lng is None or not categoria or chave in vistos:
            continue
        vistos.add(chave)
        horario = tags.get("opening_hours")
        lugares.append({
            "fonte": "osm", "fonte_id": chave, "osm_type": el["type"], "osm_id": el["id"],
            "nome": nome.strip(), "categoria": categoria, "endereco": endereco_osm(tags),
            "telefone": tags.get("phone") or tags.get("contact:phone") or tags.get("mobile"),
            "horario": horario, "website": tags.get("website") or tags.get("contact:website"),
            "lat": lat, "lng": lng,
            "aberto_24h": bool(horario and "24/7" in horario),
            "aceita_caes": True if tags.get("dog") in ("yes", "leashed") else None,
            "area_caes": tags.get("leisure") == "dog_park",
        })
    return lugares


# ------------------------------------------------------------- Overture


def ultima_release_overture() -> str:
    url = "https://overturemaps-us-west-2.s3.amazonaws.com/?list-type=2&prefix=release/&delimiter=/"
    with urllib.request.urlopen(url, timeout=60) as resposta:
        xml = resposta.read().decode()
    releases = sorted(re.findall(r"<Prefix>release/([^<]+)/</Prefix>", xml))
    if not releases:
        raise SystemExit("Não achei releases do Overture no S3.")
    return releases[-1]


def categoria_overture(cat: str, nome: str) -> str | None:
    n = sem_acento(nome.lower())
    if re.search(r"\bcreche\b|day ?care", n):
        return "creche"
    if re.search(r"hotel|hospedagem", n) and cat in ("animal_or_pet_service", "pet_boarding", "pet_sitting"):
        return "hotelzinho"
    if cat in ("veterinarian", "animal_hospital"):
        return "clinica"
    if cat in ("pet_store", "aquatic_pet_store"):
        return "petshop"
    if cat == "pet_groomer":
        return "banho_tosa"
    if cat == "pet_boarding":
        return "hotelzinho"
    if cat == "dog_park":
        return "parque"
    if cat == "animal_or_pet_service":
        # Categoria genérica: o nome diz o que é.
        if re.search(r"banho|tosa|estetica|spa|groom", n):
            return "banho_tosa"
        if re.search(r"veterin|clinica|hospital|diagnost", n):
            return "clinica"
        if re.search(r"pet ?shop|racao|racoes|petstop", n):
            return "petshop"
    return None


def formatar_telefone(bruto: str | None) -> str | None:
    if not bruto:
        return None
    digitos = re.sub(r"\D", "", bruto)
    if digitos.startswith("55") and len(digitos) in (12, 13):
        digitos = digitos[2:]
    if len(digitos) == 11:
        return f"({digitos[:2]}) {digitos[2:7]}-{digitos[7:]}"
    if len(digitos) == 10:
        return f"({digitos[:2]}) {digitos[2:6]}-{digitos[6:]}"
    return bruto


def lugares_overture(bbox: str, release: str) -> list[dict]:
    sul, oeste, norte, leste = (float(v) for v in bbox.split(","))
    con = duckdb.connect()
    con.execute("install httpfs; load httpfs; set s3_region='us-west-2';")
    caminho = f"s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*"
    linhas = con.execute(
        f"""
        select id, names.primary, taxonomy.primary, confidence, bbox.ymin, bbox.xmin,
               phones[1], websites[1], addresses[1].freeform, addresses[1].locality, operating_status
        from read_parquet('{caminho}')
        where bbox.xmin between ? and ? and bbox.ymin between ? and ?
          and taxonomy.primary in ('veterinarian', 'animal_hospital', 'pet_store', 'aquatic_pet_store',
                                   'pet_groomer', 'pet_boarding', 'pet_sitting', 'dog_park', 'animal_or_pet_service')
          and confidence >= ?
        """,
        [oeste, leste, sul, norte, CONFIANCA_MINIMA],
    ).fetchall()

    lugares = []
    for id_, nome, cat, _conf, lat, lng, telefone, site, endereco, cidade, status in linhas:
        if not nome or status in ("permanently_closed", "temporarily_closed"):
            continue
        if cidade and sem_acento(cidade.lower()) not in CIDADES:
            continue
        categoria = categoria_overture(cat, nome)
        if not categoria:
            continue
        n = sem_acento(nome.lower())
        lugares.append({
            "fonte": "overture", "fonte_id": id_, "osm_type": None, "osm_id": None,
            "nome": nome.strip(), "categoria": categoria,
            "endereco": (endereco or "").replace("\\t", "").strip() or None,
            "telefone": formatar_telefone(telefone), "horario": None, "website": site,
            "lat": lat, "lng": lng,
            "aberto_24h": categoria == "clinica" and bool(re.search(r"24 ?h|24 horas", n)),
            "aceita_caes": None,
            "area_caes": categoria == "parque",
        })
    return lugares


# ------------------------------------------------------- tirar repetidos

PALAVRAS_VAZIAS = {
    "pet", "pets", "shop", "petshop", "clinica", "veterinaria", "veterinario", "centro", "hospital",
    "ltda", "me", "de", "da", "do", "das", "dos", "e", "a", "o", "banho", "tosa", "racoes", "racao",
    "store", "unidade", "the",
}


def tokens(nome: str) -> set[str]:
    palavras = re.findall(r"[a-z0-9]+", sem_acento(nome.lower()))
    uteis = {p for p in palavras if p not in PALAVRAS_VAZIAS}
    return uteis or set(palavras)


def distancia_m(a: dict, b: dict) -> float:
    dlat = math.radians(b["lat"] - a["lat"])
    dlng = math.radians(b["lng"] - a["lng"])
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a["lat"])) * math.cos(math.radians(b["lat"])) * math.sin(dlng / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def mesmo_lugar(a: dict, b: dict) -> bool:
    if a["categoria"] != b["categoria"] or distancia_m(a, b) > RAIO_REPETIDO_M:
        return False
    ta, tb = tokens(a["nome"]), tokens(b["nome"])
    return len(ta & tb) / max(1, len(ta | tb)) >= 0.5


def juntar(principais: list[dict], extras: list[dict]) -> tuple[list[dict], int]:
    """Soma os extras que não repetem um principal (nem outro extra já aceito)."""
    aceitos = list(principais)
    # Grade de ~1 km para comparar só com os vizinhos.
    grade: dict[tuple[int, int], list[dict]] = {}

    def celula(l: dict) -> tuple[int, int]:
        return (int(l["lat"] * 100), int(l["lng"] * 100))

    for l in aceitos:
        grade.setdefault(celula(l), []).append(l)

    repetidos = 0
    for extra in extras:
        cy, cx = celula(extra)
        vizinhos = [v for dy in (-1, 0, 1) for dx in (-1, 0, 1) for v in grade.get((cy + dy, cx + dx), [])]
        igual = next((v for v in vizinhos if mesmo_lugar(v, extra)), None)
        if igual:
            repetidos += 1
            for campo in ("telefone", "website", "endereco"):
                if not igual.get(campo) and extra.get(campo):
                    igual[campo] = extra[campo]
            continue
        aceitos.append(extra)
        grade.setdefault((cy, cx), []).append(extra)
    return aceitos, repetidos


# ------------------------------------------------------------------ SQL


def sql(valor) -> str:
    if valor is None or valor == "":
        return "null"
    if isinstance(valor, bool):
        return "true" if valor else "false"
    if isinstance(valor, (int, float)):
        return repr(valor)
    return "'" + str(valor).replace("'", "''") + "'"


COLUNAS = ["fonte", "fonte_id", "osm_type", "osm_id", "nome", "categoria", "endereco", "telefone",
           "horario", "website", "lat", "lng", "aberto_24h", "aceita_caes", "area_caes"]


def gravar(lugares: list[dict], bbox: str, release: str) -> None:
    valores = ",\n".join("(" + ", ".join(sql(l[c]) for c in COLUNAS) + ")" for l in lugares)
    atualizar = ",\n  ".join(f"{c} = excluded.{c}" for c in COLUNAS if c not in ("fonte", "fonte_id"))
    SAIDA.write_text(
        f"-- Gerado por scripts/importar-lugares.py (bbox {bbox}, Overture {release}).\n"
        f"-- {len(lugares)} lugares pet: OpenStreetMap (ODbL) e Overture Maps (CDLA-Permissive-2.0,\n"
        "-- com dados da Meta, Microsoft e Foursquare/Apache-2.0). Créditos em docs/dados-abertos.md.\n"
        "-- Um comando só (o `db query -f` usa prepared statement); upsert idempotente.\n"
        f"insert into public.places\n  ({', '.join(COLUNAS)})\nvalues\n{valores}\n"
        f"on conflict (fonte, fonte_id) do update set\n  {atualizar};\n",
        encoding="utf-8",
    )


def main() -> None:
    args = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    args.add_argument("--bbox", default=BBOX_RIO, help="sul,oeste,norte,leste")
    args.add_argument("--release", default=None, help="release do Overture (padrão: a mais recente)")
    opcoes = args.parse_args()

    release = opcoes.release or ultima_release_overture()
    print(f"OpenStreetMap (Overpass) e Overture {release}, bbox {opcoes.bbox}")
    osm = lugares_osm(buscar_osm(opcoes.bbox))
    print(f"  OSM: {len(osm)}")
    overture = lugares_overture(opcoes.bbox, release)
    print(f"  Overture (confiança >= {CONFIANCA_MINIMA}): {len(overture)}")

    # Repetidos dentro do próprio Overture (Meta e Microsoft para a mesma loja).
    overture_unicos, internos = juntar([], overture)
    todos, cruzados = juntar(osm, overture_unicos)
    print(f"  Repetidos: {internos} dentro do Overture, {cruzados} entre OSM e Overture")

    contagem: dict[str, int] = {}
    for l in todos:
        contagem[l["categoria"]] = contagem.get(l["categoria"], 0) + 1
    print(f"Total: {len(todos)} -> {SAIDA.relative_to(RAIZ)}")
    print("Por categoria:", dict(sorted(contagem.items(), key=lambda kv: -kv[1])))
    gravar(todos, opcoes.bbox, release)


if __name__ == "__main__":
    main()
