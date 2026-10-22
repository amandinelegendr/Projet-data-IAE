// Module 5 — Relation entre deux variables quantitatives : corrélation de Pearson et régression linéaire

import { CATEGORIES } from "../state.js";
import { pearson } from "../utils/statsEngine.js";
import { num, pval, intensite, esc } from "../utils/format.js";
import { nuage } from "../components/charts.js";
import { select, brancher, question, hypotheses, verdict, cours, alerte, noteSalaire, noteScore, tex } from "./commun.js";

const AXES_X = {
  prestige: { nom: "Score de prestige (/30)", get: o => o.score_detail.prestige },
  taille: { nom: "Taille de l'établissement (log₁₀ effectif)", get: o => (o.taille_min ? Math.log10(o.taille_min) : NaN) },
  loyer: { nom: "Coût du logement : loyer d'un studio (€)", get: o => o.loyer_studio },
  duree: { nom: "Durée du contrat (mois)", get: o => o.duree_mois },
};
const AXES_Y = {
  salaire: { nom: "Salaire brut mensuel (€)", get: o => o.salaire_brut_mensuel },
  score: { nom: "Indice d'attractivité (/100)", get: o => o.score_attractivite },
  pa: { nom: "Reste à vivre après loyer (€)", get: o => o.pouvoir_achat_ajuste },
};
const reglages = { x: "taille", y: "salaire" };

export const titre = "5 · Corrélation de Pearson";

export function rendre(el, offres) {
  const X = AXES_X[reglages.x], Y = AXES_Y[reglages.y];
  const pts = offres.map(o => ({ x: X.get(o), y: Y.get(o), cat: o.categorie, label: `${o.titre} — ${o.entreprise}` }))
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

  let html = `${question(`Existe-t-il une relation linéaire entre « ${X.nom} » et « ${Y.nom} » ?`)}
    <div class="controls">
      <label>Axe X ${select("x", Object.entries(AXES_X).map(([k, a]) => [k, a.nom]), reglages.x)}</label>
      <label>Axe Y ${select("y", Object.entries(AXES_Y).map(([k, a]) => [k, a.nom]), reglages.y)}</label>
    </div>
    ${hypotheses(`$\\rho = 0$ : pas de corrélation linéaire dans la population.`, `$\\rho \\neq 0$ : il existe une corrélation linéaire.`)}`;

  const r = pearson(pts.map(p => p.x), pts.map(p => p.y));
  if (!r) {
    el.innerHTML = html + alerte("Il faut au moins 3 offres renseignées sur les deux variables. Élargissez les filtres.");
    brancher(el, reglages, () => rendre(el, offres));
    return;
  }
  const force = intensite(r.r, [0.1, 0.3, 0.5]);
  const sens = r.r > 0 ? "positive" : "négative";
  const mecanique = (reglages.x === "prestige" && reglages.y === "score") || (reglages.x === "loyer" && reglages.y === "pa");

  html += `<div class="lab-grid"><div>
      <div class="chart" id="m5-chart"></div><div id="m5-legende"></div>
    </div><div>
      <table class="res"><tbody>
        <tr><td>Effectif $n$</td><td>${r.n}</td></tr>
        <tr><td>Coefficient $r$ de Pearson</td><td><b>${num(r.r, 3)}</b></td></tr>
        <tr><td>Coefficient de détermination $R^2$</td><td>${num(r.r2, 3)}</td></tr>
        <tr><td>Droite des moindres carrés</td><td>$y = ${tex(r.a, Math.abs(r.a) < 1 ? 3 : 1)}\\,x ${r.b < 0 ? "-" : "+"} ${tex(Math.abs(r.b), 1)}$</td></tr>
        <tr><td>Statistique $t = r\\sqrt{\\frac{n-2}{1-r^2}}$</td><td>${num(r.t, 3)} (${r.df} ddl)</td></tr>
        <tr><td>$p$-value</td><td><b>${pval(r.p)}</b></td></tr>
      </tbody></table>
      ${verdict(r.p,
        `La corrélation est ${sens} et ${force} : $X$ explique ${num(r.r2 * 100, 1)} % de la variance de $Y$. Quand $X$ augmente d'une unité, $Y$ varie en moyenne de ${num(r.a, 2)}.`,
        `Aucune relation linéaire significative : $X$ n'explique que ${num(r.r2 * 100, 1)} % de la variance de $Y$.`)}
      ${mecanique ? alerte(`⚠️ La variable Y est calculée à partir de X (${reglages.y === "score" ? "le prestige est une composante de l'indice" : "le reste à vivre = salaire − loyer"}) : la corrélation est en partie <b>mécanique</b>.`) : ""}
      ${reglages.y === "score" ? noteScore() : noteSalaire(offres.filter(o => Number.isFinite(X.get(o))), reglages.y)}
    </div></div>
    ${cours("Pourquoi la corrélation de Pearson ?", `
      <p>On étudie deux variables <b>quantitatives</b> mesurées sur les mêmes offres. Le coefficient
      $$r = \\frac{\\sum (x_i-\\bar{x})(y_i-\\bar{y})}{\\sqrt{\\sum (x_i-\\bar{x})^2 \\sum (y_i-\\bar{y})^2}} \\in [-1, 1]$$
      mesure l'intensité de la liaison <b>linéaire</b>. La droite des moindres carrés $y = ax + b$ a pour pente $a = \\frac{\\text{cov}(x,y)}{s_x^2}$
      et passe par le point moyen $(\\bar{x}, \\bar{y})$ ; $R^2 = r^2$ est la part de variance de $Y$ expliquée par $X$.</p>
      <p>Sous $H_0 : \\rho = 0$, $t = r\\sqrt{\\frac{n-2}{1-r^2}}$ suit une loi de Student à $n-2$ ddl. Attention : <b>corrélation n'est pas causalité</b>,
      et $r$ ne détecte pas les relations non linéaires ni ne résiste aux valeurs atypiques — d'où l'intérêt de regarder le nuage.</p>`)}`;
  el.innerHTML = html;
  el.querySelector("#m5-legende").innerHTML = nuage(el.querySelector("#m5-chart"), pts, r,
    { titreX: X.nom, titreY: Y.nom, categories: CATEGORIES.filter(c => pts.some(p => p.cat === c)) });
  brancher(el, reglages, () => rendre(el, offres));
}
