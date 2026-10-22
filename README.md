# Observatoire & Laboratoire statistique des alternances

Application web analytique sur les offres d'alternance en ingénierie, commerce & marketing et management & gestion en France : carte multi-échelles (régions, départements, villes, bassins d'emploi), indicateurs, explorateur d'offres classées par un indice d'attractivité, et laboratoire statistique (statistiques descriptives et loi normale, test t de Welch, ANOVA + Tukey-Kramer, khi² d'indépendance, corrélation de Pearson) recalculé en direct sur les offres filtrées.

Site : https://amandinelegendr.github.io/Projet-data-IAE/

## Organisation

| Chemin | Contenu |
| --- | --- |
| `scripts/fetch_and_enrich.py` | Télécharge l'export des offres de La bonne alternance, garde les offres des trois filières et les enrichit (bassin, catégorie d'entreprise, salaire, reste à vivre, indice d'attractivité) |
| `docs/data/alternances_enrichies.json` | Offres enrichies et métadonnées, produites par le script, lues par le site |
| `docs/data/regions.geojson`, `docs/data/departements.geojson` | Contours ([france-geojson](https://github.com/gregoiredavid/france-geojson), IGN / Insee) |
| `docs/index.html` | Page et styles |
| `docs/src/app.js`, `docs/src/state.js` | Démarrage, état partagé (filtres, zone sélectionnée) |
| `docs/src/utils/statsEngine.js` | Moteur statistique (descriptif, lois normale / Student / Fisher / khi² / étendue studentisée, tests) |
| `docs/src/components/` | Barre de filtres, indicateurs, carte, panneau d'offres, graphiques, méthodologie |
| `docs/src/lab/` | Les 5 modules du laboratoire |
| `.github/workflows/mise-a-jour-donnees.yml` | Action quotidienne qui relance l'extraction et enregistre les nouvelles données |

Le site n'a pas d'étape de compilation : GitHub Pages sert directement le dossier `docs/` (modules JavaScript, d3 et KaTeX depuis cdnjs).

## Données

- **Offres** : [La bonne alternance](https://labonnealternance.apprentissage.beta.gouv.fr), route d'export de l'[API apprentissage](https://api.apprentissage.beta.gouv.fr), mise à jour chaque nuit. Seules les offres publiées sont gardées (pas les « recruteurs » à démarcher) ; les intitulés hors sujet sont écartés (règle `HORS_SUJET` du script). **Aucune offre n'est simulée.**
- **Salaire** : montant annoncé dans l'offre quand il existe, sinon minimum légal de l'alternance (SMIC au 1er janvier 2026 : 1 823,03 €, grille 21-25 ans selon le niveau visé et le type de contrat). Presque tous les salaires sont donc des estimations, ce que le site signale à chaque test.
- **Reste à vivre** : salaire moins le loyer d'un studio de 25 m² d'après la « Carte des loyers » 2025 du ministère du Logement (data.gouv.fr).
- **Télétravail, taille, convention collective, niveau, durée, coordonnées** : champs de l'offre ; un champ absent reste « non précisé ».
- **Indice d'attractivité /100** : prestige /30, rémunération /30, missions /20, cadre de vie /20 (formules dans la section Méthodologie du site et dans `notes()`).

### Filières, thèmes et codes ROME

| Filière | Thème | Codes ROME |
| --- | --- | --- |
| Ingénierie | Supply Chain & Logistique | H1401 |
| Ingénierie | Production, Méthodes & Lean | H1402, H1404, I1302 |
| Ingénierie | R&D, Études & Matériaux | H1206 |
| Ingénierie | Qualité & HSE | H1502, H1302, H1528, H1524, F1204 |
| Ingénierie | Data, IT & Cyber | M1805, M1810 |
| Ingénierie | Ingénierie BTP | F1117 |
| Commerce & Marketing | Développement commercial B2B | D1402, D1407, D1416, D1113, M1707 |
| Commerce & Marketing | Relation client & ADV | D1401, D1403, D1409, D1410, D1408 |
| Commerce & Marketing | Marketing & Produit | M1705, M1711, M1718, M1620 |
| Commerce & Marketing | Achats | D1431, M1101 |
| Commerce & Marketing | Management de la distribution | D1502, D1503, D1509, D1302 |
| Management & Gestion | Ressources humaines | M1501, M1502, M1507, M1510 |
| Management & Gestion | Finance, comptabilité & contrôle | M1203, M1204, M1202, M1213, M1406 |
| Management & Gestion | Direction & gestion d'entreprise | M1604, M1302, M1621 |
| Management & Gestion | Juridique & RSE | M1612, M1413 |

La liste se modifie dans `THEMES`, en tête du script. La vente en magasin, les métiers de bouche, la coiffure, la caisse et les diplômes de niveau CAP / BP sont écartés par la règle `HORS_SUJET`, même quand ils portent l'un de ces codes.

## Clé d'accès

1. Créer un compte sur [api.apprentissage.beta.gouv.fr](https://api.apprentissage.beta.gouv.fr) et générer une clé **production** (lecture seule, valable un an).
2. Dans le dépôt GitHub : *Settings → Secrets and variables → Actions*, ajouter le secret `LBA_API_KEY`.
3. Lancer l'Action « Mise à jour des offres » depuis l'onglet *Actions* (le bouton « Actualiser via l'API » du site y mène).

La clé n'est jamais écrite dans le code. Penser à la renouveler avant son expiration.

## Lancer l'extraction à la main

```bash
LBA_API_KEY=... python scripts/fetch_and_enrich.py
```

Python 3 standard, sans dépendance.

## Publication

*Settings → Pages* : source « Deploy from a branch », branche `main`, dossier `/docs`.
