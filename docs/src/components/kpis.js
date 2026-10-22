// Bandeau des 5 indicateurs clés, recalculés sur les offres filtrées

import { state, offresFiltrees, salaire, nomSalaire, nomTheme, avecTeletravail } from "../state.js";
import { mean, median, sd } from "../utils/statsEngine.js";
import { num, eur, pct, signe } from "../utils/format.js";

export function rendreKpis() {
  const el = document.getElementById("kpis");
  const o = offresFiltrees(), n = o.length, total = state.offres.length;
  if (!n) {
    el.innerHTML = `<div class="card kpi" style="grid-column:1/-1"><div class="l">Aucune offre</div><div class="s">Aucune offre ne correspond aux filtres.</div></div>`;
    return;
  }
  const grands = o.filter(x => x.categorie !== "ETI / PME"), cac = o.filter(x => x.categorie === "CAC 40");
  const sal = o.map(salaire).filter(Number.isFinite);
  const m = mean(sal), me = median(sal);
  const annonces = o.filter(x => x.salaire_source === "annoncé").length;

  const parTheme = d3.rollups(o, v => ({ n: v.length, s: mean(v.map(x => x.score_attractivite)) }), x => x.theme)
    .filter(([, v]) => v.n >= 3).sort((a, b) => b[1].s - a[1].s);
  const precises = o.filter(x => x.teletravail !== "Non précisé");

  const cartes = [
    ["Offres actives", num(n), `<b>${pct(n / total)}</b> des ${num(total)} offres d'ingénierie suivies`],
    ["CAC 40 & grands groupes", pct(grands.length / n), `<b>${num(grands.length)}</b> offres, dont <b>${num(cac.length)}</b> du CAC 40`],
    [`${nomSalaire()} : moyenne / médiane`, `${eur(m)} / ${eur(me)}`,
      `écart <b>${signe(m - me, 0, " €")}</b> · σ = <b>${eur(sd(sal))}</b> · ${annonces ? `${num(annonces)} annoncé${annonces > 1 ? "s" : ""}, ` : ""}reste estimé`],
    ["Score d'attractivité moyen", `${num(mean(o.map(x => x.score_attractivite)), 1)} /100`,
      parTheme.length ? `meilleur thème : <b>${nomTheme(parTheme[0][0])}</b> (${num(parTheme[0][1].s, 1)})` : "trop peu d'offres par thème"],
    ["Accès au télétravail", precises.length ? pct(precises.filter(avecTeletravail).length / precises.length) : "–",
      `parmi les <b>${num(precises.length)}</b> offres qui précisent le mode de travail (${pct(precises.length / n, 0)})`],
  ];
  el.innerHTML = cartes.map(([l, v, s]) => `<div class="card kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join("");
}
