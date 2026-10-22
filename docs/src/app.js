// Point d'entrée : chargement des données, branchement des vues sur l'état partagé

import { state, maj, abonner } from "./state.js";
import { initControles } from "./components/controls.js";
import { rendreKpis } from "./components/kpis.js";
import { initCarte, rendreCarte, suivreZone } from "./components/map.js";
import { rendrePanneau } from "./components/panel.js";
import { rendreMethodo } from "./components/methodo.js";
import { rendreLabo } from "./lab/lab.js";
import { maths } from "./utils/format.js";

async function demarrer() {
  try {
    // no-cache : le navigateur revérifie le fichier, mis à jour chaque jour, au lieu de garder une copie ancienne
    const donnees = await d3.json("data/alternances_enrichies.json", { cache: "no-cache" });
    state.offres = donnees.offres;
    state.meta = donnees.meta;
  } catch (e) {
    const a = document.getElementById("alerte");
    a.hidden = false;
    a.textContent = "Les données n'ont pas pu être chargées. Réessayez dans quelques instants.";
    console.error(e);
    return;
  }
  await initCarte();
  const rendreControles = initControles();
  rendreMethodo();
  abonner(rendreControles);
  abonner(rendreKpis);
  abonner(rendreCarte);
  abonner(suivreZone);
  abonner(rendrePanneau);
  abonner(rendreLabo);
  maj();
  // KaTeX est chargé en différé : on rend les formules statiques une fois la bibliothèque prête
  const formules = () => maths(document.getElementById("labo"));
  if (document.readyState === "complete") formules(); else window.addEventListener("load", formules);
}

demarrer();
