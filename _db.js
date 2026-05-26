/* ============================================================
   ELESIC 2026 — Integración Supabase
   Guarda respuestas por evento y resultados finales.
   Requiere: _config.js cargado antes, Supabase CDN cargado antes.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Validar config ---------- */
  const CFG = window.ELESIC_CONFIG || {};
  const configured = CFG.url && CFG.url !== 'TU_SUPABASE_URL_AQUI'
                  && CFG.key && CFG.key !== 'TU_SUPABASE_ANON_KEY_AQUI';

  if (!configured) {
    console.warn('[ELESIC DB] _config.js no configurado — modo sin base de datos.');
  }

  const supabaseLib = window.supabase;
  if (configured && !supabaseLib) {
    console.error('[ELESIC DB] Supabase CDN no cargó.');
  }

  const db = (configured && supabaseLib)
    ? supabaseLib.createClient(CFG.url, CFG.key)
    : null;

  const SID = window.ELESIC_SCENARIO_ID || 'EX';
  const STORAGE_KEY = 'elesic_' + SID;

  let session = null;
  try { session = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) {}

  /* ============================================================
     ESTILOS DEL MODAL DE EQUIPO
     ============================================================ */
  const MODAL_CSS = `
    #edb-overlay{position:fixed;inset:0;background:rgba(7,20,44,.82);backdrop-filter:blur(6px);
      z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;
      animation:edbFade .2s ease}
    @keyframes edbFade{from{opacity:0}to{opacity:1}}
    #edb-box{background:#fff;border-radius:18px;max-width:440px;width:100%;
      box-shadow:0 28px 64px rgba(0,0,0,.45);overflow:hidden;
      animation:edbPop .25s cubic-bezier(.16,1,.3,1)}
    @keyframes edbPop{from{transform:scale(.94) translateY(12px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
    #edb-head{background:linear-gradient(100deg,#071e44,#13407e);
      padding:20px 24px;border-bottom:3px solid #c8a13a}
    #edb-head h2{font-family:'Oswald',sans-serif;font-size:19px;font-weight:700;color:#fff;margin:0 0 3px}
    #edb-head p{font-size:13px;color:#8fb8d8;margin:0;font-family:'Barlow',sans-serif}
    #edb-body{padding:24px}
    .edb-field{margin-bottom:18px}
    .edb-field label{display:block;font-family:'Oswald',sans-serif;font-size:12px;
      font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#41597a;margin-bottom:6px}
    .edb-field select,.edb-field input{width:100%;border:1.5px solid #d4e0ee;border-radius:10px;
      padding:11px 14px;font-size:15px;font-family:'Barlow',sans-serif;color:#15233a;
      background:#fafcff;transition:border-color .15s,box-shadow .15s;outline:none}
    .edb-field select:focus,.edb-field input:focus{border-color:#2e63a8;
      box-shadow:0 0 0 3px rgba(46,99,168,.12)}
    #edb-btn{width:100%;background:linear-gradient(100deg,#0a2a5e,#2e63a8);color:#fff;
      font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;letter-spacing:.8px;
      text-transform:uppercase;border:none;border-radius:10px;padding:13px;cursor:pointer;
      transition:filter .15s,transform .1s;margin-top:4px}
    #edb-btn:hover{filter:brightness(1.12)}
    #edb-btn:active{transform:translateY(1px)}
    #edb-btn:disabled{background:#c3ccd8;cursor:not-allowed}
    #edb-note{font-size:12px;color:#7a8ea8;text-align:center;margin-top:12px;
      font-family:'Barlow',sans-serif;line-height:1.5}
    /* Badge flotante */
    #edb-badge{position:fixed;bottom:18px;left:18px;z-index:500;
      display:flex;align-items:center;gap:8px;background:#fff;
      border:1px solid #d4e0ee;border-radius:22px;padding:6px 12px 6px 8px;
      box-shadow:0 4px 16px rgba(10,42,94,.14);font-family:'Barlow Condensed',sans-serif;
      font-size:13px;font-weight:600;letter-spacing:.5px;color:#15233a;cursor:pointer;
      transition:box-shadow .15s,transform .15s;user-select:none}
    #edb-badge:hover{box-shadow:0 6px 20px rgba(10,42,94,.2);transform:translateY(-1px)}
    #edb-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
    #edb-dot.ok{background:#1a6b42;box-shadow:0 0 0 3px rgba(26,107,66,.18)}
    #edb-dot.err{background:#a32030;box-shadow:0 0 0 3px rgba(163,32,48,.18)}
    #edb-dot.wait{background:#b07918;animation:edbBlink .9s infinite}
    @keyframes edbBlink{0%,100%{opacity:1}50%{opacity:.35}}
    #edb-saving{position:fixed;top:80px;right:18px;z-index:500;background:#071e44;color:#fff;
      font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:.8px;
      padding:7px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.12);
      opacity:0;transition:opacity .3s;pointer-events:none}
    #edb-saving.show{opacity:1}
  `;

  /* ---------- Inyectar estilos ---------- */
  const style = document.createElement('style');
  style.textContent = MODAL_CSS;
  document.head.appendChild(style);

  /* ---------- Toast de guardado ---------- */
  let savingEl = null;
  let savingTimer = null;
  function flashSaved(txt) {
    if (!savingEl) {
      savingEl = document.createElement('div');
      savingEl.id = 'edb-saving';
      document.body.appendChild(savingEl);
    }
    savingEl.textContent = txt || '✓ Guardado';
    savingEl.classList.add('show');
    clearTimeout(savingTimer);
    savingTimer = setTimeout(() => savingEl.classList.remove('show'), 2200);
  }

  /* ---------- Badge de equipo ---------- */
  let badgeEl = null;
  function showTeamBadge() {
    if (badgeEl) return;
    badgeEl = document.createElement('div');
    badgeEl.id = 'edb-badge';
    badgeEl.title = 'Haz clic para cambiar equipo';
    badgeEl.onclick = () => { if (confirm('¿Cambiar de equipo? Se perderá la sesión actual.')) resetSession(); };
    badgeEl.innerHTML = `<div id="edb-dot" class="${db ? 'ok' : 'err'}"></div><span id="edb-team-lbl">${session?.equipo || '?'} · ${SID}</span>`;
    document.body.appendChild(badgeEl);
  }

  function setDotStatus(state) {
    const dot = document.getElementById('edb-dot');
    if (!dot) return;
    dot.className = '';
    dot.classList.add(state); // 'ok' | 'err' | 'wait'
  }

  /* ---------- Modal de selección de equipo ---------- */
  function buildModal() {
    const overlay = document.createElement('div');
    overlay.id = 'edb-overlay';
    overlay.innerHTML = `
      <div id="edb-box" role="dialog" aria-modal="true" aria-labelledby="edb-title">
        <div id="edb-head">
          <h2 id="edb-title">Identificación del Equipo</h2>
          <p>ELESIC 2026 · Escenario ${SID} — Antes de comenzar, registra tu equipo.</p>
        </div>
        <div id="edb-body">
          <div class="edb-field">
            <label for="edb-equipo">Equipo <span style="color:#b3303f">*</span></label>
            <select id="edb-equipo">
              <option value="" disabled selected>Selecciona tu equipo…</option>
              <option value="ALFA">ALFA</option>
              <option value="BETA">BETA</option>
              <option value="GAMA">GAMA</option>
              <option value="DELTA">DELTA</option>
            </select>
          </div>
          <div class="edb-field">
            <label for="edb-instructor">Instructor / Observador (opcional)</label>
            <input id="edb-instructor" type="text" placeholder="Nombre del instructor…" maxlength="80">
          </div>
          <button id="edb-btn" disabled>Comenzar ejercicio</button>
          <p id="edb-note">${db ? 'Las respuestas se guardarán automáticamente en Supabase.' : '⚠️ Base de datos no configurada — modo sin conexión.'}</p>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const sel = document.getElementById('edb-equipo');
    const btn = document.getElementById('edb-btn');
    sel.addEventListener('change', () => { btn.disabled = !sel.value; });
    btn.addEventListener('click', async () => {
      const equipo = sel.value;
      if (!equipo) return;
      const instructor = (document.getElementById('edb-instructor').value || '').trim();
      btn.disabled = true;
      btn.textContent = 'Iniciando…';
      await startSession(equipo, instructor);
      overlay.remove();
      showTeamBadge();
    });
  }

  async function startSession(equipo, instructor) {
    if (db) {
      setDotStatus('wait');
      const { data, error } = await db
        .from('sesiones')
        .insert({ equipo, escenario: SID, instructor: instructor || null })
        .select()
        .single();
      if (!error && data) {
        session = { sesionId: data.id, equipo, instructor };
        setDotStatus('ok');
      } else {
        console.error('[ELESIC DB] Error creando sesión:', error?.message);
        session = { sesionId: null, equipo, instructor };
        setDotStatus('err');
      }
    } else {
      session = { sesionId: null, equipo, instructor };
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (_) {}
  }

  function resetSession() {
    localStorage.removeItem(STORAGE_KEY);
    session = null;
    if (badgeEl) { badgeEl.remove(); badgeEl = null; }
    buildModal();
  }

  /* ============================================================
     GUARDAR RESPUESTA DE EVENTO
     ============================================================ */
  async function afterScore(idx) {
    if (!session) return;

    const events  = window.ELESIC_EVENTS_REF?.() || [];
    const stateArr = window.ELESIC_STATE_REF?.()  || [];
    const ev = events[idx];
    const st = stateArr[idx];
    const r  = st?.result;
    if (!ev || !r) return;

    const payload = {
      sesion_id:               session.sesionId,
      equipo:                  session.equipo,
      escenario:               SID,
      evento_codigo:           ev.code || ev.id || ('E' + (idx + 1)),
      evento_titulo:           ev.title || '',
      opciones_seleccionadas:  st.selected || [],
      justificacion:           (st.justify || '').slice(0, 5000),
      puntaje_total:           r.total   || 0,
      puntaje_pct:             r.pct     || 0,
      nivel:                   r.level   || '',
      bloom_nivel:             r.bloomLevel  || '',
      bloom_pct:               r.bloomPct    || 0,
      kohlberg_etapa:          r.kohlStage?.st || '',
      kohlberg_pct:            r.kohlPct  || 0,
      palabras_justificacion:  r.words    || 0
    };

    if (!session.sesionId || !db) {
      _storePending({ type: 'respuesta', payload });
      return;
    }

    setDotStatus('wait');
    const { error } = await db
      .from('respuestas')
      .upsert(payload, { onConflict: 'sesion_id,evento_codigo' });

    if (error) {
      console.error('[ELESIC DB] Error guardando respuesta:', error.message);
      setDotStatus('err');
      _storePending({ type: 'respuesta', payload });
    } else {
      setDotStatus('ok');
      flashSaved('✓ Respuesta guardada');
    }
  }

  /* ============================================================
     GUARDAR RESULTADO FINAL INTEGRAL
     ============================================================ */
  async function afterIntegral() {
    if (!session?.sesionId || !db) return;

    const stateArr = window.ELESIC_STATE_REF?.() || [];
    const n = stateArr.length;
    if (!n) return;

    let perfSum = 0, bloomPtsSum = 0, kohlPtsSum = 0, count = 0;
    stateArr.forEach(s => {
      const r = s.result;
      if (!r) return;
      perfSum     += (r.pct      || 0);
      bloomPtsSum += (r.bloomPts || 0);
      kohlPtsSum  += (r.kohlPts  || 0);
      count++;
    });
    if (!count) return;

    const perfPct  = perfSum / count;
    const bloomPct = (bloomPtsSum / count) / 150 * 100;
    const kohlPct  = kohlPtsSum / 180 * 100;
    const integrado = perfPct * 0.40 + bloomPct * 0.35 + kohlPct * 0.25;
    const banda = integrado >= 90 ? 'A' : integrado >= 75 ? 'B' : integrado >= 60 ? 'C' : 'D';

    const round1 = v => Math.round(v * 10) / 10;

    setDotStatus('wait');
    const { error } = await db
      .from('resultados_finales')
      .upsert({
        sesion_id:     session.sesionId,
        equipo:        session.equipo,
        escenario:     SID,
        desempeno_pct: round1(perfPct),
        bloom_pct:     round1(bloomPct),
        kohlberg_pct:  round1(kohlPct),
        integrado_pct: round1(integrado),
        banda
      }, { onConflict: 'sesion_id' });

    if (error) {
      console.error('[ELESIC DB] Error guardando resultado final:', error.message);
      setDotStatus('err');
    } else {
      setDotStatus('ok');
      flashSaved('✓ Resultado final guardado');
    }
  }

  /* ---------- Almacén offline ---------- */
  function _storePending(item) {
    try {
      const key = 'elesic_pending_' + SID;
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({ ...item, ts: Date.now() });
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (_) {}
  }

  /* ---------- Exponer API global ---------- */
  window.elesicDB = { afterScore, afterIntegral, db, getSession: () => session };

  /* ---------- Init ---------- */
  if (!session) {
    buildModal();
  } else {
    showTeamBadge();
  }

})();
