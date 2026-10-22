// Section « Méthodologie et limites » : sources, définitions des champs calculés, formule de l'indice

import { state } from "../state.js";
import { num, eur, pct, esc } from "../utils/format.js";

export function rendreMethodo() {
  const m = state.meta, o = state.offres;
  const annonces = o.filter(x => x.salaire_source === "annoncé").length;
  const tt = o.filter(x => x.teletravail !== "Non précisé").length;
  const bassin = o.filter(x => x.bassin).length;
  document.getElementById("methodologie").innerHTML = `
    <div><h3>Source des offres</h3>
      <p>${esc(m.source)}, export quotidien de l'API publique <a href="https://api.apprentissage.beta.gouv.fr">api.apprentissage.beta.gouv.fr</a>
      du ${new Date(m.date_export).toLocaleDateString("fr-FR")}. Sur ${num(m.nb_offres_export)} offres publiées en France, <b>${num(o.length)}</b>
      relèvent des métiers d'ingénierie suivis. Les « recruteurs » de l'export (entreprises à démarcher sans offre publiée) sont écartés,
      ainsi que les intitulés manifestement hors ingénierie (opérateur de fabrication, préparateur, vendeur…). <b>Aucune offre n'est simulée.</b></p></div>
    <div><h3>Thèmes et codes ROME</h3><ul>${m.themes.map(t => `<li><b>${esc(t.nom)}</b> : ${t.romes.join(", ")}</li>`).join("")}</ul></div>
    <div><h3>Localisation</h3>
      <p>Département d'après le code postal de l'adresse (sinon les coordonnées GPS), région d'après le code officiel géographique.
      Bassin d'emploi : offre située à moins de ${m.rayon_bassin_km} km d'un des centres des ${m.bassins.length} bassins industriels retenus
      (${pct(bassin / o.length, 0)} des offres).</p></div>
    <div><h3>Catégorie d'entreprise</h3>
      <p>Reconnaissance du nom de l'établissement dans une liste du CAC 40 et une liste de grands groupes industriels et d'ingénierie
      (SBF 120 et équivalents) ; à défaut, un établissement d'au moins ${num(m.seuil_grand_groupe)} salariés est classé « Grand Groupe ».
      Le reste est classé « ETI / PME ».</p></div>
    <div><h3>Salaire</h3>
      <p>Seules <b>${num(annonces)}</b> offres annoncent un montant (repéré dans le texte de l'offre). Pour les autres, le salaire est le
      <b>minimum légal</b> : ${esc(m.profil_salaire)} SMIC de référence : ${eur(m.smic, 2)} brut mensuel (1ᵉʳ janvier 2026).
      Les conventions collectives peuvent prévoir davantage ; elles sont affichées (code IDCC) mais pas chiffrées, faute de grille fiable.</p></div>
    <div><h3>Pouvoir d'achat (reste à vivre)</h3>
      <p>Salaire brut moins le loyer d'un studio de ${m.loyer_surface_m2} m² dans la commune de l'offre (à défaut, moyenne du département) :
      ${esc(m.source_loyers)}. C'est un indicateur de coût du logement, pas un indice complet du coût de la vie.</p></div>
    <div><h3>Télétravail</h3>
      <p>Champ « mode de travail » de l'offre (présentiel, hybride, télétravail complet). Il n'est renseigné que pour
      <b>${pct(tt / o.length, 0)}</b> des offres : les autres sont « non précisé », jamais devinées.</p></div>
    <div><h3>Indice d'attractivité (/100)</h3>
      <p>Indicateur composite construit par l'Observatoire, dont les pondérations sont un choix :</p>
      <ul>
        <li><b>Prestige /30</b> : CAC 40 de 24 à 30, grand groupe de 18 à 25, ETI / PME de 8 à 18, selon l'effectif (échelle logarithmique).</li>
        <li><b>Rémunération /30</b> : linéaire entre 900 € (0) et 2 100 € (30).</li>
        <li><b>Missions /20</b> : 4 points de base + mots-clés repérés dans l'offre (gestion de projet, international, SAP, Power BI, Python, Lean, CAO, automatisme…).</li>
        <li><b>Cadre de vie /20</b> : télétravail (complet 10, hybride 7, non précisé 4, présentiel 2) + reste à vivre entre 400 € (0) et 1 400 € (10).</li>
      </ul></div>
    <div><h3>Limites</h3>
      <ul><li>Les offres d'alternance en ligne ne représentent qu'une partie des recrutements (candidatures spontanées, écoles, réseaux).</li>
      <li>Les codes ROME sont saisis par les recruteurs et peuvent être imprécis.</li>
      <li>Les tests portent sur les offres disponibles un jour donné, pas sur un échantillon aléatoire : ils décrivent ce corpus et se généralisent avec prudence.</li></ul></div>`;
  document.getElementById("pied").innerHTML = `Données : ${esc(m.source)}, export du ${new Date(m.date_export).toLocaleDateString("fr-FR")} ·
    Loyers : ministère du Logement · Contours : <a href="https://github.com/gregoiredavid/france-geojson">france-geojson</a> (IGN / Insee) ·
    Code : <a href="https://github.com/amandinelegendr/Projet-data-IAE">github.com/amandinelegendr/Projet-data-IAE</a>`;
  document.getElementById("sous-titre").textContent =
    `${num(o.length)} offres réelles · La bonne alternance · mise à jour du ${new Date(m.date_export).toLocaleDateString("fr-FR")}`;
}
