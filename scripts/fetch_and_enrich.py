"""Observatoire des alternances en ingénierie : extraction et enrichissement des offres.

1. Télécharge l'export quotidien des offres de La bonne alternance (clé dans LBA_API_KEY).
2. Garde les vraies offres (pas les « recruteurs » à démarcher) des métiers d'ingénierie suivis.
3. Enrichit chaque offre avec des champs réels (télétravail, taille, convention collective, niveau,
   durée, coordonnées) et des champs calculés, tous documentés dans docs/data/alternances_enrichies.json :
   bassin d'emploi, catégorie d'entreprise, salaire (annoncé ou minimum légal), reste à vivre après loyer,
   indice d'attractivité /100.

Aucune donnée n'est inventée : un champ absent de l'offre reste « non précisé ».
"""

import csv
import datetime
import io
import json
import math
import os
import pathlib
import re
import sys
import unicodedata
import urllib.error
import urllib.request

RACINE = pathlib.Path(__file__).resolve().parent.parent
SORTIE = RACINE / "docs" / "data" / "alternances_enrichies.json"
CONTOURS = RACINE / "docs" / "data" / "departements.geojson"

URL_EXPORT = "https://api.apprentissage.beta.gouv.fr/api/job/v1/export"
URL_LOYERS = ("https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/"
              "20251211-144934/pred-app12-mef-dhup.csv")

# --- Référentiels -------------------------------------------------------------------------------

# Thèmes d'ingénierie et codes ROME (cahier des charges + codes relevés dans les vraies offres)
THEMES = [
    ("supply", "Supply Chain & Logistique", ["H1401"]),
    ("production", "Production, Méthodes & Lean", ["H1402", "H1404", "I1302"]),
    ("rd", "R&D, Études & Matériaux", ["H1206"]),
    ("qualite", "Qualité & HSE", ["H1502", "H1302", "H1528", "H1524", "F1204"]),
    ("data", "Data, IT & Cyber", ["M1805", "M1810"]),
    ("btp", "Ingénierie BTP", ["F1117"]),
]
THEME_DU_ROME = {rome: cle for cle, _, romes in THEMES for rome in romes}

# Bassins industriels et technologiques : une offre en fait partie si elle est à moins de 30 km d'un des centres
BASSINS = [
    ("Paris / Saclay", [(48.8566, 2.3522), (48.7130, 2.1680)]),
    ("Lyon", [(45.7640, 4.8357)]),
    ("Toulouse", [(43.6047, 1.4442)]),
    ("Clermont-Ferrand", [(45.7772, 3.0870)]),
    ("Grenoble", [(45.1885, 5.7245)]),
    ("Bordeaux", [(44.8378, -0.5792)]),
    ("Nantes / Saint-Nazaire", [(47.2184, -1.5536), (47.2735, -2.2138)]),
    ("Lille", [(50.6292, 3.0573)]),
    ("Aix-Marseille", [(43.2965, 5.3698), (43.5297, 5.4474)]),
    ("Rennes", [(48.1173, -1.6778)]),
    ("Strasbourg", [(48.5734, 7.7521)]),
    ("Montpellier", [(43.6108, 3.8767)]),
    ("Nice / Sophia-Antipolis", [(43.7102, 7.2620), (43.6163, 7.0552)]),
    ("Brest", [(48.3904, -4.4861)]),
    ("Le Havre / Rouen", [(49.4944, 0.1079), (49.4432, 1.0999)]),
]
RAYON_BASSIN_KM = 30

REGIONS = {
    "11": "Île-de-France", "24": "Centre-Val de Loire", "27": "Bourgogne-Franche-Comté", "28": "Normandie",
    "32": "Hauts-de-France", "44": "Grand Est", "52": "Pays de la Loire", "53": "Bretagne",
    "75": "Nouvelle-Aquitaine", "76": "Occitanie", "84": "Auvergne-Rhône-Alpes",
    "93": "Provence-Alpes-Côte d'Azur", "94": "Corse",
    "01": "Guadeloupe", "02": "Martinique", "03": "Guyane", "04": "La Réunion", "06": "Mayotte",
}
OUTRE_MER = {"971": "Guadeloupe", "972": "Martinique", "973": "Guyane", "974": "La Réunion", "976": "Mayotte"}

# Catégorie d'entreprise d'après le nom (mots entiers, sans accents)
CAC40 = ["AIRBUS", "SAFRAN", "THALES", "MICHELIN", "SCHNEIDER ELECTRIC", "AIR LIQUIDE", "TOTALENERGIES", "TOTAL ENERGIES",
         "SANOFI", "LVMH", "LOUIS VUITTON", "L OREAL", "LOREAL", "STELLANTIS", "PSA AUTOMOBILES", "RENAULT", "CAPGEMINI",
         "VINCI", "BOUYGUES", "SAINT GOBAIN", "ENGIE", "VEOLIA", "DASSAULT SYSTEMES", "LEGRAND", "ARCELORMITTAL",
         "ORANGE", "STMICROELECTRONICS", "ESSILOR", "ESSILORLUXOTTICA", "DANONE", "PERNOD RICARD", "EUROFINS",
         "BUREAU VERITAS", "HERMES", "KERING", "CARREFOUR", "ACCOR", "PUBLICIS", "TELEPERFORMANCE"]
GRANDS_GROUPES = ["EDF", "ELECTRICITE DE FRANCE", "ENEDIS", "RTE", "SNCF", "ORANO", "FRAMATOME", "CEA",
                  "COMMISSARIAT A L ENERGIE ATOMIQUE", "AUBERT DUVAL", "CONSTELLIUM", "VALEO", "FORVIA", "FAURECIA",
                  "ALSTOM", "NAVAL GROUP", "MBDA", "DASSAULT AVIATION", "ARIANEGROUP", "ARIANE GROUP", "BIOMERIEUX",
                  "LIMAGRAIN", "SOPRA STERIA", "ALTEN", "AKKODIS", "DHL", "GEODIS", "KUEHNE NAGEL", "MOVIANTO",
                  "EIFFAGE", "SPIE", "NEXANS", "SEB", "PLASTIC OMNIUM", "OPMOBILITY", "IMERYS", "ARKEMA", "SUEZ",
                  "SODEXO", "LISI", "FIGEAC AERO", "LATECOERE", "DAHER", "SAFT", "ATOS", "EVIDEN", "ASSYSTEM",
                  "SEGULA", "EXPLEO", "ARTELIA", "EGIS", "SETEC", "COLAS", "RATP", "LA POSTE", "AIR FRANCE"]
SEUIL_GRAND_GROUPE = 2000  # salariés de l'établissement, à défaut de nom reconnu

# Conventions collectives les plus courantes (affichage seulement)
CONVENTIONS = {
    3248: "Métallurgie", 1486: "Syntec (bureaux d'études)", 44: "Chimie", 176: "Industrie pharmaceutique",
    1597: "Bâtiment ETAM", 2614: "Travaux publics ETAM", 3212: "Travaux publics cadres", 16: "Transports routiers",
    2216: "Commerce de détail alimentaire", 1501: "Restauration rapide", 2120: "Banque", 1979: "Hôtels, cafés, restaurants",
    1090: "Services de l'automobile", 2098: "Prestataires de services", 573: "Commerces de gros", 1527: "Immobilier",
    2264: "Hospitalisation privée", 1996: "Pharmacie d'officine", 2941: "Aide à domicile", 3043: "Entreprises de propreté",
    1518: "Animation", 2111: "Salariés du particulier employeur", 650: "Métallurgie (ingénieurs et cadres, ancienne)",
    1702: "Travaux publics ouvriers", 2148: "Télécommunications", 1672: "Sociétés d'assurances", 3127: "Services à la personne",
    1505: "Commerce de détail fruits et légumes", 2706: "Personnel des administrateurs de biens", 1555: "Plasturgie",
    292: "Plasturgie", 1880: "Ameublement", 2609: "Bâtiment ETAM", 1607: "Industries des jeux et jouets",
    1938: "Industries de la transformation des volailles", 3109: "Industries alimentaires diverses",
    1747: "Activités industrielles de boulangerie", 18: "Industries textiles", 675: "Maisons à succursales habillement",
    3236: "Industrie et services nautiques", 1413: "Travail temporaire", 2121: "Édition", 1516: "Organismes de formation",
}

# Salaire : SMIC mensuel brut au 1er janvier 2026 et grille légale (part du SMIC)
SMIC = 1823.03
PROFIL_REFERENCE = ("Grille légale pour un alternant de 21 à 25 ans : apprentissage 53 % / 61 % / 78 % du SMIC "
                    "selon l'année (moyenne des années de formation selon le niveau visé), professionnalisation 80 %.")
PART_SMIC_APPRENTISSAGE = {  # niveau européen visé -> part moyenne du SMIC sur le cursus, 21-25 ans
    "7": (0.53 + 0.61 + 0.78) / 3,   # cycle ingénieur ou master en 3 ans
    "6": (0.53 + 0.61) / 2,          # licence / bachelor
    "5": (0.43 + 0.51) / 2,          # BTS / BUT (souvent 18-20 ans)
    None: (0.53 + 0.61 + 0.78) / 3,
}
PART_SMIC_PRO = 0.80

LOYER_SURFACE_M2 = 25  # studio de référence pour le reste à vivre

MOTS_MISSIONS = [  # (motif, points, étiquette)
    (r"gestion de projet|chef de projet|pilotage|piloter", 3, "Gestion de projet"),
    (r"international|anglais|english", 3, "International"),
    (r"multi.?sites?|plusieurs sites", 2, "Multi-sites"),
    (r"\bsap\b", 2, "SAP"),
    (r"power ?bi", 2, "Power BI"),
    (r"python", 2, "Python"),
    (r"\blean\b|six sigma|\b5s\b|kaizen", 2, "Lean / Six Sigma"),
    (r"am[ée]lioration continue", 2, "Amélioration continue"),
    (r"\bia\b|intelligence artificielle|machine learning|\bdata\b", 2, "Data / IA"),
    (r"r&d|innovation|recherche", 2, "R&D / Innovation"),
    (r"catia|solidworks|\bcao\b|autocad|revit", 2, "CAO"),
    (r"automatisme|automate|\bplc\b|siemens", 2, "Automatisme"),
    (r"manag", 2, "Management"),
]
NOTE_MISSION_BASE = 4

# --- Outils -------------------------------------------------------------------------------------


def normaliser(texte):
    texte = unicodedata.normalize("NFKD", texte or "").encode("ascii", "ignore").decode().upper()
    texte = re.sub(r"[^A-Z0-9]+", " ", texte)
    texte = re.sub(r"\bSTE\b", "SAINTE", re.sub(r"\bST\b", "SAINT", texte))
    return " ".join(texte.split())


def contient(nom, liste):
    return any(re.search(rf"\b{re.escape(m)}\b", nom) for m in liste)


def distance_km(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p = math.pi / 180
    h = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def borner(x, bas, haut):
    return max(bas, min(haut, x))


def telecharger(url, entetes=None, delai=600):
    with urllib.request.urlopen(urllib.request.Request(url, headers=entetes or {}), timeout=delai) as reponse:
        return reponse.read()


# --- Sources ------------------------------------------------------------------------------------


def charger_offres():
    cle = os.environ.get("LBA_API_KEY")
    if not cle:
        sys.exit("LBA_API_KEY doit être définie (voir README).")
    try:
        export = json.loads(telecharger(URL_EXPORT, {"Authorization": f"Bearer {cle}", "Accept": "application/json"}, 60))
    except urllib.error.HTTPError as erreur:
        sys.exit(f"Export refusé par La bonne alternance ({erreur.code}) : {erreur.read().decode(errors='replace')[:500]}")
    print(f"Export du {export['lastUpdate']}, téléchargement…")
    donnees = json.loads(telecharger(export["url"]))  # URL signée, valable 2 minutes
    elements = donnees.get("jobs", []) if isinstance(donnees, dict) else donnees
    # L'export mêle de vraies offres et des « recruteurs » (entreprises à démarcher, sans offre publiée)
    offres = [o for o in elements if o.get("identifier", {}).get("partner_label") != "recruteurs_lba"]
    print(f"{len(elements)} éléments, dont {len(offres)} offres publiées")
    return export["lastUpdate"][:10], offres


def charger_loyers():
    """Loyer d'annonce prédit (€/m², appartements 1-2 pièces) par commune et moyenne par département."""
    texte = telecharger(URL_LOYERS).decode("latin-1")
    par_commune, cumul_dep, region_du_dep = {}, {}, {}
    for ligne in csv.DictReader(io.StringIO(texte), delimiter=";"):
        dep, loyer = ligne["DEP"], float(ligne["loypredm2"].replace(",", "."))
        poids = int(ligne["nbobs_com"] or 0) or 1
        region_du_dep[dep] = ligne["REG"].zfill(2)
        nom = normaliser(re.sub(r"\s+\d+(er|e)?\s+Arrondissement$", "", ligne["LIBGEO"], flags=re.I))
        par_commune.setdefault((dep, nom), []).append((loyer, poids))
        s = cumul_dep.setdefault(dep, [0.0, 0])
        s[0] += loyer * poids
        s[1] += poids
    moyenne = lambda valeurs: sum(l * p for l, p in valeurs) / sum(p for _, p in valeurs)
    communes = {k: moyenne(v) for k, v in par_commune.items()}
    departements = {d: s[0] / s[1] for d, s in cumul_dep.items()}
    region_du_dep["976"] = "06"
    return communes, departements, region_du_dep


def charger_contours():
    contours = json.loads(CONTOURS.read_text(encoding="utf-8"))
    noms = {f["properties"]["code"]: f["properties"]["nom"] for f in contours["features"]}
    noms.update(OUTRE_MER)
    polygones = []
    for f in contours["features"]:
        g = f["geometry"]
        for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]):
            polygones.append((f["properties"]["code"], poly[0]))
    return noms, polygones


# --- Enrichissement -----------------------------------------------------------------------------


def dans_polygone(x, y, anneau):
    dedans = False
    for (x1, y1), (x2, y2) in zip(anneau, anneau[1:] + anneau[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            dedans = not dedans
    return dedans


def localiser(lieu, polygones):
    """(département, ville) d'après le code postal de l'adresse, sinon d'après les coordonnées."""
    adresse = lieu.get("address") or ""
    cp = re.findall(r"\b(\d{5})\b", adresse)
    ville = re.sub(r"^.*\b\d{5}\s*", "", adresse).strip() if cp else ""
    ville = re.sub(r"\s+(CEDEX.*|\d+(E|ER)?)$", "", ville, flags=re.I).strip()
    if cp:
        cp = cp[-1]
        dep = cp[:3] if cp.startswith("97") else ("2A" if int(cp) < 20200 else "2B") if cp.startswith("20") else cp[:2]
        return dep, ville
    coords = (lieu.get("geopoint") or {}).get("coordinates")
    if coords:
        for code, anneau in polygones:
            if dans_polygone(coords[0], coords[1], anneau):
                return code, ville
    return None, ville


def categorie(nom, taille_min):
    n = normaliser(nom)
    if contient(n, CAC40):
        return "CAC 40", "nom"
    if contient(n, GRANDS_GROUPES):
        return "Grand Groupe", "nom"
    if taille_min is not None and taille_min >= SEUIL_GRAND_GROUPE:
        return "Grand Groupe", "effectif"
    return "ETI / PME", "nom" if n else "inconnu"


def taille_minimum(taille):
    m = re.match(r"\s*(\d+)", taille or "")
    return int(m.group(1)) if m else None


def salaire_annonce(texte):
    """Montant mensuel brut annoncé dans l'offre (en € ou en % du SMIC), sinon None."""
    t = (texte or "").replace(" ", " ").replace("\xa0", " ")
    for m in re.finditer(r"(\d{1,3}(?:[ .]\d{3})|\d{3,4})(?:[.,]\d{1,2})?\s*(?:€|euros?)", t, flags=re.I):
        montant = float(re.sub(r"[ .]", "", m.group(1)))
        contexte = t[max(0, m.start() - 80): m.end() + 40].lower()
        if 700 <= montant <= 3500 and re.search(r"brut|mois|mensuel|r[ée]mun[ée]ration|salaire", contexte) \
                and not re.search(r"\ban\b|annuel|prime|aide|indemnit|frais", contexte):
            return round(montant)
    m = re.search(r"(\d{2,3})\s*%\s*(?:du\s*)?smic", t, flags=re.I)
    if m and 25 <= int(m.group(1)) <= 130:
        return round(int(m.group(1)) / 100 * SMIC)
    return None


def salaire_legal(types, niveau):
    if types == ["Professionnalisation"]:
        return round(PART_SMIC_PRO * SMIC)
    return round(PART_SMIC_APPRENTISSAGE.get(niveau, PART_SMIC_APPRENTISSAGE[None]) * SMIC)


def bassin(lat, lon):
    if lat is None:
        return None
    meilleur = min(((min(distance_km((lat, lon), c) for c in centres), nom) for nom, centres in BASSINS))
    return meilleur[1] if meilleur[0] <= RAYON_BASSIN_KM else None


def notes(cat, taille_min, salaire, texte, teletravail, reste_a_vivre):
    """Indice d'attractivité /100 : prestige /30, rémunération /30, missions /20, cadre de vie /20."""
    echelle_taille = borner(math.log10(max(1, taille_min or 1)) / 4, 0, 1)  # 1 salarié -> 0, 10 000 -> 1
    bornes = {"CAC 40": (24, 30), "Grand Groupe": (18, 25), "ETI / PME": (8, 18)}[cat]
    prestige = bornes[0] + (bornes[1] - bornes[0]) * echelle_taille
    remuneration = 30 * borner((salaire - 900) / (2100 - 900), 0, 1)
    mots = [etiquette for motif, _, etiquette in MOTS_MISSIONS if re.search(motif, texte, flags=re.I)]
    missions = min(20, NOTE_MISSION_BASE + sum(p for motif, p, _ in MOTS_MISSIONS if re.search(motif, texte, flags=re.I)))
    cadre = {"Télétravail complet": 10, "Hybride": 7, "Présentiel": 2}.get(teletravail, 4)
    if reste_a_vivre is not None:
        cadre += 10 * borner((reste_a_vivre - 400) / (1400 - 400), 0, 1)
    else:
        cadre += 5
    detail = {"prestige": round(prestige, 1), "remuneration": round(remuneration, 1),
              "missions": round(missions, 1), "cadre_vie": round(cadre, 1)}
    return round(sum(detail.values()), 1), detail, mots


def main():
    date_export, offres = charger_offres()
    loyers_communes, loyers_deps, region_du_dep = charger_loyers()
    noms_deps, polygones = charger_contours()
    teletravail_libelle = {"onsite": "Présentiel", "hybrid": "Hybride", "remote": "Télétravail complet"}

    resultats, ignorees = [], 0
    for o in offres:
        offre, lieu = o.get("offer", {}), (o.get("workplace", {}).get("location") or {})
        theme = next((THEME_DU_ROME[r] for r in offre.get("rome_codes") or [] if r in THEME_DU_ROME), None)
        if not theme:
            continue
        dep, ville = localiser(lieu, polygones)
        if dep not in noms_deps:
            ignorees += 1
            continue
        coords = (lieu.get("geopoint") or {}).get("coordinates") or [None, None]
        lon, lat = coords[0], coords[1]
        travail = o.get("workplace", {})
        contrat = o.get("contract", {})
        niveau = (offre.get("target_diploma") or {}).get("european")
        types = contrat.get("type") or []
        texte = f"{offre.get('title', '')} {offre.get('description', '')} {' '.join(offre.get('desired_skills') or [])}"

        taille_min = taille_minimum(travail.get("size"))
        cat, methode_cat = categorie(travail.get("name") or travail.get("legal_name") or "", taille_min)
        annonce = salaire_annonce(offre.get("description"))
        salaire = annonce or salaire_legal(types, niveau)
        loyer_m2 = loyers_communes.get((dep, normaliser(ville))) or loyers_deps.get(dep)
        loyer = round(loyer_m2 * LOYER_SURFACE_M2) if loyer_m2 else None
        reste = salaire - loyer if loyer else None
        teletravail = teletravail_libelle.get(contrat.get("remote"), "Non précisé")
        score, detail, mots = notes(cat, taille_min, salaire, texte, teletravail, reste)
        idcc = (travail.get("domain") or {}).get("idcc")
        naf = (travail.get("domain") or {}).get("naf") or {}
        region = region_du_dep.get(dep)

        resultats.append({
            "id": o.get("identifier", {}).get("id") or o.get("identifier", {}).get("partner_job_id"),
            "source": o.get("identifier", {}).get("partner_label"),
            "titre": offre.get("title", ""),
            "entreprise": travail.get("name") or travail.get("legal_name") or "",
            "siret": travail.get("siret"),
            "categorie": cat,
            "categorie_methode": methode_cat,
            "taille": travail.get("size"),
            "taille_min": taille_min,
            "naf": naf.get("label"),
            "idcc": idcc,
            "convention": CONVENTIONS.get(idcc, f"IDCC {idcc}") if idcc else None,
            "theme": theme,
            "rome": [r for r in offre.get("rome_codes") or [] if r in THEME_DU_ROME],
            "ville": ville.title() if ville else noms_deps[dep],
            "departement": dep,
            "region": region,
            "lat": lat,
            "lon": lon,
            "bassin": bassin(lat, lon),
            "contrat": types,
            "duree_mois": contrat.get("duration"),
            "niveau": niveau,
            "teletravail": teletravail,
            "salaire_brut_mensuel": salaire,
            "salaire_source": "annoncé" if annonce else "minimum légal",
            "loyer_studio": loyer,
            "pouvoir_achat_ajuste": reste,
            "score_attractivite": score,
            "score_detail": detail,
            "competences": mots,
            "date": ((offre.get("publication") or {}).get("creation") or "")[:10],
            "url": o.get("apply", {}).get("url", ""),
        })

    resultats.sort(key=lambda r: r["score_attractivite"], reverse=True)
    donnees = {
        "meta": {
            "mise_a_jour": datetime.date.today().isoformat(),
            "date_export": date_export,
            "nb_offres_export": len(offres),
            "source": "La bonne alternance (offres collectées par La bonne alternance, France Travail et leurs partenaires)",
            "themes": [{"id": cle, "nom": nom, "romes": romes} for cle, nom, romes in THEMES],
            "bassins": [{"nom": nom, "centres": centres} for nom, centres in BASSINS],
            "rayon_bassin_km": RAYON_BASSIN_KM,
            "regions": REGIONS,
            "departements": noms_deps,
            "smic": SMIC,
            "profil_salaire": PROFIL_REFERENCE,
            "loyer_surface_m2": LOYER_SURFACE_M2,
            "source_loyers": "Ministère du Logement, « Carte des loyers » 2025 (loyer d'annonce prédit, appartements 1-2 pièces)",
            "seuil_grand_groupe": SEUIL_GRAND_GROUPE,
        },
        "offres": resultats,
    }
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, indent=1), encoding="utf-8")
    annonces = sum(r["salaire_source"] == "annoncé" for r in resultats)
    print(f"{len(resultats)} offres d'ingénierie ({annonces} avec salaire annoncé, {ignorees} sans département) → {SORTIE}")
    if not resultats:
        sys.exit("Aucune offre d'ingénierie trouvée : format de l'export à vérifier.")


if __name__ == "__main__":
    main()
