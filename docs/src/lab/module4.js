// Module 4 — Croiser deux variables qualitatives : test du khi-deux d'indépendance

import { state, nomTheme, nomRegion, CATEGORIES, avecTeletravail } from "../state.js";
import { chi2Independence } from "../utils/statsEngine.js";
import { num, pval, intensite, pct, esc, cssVar } from "../utils/format.js";
import { barres100 } from "../components/charts.js";
import { select, brancher, question, hypotheses, verdict, cours, alerte, tex } from "./commun.js";

const teletravail = o => (o.teletravail === "Non précisé" ? "Non précisé" : avecTeletravail(o) ? "Avec télétravail" : "Présentiel");
const regionPrincipale = offres => {
  // Les 5 régions les plus fournies, les autres regroupées pour garder des effectifs suffisants
  const top = d3.rollups(offres, v => v.length, o => o.region).sort((a, b) => b[1] - a[1]).slice(0, 5).map(d => d[0]);
  return o => (top.includes(o.region) ? nomRegion(o.region) : "Autres régions");
};
const CROISEMENTS = {
  A: { nom: "Télétravail × thème d'ingénierie", ligne: () => o => nomTheme(o.theme), col: () => teletravail, tt: true,
    q: "L'accès au télétravail dépend-il du métier d'ingénierie ?" },
  B: { nom: "Télétravail × catégorie d'entreprise", ligne: () => o => o.categorie, col: () => teletravail, tt: true, ordreL: CATEGORIES,
    q: "L'accès au télétravail dépend-il de la taille ou du prestige de l'entreprise ?" },
  C: { nom: "Catégorie d'entreprise × région", ligne: regionPrincipale, col: () => o => o.categorie, ordreC: CATEGORIES,
    q: "Les grandes entreprises sont-elles concentrées dans certaines régions ?" },
};
const reglages = { croisement: "A", nonPrecise: false, vue: "O" };

export const titre = "4 · Khi² d'indépendance";

export function rendre(el, offres) {
  const C = CROISEMENTS[reglages.croisement];
  const sel = C.tt && !reglages.nonPrecise ? offres.filter(o => o.teletravail !== "Non précisé") : offres;
  const fL = C.ligne(offres), fC = C.col();
  const ordonner = (vals, ordre) => (ordre ? ordre.filter(v => vals.includes(v)) : vals.sort((a, b) => a.localeCompare(b, "fr")));
  let lignes = ordonner([...new Set(sel.map(fL))], C.ordreL);
  let colonnes = ordonner([...new Set(sel.map(fC))], C.ordreC ?? (C.tt ? ["Avec télétravail", "Présentiel", "Non précisé"] : null));
  if (lignes.includes("Autres régions")) lignes = [...lignes.filter(l => l !== "Autres régions"), "Autres régions"];
  const table = lignes.map(l => colonnes.map(c => sel.filter(o => fL(o) === l && fC(o) === c).length));

  let html = `${question(C.q)}
    <div class="controls">
      <label>Croisement ${select("croisement", Object.entries(CROISEMENTS).map(([k, c]) => [k, `${k} · ${c.nom}`]), reglages.croisement)}</label>
      ${C.tt ? `<label><input type="checkbox" data-ctl="nonPrecise" ${reglages.nonPrecise ? "checked" : ""}> inclure « non précisé »</label>` : ""}
      <label>Tableau ${select("vue", [["O", "Effectifs observés Oᵢⱼ"], ["E", "Effectifs théoriques Eᵢⱼ"], ["X", "Contributions au χ²"], ["P", "Pourcentages en ligne"]], reglages.vue)}</label>
    </div>
    ${hypotheses(`Les deux variables sont <b>indépendantes</b> : la répartition en colonnes est la même pour chaque ligne.`,
      `Les deux variables sont <b>liées</b>.`)}`;

  if (lignes.length < 2 || colonnes.length < 2) {
    el.innerHTML = html + alerte(`Le tableau doit avoir au moins 2 lignes et 2 colonnes non vides (actuellement ${lignes.length} × ${colonnes.length}).
      ${C.tt && !reglages.nonPrecise ? "Peu d'offres précisent le mode de travail : essayez d'inclure « non précisé » ou d'élargir les filtres." : ""}`);
    brancher(el, reglages, () => rendre(el, offres));
    return;
  }
  const r = chi2Independence(table);
  const effet = intensite(r.vCramer, [0.1, 0.3, 0.5]);
  const maxContrib = Math.max(...r.contributions.flat());
  const cellule = (i, j) => {
    const o = r.observes[i][j], e = r.attendus[i][j], x = r.contributions[i][j];
    const fond = reglages.vue === "X" && maxContrib ? `background:color-mix(in srgb, ${o > e ? cssVar("--c2") : cssVar("--c1")} ${Math.round(x / maxContrib * 70)}%, transparent)` : "";
    const v = { O: num(o), E: num(e, 1), X: num(x, 2), P: pct(r.totL[i] ? o / r.totL[i] : 0, 0) }[reglages.vue];
    return `<td style="${fond}" title="Observé ${o} · théorique ${num(e, 1)} · contribution ${num(x, 2)}">${v}${reglages.vue === "X" ? (o > e ? " ▲" : " ▼") : ""}</td>`;
  };
  // Cases qui pèsent le plus dans le χ²
  const fortes = r.contributions.flatMap((ligne, i) => ligne.map((x, j) => ({ i, j, x }))).sort((a, b) => b.x - a.x).slice(0, 2)
    .map(({ i, j }) => `« ${esc(lignes[i])} × ${esc(colonnes[j])} » (${r.observes[i][j]} observées pour ${num(r.attendus[i][j], 1)} attendues)`);

  html += `<div class="lab-grid"><div>
      <div class="chart" id="m4-chart"></div><div id="m4-legende"></div>
      <h3 style="margin-top:14px">Tableau de contingence</h3>
      <table class="res contingence"><thead><tr><th></th>${colonnes.map(c => `<th>${esc(c)}</th>`).join("")}<th>Total</th></tr></thead><tbody>
        ${lignes.map((l, i) => `<tr><td>${esc(l)}</td>${colonnes.map((_, j) => cellule(i, j)).join("")}<td><b>${r.totL[i]}</b></td></tr>`).join("")}
        <tr><td><b>Total</b></td>${r.totC.map(t => `<td><b>${t}</b></td>`).join("")}<td><b>${r.N}</b></td></tr>
      </tbody></table>
      ${reglages.vue === "X" ? `<p class="small muted">Couleur : contribution $\\frac{(O_{ij}-E_{ij})^2}{E_{ij}}$ ; ▲ plus d'offres qu'attendu sous $H_0$, ▼ moins.</p>` : ""}
    </div><div>
      <table class="res"><tbody>
        <tr><td>Statistique $\\chi^2$</td><td><b>${num(r.chi2, 3)}</b></td></tr>
        <tr><td>Degrés de liberté $(L-1)(C-1)$</td><td>${r.ddl}</td></tr>
        <tr><td>$p$-value</td><td><b>${pval(r.p)}</b></td></tr>
        <tr><td>V de Cramer</td><td>${num(r.vCramer, 3)} (lien ${effet})</td></tr>
        <tr><td>Effectif total $N$</td><td>${r.N}</td></tr>
      </tbody></table>
      ${verdict(r.p,
        `Les deux variables sont liées (V de Cramer = ${num(r.vCramer, 2)}, lien ${effet}). Les cases qui s'écartent le plus de l'indépendance : ${fortes.join(" et ")}.`,
        `Les écarts entre effectifs observés et théoriques sont compatibles avec l'indépendance : rien ne permet d'affirmer un lien.`)}
      ${r.partAttendusFaibles > 0.2 ? alerte(`${pct(r.partAttendusFaibles, 0)} des cases ont un effectif théorique inférieur à 5 (règle de Cochran : au plus 20 %).
        L'approximation par la loi du χ² est alors peu fiable : regroupez des modalités ou élargissez les filtres.`) : ""}
      ${C.tt ? alerte(`Le mode de travail n'est précisé que dans ${pct(offres.filter(o => o.teletravail !== "Non précisé").length / offres.length, 0)} des offres.
        ${reglages.nonPrecise ? "La modalité « non précisé » est incluse : un lien peut aussi refléter des différences de renseignement des offres." : "Le test ne porte que sur ces offres."}`) : ""}
    </div></div>
    ${cours("Pourquoi le test du χ² d'indépendance ?", `
      <p>On croise deux variables <b>qualitatives</b> : on ne peut calculer ni moyenne ni corrélation, on compare des <b>effectifs</b>.
      Sous $H_0$ (indépendance), l'effectif attendu dans chaque case vaut $E_{ij} = \\frac{N_{i\\cdot} \\times N_{\\cdot j}}{N}$.
      On mesure l'écart global entre observé et attendu :
      $$\\chi^2 = \\sum_{i,j} \\frac{(O_{ij} - E_{ij})^2}{E_{ij}} \\quad\\text{avec}\\quad ddl = (L-1)(C-1)$$</p>
      <p>La $p$-value dit si le lien est significatif ; le <b>V de Cramer</b> $V = \\sqrt{\\frac{\\chi^2}{N\\,(\\min(L,C)-1)}}$, compris entre 0 et 1,
      en mesure l'<b>intensité</b> indépendamment de $N$. Condition d'application : effectifs théoriques $E_{ij} \\ge 5$ dans au moins 80 % des cases.</p>`)}`;
  el.innerHTML = html;
  el.querySelector("#m4-legende").innerHTML = barres100(el.querySelector("#m4-chart"), lignes, colonnes, table);
  brancher(el, reglages, () => rendre(el, offres));
}
