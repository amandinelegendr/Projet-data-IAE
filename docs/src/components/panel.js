// Panneau de droite : résumé statistique de la zone sélectionnée (écart à la moyenne nationale) et offres classées

import { state, maj, offresFiltrees, offresZone, salaire, nomSalaire, nomTheme, avecTeletravail } from "../state.js";
import { mean, median } from "../utils/statsEngine.js";
import { num, eur, pct, esc, signe } from "../utils/format.js";

const TRIS = {
  score: { nom: "Score d'attractivité", f: o => o.score_attractivite },
  salaire: { nom: "Salaire", f: o => salaire(o) ?? -Infinity },
  prestige: { nom: "Prestige", f: o => o.score_detail.prestige },
  date: { nom: "Date de publication", f: o => o.date },
};
const PAS = 40;
let affichees = PAS, derniereCle = "";

const PARTS = [
  ["prestige", "Prestige", 30, "--p-prestige"], ["remuneration", "Rémunération", 30, "--p-remu"],
  ["missions", "Missions", 20, "--p-mission"], ["cadre_vie", "Cadre de vie", 20, "--p-cadre"],
];

function delta(v, ref, d, unite, inverse = false) {
  if (!Number.isFinite(v) || !Number.isFinite(ref)) return "";
  const x = v - ref, cls = Math.abs(x) < 1e-9 ? "eq" : (x > 0) !== inverse ? "up" : "down";
  return `<span class="delta ${cls}">${signe(x, d, unite)} vs France</span>`;
}

function carte(o) {
  const badge = o.categorie === "CAC 40" ? `<span class="badge cac">★ CAC 40</span>`
    : o.categorie === "Grand Groupe" ? `<span class="badge gg">Grand groupe</span>` : `<span class="badge pme">ETI / PME</span>`;
  const tt = o.teletravail === "Non précisé" ? `<span class="badge neutre">Télétravail non précisé</span>`
    : `<span class="badge ${avecTeletravail(o) ? "tt" : "neutre"}">${esc(o.teletravail)}</span>`;
  const barre = PARTS.map(([k, nom, max, c]) => `<span style="width:${o.score_detail[k]}%;background:var(${c})" title="${nom} : ${num(o.score_detail[k], 1)} / ${max}"></span>`).join("");
  const titre = o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.titre)}</a>` : esc(o.titre);
  const s = salaire(o);
  return `<article class="offre">
    <div class="badges">${badge}<span class="badge neutre">${esc(nomTheme(o.theme))}</span>${tt}</div>
    <div class="t">${titre}</div>
    <div class="meta">${esc(o.entreprise || "Entreprise non communiquée")} · ${esc(o.ville)} (${esc(o.departement)})${o.niveau ? ` · niveau ${esc(o.niveau)}` : ""}${o.date ? ` · ${new Date(o.date).toLocaleDateString("fr-FR")}` : ""}</div>
    <div class="bas"><span>${nomSalaire()} : <b>${eur(s)}</b> <span class="muted">(${state.mode === "pa" ? `loyer ${eur(o.loyer_studio)} déduit` : o.salaire_source})</span></span>
      <span class="score">${num(o.score_attractivite, 1)}<span class="muted small"> /100</span></span></div>
    <div class="scorebar" aria-label="Décomposition du score">${barre}</div>
  </article>`;
}

export function rendrePanneau() {
  const el = document.getElementById("panneau");
  const tout = offresFiltrees(), zone = offresZone(), z = state.zone;
  const cle = JSON.stringify([z?.code, state.tri, tout.length]);
  if (cle !== derniereCle) { affichees = PAS; derniereCle = cle; }

  const indic = v => {
    const s = v.map(salaire).filter(Number.isFinite);
    const p = v.filter(o => o.teletravail !== "Non précisé");
    return {
      n: v.length, med: median(s), score: mean(v.map(o => o.score_attractivite)),
      grands: v.filter(o => o.categorie !== "ETI / PME").length / v.length,
      tt: p.length ? p.filter(avecTeletravail).length / p.length : NaN,
    };
  };
  const ref = tout.length ? indic(tout) : null, loc = zone.length ? indic(zone) : null;
  const titre = z ? esc(z.nom) : "France entière";

  let html = `<div class="zone-head"><h3>${titre}</h3>${z ? `<button class="btn link" data-reset>Toute la France</button>` : ""}</div>`;
  if (!loc) {
    html += `<p class="empty">Aucune offre dans cette zone avec les filtres actuels.</p>`;
  } else {
    html += `<div class="zone-stats">
      <div><div class="muted small">Offres</div><div class="v">${num(loc.n)}</div>${z ? `<span class="delta eq">${pct(loc.n / ref.n)} du total filtré</span>` : ""}</div>
      <div><div class="muted small">${nomSalaire()} médian</div><div class="v">${eur(loc.med)}</div>${z ? delta(loc.med, ref.med, 0, " €") : ""}</div>
      <div><div class="muted small">Score moyen</div><div class="v">${num(loc.score, 1)}</div>${z ? delta(loc.score, ref.score, 1, " pt") : ""}</div>
      <div><div class="muted small">CAC 40 + grands groupes</div><div class="v">${pct(loc.grands, 0)}</div>${z ? delta(loc.grands * 100, ref.grands * 100, 0, " pt") : ""}</div>
    </div>`;
    const liste = [...zone].sort((a, b) => d3.descending(TRIS[state.tri].f(a), TRIS[state.tri].f(b)));
    html += `<div class="list-tools"><span class="muted small">${num(liste.length)} offre${liste.length > 1 ? "s" : ""}, triées par</span>
      <select data-tri>${Object.entries(TRIS).map(([k, t]) => `<option value="${k}" ${k === state.tri ? "selected" : ""}>${t.nom}</option>`).join("")}</select></div>
      <div class="legend-inline">${PARTS.map(([, nom, max, c]) => `<span><i style="background:var(${c})"></i>${nom} /${max}</span>`).join("")}</div>
      <div class="offres">${liste.slice(0, affichees).map(carte).join("")}
      ${liste.length > affichees ? `<button class="btn" data-plus style="width:100%">Afficher ${Math.min(PAS, liste.length - affichees)} offres de plus</button>` : ""}</div>`;
  }
  el.innerHTML = html;
  el.querySelector("[data-reset]")?.addEventListener("click", () => maj({ zone: null }));
  el.querySelector("[data-tri]")?.addEventListener("change", e => maj({ tri: e.target.value }));
  el.querySelector("[data-plus]")?.addEventListener("click", () => { affichees += PAS; rendrePanneau(); });
}
