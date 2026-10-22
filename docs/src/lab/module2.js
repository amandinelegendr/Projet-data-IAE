// Module 2 — Comparer deux moyennes : test t de Welch

import { VARIABLES, avecTeletravail } from "../state.js";
import { welchTest } from "../utils/statsEngine.js";
import { num, pval, intensite, signe } from "../utils/format.js";
import { moyennesIC } from "../components/charts.js";
import { select, brancher, question, hypotheses, verdict, cours, alerte, noteSalaire, noteScore, tex } from "./commun.js";

const DUELS = {
  A: { nom: "CAC 40 vs ETI / PME", g1: ["CAC 40", o => o.categorie === "CAC 40"], g2: ["ETI / PME", o => o.categorie === "ETI / PME"] },
  B: { nom: "Grands groupes (CAC 40 + autres) vs ETI / PME", g1: ["Grands groupes", o => o.categorie !== "ETI / PME"], g2: ["ETI / PME", o => o.categorie === "ETI / PME"] },
  C: { nom: "Avec télétravail vs 100 % présentiel", g1: ["Avec télétravail", avecTeletravail], g2: ["Présentiel", o => o.teletravail === "Présentiel"] },
  D: { nom: "Ingénierie vs Commerce & Marketing", g1: ["Ingénierie", o => o.filiere === "ingenierie"], g2: ["Commerce & Marketing", o => o.filiere === "commerce"] },
  E: { nom: "Ingénierie vs Management & Gestion", g1: ["Ingénierie", o => o.filiere === "ingenierie"], g2: ["Management & Gestion", o => o.filiere === "management"] },
};
const reglages = { duel: "B", variable: "salaire" };

export const titre = "2 · Comparer 2 moyennes";

export function rendre(el, offres) {
  const D = DUELS[reglages.duel], V = VARIABLES[reglages.variable];
  const val = o => V.get(o);
  const ok = offres.filter(o => Number.isFinite(val(o)));
  const a = ok.filter(D.g1[1]).map(val), b = ok.filter(D.g2[1]).map(val);
  const u = V.unite === "€" ? " €" : " pt";

  let html = `${question(`Le « ${V.nom.toLowerCase()} » moyen diffère-t-il entre ${D.g1[0]} et ${D.g2[0]} ?`)}
    <div class="controls">
      <label>Duel ${select("duel", Object.entries(DUELS).map(([k, d]) => [k, `${k} · ${d.nom}`]), reglages.duel)}</label>
      <label>Variable ${select("variable", Object.entries(VARIABLES).map(([k, v]) => [k, v.nom]), reglages.variable)}</label>
    </div>
    ${hypotheses(`$\\mu_1 = \\mu_2$ : en moyenne, ${D.g1[0]} et ${D.g2[0]} ont le même ${V.court.toLowerCase()}.`,
      `$\\mu_1 \\neq \\mu_2$ : les moyennes diffèrent (test bilatéral).`)}`;

  const t = welchTest(a, b);
  if (!t) {
    el.innerHTML = html + alerte(`Il faut au moins 2 offres dans chaque groupe (actuellement ${a.length} et ${b.length}). Élargissez les filtres ou changez de duel.`);
    brancher(el, reglages, () => rendre(el, offres));
    return;
  }
  const effet = intensite(t.d, [0.2, 0.5, 0.8], ["négligeable", "petit", "moyen", "grand"]);
  html += `<div class="lab-grid"><div>
      <div class="chart" id="m2-chart"></div>
      <p class="small muted">Points : moyennes $\\bar{X}$ ; barres : intervalle de confiance à 95 % $\\bar{X} \\pm 1{,}96\\,\\frac{s}{\\sqrt{n}}$.</p>
    </div><div>
      <table class="res"><thead><tr><th></th><th>${D.g1[0]}</th><th>${D.g2[0]}</th></tr></thead><tbody>
        <tr><td>Effectif $n$</td><td>${t.n1}</td><td>${t.n2}</td></tr>
        <tr><td>Moyenne $\\bar{X}$</td><td>${num(t.m1, V.d + 1)}</td><td>${num(t.m2, V.d + 1)}</td></tr>
        <tr><td>Écart-type $s$</td><td>${num(t.s1, 1)}</td><td>${num(t.s2, 1)}</td></tr>
        <tr><td>IC 95 %</td><td>[${num(t.ci1[0], V.d)} ; ${num(t.ci1[1], V.d)}]</td><td>[${num(t.ci2[0], V.d)} ; ${num(t.ci2[1], V.d)}]</td></tr>
      </tbody></table>
      <table class="res" style="margin-top:10px"><tbody>
        <tr><td>Écart $\\bar{X}_1 - \\bar{X}_2$</td><td><b>${signe(t.diff, V.d + 1, u)}</b></td></tr>
        <tr><td>Statistique $t$ de Welch</td><td>${num(t.t, 3)}</td></tr>
        <tr><td>Degrés de liberté (Welch-Satterthwaite)</td><td>${num(t.df, 1)}</td></tr>
        <tr><td>$p$-value bilatérale</td><td><b>${pval(t.p)}</b></td></tr>
        <tr><td>Taille d'effet : $d$ de Cohen</td><td>${num(t.d, 2)} (${effet})</td></tr>
      </tbody></table>
      ${verdict(t.p,
        `L'écart de ${signe(t.diff, V.d + 1, u)} entre ${D.g1[0]} et ${D.g2[0]} est statistiquement significatif : il est peu probable qu'il soit dû au hasard de l'échantillonnage. L'effet est ${effet} ($d = ${tex(t.d, 2)}$).`,
        `L'écart observé (${signe(t.diff, V.d + 1, u)}) peut s'expliquer par les fluctuations d'échantillonnage : on ne peut pas conclure à une différence entre ${D.g1[0]} et ${D.g2[0]}.`)}
      ${Math.min(t.n1, t.n2) < 30 ? alerte(`Un groupe compte moins de 30 offres (n = ${Math.min(t.n1, t.n2)}) : le test t suppose alors une distribution à peu près normale dans chaque groupe. Interprétez avec prudence.`) : ""}
      ${reglages.variable === "score" ? noteScore() : noteSalaire(ok.filter(o => D.g1[1](o) || D.g2[1](o)), reglages.variable)}
    </div></div>
    ${cours("Pourquoi le test t de Welch ?", `
      <p>On compare la moyenne d'une variable <b>quantitative</b> entre <b>deux groupes indépendants</b>. Le test t de Student classique
      suppose des variances égales ; ici les groupes ont des tailles et des dispersions très différentes (${t.n1} vs ${t.n2} offres,
      $s_1 = ${tex(t.s1, 1)}$ vs $s_2 = ${tex(t.s2, 1)}$). Le test de <b>Welch</b> ne fait pas cette hypothèse :
      $$t = \\frac{\\bar{X}_1 - \\bar{X}_2}{\\sqrt{\\frac{s_1^2}{n_1} + \\frac{s_2^2}{n_2}}}, \\qquad
      \\nu = \\frac{\\left(\\frac{s_1^2}{n_1}+\\frac{s_2^2}{n_2}\\right)^2}{\\frac{(s_1^2/n_1)^2}{n_1-1}+\\frac{(s_2^2/n_2)^2}{n_2-1}}$$</p>
      <p>Sous $H_0$, $t$ suit une loi de Student à $\\nu$ degrés de liberté, d'où la $p$-value. La $p$-value dit si l'écart est
      <b>significatif</b> ; le <b>$d$ de Cohen</b> $d = \\frac{\\bar{X}_1-\\bar{X}_2}{s_{p}}$ dit s'il est <b>important</b>
      (0,2 petit, 0,5 moyen, 0,8 grand).</p>`)}`;
  el.innerHTML = html;
  moyennesIC(el.querySelector("#m2-chart"), [
    { nom: D.g1[0], m: t.m1, ci: t.ci1, n: t.n1, d: V.d }, { nom: D.g2[0], m: t.m2, ci: t.ci2, n: t.n2, d: V.d },
  ], { titreY: `${V.nom} (${V.unite})` });
  brancher(el, reglages, () => rendre(el, offres));
}
