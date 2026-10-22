// Éléments communs aux modules du laboratoire : hypothèses, verdict au seuil α, rappel de cours, avertissements

import { esc, pval, pct, num } from "../utils/format.js";

export const ALPHA = 0.05;

/** Nombre au format français dans une formule KaTeX (la virgule décimale doit être protégée). */
export const tex = (x, d) => (d === undefined ? pval(x) : num(x, d)).replace(",", "{,}").replace(/\s/g, "\\,");

export const select = (nom, options, valeur) =>
  `<select data-ctl="${nom}">${options.map(([v, l]) => `<option value="${esc(v)}" ${v === valeur ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;

/** Branche les menus déroulants d'un module : chaque changement met à jour le réglage et redessine. */
export function brancher(el, reglages, redessiner) {
  el.querySelectorAll("[data-ctl]").forEach(s => {
    s.onchange = () => {
      reglages[s.dataset.ctl] = s.type === "checkbox" ? s.checked : s.value;
      redessiner();
    };
  });
}

export const question = q => `<div class="question">${q}</div>`;

export const hypotheses = (h0, h1) => `<div class="hyp"><b>$H_0$</b><span>${h0}</span><b>$H_1$</b><span>${h1}</span></div>`;

/** Conclusion rédigée au seuil α = 5 %. */
export function verdict(p, siRejet, siNonRejet) {
  if (!Number.isFinite(p)) return `<div class="verdict limite">Test impossible avec les offres actuellement filtrées.</div>`;
  const rejet = p < ALPHA;
  return `<div class="verdict ${rejet ? "rejet" : "garde"}"><b>${rejet ? `On rejette $H_0$` : `On ne rejette pas $H_0$`}</b>
    ($p ${p < 0.001 ? "< 0{,}001" : `= ${tex(p)}`}$ ${rejet ? "<" : "≥"} $\\alpha = 0{,}05$). ${rejet ? siRejet : siNonRejet}</div>`;
}

export const cours = (titre, html) => `<div class="cours"><h4>📘 Rappel du cours — ${titre}</h4>${html}</div>`;

export const alerte = html => `<div class="verdict limite">${html}</div>`;

/** Avertissement quand la variable étudiée est le salaire, en grande partie estimé par la grille légale. */
export function noteSalaire(offres, cle) {
  if (cle !== "salaire" && cle !== "pa") return "";
  const estimes = offres.filter(o => o.salaire_source !== "annoncé").length;
  if (!estimes) return "";
  return alerte(`⚠️ ${pct(estimes / offres.length, 0)} des salaires sont <b>estimés</b> par la grille légale de l'alternance
    (niveau de diplôme visé et type de contrat), car l'offre n'annonce pas de montant. Une différence de salaire entre groupes
    traduit donc surtout des différences de <b>niveau visé</b> ou de <b>contrat</b>, pas des politiques salariales d'entreprise.`);
}

/** Avertissement quand une variable est une composante d'une autre (corrélation mécanique). */
export const noteScore = () => alerte(`⚠️ L'indice d'attractivité est un <b>indicateur composite</b> calculé par l'Observatoire
  (voir la méthodologie) : il dépend lui-même de la catégorie d'entreprise, du salaire et du télétravail. Un lien avec ces
  variables est donc en partie <b>construit</b>, pas observé.`);
