/* Simplified flag SVGs (30x20) for the 12 interface languages. */
(function () {
  const star = (cx, cy, r, rot = -90) => {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const a = (rot + i * 36) * Math.PI / 180, rr = i % 2 ? r * 0.4 : r;
      p.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2));
    }
    return `<polygon points="${p.join(' ')}"`;
  };
  const wrap = (inner) => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true" focusable="false"><clipPath id="fc"><rect width="30" height="20" rx="2"/></clipPath><g clip-path="url(#fc)">${inner}</g><rect x=".25" y=".25" width="29.5" height="19.5" rx="2" fill="none" stroke="rgba(0,0,0,.18)" stroke-width=".5"/></svg>`;
  const tri = (x, y, rot) => {
    // a trigram block (three bars) rotated around (x, y)
    let s = `<g transform="translate(${x} ${y}) rotate(${rot})" fill="#111">`;
    for (let i = 0; i < 3; i++) s += `<rect x="-1.8" y="${-1.6 + i * 1.15}" width="3.6" height=".7"/>`;
    return s + '</g>';
  };
  let us = '<rect width="30" height="20" fill="#fff"/>';
  for (let i = 0; i < 7; i++) us += `<rect y="${i * 20 / 6.5}" width="30" height="${20 / 13}" fill="#B22234"/>`;
  us += '<rect width="13" height="10.8" fill="#3C3B6E"/>';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) us += `<circle cx="${1.5 + c * 2.5 + (r % 2) * 1.2}" cy="${1.4 + r * 2.6}" r=".45" fill="#fff"/>`;

  window.ATLAS_FLAGS = {
    ko: wrap('<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="4.6" fill="#0047A0"/><path d="M10.4 10a4.6 4.6 0 0 1 9.2 0 2.3 2.3 0 0 1-4.6 0 2.3 2.3 0 0 0-4.6 0z" fill="#CD2E3A"/>' +
      tri(7.6, 5.1, -56) + tri(22.4, 14.9, -56) + tri(22.4, 5.1, 56) + tri(7.6, 14.9, 56)),
    en: wrap(us),
    es: wrap('<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>'),
    zh: wrap('<rect width="30" height="20" fill="#DE2910"/>' + star(5.5, 5.5, 3) + ' fill="#FFDE00"/>' +
      star(10, 2.2, 1, -60) + ' fill="#FFDE00"/>' + star(12, 4.2, 1, -40) + ' fill="#FFDE00"/>' +
      star(12, 7.2, 1, -90) + ' fill="#FFDE00"/>' + star(10, 9.2, 1, -70) + ' fill="#FFDE00"/>'),
    ja: wrap('<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>'),
    fr: wrap('<rect width="10" height="20" fill="#0055A4"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#EF4135"/>'),
    de: wrap('<rect width="30" height="7" fill="#000"/><rect y="6.66" width="30" height="6.7" fill="#DD0000"/><rect y="13.33" width="30" height="6.7" fill="#FFCE00"/>'),
    pt: wrap('<rect width="30" height="20" fill="#009C3B"/><polygon points="15,2.4 27.4,10 15,17.6 2.6,10" fill="#FFDF00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/><path d="M10.8 9.2c3-1 6.2-.6 8.8.9" stroke="#fff" stroke-width=".7" fill="none"/>'),
    ru: wrap('<rect width="30" height="7" fill="#fff"/><rect y="6.66" width="30" height="6.7" fill="#0039A6"/><rect y="13.33" width="30" height="6.7" fill="#D52B1E"/>'),
    ar: wrap('<rect width="30" height="20" fill="#006C35"/><path d="M8 7.2c1.4.9 2.4-.6 3.6.3s2.4-.8 3.6.1 2.4-.7 3.6.2 2.2-.6 3.2.1" stroke="#fff" stroke-width=".9" fill="none"/><path d="M8.5 12.6h12.6l1.4-.7" stroke="#fff" stroke-width=".8" fill="none"/>'),
    hi: wrap('<rect width="30" height="7" fill="#FF9933"/><rect y="6.66" width="30" height="6.7" fill="#fff"/><rect y="13.33" width="30" height="6.7" fill="#138808"/><circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width=".55"/><circle cx="15" cy="10" r=".5" fill="#000080"/>'),
    it: wrap('<rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#CE2B37"/>'),
  };
  window.ATLAS_LANGS = [
    ['ko', '한국어'], ['en', 'English'], ['es', 'Español'], ['zh', '简体中文'], ['ja', '日本語'], ['fr', 'Français'],
    ['de', 'Deutsch'], ['pt', 'Português'], ['ru', 'Русский'], ['ar', 'العربية'], ['hi', 'हिन्दी'], ['it', 'Italiano'],
  ];
})();
