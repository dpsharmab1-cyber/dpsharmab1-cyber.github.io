// Google Fonts on demand, with the weights each family really ships
// (asking Google for a missing weight fails the whole request).

const R = (a, b) => { const o = []; for (let w = a; w <= b; w += 100) o.push(w); return o; };

export const WEIGHTS = {
  'Inter': R(100, 900), 'Roboto': R(100, 900), 'Poppins': R(100, 900), 'Montserrat': R(100, 900),
  'Open Sans': R(300, 800), 'Lato': [100, 300, 400, 700, 900], 'DM Sans': R(100, 900), 'Manrope': R(200, 800),
  'Plus Jakarta Sans': R(200, 800), 'Space Grotesk': R(300, 700), 'Outfit': R(100, 900), 'Sora': R(100, 800),
  'Figtree': R(300, 900), 'Work Sans': R(100, 900), 'Rubik': R(300, 900), 'Nunito': R(200, 900),
  'Raleway': R(100, 900), 'Karla': R(200, 800), 'Archivo': R(100, 900), 'Syne': R(400, 800),
  'IBM Plex Sans': R(100, 700), 'Playfair Display': R(400, 900), 'DM Serif Display': [400],
  'Fraunces': R(100, 900), 'Lora': R(400, 700), 'Merriweather': R(300, 900), 'Bebas Neue': [400],
  'Oswald': R(200, 700), 'JetBrains Mono': R(100, 800), 'IBM Plex Mono': R(100, 700),
};

export const WEIGHT_NAMES = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };

export function nearestWeight(family, w) {
  const list = WEIGHTS[family] || [400, 700];
  return list.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a), list[0]);
}

export function fontURL(family, weights, italic = false) {
  const ws = [...new Set(weights.map((w) => nearestWeight(family, w)))].sort((a, b) => a - b);
  const fam = family.replace(/ /g, '+');
  const spec = italic ? 'ital,wght@' + [...ws.map((w) => `0,${w}`), ...ws.map((w) => `1,${w}`)].join(';') : 'wght@' + ws.join(';');
  return `https://fonts.googleapis.com/css2?family=${fam}:${spec}&display=swap`;
}

const loaded = new Set();
export function ensureFont(family, weight = 400, italic = false) {
  if (!family || !WEIGHTS[family]) return;
  const w = nearestWeight(family, weight);
  // the upright file always; italic separately, since not every family has it
  for (const it of italic ? [false, true] : [false]) {
    const key = `${family}|${w}|${it ? 1 : 0}`;
    if (loaded.has(key)) continue;
    loaded.add(key);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = it ? fontURL(family, [w], true).replace(/ital,wght@0,\d+;/, 'ital,wght@') : fontURL(family, [w]);
    document.head.appendChild(link);
  }
}
