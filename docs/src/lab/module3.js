// Module 3 — Comparer plus de deux moyennes : ANOVA à un facteur + test post-hoc de Tukey-Kramer

import { VARIABLES, nomTheme, nomRegion, CATEGORIES } from "../state.js";
import { anova, tukeyKramer, describe } from "../utils/statsEngine.js";
import { num, pval, intensite, signe, esc } from "../utils/format.js";
import { boites } from "../components/charts.js";
import { select, brancher, question, hypotheses, verdict, cours, alerte, noteSalaire, noteScore, tex } from "./commun.js";

const FACTEURS = {
  theme: { nom: "Thème d'ingénierie", cle: o => o.theme, libelle: nomTheme },
  categorie: { nom: "Catégorie d'entreprise", cle: o => o.categorie, libelle: c => c, ordre: CATEGORIES },
  region: { nom: "Région", cle: o => o.region, libelle: nomRegion },
};
const N_MIN = 3;
const reglages = { facteur: "theme", variable: "score" };

export const titre = "3 · ANOVA + Tukey";

export function rendre(el, offres) {
  const F = FACTEURS[reglages.facteur], V = VARIABLES[reglages.variable];
  const ok = offres.filter(o => Number.isFinite(V.get(o)));
  const u = V.unite === "€" ? " €" : " pt";
  const tous = d3.groups(ok, F.cle).map(([k, v]) => ({ nom: F.libelle(k), valeurs: v.map(V.get) }));
  const groupes = tous.filter(g => g.valeurs.length >= N_MIN)
    .sort((a, b) => (F.ordre ? F.ordre.indexOf(a.nom) - F.ordre.indexOf(b.nom) : b.valeurs.length - a.valeurs.length));
  const exclus = tous.filter(g => g.valeurs.length < N_MIN);

  let html = `${question(`Le « ${V.nom.toLowerCase()} » moyen varie-t-il selon : ${F.nom.toLowerCase()} ? Et quelles modalités diffèrent ?`)}
    <div class="controls">
      <label>Facteur ${select("facteur", Object.entries(FACTEURS).map(([k, f]) => [k, f.nom]), reglages.facteur)}</label>
      <label>Variable ${select("variable", Object.entries(VARIABLES).map(([k, v]) => [k, v.nom]), reglages.variable)}</label>
    </div>
    ${hypotheses(`$\\mu_1 = \\mu_2 = \\dots = \\mu_k$ : toutes les modalités ont la même moyenne.`,
      `Au moins une moyenne diffère des autres.`)}`;

  const res = groupes.length >= 2 ? anova(groupes) : null;
  if (!res) {
    el.innerHTML = html + alerte(`Il faut au moins 2 groupes d'au moins ${N_MIN} offres (actuellement ${groupes.length}). Élargissez les filtres.`);
    brancher(el, reglages, () => rendre(el, offres));
    return;
  }
  const paires = tukeyKramer(res);
  const signif = paires.filter(p => p.p < 0.05);
  const effet = intensite(res.eta2, [0.01, 0.06, 0.14], ["négligeable", "petit", "moyen", "grand"]);
  const sds = res.groupes.map(g => g.sd).filter(s => s > 0);
  const ratio = sds.length ? Math.max(...sds) / Math.min(...sds) : 1;
  const ligne = p => `<tr><td>${esc(p.a)} vs ${esc(p.b)}</td><td>${signe(p.diff, V.d + 1, u)}</td><td>${num(p.q, 2)}</td><td>${pval(p.p)}</td><td>${p.p < 0.05 ? "✔︎" : ""}</td></tr>`;

  html += `<div class="lab-grid"><div>
      <div class="chart" id="m3-chart"></div><div id="m3-legende"></div>
      ${exclus.length ? `<p class="small muted">Modalités écartées (moins de ${N_MIN} offres) : ${exclus.map(g => `${esc(g.nom)} (${g.valeurs.length})`).join(", ")}.</p>` : ""}
    </div><div>
      <h3>Tableau d'analyse de la variance</h3>
      <table class="res"><thead><tr><th>Source</th><th>SC</th><th>ddl</th><th>CM</th><th>F</th><th>p</th></tr></thead><tbody>
        <tr><td>Inter-groupes (SCE)</td><td>${num(res.sce, 0)}</td><td>${res.ddl1}</td><td>${num(res.cm1, 1)}</td><td><b>${num(res.F, 3)}</b></td><td><b>${pval(res.p)}</b></td></tr>
        <tr><td>Intra-groupes (SCR)</td><td>${num(res.scr, 0)}</td><td>${res.ddl2}</td><td>${num(res.cm2, 1)}</td><td></td><td></td></tr>
        <tr><td>Total (SCT)</td><td>${num(res.sct, 0)}</td><td>${res.ddlT}</td><td></td><td></td><td></td></tr>
      </tbody></table>
      <p class="small">Rapport de corrélation $\\eta^2 = \\frac{SCE}{SCT} = ${tex(res.eta2, 3)}$ : le facteur explique <b>${num(res.eta2 * 100, 1)} %</b> de la variance (effet ${effet}).</p>
      ${verdict(res.p,
        `Les ${res.k} modalités n'ont pas toutes la même moyenne. Le test de Tukey-Kramer ci-dessous identifie les paires qui diffèrent.`,
        `Les écarts entre modalités ne sont pas significatifs : les comparaisons deux à deux ne doivent pas être sur-interprétées.`)}
      <h3>Post-hoc de Tukey-Kramer — paires les plus contrastées</h3>
      <table class="res"><thead><tr><th>Paire</th><th>Écart</th><th>q</th><th>p ajustée</th><th>&lt; 5 %</th></tr></thead>
        <tbody>${paires.slice(0, 3).map(ligne).join("")}</tbody></table>
      <p class="small">${res.p < 0.05 ? (signif.length ? `${signif.length} paire${signif.length > 1 ? "s" : ""} sur ${paires.length} diffère${signif.length > 1 ? "nt" : ""} significativement.` : "Aucune paire ne diffère significativement après ajustement, malgré l'ANOVA significative (cas possible quand l'effet est diffus).") : "ANOVA non significative : ces écarts sont donnés à titre indicatif."}</p>
      ${paires.length > 3 ? `<details><summary class="small">Matrice complète (${paires.length} paires)</summary>
        <table class="res"><tbody>${paires.map(ligne).join("")}</tbody></table></details>` : ""}
      ${ratio > 2 ? alerte(`Le plus grand écart-type est ${num(ratio, 1)} fois le plus petit : l'hypothèse d'homogénéité des variances (homoscédasticité) est fragile, interprétez la $p$-value avec prudence.`) : ""}
      ${reglages.variable === "score" ? noteScore() : noteSalaire(ok, reglages.variable)}
    </div></div>
    ${cours("Pourquoi une ANOVA, et pourquoi Tukey ensuite ?", `
      <p>Comparer $k$ groupes par des tests t deux à deux multiplie les risques d'erreur : avec $m = ${paires.length}$ paires, la probabilité
      d'au moins un faux positif atteint $1 - 0{,}95^{${paires.length}} \\approx ${tex((1 - 0.95 ** paires.length) * 100, 0)}\\,\\%$. L'ANOVA teste
      <b>en une seule fois</b> l'égalité des $k$ moyennes en décomposant la variabilité :
      $$SCT = SCE + SCR, \\qquad F = \\frac{SCE/(k-1)}{SCR/(N-k)} = \\frac{CM_{inter}}{CM_{intra}}$$
      Sous $H_0$, $F$ suit une loi de Fisher à $(k-1,\\ N-k)$ degrés de liberté. Conditions : indépendance, normalité dans chaque groupe,
      variances homogènes.</p>
      <p>Une ANOVA significative dit seulement qu'<b>au moins un</b> groupe diffère. Le test de <b>Tukey-Kramer</b> compare ensuite toutes les
      paires en contrôlant le risque global à 5 %, avec la loi de l'étendue studentisée :
      $q = \\frac{|\\bar{X}_i - \\bar{X}_j|}{\\sqrt{\\frac{CM_{intra}}{2}\\left(\\frac{1}{n_i}+\\frac{1}{n_j}\\right)}}$ (version adaptée aux effectifs inégaux).</p>`)}`;
  el.innerHTML = html;
  el.querySelector("#m3-legende").innerHTML = boites(el.querySelector("#m3-chart"),
    groupes.map(g => ({ ...g, stats: describe(g.valeurs) })), { titreY: `${V.nom} (${V.unite})` });
  brancher(el, reglages, () => rendre(el, offres));
}
