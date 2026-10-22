// Graphiques du laboratoire (d3) : histogramme + loi normale, moyennes ± IC 95 %, boîtes à moustaches,
// barres empilées à 100 %, nuage de points + droite de régression.

import { normalPdf } from "../utils/statsEngine.js";
import { num, cssVar, esc } from "../utils/format.js";

export const PALETTE = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c6"];
export const couleur = i => cssVar(PALETTE[i % PALETTE.length]);

function cadre(el, { w = 640, h = 320, m = { t: 16, r: 16, b: 40, l: 56 } } = {}) {
  el.innerHTML = "";
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img");
  return { svg, g: svg.append("g").attr("transform", `translate(${m.l},${m.t})`), iw: w - m.l - m.r, ih: h - m.t - m.b, m, w, h };
}
const fmtAxe = d => num(d, Math.abs(d) < 10 && d % 1 ? 1 : 0);
function axes(c, x, y, { titreX = "", titreY = "", xTicks = 6, yTicks = 5, xFormat = fmtAxe, yFormat = fmtAxe } = {}) {
  c.g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(yTicks).tickSize(-c.iw).tickFormat("")).call(s => s.select(".domain").remove());
  c.g.append("g").attr("class", "axis").attr("transform", `translate(0,${c.ih})`).call(d3.axisBottom(x).ticks(xTicks).tickFormat(xFormat));
  c.g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(yTicks).tickFormat(yFormat));
  if (titreX) c.g.append("text").attr("x", c.iw / 2).attr("y", c.ih + 34).attr("text-anchor", "middle").text(titreX);
  if (titreY) c.g.append("text").attr("transform", "rotate(-90)").attr("x", -c.ih / 2).attr("y", -44).attr("text-anchor", "middle").text(titreY);
}

/** Histogramme des fréquences + densité normale N(μ, σ²) + repères moyenne, médiane, Q1, Q3. */
export function histogramme(el, valeurs, stats, { unite = "", titreX = "" } = {}) {
  const c = cadre(el);
  const ext = d3.extent(valeurs);
  const marge = (ext[1] - ext[0]) * 0.05 || 1;
  const x = d3.scaleLinear().domain([Math.min(ext[0], stats.mean - 3 * stats.sd) - marge, Math.max(ext[1], stats.mean + 3 * stats.sd) + marge]).nice();
  const nbClasses = Math.max(5, Math.min(30, Math.ceil(Math.log2(valeurs.length) + 1) * 2)); // Sturges ×2
  const classes = d3.bin().domain(x.domain()).thresholds(x.ticks(nbClasses))(valeurs);
  const largeur = classes[0].x1 - classes[0].x0;
  // Densité empirique (effectif / (n·largeur)) pour superposer la densité théorique sur la même échelle
  const dens = classes.map(b => b.length / (valeurs.length * largeur));
  const xs = d3.range(x.domain()[0], x.domain()[1], (x.domain()[1] - x.domain()[0]) / 200);
  const courbe = stats.sd > 0 ? xs.map(v => [v, normalPdf(v, stats.mean, stats.sd)]) : [];
  const y = d3.scaleLinear().domain([0, d3.max([...dens, ...courbe.map(p => p[1])]) * 1.1]).range([c.ih, 0]);
  const xpx = x.range([0, c.iw]);
  axes(c, xpx, y, { titreX, titreY: "Densité de fréquence", yFormat: d => d3.format(".1e")(d).replace(".", ",") });

  c.g.append("g").selectAll("rect").data(classes).join("rect")
    .attr("x", b => xpx(b.x0) + 1).attr("width", b => Math.max(0, xpx(b.x1) - xpx(b.x0) - 2))
    .attr("y", (b, i) => y(dens[i])).attr("height", (b, i) => c.ih - y(dens[i]))
    .attr("fill", cssVar("--s2")).append("title").text(b => `${num(b.x0)} – ${num(b.x1)} ${unite} : ${b.length} offre(s)`);
  if (courbe.length) {
    c.g.append("path").datum(courbe).attr("fill", "none").attr("stroke", cssVar("--c2")).attr("stroke-width", 2.5)
      .attr("d", d3.line().x(p => xpx(p[0])).y(p => y(p[1])).curve(d3.curveBasis));
  }
  const reperes = [
    [stats.mean, "Moyenne", cssVar("--c5"), null], [stats.median, "Médiane", cssVar("--c3"), null],
    [stats.q1, "Q1", cssVar("--muted"), "4 3"], [stats.q3, "Q3", cssVar("--muted"), "4 3"],
  ];
  for (const [v, nom, col, tirets] of reperes) {
    c.g.append("line").attr("x1", xpx(v)).attr("x2", xpx(v)).attr("y1", 0).attr("y2", c.ih)
      .attr("stroke", col).attr("stroke-width", tirets ? 1.5 : 2.5).attr("stroke-dasharray", tirets);
  }
  return `<div class="legend-inline">
    <span><i style="background:${cssVar("--s2")};height:10px"></i>Histogramme (densité)</span>
    <span><i style="background:${cssVar("--c2")}"></i>Loi normale $\\mathcal{N}(\\mu,\\sigma^2)$</span>
    <span><i style="background:${cssVar("--c5")}"></i>Moyenne</span><span><i style="background:${cssVar("--c3")}"></i>Médiane</span>
    <span><i style="background:${cssVar("--muted")}"></i>Q1 / Q3 (pointillés)</span></div>`;
}

/** Moyennes de groupes avec barres d'intervalle de confiance à 95 %. */
export function moyennesIC(el, groupes, { titreY = "" } = {}) {
  const c = cadre(el, { h: 300 });
  const x = d3.scaleBand().domain(groupes.map(g => g.nom)).range([0, c.iw]).padding(0.45);
  const lo = d3.min(groupes, g => g.ci[0]), hi = d3.max(groupes, g => g.ci[1]);
  const pad = (hi - lo) * 0.4 || Math.abs(hi) * 0.1 || 1;
  const y = d3.scaleLinear().domain([lo - pad, hi + pad]).nice().range([c.ih, 0]);
  axes(c, x, y, { titreY, xTicks: groupes.length, xFormat: d => d });
  groupes.forEach((g, i) => {
    const cx = x(g.nom) + x.bandwidth() / 2, col = couleur(i);
    c.g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", y(g.ci[0])).attr("y2", y(g.ci[1])).attr("stroke", col).attr("stroke-width", 2.5);
    for (const v of g.ci) c.g.append("line").attr("x1", cx - 14).attr("x2", cx + 14).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", col).attr("stroke-width", 2.5);
    c.g.append("circle").attr("cx", cx).attr("cy", y(g.m)).attr("r", 7).attr("fill", col);
    c.g.append("text").attr("x", cx + 20).attr("y", y(g.m) + 4).style("fill", cssVar("--text")).style("font-weight", 600).text(num(g.m, g.d ?? 0));
    c.g.append("text").attr("x", cx).attr("y", c.ih + 30).attr("text-anchor", "middle").text(`n = ${g.n}`);
  });
}

/** Boîtes à moustaches (méthode de Tukey : moustaches à 1,5 × IQR, points atypiques au-delà) + moyenne en losange. */
export function boites(el, groupes, { titreY = "" } = {}) {
  const c = cadre(el, { h: 340, m: { t: 16, r: 16, b: 70, l: 56 } });
  const x = d3.scaleBand().domain(groupes.map(g => g.nom)).range([0, c.iw]).padding(0.35);
  const toutes = groupes.flatMap(g => g.valeurs);
  const ext = d3.extent(toutes), pad = (ext[1] - ext[0]) * 0.08 || 1;
  const y = d3.scaleLinear().domain([ext[0] - pad, ext[1] + pad]).nice().range([c.ih, 0]);
  axes(c, x, y, { titreY, xFormat: () => "" });
  groupes.forEach((g, i) => {
    const s = g.stats, x0 = x(g.nom), bw = x.bandwidth(), cx = x0 + bw / 2, col = couleur(i);
    const basM = d3.min(g.valeurs.filter(v => v >= s.q1 - 1.5 * s.iqr)), hautM = d3.max(g.valeurs.filter(v => v <= s.q3 + 1.5 * s.iqr));
    c.g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", y(basM)).attr("y2", y(hautM)).attr("stroke", cssVar("--muted"));
    for (const v of [basM, hautM]) c.g.append("line").attr("x1", cx - bw / 4).attr("x2", cx + bw / 4).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", cssVar("--muted"));
    c.g.append("rect").attr("x", x0).attr("width", bw).attr("y", y(s.q3)).attr("height", Math.max(1, y(s.q1) - y(s.q3)))
      .attr("fill", col).attr("fill-opacity", 0.25).attr("stroke", col).attr("stroke-width", 1.5);
    c.g.append("line").attr("x1", x0).attr("x2", x0 + bw).attr("y1", y(s.median)).attr("y2", y(s.median)).attr("stroke", col).attr("stroke-width", 3);
    c.g.append("path").attr("d", d3.symbol(d3.symbolDiamond, 70)()).attr("transform", `translate(${cx},${y(s.mean)})`)
      .attr("fill", cssVar("--text")).append("title").text(`Moyenne : ${num(s.mean, 1)}`);
    c.g.selectAll(null).data(g.valeurs.filter(v => v < s.q1 - 1.5 * s.iqr || v > s.q3 + 1.5 * s.iqr)).join("circle")
      .attr("cx", cx).attr("cy", v => y(v)).attr("r", 3).attr("fill", "none").attr("stroke", col);
    c.g.append("text").attr("x", cx).attr("y", c.ih + 16).attr("text-anchor", "middle").style("fill", cssVar("--text"))
      .text(g.nom.length > 22 ? g.nom.slice(0, 21) + "…" : g.nom).append("title").text(g.nom);
    c.g.append("text").attr("x", cx).attr("y", c.ih + 30).attr("text-anchor", "middle").text(`n = ${g.valeurs.length}`);
  });
  return `<div class="legend-inline"><span>▭ boîte : Q1 – Q3</span><span>━ médiane</span><span>◆ moyenne</span><span>┃ moustaches : 1,5 × IQR</span><span>○ valeurs atypiques</span></div>`;
}

/** Barres empilées à 100 % : une barre par ligne du tableau de contingence. */
export function barres100(el, lignes, colonnes, table) {
  const c = cadre(el, { h: Math.max(180, 44 * lignes.length + 60), m: { t: 10, r: 16, b: 30, l: 170 } });
  const y = d3.scaleBand().domain(lignes).range([0, c.ih]).padding(0.25);
  const x = d3.scaleLinear().domain([0, 1]).range([0, c.iw]);
  c.g.append("g").attr("class", "axis").attr("transform", `translate(0,${c.ih})`).call(d3.axisBottom(x).ticks(5).tickFormat(d => `${d * 100} %`));
  c.g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickFormat(d => (d.length > 26 ? d.slice(0, 25) + "…" : d)));
  table.forEach((ligne, i) => {
    const tot = d3.sum(ligne);
    let cumul = 0;
    ligne.forEach((v, j) => {
      const part = tot ? v / tot : 0;
      c.g.append("rect").attr("x", x(cumul)).attr("y", y(lignes[i])).attr("width", Math.max(0, x(part) - 1)).attr("height", y.bandwidth())
        .attr("fill", couleur(j)).append("title").text(`${lignes[i]} × ${colonnes[j]} : ${v} (${num(part * 100, 1)} %)`);
      if (part > 0.08) c.g.append("text").attr("x", x(cumul + part / 2)).attr("y", y(lignes[i]) + y.bandwidth() / 2 + 4)
        .attr("text-anchor", "middle").style("fill", "#fff").style("font-weight", 600).text(`${Math.round(part * 100)} %`);
      cumul += part;
    });
  });
  return `<div class="legend-inline">${colonnes.map((col, j) => `<span><i style="background:${couleur(j)};height:10px"></i>${esc(col)}</span>`).join("")}</div>`;
}

/** Nuage de points coloré par catégorie + droite des moindres carrés y = a·x + b. */
export function nuage(el, points, reg, { titreX = "", titreY = "", categories = [] } = {}) {
  const c = cadre(el, { h: 340 });
  const ex = d3.extent(points, p => p.x), ey = d3.extent(points, p => p.y);
  const px = (ex[1] - ex[0]) * 0.05 || 1, py = (ey[1] - ey[0]) * 0.08 || 1;
  const x = d3.scaleLinear().domain([ex[0] - px, ex[1] + px]).nice().range([0, c.iw]);
  const y = d3.scaleLinear().domain([ey[0] - py, ey[1] + py]).nice().range([c.ih, 0]);
  axes(c, x, y, { titreX, titreY });
  // Léger décalage aléatoire déterministe pour distinguer les points superposés (valeurs discrètes)
  const jit = i => (((i * 9301 + 49297) % 233280) / 233280 - 0.5) * 6;
  c.g.append("g").selectAll("circle").data(points).join("circle")
    .attr("cx", (p, i) => x(p.x) + jit(i)).attr("cy", (p, i) => y(p.y) + jit(i + 7)).attr("r", 4)
    .attr("fill", p => couleur(Math.max(0, categories.indexOf(p.cat)))).attr("fill-opacity", 0.65)
    .append("title").text(p => p.label);
  if (reg) {
    const [x0, x1] = x.domain();
    c.g.append("line").attr("x1", x(x0)).attr("x2", x(x1)).attr("y1", y(reg.a * x0 + reg.b)).attr("y2", y(reg.a * x1 + reg.b))
      .attr("stroke", cssVar("--text")).attr("stroke-width", 2).attr("stroke-dasharray", "6 4");
  }
  return `<div class="legend-inline">${categories.map((cat, i) => `<span><i style="background:${couleur(i)};height:8px;width:8px;border-radius:50%"></i>${esc(cat)}</span>`).join("")}
    <span><i style="background:${cssVar("--text")}"></i>Droite de régression</span><span class="muted">(points légèrement décalés pour rester visibles)</span></div>`;
}
