// Barre de contrôle globale : recherche, filtres à choix multiples, seuil de score, mode de salaire, actualisation

import { state, maj, CATEGORIES, TELETRAVAIL, FILTRES_LISTES, nomRegion } from "../state.js";
import { esc } from "../utils/format.js";

const DEPOT = "https://github.com/amandinelegendr/Projet-data-IAE";

function multiSelect(titre, cle, options) {
  const choisis = state.filtres[cle];
  const el = document.createElement("details");
  el.className = "ms";
  el.dataset.actif = choisis.size > 0;
  const libelle = choisis.size ? `${titre} (${choisis.size})` : titre;
  el.innerHTML = `<summary>${esc(libelle)}</summary><div class="menu">
    ${options.map(([val, nom, n]) => val === null ? `<div class="small muted" style="padding:6px 6px 2px;font-weight:600">${esc(nom)}</div>`
      : `<label><input type="checkbox" value="${esc(val)}" ${choisis.has(val) ? "checked" : ""}>
      <span>${esc(nom)}</span><span class="n">${n}</span></label>`).join("")}
    <button class="btn link small" data-vider style="margin:6px 6px 2px">Tout effacer</button></div>`;
  el.querySelectorAll("input").forEach(cb => cb.onchange = () => {
    cb.checked ? choisis.add(cb.value) : choisis.delete(cb.value);
    maj();
  });
  el.querySelector("[data-vider]").onclick = () => { choisis.clear(); maj(); };
  return el;
}

const compter = (cle, val) => state.offres.filter(o => o[cle] === val).length;

export function initControles() {
  const el = document.getElementById("filtres");
  // Les menus restent ouverts pendant qu'on coche : on mémorise lequel est ouvert entre deux rendus
  let ouvert = null;
  document.addEventListener("click", e => {
    if (!e.target.closest("details.ms")) { ouvert = null; el.querySelectorAll("details.ms").forEach(d => d.open = false); }
  });

  function rendre() {
    const recherche = el.querySelector("input[type=search]");
    const focus = document.activeElement === recherche, curseur = recherche?.selectionStart;
    el.innerHTML = "";

    const q = document.createElement("input");
    q.type = "search";
    q.placeholder = "Mot-clé ou entreprise : Michelin, méthodes, Python, Lyon…";
    q.setAttribute("aria-label", "Rechercher une offre");
    q.value = state.filtres.q;
    q.oninput = () => { state.filtres.q = q.value; maj(); };
    el.append(q);
    if (focus) { q.focus(); q.setSelectionRange(curseur, curseur); }

    const regions = [...new Set(state.offres.map(o => o.region))].sort((a, b) => nomRegion(a).localeCompare(nomRegion(b), "fr"));
    // Thèmes regroupés par filière ; si des filières sont choisies, seuls leurs thèmes sont proposés
    const filieres = state.meta.filieres.filter(f => !state.filtres.filieres.size || state.filtres.filieres.has(f.id));
    const themes = filieres.flatMap(f => [[null, f.nom], ...state.meta.themes.filter(t => t.filiere === f.id).map(t => [t.id, t.nom, compter("theme", t.id)])]);
    const menus = [
      multiSelect("Filière", "filieres", state.meta.filieres.map(f => [f.id, f.nom, compter("filiere", f.id)])),
      multiSelect("Thème", "themes", themes),
      multiSelect("Entreprise", "categories", CATEGORIES.map(c => [c, c, compter("categorie", c)])),
      multiSelect("Télétravail", "teletravail", TELETRAVAIL.map(t => [t, t, compter("teletravail", t)])),
      multiSelect("Région", "regions", regions.map(r => [r, nomRegion(r), compter("region", r)])),
    ];
    menus.forEach((m, i) => {
      m.open = ouvert === i;
      m.addEventListener("toggle", () => { if (m.open) { ouvert = i; menus.forEach((x, j) => j !== i && (x.open = false)); } });
      el.append(m);
    });

    const slider = document.createElement("label");
    slider.className = "slider";
    slider.innerHTML = `Score ≥ <input type="range" min="0" max="100" step="1" value="${state.filtres.scoreMin}" aria-label="Score d'attractivité minimum"><b>${state.filtres.scoreMin}</b>`;
    const range = slider.querySelector("input");
    range.oninput = () => { slider.querySelector("b").textContent = range.value; };
    range.onchange = () => { state.filtres.scoreMin = +range.value; maj(); };
    el.append(slider);

    const sw = document.createElement("div");
    sw.className = "switch";
    sw.setAttribute("role", "group");
    sw.setAttribute("aria-label", "Mode de salaire");
    for (const [m, nom, aide] of [["brut", "Salaire brut", "Salaire brut mensuel facial"],
      ["pa", "Pouvoir d'achat", "Salaire brut moins le loyer d'un studio de 25 m² dans la commune"]]) {
      const b = document.createElement("button");
      b.textContent = nom; b.title = aide;
      b.setAttribute("aria-pressed", state.mode === m);
      b.onclick = () => maj({ mode: m });
      sw.append(b);
    }
    el.append(sw);

    const actifs = state.filtres.q || state.filtres.scoreMin || FILTRES_LISTES.some(k => state.filtres[k].size);
    if (actifs) {
      const r = document.createElement("button");
      r.className = "btn link";
      r.textContent = "Réinitialiser";
      r.onclick = () => {
        state.filtres.q = ""; state.filtres.scoreMin = 0;
        FILTRES_LISTES.forEach(k => state.filtres[k].clear());
        maj({ zone: null });
      };
      el.append(r);
    }

    const a = document.createElement("a");
    a.className = "btn";
    a.href = `${DEPOT}/actions/workflows/mise-a-jour-donnees.yml`;
    a.target = "_blank"; a.rel = "noopener";
    a.textContent = "↻ Actualiser via l'API";
    a.title = "Les données sont actualisées chaque jour par une Action GitHub (clé d'API stockée en secret) ; ce lien permet de la relancer.";
    el.append(a);
  }
  return rendre;
}
