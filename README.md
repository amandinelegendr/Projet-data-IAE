# Alternance en ingénierie

Site : nombre d'offres d'alternance (apprentissage et professionnalisation) dans les métiers de l'ingénierie, par département, avec une carte de France interactive, le détail par domaine et la liste des offres les plus récentes.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `scripts/extraction_offres.py` | Télécharge l'export quotidien des offres de La bonne alternance et compte les offres d'ingénierie par département, par domaine et pour le niveau Bac+5 |
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

## Source et clé d'accès

Les offres viennent de [La bonne alternance](https://labonnealternance.apprentissage.beta.gouv.fr) (offres collectées par La bonne alternance, France Travail et leurs partenaires), via la route d'export de l'[API apprentissage](https://api.apprentissage.beta.gouv.fr), mise à jour chaque nuit. Le département est déduit du code postal de l'adresse, ou à défaut des coordonnées GPS. Le niveau « Bac+5 » correspond aux offres dont le diplôme visé est de niveau européen 7.

1. Créer un compte sur [api.apprentissage.beta.gouv.fr](https://api.apprentissage.beta.gouv.fr) et générer une clé **production** (lecture seule, valable un an).
2. Dans le dépôt GitHub : *Settings → Secrets and variables → Actions*, ajouter le secret `LBA_API_KEY`.
3. Lancer l'Action « Mise à jour des offres » depuis l'onglet *Actions*.

La clé n'est jamais écrite dans le code. Penser à la renouveler avant son expiration.

## Lancer l'extraction à la main

```bash
LBA_API_KEY=... python scripts/extraction_offres.py
```

Aucune dépendance n'est nécessaire (Python 3 standard). Un seul appel à l'API (limite : 2 par minute).

## Publication

*Settings → Pages* : source « Deploy from a branch », branche `main`, dossier `/docs`.
