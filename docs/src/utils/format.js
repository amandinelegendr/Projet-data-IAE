// Mise en forme des nombres (conventions françaises) et petits utilitaires d'affichage

const nf = (d = 0) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

export const num = (x, d = 0) => (Number.isFinite(x) ? nf(d).format(x) : "–");
export const eur = (x, d = 0) => (Number.isFinite(x) ? `${num(x, d)} €` : "–");
export const pct = (x, d = 1) => (Number.isFinite(x) ? `${num(x * 100, d)} %` : "–");
export const signe = (x, d = 0, unite = "") => (Number.isFinite(x) ? `${x > 0 ? "+" : x < 0 ? "−" : "±"}${num(Math.abs(x), d)}${unite}` : "–");

/** p-value lisible : « < 0,001 » en dessous du millième. */
export const pval = p => (!Number.isFinite(p) ? "–" : p < 0.001 ? "< 0,001" : num(p, p < 0.01 ? 4 : 3));

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const cssVar = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/** Rend les formules $…$ et $$…$$ d'un élément avec KaTeX, si la bibliothèque est chargée. */
export function maths(el) {
  if (window.renderMathInElement) {
    window.renderMathInElement(el, {
      delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
      throwOnError: false,
    });
  }
}

/** Échelle verbale d'une taille d'effet. */
export function intensite(valeur, seuils, mots = ["négligeable", "faible", "moyen", "fort"]) {
  const v = Math.abs(valeur);
  const i = seuils.findIndex(s => v < s);
  return mots[i === -1 ? mots.length - 1 : i];
}
