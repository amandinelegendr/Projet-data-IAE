// Module 1 — Décrire : distribution, moyenne vs médiane, dispersion et loi normale

import { VARIABLES } from "../state.js";
import { describe, quantile } from "../utils/statsEngine.js";
import { num, pct } from "../utils/format.js";
import { histogramme } from "../components/charts.js";
import { select, brancher, question, cours, alerte, noteSalaire, noteScore } from "./commun.js";

const reglages = { variable: "salaire" };

export const titre = "1 · Décrire";

export function rendre(el, offres) {
  const V = VARIABLES[reglages.variable];
  const sel = offres.filter(o => Number.isFinite(V.get(o)));
  const xs = sel.map(V.get);
  const f = (x, d = V.d) => `${num(x, d)}${V.unite === "€" ? " €" : ""}`;

  let html = `${question(`Comment se distribue la variable « ${V.nom} » dans les offres filtrées ? Est-elle symétrique, proche d'une loi normale ?`)}
    <div class="controls"><label>Variable ${select("variable", Object.entries(VARIABLES).map(([k, v]) => [k, `${v.nom} (${v.unite})`]), reglages.variable)}</label></div>`;

  if (xs.length < 5) {
    el.innerHTML = html + alerte("Il faut au moins 5 offres pour décrire une distribution : élargissez les filtres.");
    brancher(el, reglages, () => rendre(el, offres));
    return;
  }
  const s = describe(xs);
  // Erreurs-types de l'asymétrie et de l'aplatissement : un coefficient au-delà de 2 erreurs-types est significatif
  const seKurt = 2 * s.seSkew * Math.sqrt((s.n * s.n - 1) / ((s.n - 3) * (s.n + 5)));
  const asymSig = Math.abs(s.skewness) > 2 * s.seSkew, aplatSig = Math.abs(s.kurtosis) > 2 * seKurt;
  const sens = s.skewness > 0 ? "vers la droite (queue étirée vers les valeurs hautes)" : "vers la gauche (queue étirée vers les valeurs basses)";

  // Qui occupe le haut de la distribution ?
  const d9 = quantile(xs, 0.9), haut = sel.filter(o => V.get(o) >= d9);
  const partGrands = arr => arr.filter(o => o.categorie !== "ETI / PME").length / arr.length;

  html += `<div class="lab-grid"><div>
      <div class="chart" id="m1-chart"></div><div id="m1-legende"></div>
    </div><div>
      <h3>Statistiques descriptives (n = ${s.n})</h3>
      <div class="stat-grid">
        <div>Moyenne $\\mu$<b>${f(s.mean, 1)}</b></div><div>Médiane $Q_2$<b>${f(s.median)}</b></div>
        <div>Mode<b>${s.mode.valeurs.length > 3 ? "multiple" : s.mode.valeurs.map(v => f(v)).join(" ; ")}</b><span class="muted">${s.mode.effectif} offres</span></div>
        <div>Variance $s^2$<b>${num(s.variance, 0)}</b></div><div>Écart-type $\\sigma$<b>${f(s.sd, 1)}</b></div>
        <div>Coef. de variation<b>${pct(s.cv)}</b></div>
        <div>$Q_1$<b>${f(s.q1)}</b></div><div>$Q_3$<b>${f(s.q3)}</b></div><div>$IQR = Q_3 - Q_1$<b>${f(s.iqr)}</b></div>
        <div>$D_1$<b>${f(s.d1)}</b></div><div>$D_9$<b>${f(s.d9)}</b></div><div>Min / Max<b>${f(s.min)} / ${f(s.max)}</b></div>
        <div>Asymétrie (skewness)<b>${num(s.skewness, 3)}</b><span class="muted">± ${num(s.seSkew, 2)}</span></div>
        <div>Aplatissement (kurtosis)<b>${num(s.kurtosis, 3)}</b><span class="muted">± ${num(seKurt, 2)}</span></div>
        <div>Écart moyenne − médiane<b>${f(s.mean - s.median, 1)}</b></div>
      </div>
      <div class="verdict ${asymSig || aplatSig ? "rejet" : "garde"}" style="margin-top:12px">
        ${s.mean > s.median ? "La moyenne dépasse la médiane" : s.mean < s.median ? "La moyenne est inférieure à la médiane" : "Moyenne et médiane sont égales"}
        (écart de ${f(Math.abs(s.mean - s.median), 1)}).
        ${asymSig ? `L'asymétrie est <b>significative</b> (|${num(s.skewness, 2)}| > 2 × ${num(s.seSkew, 2)}) : la distribution est étirée ${sens}.`
          : `L'asymétrie n'est pas significative (|${num(s.skewness, 2)}| ≤ 2 × ${num(s.seSkew, 2)}).`}
        ${aplatSig ? `L'aplatissement est significatif (${s.kurtosis > 0 ? "distribution plus pointue, queues plus épaisses" : "distribution plus plate"} qu'une loi normale).`
          : "L'aplatissement est compatible avec une loi normale."}
        ${asymSig || aplatSig ? "<b>L'hypothèse de normalité est mise en défaut</b> : la médiane et l'IQR décrivent mieux le centre et la dispersion que la moyenne et l'écart-type."
          : "La loi normale est une approximation acceptable de cette distribution."}
      </div>
      <p class="small">Au-delà du 9ᵉ décile (${f(d9)}), <b>${pct(partGrands(haut), 0)}</b> des offres viennent du CAC 40 ou d'un grand groupe,
        contre ${pct(partGrands(sel), 0)} dans l'ensemble : ${partGrands(haut) > partGrands(sel) + 0.05 ? "les grandes entreprises sont surreprésentées dans le haut de la distribution."
          : "les grandes entreprises ne sont pas surreprésentées dans le haut de la distribution."}</p>
      ${reglages.variable === "score" ? noteScore() : noteSalaire(sel, reglages.variable)}
    </div></div>
    ${cours("Moyenne, médiane, dispersion et loi normale", `
      <p>La <b>moyenne</b> $\\bar{x} = \\frac{1}{n}\\sum x_i$ utilise toutes les valeurs : elle est tirée par les valeurs extrêmes.
      La <b>médiane</b> partage l'échantillon en deux moitiés et ne dépend que du rang : elle est <b>robuste</b>.
      Si $\\bar{x} > Q_2$, la distribution est en général étirée vers la droite (asymétrie positive).</p>
      <p>La <b>variance</b> $s^2 = \\frac{1}{n-1}\\sum (x_i-\\bar{x})^2$ et l'<b>écart-type</b> $s$ mesurent la dispersion autour de la moyenne ;
      l'<b>IQR</b> $= Q_3 - Q_1$ contient les 50 % d'offres centrales et résiste aux valeurs atypiques.</p>
      <p>La <b>loi normale</b> a pour densité $f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}}\\, e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}$ : symétrique
      (asymétrie 0), aplatissement en excès 0, et 68 % / 95 % / 99,7 % des valeurs dans $\\mu \\pm 1, 2, 3\\,\\sigma$.
      On compare les coefficients observés à deux fois leur erreur-type ($\\approx\\sqrt{6/n}$ pour l'asymétrie) pour juger d'un écart significatif.</p>`)}`;
  el.innerHTML = html;
  el.querySelector("#m1-legende").innerHTML = histogramme(el.querySelector("#m1-chart"), xs, s, { unite: V.unite, titreX: `${V.nom} (${V.unite})` });
  brancher(el, reglages, () => rendre(el, offres));
}
