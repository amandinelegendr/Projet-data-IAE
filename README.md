# Alternance en ingénierie

Site : nombre d'offres d'alternance (apprentissage et professionnalisation) dans les métiers de l'ingénierie, par département, avec une carte de France interactive, le détail par domaine et la liste des offres les plus récentes.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `scripts/extraction_offres.py` | Interroge l'API Offres d'emploi v2 de France Travail et compte les offres en alternance par département et par domaine |
| `docs/data/offres.json` | Données produites par le script, lues par le site (créé à la première extraction) |
| `docs/data/departements.geojson` | Contours des départements métropolitains ([france-geojson](https://github.com/gregoiredavid/france-geojson), données IGN/INSEE) |
| `docs/index.html` | Site publié par GitHub Pages |
| `.github/workflows/mise-a-jour-donnees.yml` | Action quotidienne qui relance l'extraction et commit les nouvelles données |

Tant que `docs/data/offres.json` n'existe pas, le site affiche des **données d'exemple fictives**, signalées par un bandeau.

## Domaines et métiers retenus (codes ROME)

| Domaine | Codes ROME |
| --- | --- |
| Informatique et numérique | M1801, M1802, M1805, M1806, M1810 |
| Études, R&D et conception | H1202, H1203, H1206, H1208, H1209, H1210 |
| Production, méthodes et maintenance | H1401, H1402, H2502, I1102 |
| Qualité, hygiène, sécurité, environnement | H1302, H1303, H1502 |
| BTP et génie civil | F1103, F1104, F1106, F1201 |
| Ingénierie d'affaires et technico-commercial | D1407, H1102 |

La liste se modifie dans `DOMAINES`, en tête du script. Elle inclut des postes de technicien supérieur (dessin, intervention technique) souvent ouverts aux alternants en école d'ingénieurs.

## Clé d'accès France Travail

1. Créer un compte sur [francetravail.io](https://francetravail.io), puis une application abonnée à l'API **« Offres d'emploi v2 »** (gratuit).
2. Dans le dépôt GitHub : *Settings → Secrets and variables → Actions*, ajouter `FT_CLIENT_ID` et `FT_CLIENT_SECRET`.
3. Lancer l'Action « Mise à jour des offres » depuis l'onglet *Actions*.

Les identifiants ne sont jamais écrits dans le code.

## Lancer l'extraction à la main

```bash
FT_CLIENT_ID=... FT_CLIENT_SECRET=... python scripts/extraction_offres.py
```

Aucune dépendance n'est nécessaire (Python 3 standard). Environ 620 appels, quelques minutes.

## Publication

*Settings → Pages* : source « Deploy from a branch », branche `main`, dossier `/docs`.
