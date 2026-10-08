// Account button, sign-in, My projects, Save/autosave and Upgrade dialogs.

import { CONFIG, PLANS } from '../../assets/config.js';
import { icon } from '../../assets/icons.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function setupAccount({ cloud, snapshot, restore, toast, templateName }) {
  let current = { id: null, name: 'Untitled pack' };
  let dirty = false, saving = false, timer = 0;

  // ---------- dialogs ----------
  const dlg = (id) => {
    let d = document.getElementById(id);
    if (!d) {
      d = document.createElement('dialog');
      d.id = id;
      d.className = 'dlg';
      d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
      document.body.appendChild(d);
    }
    return d;
  };
  const head = (title, sub = '') => `<header class="dlg-head"><div><h2>${title}</h2>${sub ? `<p class="muted">${sub}</p>` : ''}</div><button type="button" class="dlg-x" data-close aria-label="Close">${icon('x')}</button></header>`;

  // ---------- plan gating ----------
  const plan = () => cloud.plan;
  const can = () => CONFIG.betaAllFree || plan() !== 'free';

  // ---------- header button ----------
  function renderAccountButton() {
    const b = $('#accountBtn');
    if (cloud.user) {
      const p = plan();
      b.innerHTML = `<span class="avatar">${esc(cloud.user.email?.[0]?.toUpperCase() || '?')}</span><span class="plan-chip ${p}">${p === 'free' ? 'Free' : p === 'pro' ? 'Pro' : 'Business'}</span>`;
      b.title = cloud.user.email;
    } else {
      b.innerHTML = `${icon('circle-user')}<span>Sign in</span>`;
      b.title = cloud.mode === 'cloud' ? 'Sign in' : 'Accounts';
    }
  }

  // ---------- sign in ----------
  function openAuth(reason = '') {
    const d = dlg('dlgAuth');
    if (cloud.mode !== 'cloud') {
      d.innerHTML = `${head('Accounts are coming soon')}
        <div class="dlg-body"><p>Until accounts switch on, your projects are saved <b>in this browser</b>. Use <b>Save</b> and they will be here in <b>Projects</b> next time you visit on this device.</p>
        <p class="muted small">Clearing your browser data removes them, so download the PDF or SVG for anything important.</p></div>
        <footer class="dlg-foot"><button type="button" class="btn-primary" data-close>Got it</button></footer>`;
      d.showModal();
      return;
    }
    d.innerHTML = `${head('Sign in to Pack Studio', reason || 'Save projects to your account and open them on any device.')}
      <form class="dlg-body auth" id="authForm">
        <label class="field"><span>Email</span><input type="email" name="email" required autocomplete="email" placeholder="you@brand.com"></label>
        <button type="submit" class="btn-primary wide">${icon('mail')} Email me a sign-in link</button>
        <div class="or"><span>or</span></div>
        <button type="button" class="btn-line wide" id="googleBtn"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg> Continue with Google</button>
        <p class="muted small">No password needed. By signing in you agree to keep your designs your own; we never share them.</p>
      </form>`;
    $('#authForm', d).addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = new FormData(e.target).get('email');
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await cloud.signInWithEmail(email);
        $('.dlg-body', d).innerHTML = `<div class="sent">${icon('mail', 'big')}<h3>Check your inbox</h3><p>We sent a sign-in link to <b>${esc(email)}</b>. Open it on this device to finish signing in.</p></div>`;
      } catch (err) {
        toast('Could not send the link: ' + (err.message || err));
        btn.disabled = false;
      }
    });
    $('#googleBtn', d).addEventListener('click', () => cloud.signInWithGoogle().catch((err) => toast('Google sign-in failed: ' + err.message)));
    d.showModal();
  }

  function openAccount() {
    if (!cloud.user) return openAuth();
    const d = dlg('dlgAccount'), p = plan();
    const until = cloud.profile?.plan_until && p !== 'free' ? new Date(cloud.profile.plan_until).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    d.innerHTML = `${head('Your account')}
      <div class="dlg-body">
        <div class="acct-row"><span class="avatar big">${esc(cloud.user.email?.[0]?.toUpperCase())}</span><div><b>${esc(cloud.user.email)}</b><p class="muted small">Projects save to this account</p></div></div>
        <div class="plan-box ${p}"><div><span class="eyebrow">Current plan</span><h3>${p === 'free' ? 'Free' : p === 'pro' ? 'Pro' : 'Business'}</h3>${until ? `<p class="muted small">Active until ${until}</p>` : `<p class="muted small">${CONFIG.betaAllFree ? 'Everything is unlocked during the beta.' : `Up to ${CONFIG.freeCloudProjects} saved projects.`}</p>`}</div>
        <button type="button" class="btn-gold" id="acctUpgrade">${icon('crown')} ${p === 'free' ? 'Upgrade' : 'Extend'}</button></div>
      </div>
      <footer class="dlg-foot"><button type="button" class="btn-line" id="signOut">${icon('log-out')} Sign out</button><button type="button" class="btn-primary" data-close>Done</button></footer>`;
    $('#acctUpgrade', d).addEventListener('click', () => { d.close(); openUpgrade(); });
    $('#signOut', d).addEventListener('click', async () => { await cloud.signOut(); d.close(); toast('Signed out. New saves stay in this browser.'); });
    d.showModal();
  }

  // ---------- upgrade ----------
  function openUpgrade(reason = '', highlight = 'pro_month') {
    const d = dlg('dlgUpgrade');
    const live = cloud.mode === 'cloud';
    const note = !live
      ? 'Payments open soon. Everything is free while we are in beta.'
      : CONFIG.betaAllFree ? 'Everything is unlocked during the beta. Subscribing now locks in the launch price and supports the project.' : '';
    d.innerHTML = `${head('Upgrade Pack Studio', reason || 'Pay securely with UPI, cards or netbanking through Razorpay.')}
      <div class="dlg-body">
        ${note ? `<p class="notice">${icon('sparkles')} ${note}</p>` : ''}
        <div class="plan-grid">${PLANS.map((pl) => `
          <div class="plan-card ${pl.id === highlight ? 'hl' : ''}">
            <b>${pl.name}</b><p class="price">${pl.price}<small>/${pl.per}</small></p><p class="muted small">${pl.note}</p>
            <button type="button" class="${pl.id === highlight ? 'btn-gold' : 'btn-line'} wide" data-plan="${pl.id}" ${live ? '' : 'disabled'}>${live ? `${icon('credit-card')} Pay ${pl.price}` : 'Opens soon'}</button>
          </div>`).join('')}</div>
        <ul class="perks"><li>${icon('check')} Unlimited saved projects</li><li>${icon('check')} HD renders and GLB without watermark</li><li>${icon('check')} DXF for cutting tables, commercial use</li></ul>
      </div>`;
    d.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', async () => {
      if (!cloud.user) { d.close(); openAuth('Sign in first, then choose your plan.'); return; }
      b.disabled = true;
      try {
        const prof = await cloud.checkout(b.dataset.plan);
        d.close();
        toast(`Payment received. You're on ${prof.plan === 'business' ? 'Business' : 'Pro'} until ${new Date(prof.plan_until).toLocaleDateString()}.`);
      } catch (err) {
        if (err.message !== 'dismissed') toast(err.message === 'checkout_unavailable' ? 'Could not load the payment window. Check your connection.' : 'Payment did not complete: ' + err.message);
        b.disabled = false;
      }
    }));
    d.showModal();
  }

  // ---------- projects ----------
  async function openProjects() {
    const d = dlg('dlgProjects');
    const where = cloud.where;
    d.innerHTML = `${head('My projects', where === 'cloud' ? `Saved to ${esc(cloud.user.email)}` : 'Saved in this browser')}
      <div class="dlg-body"><div class="proj-tools"><button type="button" class="btn-primary" id="newProj">${icon('file-plus')} New project</button><span id="uploadSlot"></span></div>
      <div class="proj-grid" id="projGrid"><p class="muted">Loading…</p></div></div>`;
    d.showModal();
    $('#newProj', d).addEventListener('click', () => { location.href = location.pathname; });
    if (where === 'cloud' && cloud.listLocal) {
      const local = await cloud.listLocal();
      if (local.length) {
        $('#uploadSlot', d).innerHTML = `<button type="button" class="btn-line" id="upLocal">${icon('upload')} Move ${local.length} from this browser to my account</button>`;
        $('#upLocal', d).addEventListener('click', async () => {
          try { const n = await cloud.uploadLocal(); toast(`Moved ${n} project${n === 1 ? '' : 's'} to your account.`); openProjects(); }
          catch (err) { if (err.message === 'free_limit') { d.close(); openUpgrade(`Free accounts keep ${CONFIG.freeCloudProjects} projects.`); } else toast(err.message); }
        });
      }
    }
    let list;
    try { list = await cloud.listProjects(); } catch (err) { $('#projGrid', d).innerHTML = `<p class="muted">Could not load projects: ${esc(err.message)}</p>`; return; }
    const grid = $('#projGrid', d);
    if (!list.length) {
      grid.innerHTML = `<div class="empty-state">${icon('folder-open', 'big')}<h3>No saved projects yet</h3><p class="muted">Press <b>Save</b> (or Ctrl+S) in the studio and your pack will appear here.</p></div>`;
      return;
    }
    grid.innerHTML = list.map((p) => `
      <article class="proj ${p.id === current.id ? 'open' : ''}" data-id="${esc(p.id)}">
        <button type="button" class="proj-open" data-act="open">${p.thumb ? `<img src="${esc(p.thumb)}" alt="">` : `<span class="noimg">${icon('box')}</span>`}</button>
        <div class="proj-meta"><b title="${esc(p.name)}">${esc(p.name)}</b><small>${esc(templateName(p.template))} · ${new Date(p.updated_at).toLocaleDateString()}</small></div>
        <div class="proj-acts">
          <button type="button" data-act="rename" title="Rename">${icon('pencil')}</button>
          <button type="button" data-act="dup" title="Duplicate">${icon('copy')}</button>
          <button type="button" data-act="del" title="Delete" class="danger">${icon('trash-2')}</button>
        </div>
      </article>`).join('');
    grid.onclick = async (e) => {
      const b = e.target.closest('[data-act]'), card = e.target.closest('.proj');
      if (!b || !card) return;
      const id = card.dataset.id, meta = list.find((x) => String(x.id) === id);
      try {
        if (b.dataset.act === 'open') { await openProject(id); d.close(); }
        if (b.dataset.act === 'rename') {
          const name = prompt('Rename project', meta.name);
          if (!name) return;
          const full = await cloud.getProject(id);
          await cloud.saveProject({ ...full, name: name.slice(0, 120) });
          if (current.id === id) setName(name);
          openProjects();
        }
        if (b.dataset.act === 'dup') {
          const full = await cloud.getProject(id);
          await cloud.saveProject({ ...full, id: null, created_at: undefined, name: (full.name + ' copy').slice(0, 120) });
          openProjects();
        }
        if (b.dataset.act === 'del') {
          if (!confirm(`Delete “${meta.name}”? This cannot be undone.`)) return;
          await cloud.deleteProject(id);
          if (current.id === id) { current.id = null; setStatus('Not saved'); setUrl(null); }
          openProjects();
        }
      } catch (err) {
        if (err.message === 'free_limit') { d.close(); openUpgrade(`Free accounts keep ${CONFIG.freeCloudProjects} projects.`); }
        else toast(err.message || String(err));
      }
    };
  }

  async function openProject(id) {
    const p = await cloud.getProject(id);
    if (!p) { toast('That project could not be found.'); return; }
    await restore(p.state);
    current = { id: p.id, name: p.name };
    setName(p.name);
    dirty = false;
    setStatus('Saved');
    setUrl(p.id);
  }

  // ---------- save ----------
  function setStatus(t) { $('#saveStatus').textContent = t; $('#saveBtn').classList.toggle('pending', t !== 'Saved'); }
  function setName(n) { current.name = n; $('#docName').value = n; }
  function setUrl(id) {
    const u = new URL(location.href);
    if (id) u.searchParams.set('project', id); else u.searchParams.delete('project');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }

  async function save({ quiet = false } = {}) {
    if (saving) return;
    saving = true;
    clearTimeout(timer);
    setStatus('Saving…');
    try {
      const snap = await snapshot();
      const row = await cloud.saveProject({ id: current.id, name: current.name || 'Untitled pack', ...snap });
      current.id = row.id;
      dirty = false;
      setStatus('Saved');
      setUrl(row.id);
      if (!quiet) toast(cloud.where === 'cloud' ? 'Saved to your account.' : 'Saved in this browser. Sign in to keep it on every device.');
    } catch (err) {
      setStatus('Not saved');
      if (err.message === 'free_limit') openUpgrade(`Free accounts keep ${CONFIG.freeCloudProjects} projects. Upgrade to save more.`);
      else if (/quota|QuotaExceeded/i.test(err.message || err.name)) toast('This browser is out of storage space. Remove old projects or sign in.');
      else toast('Could not save: ' + (err.message || err));
    } finally {
      saving = false;
    }
  }

  function markDirty() {
    dirty = true;
    if (!current.id) { setStatus('Not saved'); return; }
    setStatus('Unsaved changes');
    clearTimeout(timer);
    timer = setTimeout(() => save({ quiet: true }), 2500); // autosave once a project exists
  }

  // ---------- wiring ----------
  $('#accountBtn').addEventListener('click', () => (cloud.user ? openAccount() : openAuth()));
  $('#projectsBtn').addEventListener('click', openProjects);
  $('#saveBtn').addEventListener('click', () => save());
  $('#docName').addEventListener('change', (e) => { setName(e.target.value.trim().slice(0, 120) || 'Untitled pack'); markDirty(); });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });
  window.addEventListener('beforeunload', (e) => { if (dirty && current.id) { e.preventDefault(); e.returnValue = ''; } });
  cloud.onChange(() => renderAccountButton());
  renderAccountButton();
  setStatus('Not saved');

  // deep links: ?project=, ?signin=1, ?upgrade=pro_month
  const q = new URLSearchParams(location.search);
  if (q.get('project')) openProject(q.get('project')).catch(() => toast('Could not open that project. Sign in with the account that saved it.'));
  if (q.has('signin')) openAuth();
  if (q.get('upgrade')) openUpgrade('', PLANS.some((p) => p.id === q.get('upgrade')) ? q.get('upgrade') : 'pro_month');
  if (q.has('signin') || q.has('upgrade')) {
    q.delete('signin'); q.delete('upgrade');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
  }

  return { save, markDirty, can, openUpgrade, openAuth };
}
