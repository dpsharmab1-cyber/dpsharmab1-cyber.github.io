// Terms / Privacy / Refund / Contact pages: fill in business details from config.js.
import { hydrateIcons } from './icons.js';
import { BUSINESS } from './config.js';

const LABELS = {
  legalName: 'legal business name', email: 'support email', phone: 'phone number', address: 'postal address',
  city: 'city for jurisdiction', gstin: 'GSTIN', grievanceOfficer: 'grievance officer name', hours: 'support hours', effectiveDate: 'effective date',
};

let missing = 0;
document.querySelectorAll('[data-biz]').forEach((el) => {
  const key = el.dataset.biz, val = (BUSINESS[key] || '').trim();
  if (val) el.textContent = val;
  else { el.textContent = `[${LABELS[key] || key}]`; el.classList.add('todo'); missing++; }
});

// email links
const email = (BUSINESS.email || '').trim();
document.querySelectorAll('[data-biz-mail]').forEach((a) => {
  if (email) { a.href = `mailto:${email}`; a.textContent = email; }
  else { a.textContent = '[support email]'; a.classList.add('todo'); a.removeAttribute('href'); missing++; }
});

// GSTIN is optional: hide the line when it isn't set
if (!(BUSINESS.gstin || '').trim()) document.querySelectorAll('[data-gstin-row]').forEach((n) => n.remove());

// a visible reminder for the site owner while details are missing
if (missing) {
  const n = document.createElement('div');
  n.className = 'todo-banner';
  n.innerHTML = '<b>Draft:</b> some business details are missing. Fill in <code>BUSINESS</code> in <code>assets/config.js</code> before applying for live payments.';
  document.querySelector('.legal-hero .wrap')?.appendChild(n);
}

// contact form opens the visitor's email app with the message filled in
const form = document.getElementById('contactForm');
if (form) {
  if (!email) form.querySelector('button[type=submit]').disabled = true;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const subject = `[Pack Studio] ${f.get('topic')}`;
    const body = `${f.get('message')}\n\n— ${f.get('name')} (${f.get('email')})`;
    form.dataset.mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    location.href = form.dataset.mailto;
  });
}

hydrateIcons();

// mobile menu (same as the home page)
const menu = document.getElementById('menuBtn'), links = document.querySelector('.links');
menu?.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});
