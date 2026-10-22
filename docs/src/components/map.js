// Carte de France à deux niveaux (régions / départements) avec bulles par ville ou par bassin d'emploi.
// Un clic sur une zone ou une bulle la sélectionne et zoome dessus ; le panneau de droite suit la sélection.

import { state, maj, offresFiltrees, salaire, nomSalaire, nomRegion } from "../state.js";
import { median } from "../utils/statsEngine.js";
import { num, eur, pct, esc, cssVar } from "../utils/format.js";

const W = 640, H = 620;
const vue = { niveau: "region", mesure: "volume", bulles: "ville" };
let geo = {}, svg, gCarte, gZones, gBulles, zoom, chemin, projection;

const MESURES = {
  volume: { nom: "Nombre d'offres", calc: v => v.length, fmt: x => num(x) },
  salaire: { nom: () => `${nomSalaire()} médian`, calc: v => median(v.map(salaire).filter(Number.isFinite)), fmt: x => eur(x), min: 1 },
  grands: { nom: "Part CAC 40 + grands groupes", calc: v => v.filter(o => o.categorie !== "ETI / PME").length / v.length, fmt: x => pct(x, 0), min: 1 },
};
const nomMesure = () => { const n = MESURES[vue.mesure].nom; return typeof n === "function" ? n() : n; };

export async function initCarte() {
  const [regions, departements] = await Promise.all([d3.json("data/regions.geojson"), d3.json("data/departements.geojson")]);
  geo = { region: regions, departement: departements };
  projection = d3.geoConicConformal().parallels([44, 49]).rotate([-3, 0]).fitExtent([[8, 8], [W - 8, H - 8]], departements);
  chemin = d3.geoPath(projection);

  svg = d3.select("#map").attr("viewBox", `0 0 ${W} ${H}`);
  gCarte = svg.append("g");
  gZones = gCarte.append("g");
  gBulles = gCarte.append("g");
  zoom = d3.zoom().scaleExtent([1, 12]).translateExtent([[0, 0], [W, H]]).on("zoom", e => {
    gCarte.attr("transform", e.transform);
    gBulles.selectAll("circle").attr("r", d => d.r / Math.sqrt(e.transform.k));
  });
  svg.call(zoom).on("dblclick.zoom", null);
  document.getElementById("map-reset").onclick = () => maj({ zone: null });

  const outils = document.getElementById("map-tools");
  outils.innerHTML = `
    <div class="switch" role="group" aria-label="Niveau de la carte">
      <button data-niveau="region">Régions</button><button data-niveau="departement">Départements</button></div>
    <label class="small muted">Couleur <select data-mesure>
      <option value="volume">Nombre d'offres</option><option value="salaire">Salaire médian</option>
      <option value="grands">Part CAC 40 + grands groupes</option></select></label>
    <label class="small muted">Bulles <select data-bulles>
      <option value="ville">Par ville</option><option value="bassin">Par bassin d'emploi</option><option value="aucune">Aucune</option></select></label>`;
  outils.querySelectorAll("[data-niveau]").forEach(b => b.onclick = () => { vue.niveau = b.dataset.niveau; rendreCarte(); });
  outils.querySelector("[data-mesure]").onchange = e => { vue.mesure = e.target.value; rendreCarte(); };
  outils.querySelector("[data-bulles]").onchange = e => { vue.bulles = e.target.value; rendreCarte(); };
}

function zoomSur(feature) {
  if (!feature) { svg.transition().duration(650).call(zoom.transform, d3.zoomIdentity); return; }
  const [[x0, y0], [x1, y1]] = chemin.bounds(feature);
  const k = Math.min(8, 0.85 / Math.max((x1 - x0) / W, (y1 - y0) / H));
  svg.transition().duration(650).call(zoom.transform,
    d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
}

function zoomPoint([x, y], k = 5) {
  svg.transition().duration(650).call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-x, -y));
}

const tip = (e, html) => {
  const t = document.getElementById("tip");
  t.innerHTML = html; t.style.opacity = 1;
  t.style.left = Math.min(e.clientX + 14, innerWidth - 290) + "px"; t.style.top = e.clientY + 14 + "px";
};
const cacherTip = () => (document.getElementById("tip").style.opacity = 0);

export function rendreCarte() {
  const offres = offresFiltrees();
  const outils = document.getElementById("map-tools");
  outils.querySelectorAll("[data-niveau]").forEach(b => b.setAttribute("aria-pressed", b.dataset.niveau === vue.niveau));
  outils.querySelector("[data-mesure]").value = vue.mesure;
  outils.querySelector("[data-bulles]").value = vue.bulles;
  outils.querySelector("[data-mesure] option[value=salaire]").textContent = `${nomSalaire()} médian`;

  // Zones colorées
  const cle = vue.niveau === "region" ? "region" : "departement";
  const groupes = d3.group(offres, o => o[cle]);
  const M = MESURES[vue.mesure];
  const valeurs = new Map([...groupes].map(([k, v]) => [k, v.length >= (M.min ?? 1) ? M.calc(v) : NaN]));
  const vals = [...valeurs.values()].filter(x => Number.isFinite(x) && (vue.mesure !== "volume" || x > 0));
  const couleurs = ["--s0", "--s1", "--s2", "--s3", "--s4", "--s5"].map(cssVar);
  const echelle = vals.length > 1 ? d3.scaleQuantile().domain(vals).range(couleurs) : () => couleurs[3];
  const couleur = code => { const v = valeurs.get(code); return Number.isFinite(v) && (vue.mesure !== "volume" || v > 0) ? echelle(v) : cssVar("--empty"); };

  const zoneSel = state.zone && state.zone.type === cle ? state.zone.code : null;
  gZones.selectAll("path.zone").data(geo[vue.niveau].features, f => vue.niveau + f.properties.code).join("path")
    .attr("class", f => "zone" + (f.properties.code === zoneSel ? " sel" : ""))
    .attr("d", chemin)
    .attr("fill", f => couleur(f.properties.code))
    .on("mousemove", (e, f) => {
      const v = groupes.get(f.properties.code) ?? [];
      tip(e, `<b>${esc(f.properties.nom)}</b><br>${num(v.length)} offre${v.length > 1 ? "s" : ""}` +
        (vue.mesure !== "volume" ? `<br>${nomMesure()} : ${Number.isFinite(valeurs.get(f.properties.code)) ? M.fmt(valeurs.get(f.properties.code)) : "–"}` : ""));
    })
    .on("mouseleave", cacherTip)
    .on("click", (e, f) => {
      const code = f.properties.code;
      maj({ zone: zoneSel === code ? null : { type: cle, code, nom: f.properties.nom } });
    });
  gZones.selectAll("path.sel").raise();

  // Bulles géolocalisées
  let points = [];
  if (vue.bulles === "ville") {
    points = d3.rollups(offres.filter(o => o.lat != null && o.departement.length === 2), v => v, o => `${o.departement}|${o.ville}`)
      .map(([code, v]) => ({ type: "ville", code, nom: `${v[0].ville} (${v[0].departement})`, v, pos: projection([d3.mean(v, o => o.lon), d3.mean(v, o => o.lat)]) }));
  } else if (vue.bulles === "bassin") {
    points = state.meta.bassins.map(b => {
      const v = offres.filter(o => o.bassin === b.nom);
      const [lat, lon] = b.centres[0];
      return { type: "bassin", code: b.nom, nom: `Bassin ${b.nom}`, v, pos: projection([lon, lat]) };
    }).filter(p => p.v.length);
  }
  const rMax = vue.bulles === "bassin" ? 34 : 22;
  const rayon = d3.scaleSqrt().domain([0, d3.max(points, p => p.v.length) || 1]).range([0, rMax]);
  points.forEach(p => (p.r = Math.max(3, rayon(p.v.length))));
  const k = d3.zoomTransform(svg.node()).k;
  gBulles.selectAll("circle.bulle").data(points.filter(p => p.pos).sort((a, b) => b.r - a.r), p => p.type + p.code).join("circle")
    .attr("class", p => "bulle" + (state.zone?.type === p.type && state.zone.code === p.code ? " sel" : ""))
    .attr("cx", p => p.pos[0]).attr("cy", p => p.pos[1]).attr("r", p => p.r / Math.sqrt(k))
    .on("mousemove", (e, p) => tip(e, `<b>${esc(p.nom)}</b><br>${num(p.v.length)} offre${p.v.length > 1 ? "s" : ""}<br>${nomSalaire()} médian : ${eur(median(p.v.map(salaire).filter(Number.isFinite)))}`))
    .on("mouseleave", cacherTip)
    .on("click", (e, p) => {
      e.stopPropagation();
      const meme = state.zone?.type === p.type && state.zone.code === p.code;
      maj({ zone: meme ? null : { type: p.type, code: p.code, nom: p.nom, pos: p.pos } });
    });

  // Légende
  const lg = document.getElementById("legende");
  if (vals.length > 1) {
    const bornes = [d3.min(vals), ...echelle.quantiles(), d3.max(vals)];
    lg.innerHTML = `<span>${nomMesure()} :</span>` + couleurs.map((c, i) =>
      `<span class="sw" style="background:${c}" title="${M.fmt(bornes[i])} – ${M.fmt(bornes[i + 1])}"></span>`).join("") +
      `<span>${M.fmt(bornes[0])} → ${M.fmt(bornes.at(-1))}</span>` +
      (vue.bulles !== "aucune" ? `<span style="margin-left:12px">● taille des bulles = nombre d'offres</span>` : "");
  } else lg.innerHTML = "";

  // Outre-mer (hors carte)
  const dom = document.getElementById("outre-mer");
  const codesDom = vue.niveau === "region" ? ["01", "02", "03", "04", "06"] : ["971", "972", "973", "974", "976"];
  dom.innerHTML = "";
  for (const code of codesDom) {
    const v = groupes.get(code) ?? [];
    const nom = vue.niveau === "region" ? nomRegion(code) : state.meta.departements[code];
    const b = document.createElement("button");
    b.className = zoneSel === code ? "sel" : "";
    b.style.background = couleur(code);
    b.textContent = `${nom} · ${num(v.length)}`;
    b.onclick = () => maj({ zone: zoneSel === code ? null : { type: cle, code, nom } });
    dom.append(b);
  }

  document.getElementById("map-reset").hidden = !state.zone;
}

/** Zoom suivant la zone sélectionnée (appelé quand la sélection change). */
let derniereZone = null;
export function suivreZone() {
  const z = state.zone, cle = z ? `${z.type}|${z.code}` : null;
  if (cle === derniereZone) return;
  derniereZone = cle;
  if (!z) return zoomSur(null);
  if (z.type === "region" || z.type === "departement") {
    const f = geo[z.type].features.find(x => x.properties.code === z.code);
    if (f) zoomSur(f); else zoomSur(null);
  } else if (z.pos) zoomPoint(z.pos, z.type === "bassin" ? 4 : 6);
}
