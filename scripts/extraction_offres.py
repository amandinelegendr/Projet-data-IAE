"""Compte les offres d'alternance en ingénierie par département (API La bonne alternance).

Clé d'API lue dans la variable d'environnement LBA_API_KEY
(compte sur https://api.apprentissage.beta.gouv.fr, clé « production » en lecture seule).
Écrit docs/data/offres.json, lu par le site.
"""

import datetime
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

RACINE = pathlib.Path(__file__).resolve().parent.parent
SORTIE = RACINE / "docs" / "data" / "offres.json"
CONTOURS = RACINE / "docs" / "data" / "departements.geojson"

URL_EXPORT = "https://api.apprentissage.beta.gouv.fr/api/job/v1/export"

# Métiers de l'ingénierie regroupés par domaine (codes ROME)
DOMAINES = [
    ("informatique", "Informatique et numérique", ["M1801", "M1802", "M1805", "M1806", "M1810"]),
    ("etudes", "Études, R&D et conception", ["H1202", "H1203", "H1206", "H1208", "H1209", "H1210"]),
    ("production", "Production, méthodes et maintenance", ["H1401", "H1402", "H2502", "I1102"]),
    ("qualite", "Qualité, hygiène, sécurité, environnement", ["H1302", "H1303", "H1502"]),
    ("btp", "BTP et génie civil", ["F1103", "F1104", "F1106", "F1201"]),
    ("affaires", "Ingénierie d'affaires et technico-commercial", ["D1407", "H1102"]),
]
DOMAINE_DU_ROME = {rome: cle for cle, _, romes in DOMAINES for rome in romes}

OUTRE_MER = {"971": "Guadeloupe", "972": "Martinique", "973": "Guyane", "974": "La Réunion", "976": "Mayotte"}

OFFRES_DETAILLEES = 1000  # offres les plus récentes gardées pour la liste du site


def telecharger():
    cle = os.environ.get("LBA_API_KEY")
    if not cle:
        sys.exit("LBA_API_KEY doit être définie (voir README).")
    requete = urllib.request.Request(URL_EXPORT, headers={"Authorization": f"Bearer {cle}", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(requete, timeout=60) as reponse:
            export = json.load(reponse)
    except urllib.error.HTTPError as erreur:
        sys.exit(f"Export refusé par La bonne alternance ({erreur.code}) : {erreur.read().decode(errors='replace')[:500]}")
    print(f"Export du {export['lastUpdate']}, téléchargement…")
    # L'URL du fichier est signée et valable 2 minutes : pas d'en-tête d'authentification
    with urllib.request.urlopen(export["url"], timeout=600) as reponse:
        donnees = json.load(reponse)
    elements = donnees.get("jobs", []) if isinstance(donnees, dict) else donnees
    # L'export mêle de vraies offres et des « recruteurs » (entreprises à démarcher en candidature
    # spontanée, sans offre publiée, chacune rattachée à une dizaine de métiers) : on ne garde que les offres
    offres = [o for o in elements if o.get("identifier", {}).get("partner_label") != "recruteurs_lba"]
    print(f"{len(elements)} éléments, dont {len(offres)} offres publiées")
    return export["lastUpdate"][:10], offres


def charger_contours():
    contours = json.loads(CONTOURS.read_text(encoding="utf-8"))
    noms = {f["properties"]["code"]: f["properties"]["nom"] for f in contours["features"]}
    noms.update(OUTRE_MER)
    polygones = []
    for f in contours["features"]:
        g = f["geometry"]
        for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]):
            polygones.append((f["properties"]["code"], poly[0]))
    return dict(sorted(noms.items())), polygones


def dans_polygone(x, y, anneau):
    dedans = False
    for (x1, y1), (x2, y2) in zip(anneau, anneau[1:] + anneau[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            dedans = not dedans
    return dedans


def departement(lieu, polygones):
    """Département d'après le code postal de l'adresse, sinon d'après les coordonnées GPS."""
    cp = re.findall(r"\b(\d{5})\b", lieu.get("address") or "")
    if cp:
        cp = cp[-1]
        if cp.startswith("97"):
            return cp[:3]
        if cp.startswith("20"):
            return "2A" if int(cp) < 20200 else "2B"
        return cp[:2]
    coords = (lieu.get("geopoint") or {}).get("coordinates")
    if coords:
        for code, anneau in polygones:
            if dans_polygone(coords[0], coords[1], anneau):
                return code
    return None


def main():
    date_export, offres = telecharger()
    noms, polygones = charger_contours()

    comptes = {code: {"nom": nom, "domaines": {c: 0 for c, _, _ in DOMAINES}, "bac5": {c: 0 for c, _, _ in DOMAINES}}
               for code, nom in noms.items()}
    retenues, hors_departement = [], 0
    for o in offres:
        offre = o.get("offer", {})
        domaine = next((DOMAINE_DU_ROME[r] for r in offre.get("rome_codes") or [] if r in DOMAINE_DU_ROME), None)
        if not domaine:
            continue
        lieu = o.get("workplace", {}).get("location") or {}
        code = departement(lieu, polygones)
        if code not in comptes:
            hors_departement += 1
            continue
        bac5 = (offre.get("target_diploma") or {}).get("european") == "7"
        comptes[code]["domaines"][domaine] += 1
        comptes[code]["bac5"][domaine] += bac5
        lieu_texte = re.sub(r"^.*?\b\d{5}\s*", "", lieu.get("address") or "").strip() or noms[code]
        retenues.append({
            "id": o.get("identifier", {}).get("id") or o.get("identifier", {}).get("partner_job_id"),
            "intitule": offre.get("title", ""),
            "entreprise": o.get("workplace", {}).get("name") or "",
            "lieu": f"{code} - {lieu_texte}",
            "departement": code,
            "domaine": domaine,
            "bac5": bac5,
            "contrat": " / ".join(o.get("contract", {}).get("type") or []),
            "date": ((offre.get("publication") or {}).get("creation") or "")[:10],
            "url": o.get("apply", {}).get("url", ""),
        })

    for compte in comptes.values():
        compte["total"] = sum(compte["domaines"].values())
        compte["total_bac5"] = sum(compte["bac5"].values())

    retenues.sort(key=lambda o: o["date"], reverse=True)
    donnees = {
        "mise_a_jour": datetime.date.today().isoformat(),
        "date_export": date_export,
        "source": "La bonne alternance (offres collectées par La bonne alternance, France Travail et leurs partenaires)",
        "domaines": [{"id": cle, "nom": nom, "romes": romes} for cle, nom, romes in DOMAINES],
        "departements": comptes,
        "offres": retenues[:OFFRES_DETAILLEES],
    }
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(c["total"] for c in comptes.values())
    print(f"{len(offres)} offres dans l'export, {total} en ingénierie ({hors_departement} sans département reconnu) → {SORTIE}")
    if total == 0:
        sys.exit("Aucune offre d'ingénierie trouvée : format de l'export à vérifier.")


if __name__ == "__main__":
    main()
