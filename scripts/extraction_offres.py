"""Compte les offres d'alternance en ingénierie par département (API Offres d'emploi v2 de France Travail).

Identifiants lus dans les variables d'environnement FT_CLIENT_ID et FT_CLIENT_SECRET
(application créée sur https://francetravail.io, API « Offres d'emploi v2 »).
Écrit docs/data/offres.json, lu par le site.
"""

import datetime
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

RACINE = pathlib.Path(__file__).resolve().parent.parent
SORTIE = RACINE / "docs" / "data" / "offres.json"
CONTOURS = RACINE / "docs" / "data" / "departements.geojson"

URL_JETON = "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire"
URL_RECHERCHE = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search"
URL_OFFRE = "https://candidat.francetravail.fr/offres/recherche/detail/{}"

# Métiers de l'ingénierie regroupés par domaine (codes ROME)
DOMAINES = [
    ("informatique", "Informatique et numérique", ["M1801", "M1802", "M1805", "M1806", "M1810"]),
    ("etudes", "Études, R&D et conception", ["H1202", "H1203", "H1206", "H1208", "H1209", "H1210"]),
    ("production", "Production, méthodes et maintenance", ["H1401", "H1402", "H2502", "I1102"]),
    ("qualite", "Qualité, hygiène, sécurité, environnement", ["H1302", "H1303", "H1502"]),
    ("btp", "BTP et génie civil", ["F1103", "F1104", "F1106", "F1201"]),
    ("affaires", "Ingénierie d'affaires et technico-commercial", ["D1407", "H1102"]),
]

OUTRE_MER = {"971": "Guadeloupe", "972": "Martinique", "973": "Guyane", "974": "La Réunion", "976": "Mayotte"}

OFFRES_PAR_DOMAINE = 150  # maximum autorisé par appel


def lire_jeton():
    identifiant = os.environ.get("FT_CLIENT_ID")
    secret = os.environ.get("FT_CLIENT_SECRET")
    if not identifiant or not secret:
        sys.exit("FT_CLIENT_ID et FT_CLIENT_SECRET doivent être définis (voir README).")
    corps = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": identifiant,
        "client_secret": secret,
        "scope": "api_offresdemploiv2 o2dsoffre",
    }).encode()
    requete = urllib.request.Request(URL_JETON, data=corps, headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            return json.load(reponse)["access_token"]
    except urllib.error.HTTPError as erreur:
        # La réponse explique le refus (ex. invalid_client, invalid_scope) sans contenir d'identifiant
        sys.exit(f"Jeton refusé par France Travail ({erreur.code}) : {erreur.read().decode(errors='replace')}")


def rechercher(jeton, **parametres):
    """Renvoie (nombre total d'offres, liste des offres de la plage demandée)."""
    url = URL_RECHERCHE + "?" + urllib.parse.urlencode(parametres)
    requete = urllib.request.Request(url, headers={"Authorization": f"Bearer {jeton}", "Accept": "application/json"})
    for essai in range(5):
        time.sleep(0.15)  # l'API limite à 10 appels par seconde
        try:
            with urllib.request.urlopen(requete, timeout=60) as reponse:
                if reponse.status == 204:
                    return 0, []
                plage = reponse.headers.get("Content-Range", "")  # ex. « offres 0-0/1234 »
                total = int(plage.rsplit("/", 1)[1]) if "/" in plage else 0
                return total, json.load(reponse).get("resultats", [])
        except urllib.error.HTTPError as erreur:
            if erreur.code in (429, 500, 502, 503) and essai < 4:
                time.sleep(float(erreur.headers.get("Retry-After") or 2 ** essai))
                continue
            raise
    raise RuntimeError("API indisponible")


def lister_departements():
    contours = json.loads(CONTOURS.read_text(encoding="utf-8"))
    departements = {f["properties"]["code"]: f["properties"]["nom"] for f in contours["features"]}
    departements.update(OUTRE_MER)
    return dict(sorted(departements.items()))


def resumer(offre, domaine):
    lieu = offre.get("lieuTravail", {}).get("libelle", "")
    code = lieu.split(" - ", 1)[0].strip() if " - " in lieu else ""
    return {
        "id": offre["id"],
        "intitule": offre.get("intitule", ""),
        "entreprise": offre.get("entreprise", {}).get("nom", ""),
        "lieu": lieu,
        "departement": code,
        "domaine": domaine,
        "contrat": offre.get("natureContrat", ""),
        "date": offre.get("dateCreation", "")[:10],
        "url": URL_OFFRE.format(offre["id"]),
    }


def main():
    jeton = lire_jeton()
    departements = lister_departements()

    comptes = {code: {"nom": nom, "domaines": {}} for code, nom in departements.items()}
    offres = []
    for cle, nom, romes in DOMAINES:
        codes = ",".join(romes)
        print(f"{nom}…")
        for code in departements:
            total, _ = rechercher(jeton, codeROME=codes, departement=code, alternance="true", range="0-0")
            comptes[code]["domaines"][cle] = total
        _, dernieres = rechercher(jeton, codeROME=codes, alternance="true", sort=1, range=f"0-{OFFRES_PAR_DOMAINE - 1}")
        offres += [resumer(o, cle) for o in dernieres]

    for compte in comptes.values():
        compte["total"] = sum(compte["domaines"].values())

    donnees = {
        "mise_a_jour": datetime.date.today().isoformat(),
        "source": "France Travail, API Offres d'emploi v2 (offres en alternance)",
        "domaines": [{"id": cle, "nom": nom, "romes": romes} for cle, nom, romes in DOMAINES],
        "departements": comptes,
        "offres": sorted(offres, key=lambda o: o["date"], reverse=True),
    }
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{sum(c['total'] for c in comptes.values())} offres, {len(offres)} offres détaillées → {SORTIE}")


if __name__ == "__main__":
    main()
