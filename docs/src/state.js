// État partagé de l'application : données, filtres, zone sélectionnée. Chaque changement redessine les vues abonnées.

export const state = {
  offres: [],
  meta: null,
  filtres: { q: "", themes: new Set(), categories: new Set(), teletravail: new Set(), regions: new Set(), scoreMin: 0 },
  mode: "brut", // "brut" : salaire brut facial ; "pa" : reste à vivre après loyer d'un studio
  zone: null, // { type: "region" | "departement" | "ville" | "bassin", code, nom }
  tri: "score",
};

const abonnes = [];
export const abonner = f => abonnes.push(f);
export function maj(changements = {}) {
  Object.assign(state, changements);
  for (const f of abonnes) f();
}

export const CATEGORIES = ["CAC 40", "Grand Groupe", "ETI / PME"];
export const TELETRAVAIL = ["Hybride", "Télétravail complet", "Présentiel", "Non précisé"];
export const avecTeletravail = o => o.teletravail === "Hybride" || o.teletravail === "Télétravail complet";

export const nomTheme = id => state.meta.themes.find(t => t.id === id)?.nom ?? id;
export const nomRegion = code => state.meta.regions[code] ?? code;

/** Variables quantitatives proposées dans les vues et le laboratoire. */
export const VARIABLES = {
  salaire: { nom: "Salaire brut mensuel", court: "Salaire", unite: "€", d: 0, get: o => o.salaire_brut_mensuel },
  pa: { nom: "Reste à vivre après loyer d'un studio", court: "Pouvoir d'achat", unite: "€", d: 0, get: o => o.pouvoir_achat_ajuste },
  score: { nom: "Indice d'attractivité", court: "Score", unite: "/100", d: 1, get: o => o.score_attractivite },
};
/** Salaire selon le mode choisi dans l'en-tête (brut facial ou ajusté au coût du logement). */
export const salaire = o => (state.mode === "pa" ? o.pouvoir_achat_ajuste : o.salaire_brut_mensuel);
export const nomSalaire = () => (state.mode === "pa" ? "Reste à vivre" : "Salaire brut");

export function offresFiltrees() {
  const f = state.filtres, q = f.q.trim().toLowerCase();
  return state.offres.filter(o =>
    (!f.themes.size || f.themes.has(o.theme)) &&
    (!f.categories.size || f.categories.has(o.categorie)) &&
    (!f.teletravail.size || f.teletravail.has(o.teletravail)) &&
    (!f.regions.size || f.regions.has(o.region)) &&
    o.score_attractivite >= f.scoreMin &&
    (!q || [o.titre, o.entreprise, o.ville, o.convention, o.naf, ...(o.competences || [])].join(" ").toLowerCase().includes(q)));
}

export function dansZone(o, zone = state.zone) {
  if (!zone) return true;
  return { region: o.region, departement: o.departement, bassin: o.bassin, ville: `${o.departement}|${o.ville}` }[zone.type] === zone.code;
}
export const offresZone = () => offresFiltrees().filter(o => dansZone(o));
