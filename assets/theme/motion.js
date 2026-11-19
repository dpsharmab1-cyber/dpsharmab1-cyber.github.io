// Red Planet · motion helpers (no libraries). The site itself uses GSAP for
// the same moves; this file is for the asset page and any plain page.
//   reveal()        adds .is-in to [data-rp] and .rp-mask once in view
//   splitMask(el)   wraps each letter of a headline for the mask rise
//   corridor(box)   lays .rp-card slabs out as the mockup's 3D corridor
//   tilt(el)        a card leans toward the pointer
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function reveal(root = document) {
  const els = root.querySelectorAll('[data-rp], .rp-mask');
  if (reduced || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -12% 0px' });
  els.forEach((e) => io.observe(e));
}

export function splitMask(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text].map((c, i) => c === ' ' ? ' ' : `<span class="rp-mask" aria-hidden="true"><span style="--i:${i}">${c}</span></span>`).join('');
}

// the corridor: slabs left of the middle face right, slabs right face left;
// the nearer the middle, the more edge-on (as in "Content and cards")
export function corridor(box, { gap = 0.115, edge = 62, open = 26 } = {}) {
  const cards = [...box.querySelectorAll('.rp-card')];
  const n = cards.length, mid = (n - 1) / 2;
  let c = mid;
  const place = () => {
    const W = box.clientWidth;
    cards.forEach((el, i) => {
      const o = i - c, a = Math.min(1, Math.abs(o) / (mid + 0.5));
      const ry = -Math.sign(o) * (edge - (edge - open) * a);
      const x = W / 2 + o * W * gap - el.offsetWidth / 2;
      el.style.transform = `translateX(${x.toFixed(1)}px) rotateY(${ry.toFixed(1)}deg)`;
      el.style.zIndex = String(100 - Math.round(Math.abs(o) * 10));
      el.classList.toggle('is-right', o > 0);   // the red spine sits on the near edge
    });
  };
  place();
  addEventListener('resize', place);
  if (!reduced) {
    let goal = c;
    box.addEventListener('pointermove', (e) => { const r = box.getBoundingClientRect(); goal = mid + ((e.clientX - r.left) / r.width - 0.5) * 1.6; });
    box.addEventListener('pointerleave', () => { goal = mid; });
    const tick = () => { c += (goal - c) * 0.08; place(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
}

export function tilt(el, max = 8) {
  if (reduced) return;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${(x * max).toFixed(2)}deg) rotateX(${(-y * max).toFixed(2)}deg)`;
  });
  el.addEventListener('pointerleave', () => { el.style.transform = ''; });
}
