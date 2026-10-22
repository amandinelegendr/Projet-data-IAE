// Laboratoire statistique : sélecteur d'onglets et rendu du module actif sur les offres filtrées

import { offresFiltrees } from "../state.js";
import { maths } from "../utils/format.js";
import * as m1 from "./module1.js";
import * as m2 from "./module2.js";
import * as m3 from "./module3.js";
import * as m4 from "./module4.js";
import * as m5 from "./module5.js";

const MODULES = [m1, m2, m3, m4, m5];
let actif = 0, observateur = null;

export function rendreLabo() {
  const onglets = document.getElementById("onglets");
  onglets.innerHTML = MODULES.map((m, i) => `<button role="tab" aria-selected="${i === actif}" data-i="${i}">${m.titre}</button>`).join("");
  onglets.querySelectorAll("button").forEach(b => b.onclick = () => { actif = +b.dataset.i; rendreLabo(); });

  const el = document.getElementById("module");
  // Un module redessine son contenu quand on change un de ses menus : les formules sont rendues après chaque remplacement
  if (!observateur) {
    observateur = new MutationObserver(() => maths(el));
    observateur.observe(el, { childList: true });
  }
  MODULES[actif].rendre(el, offresFiltrees());
}
