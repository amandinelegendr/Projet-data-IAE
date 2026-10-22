// Moteur statistique : statistiques descriptives, lois de probabilité et tests d'hypothèses.
// Tout est recalculé à partir des tableaux de valeurs passés en argument (aucun résultat précalculé).

// ---------------------------------------------------------------------------------------------
// Statistiques descriptives
// ---------------------------------------------------------------------------------------------

const somme = xs => xs.reduce((s, x) => s + x, 0);
export const mean = xs => somme(xs) / xs.length;

/** Variance d'échantillon (dénominateur n - 1). */
export function variance(xs) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return somme(xs.map(x => (x - m) ** 2)) / (xs.length - 1);
}
export const sd = xs => Math.sqrt(variance(xs));

/** Quantile par interpolation linéaire (méthode 7, celle de R et d'Excel). */
export function quantile(xs, p) {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const h = (s.length - 1) * p, lo = Math.floor(h);
  return s[lo] + (h - lo) * ((s[Math.min(lo + 1, s.length - 1)]) - s[lo]);
}
export const median = xs => quantile(xs, 0.5);

/** Mode : valeur(s) la (les) plus fréquente(s). */
export function mode(xs) {
  const effectifs = new Map();
  for (const x of xs) effectifs.set(x, (effectifs.get(x) ?? 0) + 1);
  const max = Math.max(...effectifs.values());
  return { valeurs: [...effectifs].filter(([, n]) => n === max).map(([v]) => v).sort((a, b) => a - b), effectif: max };
}

/** Résumé descriptif complet d'une variable quantitative. */
export function describe(xs) {
  const n = xs.length;
  if (!n) return { n: 0 };
  const m = mean(xs), s = sd(xs);
  // Asymétrie et aplatissement d'échantillon ajustés (formules de Fisher, comme Excel / SPSS)
  const m2 = somme(xs.map(x => (x - m) ** 2)) / n;
  const m3 = somme(xs.map(x => (x - m) ** 3)) / n;
  const m4 = somme(xs.map(x => (x - m) ** 4)) / n;
  const g1 = m3 / m2 ** 1.5, g2 = m4 / m2 ** 2 - 3;
  const skewness = n > 2 ? Math.sqrt(n * (n - 1)) / (n - 2) * g1 : NaN;
  const kurtosis = n > 3 ? ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * g2 + 6) : NaN;
  const q1 = quantile(xs, 0.25), q3 = quantile(xs, 0.75);
  return {
    n, mean: m, median: median(xs), mode: mode(xs), variance: variance(xs), sd: s,
    min: Math.min(...xs), max: Math.max(...xs), q1, q3, iqr: q3 - q1,
    d1: quantile(xs, 0.1), d9: quantile(xs, 0.9),
    cv: s / m, skewness, kurtosis,
    seSkew: n > 2 ? Math.sqrt(6 * n * (n - 1) / ((n - 2) * (n + 1) * (n + 3))) : NaN,
  };
}

// ---------------------------------------------------------------------------------------------
// Fonctions spéciales et lois
// ---------------------------------------------------------------------------------------------

/** log Γ(x), approximation de Lanczos (précision ~1e-15). */
export function logGamma(x) {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Fonction bêta incomplète régularisée I_x(a, b), par fraction continue (Numerical Recipes). */
export function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betaCF(x, a, b) / a : 1 - bt * betaCF(1 - x, b, a) / b;
}
function betaCF(x, a, b) {
  const MAXIT = 300, EPS = 3e-16, FPMIN = 1e-300;
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Fonction gamma incomplète régularisée inférieure P(a, x). */
export function gammaP(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 1000; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  return 1 - gammaQcf(a, x);
}
function gammaQcf(a, x) {
  const FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Densité de la loi normale N(μ, σ²) : f(x) = 1/(σ√(2π)) · exp(−½((x−μ)/σ)²). */
export const normalPdf = (x, mu, sigma) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

/** Fonction de répartition de la loi normale centrée réduite Φ(z) = ½·erfc(−z/√2). */
export function normalCdf(z) {
  const x = z / Math.SQRT2, q = 1 - gammaP(0.5, x * x); // erfc(|x|) = Q(½, x²)
  return x >= 0 ? 1 - 0.5 * q : 0.5 * q;
}

/** P(|T| ≥ |t|) pour une loi de Student à df degrés de liberté. */
export const studentTwoSidedP = (t, df) => incompleteBeta(df / (df + t * t), df / 2, 0.5);

/** P(F ≥ f) pour une loi de Fisher-Snedecor F(d1, d2). */
export const fisherUpperP = (f, d1, d2) => (f <= 0 ? 1 : incompleteBeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2));

/** P(χ² ≥ x) pour une loi du khi-deux à k degrés de liberté. */
export const chi2UpperP = (x, k) => (x <= 0 ? 1 : 1 - gammaP(k / 2, x / 2));

// ---------------------------------------------------------------------------------------------
// Loi de l'étendue studentisée (pour le test de Tukey-Kramer) — portage de ptukey() de R (nmath)
// ---------------------------------------------------------------------------------------------

function wprob(w, rr, cc) {
  const nleg = 12, ihalf = 6, C1 = -30, C2 = -50, C3 = 60, bb = 8, wlar = 3, wincr1 = 2, wincr2 = 3;
  const xleg = [0.981560634246719250690549090149, 0.904117256370474856678465866119, 0.769902674194304687036893833213,
    0.587317954286617447296702418941, 0.367831498998180193752691536644, 0.125233408511468915472441369464];
  const aleg = [0.047175336386511827194615961485, 0.106939325995318430960254718194, 0.160078328543346226334652529543,
    0.203167426723065921749064455810, 0.233492536538354808760849898925, 0.249147045813402785000562436043];
  const qsqz = w * 0.5;
  if (qsqz >= bb) return 1;
  let prW = 2 * normalCdf(qsqz) - 1;
  prW = prW >= Math.exp(C2 / cc) ? prW ** cc : 0;
  const wincr = w > wlar ? wincr1 : wincr2;
  let blb = qsqz;
  const binc = (bb - qsqz) / wincr;
  let bub = blb + binc, einsum = 0;
  const cc1 = cc - 1;
  for (let wi = 1; wi <= wincr; wi++) {
    let elsum = 0;
    const a = 0.5 * (bub + blb), b = 0.5 * (bub - blb);
    for (let jj = 1; jj <= nleg; jj++) {
      let j, xx;
      if (ihalf < jj) { j = nleg - jj + 1; xx = xleg[j - 1]; } else { j = jj; xx = -xleg[j - 1]; }
      const ac = a + b * xx, qexpo = ac * ac;
      if (qexpo > C3) break;
      const pplus = 2 * normalCdf(ac), pminus = 2 * normalCdf(ac - w);
      let rinsum = pplus * 0.5 - pminus * 0.5;
      if (rinsum >= Math.exp(C1 / cc1)) elsum += aleg[j - 1] * Math.exp(-0.5 * qexpo) * rinsum ** cc1;
    }
    einsum += elsum * (2 * b * cc) / Math.sqrt(2 * Math.PI);
    blb = bub; bub += binc;
  }
  prW += einsum;
  if (prW <= Math.exp(C1 / rr)) return 0;
  prW = prW ** rr;
  return Math.min(prW, 1);
}

/** P(Q ≤ q) pour l'étendue studentisée de k moyennes à df degrés de liberté. */
export function ptukey(q, k, df, rr = 1) {
  if (q <= 0) return 0;
  if (!Number.isFinite(q)) return 1;
  if (df > 25000) return wprob(q, rr, k);
  const nlegq = 16, ihalfq = 8, eps1 = -30, eps2 = 1e-14;
  const xlegq = [0.989400934991649932596154173450, 0.944575023073232576077988415535, 0.865631202387831743880467897712,
    0.755404408355003033895101194847, 0.617876244402643748446671764049, 0.458016777657227386342419442984,
    0.281603550779258913230460501460, 0.950125098376374401853193354250e-1];
  const alegq = [0.271524594117540948517805724560e-1, 0.622535239386478928628438369944e-1, 0.951585116824927848099251076022e-1,
    0.124628971255533872052476282192, 0.149595988816576732081501730547, 0.169156519395002538189312079030,
    0.182603415044923588866763667969, 0.189450610455068496285396723208];
  const f2 = df * 0.5;
  let f2lf = f2 * Math.log(df) - df * Math.LN2 - logGamma(f2);
  const f21 = f2 - 1, ff4 = df * 0.25;
  const ulen = df <= 100 ? 1 : df <= 800 ? 0.5 : df <= 5000 ? 0.25 : 0.125;
  f2lf += Math.log(ulen);
  let ans = 0, otsum = 0;
  for (let i = 1; i <= 50; i++) {
    otsum = 0;
    const twa1 = (2 * i - 1) * ulen;
    for (let jj = 1; jj <= nlegq; jj++) {
      let j, t1;
      if (ihalfq < jj) {
        j = jj - ihalfq - 1;
        t1 = f2lf + f21 * Math.log(twa1 + xlegq[j] * ulen) - (xlegq[j] * ulen + twa1) * ff4;
      } else {
        j = jj - 1;
        t1 = f2lf + f21 * Math.log(twa1 - xlegq[j] * ulen) + (xlegq[j] * ulen - twa1) * ff4;
      }
      if (t1 >= eps1) {
        const qsqz = ihalfq < jj ? q * Math.sqrt((xlegq[j] * ulen + twa1) * 0.5) : q * Math.sqrt((-(xlegq[j] * ulen) + twa1) * 0.5);
        otsum += wprob(qsqz, rr, k) * alegq[j] * Math.exp(t1);
      }
    }
    if (i * ulen >= 1 && otsum <= eps2) break;
    ans += otsum;
  }
  return Math.min(ans, 1);
}

// ---------------------------------------------------------------------------------------------
// Tests d'hypothèses
// ---------------------------------------------------------------------------------------------

/** Intervalle de confiance à 95 % de la moyenne (approximation normale x̄ ± 1,96·s/√n). */
export function ci95(xs) {
  const m = mean(xs), e = 1.96 * sd(xs) / Math.sqrt(xs.length);
  return [m - e, m + e];
}

/** Test t de Welch (variances inégales) pour comparer deux moyennes, avec le d de Cohen. */
export function welchTest(a, b) {
  const n1 = a.length, n2 = b.length;
  if (n1 < 2 || n2 < 2) return null;
  const m1 = mean(a), m2 = mean(b), v1 = variance(a), v2 = variance(b);
  const se2 = v1 / n1 + v2 / n2;
  const t = (m1 - m2) / Math.sqrt(se2);
  const df = se2 ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1)); // Welch-Satterthwaite
  const sPool = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  return {
    n1, n2, m1, m2, s1: Math.sqrt(v1), s2: Math.sqrt(v2), diff: m1 - m2,
    t, df, p: se2 === 0 ? (m1 === m2 ? 1 : 0) : studentTwoSidedP(t, df),
    d: sPool ? (m1 - m2) / sPool : 0, ci1: ci95(a), ci2: ci95(b),
  };
}

/** ANOVA à un facteur. groups : [{ nom, valeurs }]. */
export function anova(groups) {
  const g = groups.filter(x => x.valeurs.length > 0);
  const tous = g.flatMap(x => x.valeurs), N = tous.length, k = g.length;
  if (k < 2 || N <= k) return null;
  const mg = mean(tous);
  const sce = somme(g.map(x => x.valeurs.length * (mean(x.valeurs) - mg) ** 2)); // inter-groupes
  const scr = somme(g.map(x => { const m = mean(x.valeurs); return somme(x.valeurs.map(v => (v - m) ** 2)); })); // intra
  const sct = somme(tous.map(v => (v - mg) ** 2));
  const ddl1 = k - 1, ddl2 = N - k, cm1 = sce / ddl1, cm2 = scr / ddl2;
  const F = cm2 === 0 ? (cm1 === 0 ? 0 : Infinity) : cm1 / cm2;
  return {
    k, N, moyenneGenerale: mg, sce, scr, sct, ddl1, ddl2, ddlT: N - 1, cm1, cm2, F,
    p: Number.isFinite(F) ? fisherUpperP(F, ddl1, ddl2) : 0, eta2: sct ? sce / sct : 0,
    groupes: g.map(x => ({ nom: x.nom, n: x.valeurs.length, ...describe(x.valeurs) })),
  };
}

/** Test post-hoc de Tukey-Kramer : toutes les paires de groupes après une ANOVA. */
export function tukeyKramer(res) {
  const paires = [];
  const gs = res.groupes;
  for (let i = 0; i < gs.length; i++) {
    for (let j = i + 1; j < gs.length; j++) {
      const a = gs[i], b = gs[j];
      const se = Math.sqrt(res.cm2 / 2 * (1 / a.n + 1 / b.n));
      const diff = a.mean - b.mean;
      const q = se ? Math.abs(diff) / se : 0;
      paires.push({ a: a.nom, b: b.nom, diff, q, p: se ? 1 - ptukey(q, res.k, res.ddl2) : 1 });
    }
  }
  return paires.sort((x, y) => x.p - y.p || Math.abs(y.diff) - Math.abs(x.diff));
}

/** Test du khi-deux d'indépendance sur un tableau de contingence (lignes × colonnes). */
export function chi2Independence(table) {
  const L = table.length, C = table[0].length;
  const totL = table.map(r => somme(r)), totC = table[0].map((_, j) => somme(table.map(r => r[j])));
  const N = somme(totL);
  const attendus = table.map((r, i) => r.map((_, j) => totL[i] * totC[j] / N));
  const contributions = table.map((r, i) => r.map((o, j) => (attendus[i][j] ? (o - attendus[i][j]) ** 2 / attendus[i][j] : 0)));
  const chi2 = somme(contributions.flat());
  const ddl = (L - 1) * (C - 1);
  return {
    observes: table, attendus, contributions, totL, totC, N, chi2, ddl,
    p: ddl > 0 ? chi2UpperP(chi2, ddl) : 1,
    vCramer: Math.sqrt(chi2 / (N * Math.max(1, Math.min(L - 1, C - 1)))),
    partAttendusFaibles: attendus.flat().filter(e => e < 5).length / (L * C),
  };
}

/** Corrélation linéaire de Pearson, droite des moindres carrés y = a·x + b et test de nullité de r. */
export function pearson(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2;
  }
  if (!sxx || !syy) return { n, r: 0, r2: 0, a: 0, b: my, t: 0, df: n - 2, p: 1 };
  const r = sxy / Math.sqrt(sxx * syy), a = sxy / sxx;
  const t = Math.abs(r) === 1 ? Infinity : r * Math.sqrt((n - 2) / (1 - r * r));
  return { n, r, r2: r * r, a, b: my - a * mx, t, df: n - 2, p: Number.isFinite(t) ? studentTwoSidedP(t, n - 2) : 0 };
}
