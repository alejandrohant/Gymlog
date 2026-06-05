const LOCAL_USER = { id: 'local', email: 'local@forja' };
let currentUser = LOCAL_USER;
let currentSession = null;
let timerInterval = null;
let timerEndTime = null;
let timerPausedRemainingMs = null;
let audioCtx = null;
let localSessionsCache = getSessionsLocal ? getSessionsLocal() : [];
let historyFilter = 'all';
let profileProgressPanel = '';
let editingSessionKey = null;

let __forjaLongPressTimer = null;
window.__forjaLongPressDone = false;
function forjaStartLongPress(event, index) {
  window.__forjaLongPressDone = false;
  clearTimeout(__forjaLongPressTimer);
  __forjaLongPressTimer = setTimeout(() => {
    window.__forjaLongPressDone = true;
    openSessionActions(index);
  }, 560);
}
function forjaEndLongPress() {
  clearTimeout(__forjaLongPressTimer);
  __forjaLongPressTimer = null;
}


// =====================
// DATA
// =====================
const DEFAULT_ROUTINES = [
  { id: 'push_a', name: 'Push A', day: 'Martes', emoji: '💥', desc: 'Pecho Superior + Hombros', exercises: [
    { name: 'Press de Banca Inclinado (Mancuerna)', sets: 4 },
    { name: 'Press de Hombros Sentado (Barra)', sets: 3, note: 'Incluir 45 lbs de barra' },
    { name: 'Elevacion Laterales (Mancuerna)', sets: 4 },
    { name: 'Tríceps con Polea', sets: 3 },
  ]},
  { id: 'pull_a', name: 'Pull A', day: 'Miércoles', emoji: '⚡', desc: 'Espalda + Bíceps', exercises: [
    { name: 'Jalón al Pecho (Cable)', sets: 4 },
    { name: 'Remo Inclinado (Barra)', sets: 4, note: 'Incluir 45 lbs de barra' },
    { name: 'Tirón a la Cara', sets: 4 },
    { name: 'Curl de Bíceps (Barra)', sets: 3, note: 'Incluir 45 lbs de barra' },
  ]},
  { id: 'legs_a', name: 'Legs A', day: 'Jueves', emoji: '🦵', desc: 'Cuádriceps + Gemelos', exercises: [
    { name: 'Sentadilla Hack (Máquina)', sets: 4 },
    { name: 'Peso Muerto Rumano (Barra)', sets: 4, note: 'Incluir 45 lbs de barra' },
    { name: 'Extensión de Pierna', sets: 3 },
    { name: 'Elevación de Gemelos Sentado', sets: 4 },
  ]},
  { id: 'push_b', name: 'Push B', day: 'Viernes', emoji: '🔥', desc: 'Pecho Completo + Hombros', exercises: [
    { name: 'Press de Banca (Barra)', sets: 4, note: 'Incluir 45 lbs de barra' },
    { name: 'Aperturas (Máquina)', sets: 3 },
    { name: 'Elevacion Laterales (Mancuerna)', sets: 4 },
    { name: 'Press de Hombros (Mancuerna)', sets: 3 },
    { name: 'Fondo de Tríceps', sets: 3, bodyweight: true },
  ]},
  { id: 'pull_b', name: 'Pull B + Hombros', day: 'Sábado', emoji: '💪', desc: 'Espalda + Especialización Hombros', exercises: [
    { name: 'Jalón al Pecho - Agarre Cerrado (Cable)', sets: 4 },
    { name: 'Remo Sentado con Agarre en V (Cable)', sets: 4 },
    { name: 'Vuelos invertidos para deltoides posteriores (mancuerna)', sets: 4 },
    { name: 'Elevacion Laterales (Mancuerna)', sets: 5 },
    { name: 'Curl Martillo (Mancuerna)', sets: 3 },
  ]},
  { id: 'legs_b', name: 'Legs B', day: 'Domingo', emoji: '🏋️', desc: 'Isquios/Glúteos + Gemelos', exercises: [
    { name: 'Sentadilla Búlgara', sets: 3 },
    { name: 'Press de Piernas', sets: 4 },
    { name: 'Curl de Pierna Sentado', sets: 4 },
    { name: 'Extensión de Pierna', sets: 3 },
    { name: 'Elevación de Gemelos de Pie (Máquina)', sets: 5 },
  ]},
];

let ROUTINES = getRoutinesLocal();
let routinesLocalLoaded = true;
let routinesLocalSaveTimer = null;
let routinesLocalSaveBusy = false;


function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function readSavedRoutinesLocalOnly() {
  try {
    const savedRaw = localStorage.getItem('forja_routines') || localStorage.getItem('gymlog_routines');
    const saved = JSON.parse(savedRaw || 'null');
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (e) {
    console.warn('readSavedRoutinesLocalOnly', e);
  }
  return null;
}

function getRoutinesLocal() {
  return cloneData(readSavedRoutinesLocalOnly() || DEFAULT_ROUTINES);
}

function cacheRoutinesLocal() {
  localStorage.setItem('forja_routines', JSON.stringify(ROUTINES));
}

function saveRoutinesLocal() {
  cacheRoutinesLocal();
}


function routineToLocalRow(routine, index) {
  return {
    user_id: currentUser.id,
    id: String(routine.id || `rutina_${index + 1}`),
    name: routine.name || 'Rutina',
    day: routine.day || '',
    emoji: routine.emoji || '🏋️',
    description: routine.desc || '',
    exercises: Array.isArray(routine.exercises) ? routine.exercises : [],
    sort_order: index,
    source: routine.source || 'custom',
    updated_at: new Date().toISOString()
  };
}

function localRowToRoutine(row) {
  return {
    id: row.id,
    name: row.name || 'Rutina',
    day: row.day || '',
    emoji: row.emoji || '🏋️',
    desc: row.description || '',
    exercises: Array.isArray(row.exercises) ? row.exercises : []
  };
}

async function loadLocalRoutines(bootstrapIfEmpty = true) {
  ROUTINES = getRoutinesLocal();
  routinesLocalLoaded = true;
  return ROUTINES;
}


async function saveAllRoutinesLocal() {
  cacheRoutinesLocal();
  routinesLocalLoaded = true;
  return true;
}


function queueRoutinesLocalSave() {
  cacheRoutinesLocal();
}


async function replaceLocalRoutines() {
  cacheRoutinesLocal();
  routinesLocalLoaded = true;
  return true;
}


async function ensureRoutinesReady(force = false) {
  if (!Array.isArray(ROUTINES) || !ROUTINES.length || force) ROUTINES = getRoutinesLocal();
  routinesLocalLoaded = true;
  return ROUTINES;
}


async function resetRoutinesToDefault() {
  if (!confirm('¿Restaurar la rutina base? Se perderán los cambios hechos a las rutinas.')) return;
  ROUTINES = cloneData(DEFAULT_ROUTINES);
  cacheRoutinesLocal();
  renderHome();
  showToast('✅ Rutina base restaurada');
}


function getTodayRoutine() {
  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const todayIndex = new Date().getDay();
  const today = days[todayIndex];

  const exactRoutine = ROUTINES.find(r => normalizeText(r.day) === normalizeText(today));
  if (exactRoutine) return exactRoutine;

  for (let offset = 1; offset <= 7; offset++) {
    const nextDay = days[(todayIndex + offset) % 7];
    const nextRoutine = ROUTINES.find(r => normalizeText(r.day) === normalizeText(nextDay));
    if (nextRoutine) return nextRoutine;
  }

  return ROUTINES[0] || null;
}

function getRoutineById(routineId) {
  return ROUTINES.find(r => r.id === routineId) || null;
}

function getValidSets(sets) {
  return (sets || []).filter(s => {
    const weight = parseFloat(s.weight);
    const reps = parseFloat(s.reps);
    return (s.done || s.weight || s.reps) && !Number.isNaN(weight) && !Number.isNaN(reps) && reps > 0;
  });
}

function getTotalReps(sets) {
  return getValidSets(sets).reduce((sum, s) => sum + (parseFloat(s.reps) || 0), 0);
}

function getVolume(sets) {
  return getValidSets(sets).reduce((sum, s) => sum + ((parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0)), 0);
}

function getBestSet(sets) {
  const valid = getValidSets(sets);
  if (!valid.length) return null;
  return valid.reduce((best, s) => {
    const score = (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0);
    const bestScore = (parseFloat(best.weight) || 0) * (parseFloat(best.reps) || 0);
    return score > bestScore ? s : best;
  }, valid[0]);
}

function getExerciseInsight(lastEx, currentEx) {
  if (!lastEx) {
    return `
      <div class="analysis-box">
        <div class="analysis-title">Objetivo de hoy</div>
        <div class="analysis-text">Primer registro de este ejercicio. Usa un peso controlable, deja 1–2 repeticiones en reserva y guarda datos limpios.</div>
      </div>
    `;
  }

  const lastSets = getValidSets(lastEx.sets);
  if (!lastSets.length) {
    return `
      <div class="analysis-box">
        <div class="analysis-title">Objetivo de hoy</div>
        <div class="analysis-text">La sesión anterior no tiene series completas confiables. Registra peso y repeticiones reales antes de buscar subir carga.</div>
      </div>
    `;
  }

  const lastReps = getTotalReps(lastEx.sets);
  const lastVolume = Math.round(getVolume(lastEx.sets));
  const best = getBestSet(lastEx.sets);
  const bestText = best ? `${best.weight} lb × ${best.reps}` : 'sin mejor serie';

  const validWeights = lastSets
    .map(s => parseFloat(s.weight))
    .filter(w => !Number.isNaN(w) && w > 0);

  const mainWeight = validWeights.length
    ? validWeights.sort((a, b) => b - a)[0]
    : null;

  const repsList = lastSets
    .map(s => parseInt(s.reps, 10))
    .filter(r => !Number.isNaN(r) && r > 0);

  const minReps = repsList.length ? Math.min(...repsList) : 0;
  const maxReps = repsList.length ? Math.max(...repsList) : 0;
  const targetReps = lastReps + 1;

  let decision = '';
  let nextTarget = '';

  if (mainWeight && minReps >= 12 && lastSets.length >= 3) {
    decision = `Puedes considerar subir ligeramente la carga la próxima vez.`;
    nextTarget = `Hoy confirma control técnico con ${mainWeight} lb o sube solo si no pierdes rango ni estabilidad.`;
  } else if (mainWeight && maxReps < 8) {
    decision = `No conviene subir peso todavía.`;
    nextTarget = `Mantén ${mainWeight} lb y busca sumar repeticiones limpias antes de aumentar carga.`;
  } else if (mainWeight) {
    decision = `Mantén la carga principal y busca progresión por repeticiones.`;
    nextTarget = `Objetivo concreto: mínimo ${targetReps} repeticiones totales con ${mainWeight} lb o una ejecución más limpia.`;
  } else {
    decision = `Prioridad: registrar datos consistentes.`;
    nextTarget = `Repite estructura, anota peso real y busca superar al menos 1 repetición total.`;
  }

  return `
    <div class="analysis-box">
      <div class="analysis-title">Objetivo de hoy</div>
      <div class="analysis-text">
        Anterior: ${lastSets.length} series, ${lastReps} repeticiones totales, ${lastVolume.toLocaleString()} lb de volumen. Mejor serie: ${bestText}.<br>
        ${decision}<br>
        ${nextTarget}
      </div>
    </div>
  `;
}

const CURRENT_SESSION_KEY = 'gymlog_current_session';

function getDraftOwnerId() {
  return currentUser?.id || 'local';
}
function saveCurrentDraft() {
  if (!currentSession) return;

  // Editar un entrenamiento ya guardado no debe crear ni sobrescribir una sesión activa.
  if (editingSessionKey) return;

  try {
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify({
      owner: getDraftOwnerId(),
      savedAt: new Date().toISOString(),
      session: stripRuntimeMeta(currentSession)
    }));
  } catch (e) {
    console.warn('saveCurrentDraft', e);
  }

  // Borrador local: evita tráfico a servidor en cada captura.
}

function getCurrentDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(CURRENT_SESSION_KEY) || 'null');
    if (!draft?.session) return null;
    if (draft.owner && draft.owner !== getDraftOwnerId()) return null;
    return draft.session;
  } catch (e) {
    console.warn('getCurrentDraft', e);
    return null;
  }
}

function getDraftSavedAt() {
  try {
    const draft = JSON.parse(localStorage.getItem(CURRENT_SESSION_KEY) || 'null');
    if (!draft?.savedAt) return '';
    if (draft.owner && draft.owner !== getDraftOwnerId()) return '';
    return draft.savedAt;
  } catch {
    return '';
  }
}

function clearCurrentDraft() {
  localStorage.removeItem(CURRENT_SESSION_KEY);
}

function resumeSavedSession() {
  editingSessionKey = null;
  const draft = currentSession || getCurrentDraft();
  if (!draft) {
    showToast('⚠️ No hay sesión guardada');
    return;
  }
  currentSession = draft;
  currentSessionRevision = 0;
  document.getElementById('sessionTitle').textContent = currentSession.routineName.toUpperCase();
  document.getElementById('sessionDate').innerHTML = `<span class="session-kicker">Sesión en curso</span><div>${formatDateFull(new Date(currentSession.date))}</div>`;
  renderExercises();
  const finishBtn = document.querySelector('.finish-btn');
  finishBtn.textContent = 'TERMINAR SESIÓN';
  finishBtn.onclick = () => finishSession();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('sessionScreen').classList.add('active');
  enterTrainingMode();
}

function discardSavedSession() {
  if (!confirm('¿Descartar la sesión guardada?')) return;
  currentSession = null;
  clearCurrentDraft();
  stopTimer();
  renderHome();
  showToast('🗑️ Sesión descartada');
}

window.addEventListener('beforeunload', () => saveCurrentDraft());

function stripRuntimeMeta(session) {
  if (!session) return session;
  const copy = JSON.parse(JSON.stringify(session));
  delete copy._runtimeId;
  delete copy.routine_name;
  delete copy.routine_id;
  return copy;
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object') return null;
  const source = session.data_json && typeof session.data_json === 'object' ? session.data_json : session;
  if (!source || typeof source !== 'object') return null;
  const copy = JSON.parse(JSON.stringify(source));
  copy.routineName = copy.routineName || copy.routine_name || session.routine_name || copy.name || '';
  copy.routineId = copy.routineId || copy.routine_id || session.routine_id || '';
  copy.date = copy.date || session.date || copy.finishedAt || copy.createdAt || copy.startedAt || '';
  if (!copy.routineName || !copy.date || !Array.isArray(copy.exercises)) return null;
  copy.exercises = copy.exercises.map(ex => ({ ...ex, sets: Array.isArray(ex.sets) ? ex.sets : [] }));
  delete copy._runtimeId;
  delete copy.routine_name;
  delete copy.routine_id;
  return copy;
}

function sessionKey(session) {
  const s = normalizeSession(session);
  return s ? `${s.routineName}__${s.date}` : '';
}

function doneSetsCount(session) {
  const s = normalizeSession(session);
  if (!s) return 0;
  return s.exercises.reduce((acc, ex) => acc + ex.sets.filter(st => st && st.done).length, 0);
}

function getActiveDraftSession() {
  try {
    const raw = JSON.parse(localStorage.getItem(CURRENT_SESSION_KEY) || 'null');
    return normalizeSession(raw?.session || raw);
  } catch {
    return null;
  }
}

function getSessionStatus(session) {
  const s = normalizeSession(session);
  return String(s?.status || s?.sessionStatus || '').toLowerCase();
}

function isActiveLocalSession(session) {
  const s = normalizeSession(session);
  if (!s) return false;
  const status = getSessionStatus(s);
  return s.inProgress === true || s.isActive === true || status === 'active' || status === 'in_progress' || status === 'en_curso';
}

function markActiveSession(session) {
  const clean = stripRuntimeMeta(normalizeSession(session));
  if (!clean) return null;
  clean.status = 'active';
  clean.inProgress = true;
  clean.updatedAt = new Date().toISOString();
  delete clean.finishedAt;
  return clean;
}

function markFinishedSession(session) {
  const clean = stripRuntimeMeta(normalizeSession(session));
  if (!clean) return null;
  clean.status = 'finished';
  clean.inProgress = false;
  clean.finishedAt = clean.finishedAt || new Date().toISOString();
  clean.updatedAt = new Date().toISOString();
  return clean;
}

function isValidHistorySession(session) {
  const s = normalizeSession(session);
  if (!s) return false;
  return doneSetsCount(s) > 0;
}


function scoreSessionForDedupe(session) {
  const s = normalizeSession(session);
  if (!s) return -1;
  const finishedBonus = !isActiveLocalSession(s) ? 1000000 : 0;
  const doneBonus = doneSetsCount(s) * 1000;
  const updated = Date.parse(s.finishedAt || s.updatedAt || s.date || 0) || 0;
  return finishedBonus + doneBonus + updated / 1000000000000;
}


function dedupeSessions(sessions) {
  const map = new Map();
  for (const item of sessions || []) {
    const session = normalizeSession(item);
    if (!session || !isValidHistorySession(session)) continue;
    const key = sessionKey(session);
    if (!key) continue;
    const current = map.get(key);
    if (!current || scoreSessionForDedupe(session) >= scoreSessionForDedupe(current)) {
      map.set(key, session);
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function updateSessionCaches(session) {
  const clean = normalizeSession(session);
  if (!clean) return;

  const existingLocal = getSessionsLocal();
  localSessionsCache = dedupeSessions([
    clean,
    ...(localSessionsCache || []).filter(item => sessionKey(item) !== sessionKey(clean)),
    ...existingLocal.filter(item => sessionKey(item) !== sessionKey(clean))
  ]);
  localSessionsLoaded = true;
  setSessionsLocal(localSessionsCache);
}

function removeSessionFromCaches(session) {
  const key = sessionKey(session);
  if (!key) return;
  localSessionsCache = dedupeSessions((localSessionsCache || []).filter(item => sessionKey(item) !== key));
  setSessionsLocal(getSessionsLocal().filter(item => sessionKey(item) !== key));
}

function readSessionsArrayFromStorageKey(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function setSessionsLocal(sessions) {
  /* Historial local oficial. */
  localStorage.setItem('gymlog_sessions', JSON.stringify(dedupeSessions(sessions).map(stripRuntimeMeta)));
}

function isSameSessionIdentity(a, b) {
  return !!sessionKey(a) && sessionKey(a) === sessionKey(b);
}

function shouldHideFromHistory(session) {
  /* Solo se oculta la sesión activa real de este dispositivo. */
  if (!isActiveLocalSession(session)) return false;
  const live = currentSession || getActiveDraftSession();
  return !!live && isSameSessionIdentity(live, session);
}


function getFinishedSessions() {
  return getSessions();
}


function getLastSession(routineId) {
  const sessions = getFinishedSessions();
  return sessions.find(s => s.routineId === routineId) || null;
}

function getLastExerciseData(routineId, exerciseName) {
  const last = getLastSession(routineId);
  if (!last) return null;
  return last.exercises.find(e => e.name === exerciseName) || null;
}

let currentSessionSaveTimer = null;
let currentSessionLocalSaving = false;
let currentSessionSavePending = false;
let currentSessionRevision = 0;
let localSessionsLoaded = true;
let localHistoryRefreshPromise = null;

function markCurrentSessionChanged() {
  if (!currentSession) return;
  currentSessionRevision += 1;
  currentSession.updatedAt = new Date().toISOString();
}


async function saveSession(session) {
  const cleanSession = markFinishedSession(session);
  if (!cleanSession || doneSetsCount(cleanSession) === 0) {
    showToast('⚠️ No hay series terminadas para guardar');
    return false;
  }
  updateSessionCaches(cleanSession);
  return true;
}


function makeSessionRef(session) {
  return {
    runtimeId: session?._runtimeId || null,
    routineName: session?.routineName || '',
    date: session?.date || ''
  };
}

function sameSessionRef(session, ref) {
  return session && ref && session.routineName === ref.routineName && session.date === ref.date;
}

async function updateSavedSession(originalRef, updatedSession) {
  const cleanSession = markFinishedSession(updatedSession);
  if (!cleanSession || doneSetsCount(cleanSession) === 0) {
    showToast('⚠️ No hay series terminadas para guardar');
    return false;
  }

  const previous = getSessionsLocal().filter(item => !sameSessionRef(item, originalRef));
  setSessionsLocal(dedupeSessions([cleanSession, ...previous]));
  localSessionsCache = getSessionsLocal();
  localSessionsLoaded = true;
  return true;
}


function toDateInputValue(iso) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fromDateInputValue(value, originalIso) {
  const parts = String(value || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return originalIso || new Date().toISOString();
  const old = originalIso ? new Date(originalIso) : new Date();
  const hour = Number.isNaN(old.getHours()) ? 12 : old.getHours();
  const minute = Number.isNaN(old.getMinutes()) ? 0 : old.getMinutes();
  const second = Number.isNaN(old.getSeconds()) ? 0 : old.getSeconds();
  return new Date(parts[0], parts[1] - 1, parts[2], hour, minute, second).toISOString();
}

function getYesterdayInputValue() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateInputValue(d.toISOString());
}

function setCurrentSessionDate(value) {
  if (!currentSession || !value) return;
  currentSession.date = fromDateInputValue(value, currentSession.date);
  markCurrentSessionChanged();
  const label = document.getElementById('sessionDateLabel');
  if (label) label.textContent = formatDateFull(new Date(currentSession.date));
  saveCurrentDraft();
}

async function editSavedSession(index) {
  const session = getSessionByIndex(index);
  if (!session) return;
  if (!currentUser) {
    showScreen('auth');
    showToast('🔒 Inicia sesión primero');
    return;
  }

  const active = isActiveLocalSession(session);
  editingSessionKey = makeSessionRef(session);
  currentSession = cloneData(stripRuntimeMeta(session));
  currentSession._runtimeId = session._runtimeId || null;
  if (active) currentSession = markActiveSession(currentSession);
  currentSessionRevision = 0;
  clearCurrentDraft();
  stopTimer();

  document.getElementById('sessionTitle').textContent = currentSession.routineName.toUpperCase();
  document.getElementById('sessionDate').innerHTML = active ? `
    <span class="session-kicker">Sesión en curso</span>
    <div id="sessionDateLabel">${formatDateFull(new Date(currentSession.date))}</div>
  ` : `
    <span class="session-kicker">Editando sesión guardada</span>
    <div id="sessionDateLabel">${formatDateFull(new Date(currentSession.date))}</div>
    <input type="date" class="form-input" style="margin-top:10px;" value="${toDateInputValue(currentSession.date)}" onchange="setCurrentSessionDate(this.value)">
  `;

  renderExercises();
  const finishBtn = document.querySelector('.finish-btn');
  finishBtn.textContent = active ? 'TERMINAR SESIÓN' : 'GUARDAR CAMBIOS';
  finishBtn.onclick = () => finishSession();

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('sessionScreen').classList.add('active');
  enterTrainingMode();
}

function closeDateEditOverlay() {
  const overlay = document.getElementById('dateEditOverlay');
  if (overlay) overlay.remove();
}

function changeSavedSessionDate(index) {
  const session = getSessionByIndex(index);
  if (!session) return;
  if (!currentUser) {
    showScreen('auth');
    showToast('🔒 Inicia sesión primero');
    return;
  }

  closeDateEditOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'dateEditOverlay';
  overlay.className = 'edit-overlay';
  overlay.innerHTML = `
    <div class="edit-overlay-card">
      <div class="edit-title">Cambiar fecha</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.45;margin-bottom:14px;">
        ${escapeHtml(session.routineName)} · ${formatDateFull(new Date(session.date))}
      </div>

      <label class="form-label">Fecha correcta</label>
      <input id="sessionDateEditInput" type="date" class="form-input" value="${toDateInputValue(session.date)}">

      <div class="mini-actions">
        <button class="mini-btn" onclick="document.getElementById('sessionDateEditInput').value = getYesterdayInputValue();">Ayer</button>
        <button class="mini-btn danger" onclick="closeDateEditOverlay()">Cancelar</button>
        <button class="mini-btn primary" onclick="saveSessionDateChange(${index})">Guardar fecha</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.onclick = event => {
    if (event.target === overlay) closeDateEditOverlay();
  };
}

async function saveSessionDateChange(index) {
  const session = getSessionByIndex(index);
  const input = document.getElementById('sessionDateEditInput');
  if (!session || !input || !input.value) return;

  const updated = cloneData(stripRuntimeMeta(session));
  updated.date = fromDateInputValue(input.value, session.date);

  const ok = await updateSavedSession(makeSessionRef(session), updated);
  if (!ok) return;

  closeDateEditOverlay();
  renderHome();
  renderHistory();
  showToast('✅ Fecha actualizada');
}

function getDefaultProfile() {
  return {
    name: 'Alejandro',
    goal: 'Ganar músculo',
    weight: '73 kg',
    height: '170 cm',
    age: '',
    split: 'PPL',
    note: 'Cuerpo en construcción: progresar en fuerza, masa muscular y técnica con disciplina.',
    photo: ''
  };
}

function getProfileLocal() {
  const defaultProfile = getDefaultProfile();
  try {
    const saved = localStorage.getItem('forja_profile') || localStorage.getItem('gymlog_profile');
    return JSON.parse(saved) || defaultProfile;
  } catch {
    return defaultProfile;
  }
}

function saveProfileLocal(profile) {
  localStorage.setItem('forja_profile', JSON.stringify(profile));
}

async function renderProfile() {
  const profile = getProfileLocal();

  const meta = [
    profile.weight ? `${escapeHtml(profile.weight)} peso` : null,
    profile.height ? `${escapeHtml(profile.height)} estatura` : null,
    profile.age ? `${escapeHtml(profile.age)} edad` : null
  ].filter(Boolean).join(' · ');

  const sessions = getSessions();
  const progressHtml = getProfileProgressHtml(sessions);

  document.getElementById('profileContent').innerHTML = `
    <div class="profile-shell">
      <div class="profile-head">
        <div style="display:flex;gap:14px;align-items:center;min-width:0;">
          <div class="profile-avatar" onclick="document.getElementById('profilePhotoInput').click()">
            ${profile.photo ? `<img src="${profile.photo}" alt="Foto de perfil">` : '👤'}
          </div>
          <div style="min-width:0;">
            <div class="eyebrow">Perfil local</div>
            <div class="profile-name">${escapeHtml(profile.name || 'Sin nombre')}</div>
            <div class="profile-sub">${escapeHtml(profile.goal || 'Sin objetivo definido')}${meta ? ` · ${meta}` : ''}</div>
          </div>
        </div>
        <div class="profile-badge">
          <div class="profile-badge-value">${escapeHtml(profile.split || '--')}</div>
          <div class="profile-badge-label">División</div>
        </div>
      </div>

      <div class="profile-note">
        <div class="profile-note-title">Nota personal</div>
        <div>${escapeHtml(profile.note || 'Sin nota guardada todavía.')}</div>
      </div>

      <div class="profile-progress-shell">
        <div class="profile-progress-title">Panel de progreso</div>
        ${progressHtml}
      </div>

      <div class="profile-actions">
        <button onclick="editProfile()" class="ghost-btn">Editar perfil</button>
      </div>

      <input id="profilePhotoInput" type="file" accept="image/*" style="display:none" onchange="handleProfilePhoto(event)">
    </div>
  `;
}


async function editProfile() {
  let current = getProfileLocal();

  const oldOverlay = document.getElementById('profileEditOverlay');
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'profileEditOverlay';
  overlay.className = 'edit-overlay';
  overlay.innerHTML = `
    <div class="edit-overlay-card">
      <div class="edit-title">Editar perfil</div>

      <label class="form-label">Nombre</label>
      <input id="profileNameInput" class="form-input" value="${escapeHtml(current.name || '')}">

      <label class="form-label">Objetivo</label>
      <input id="profileGoalInput" class="form-input" value="${escapeHtml(current.goal || '')}">

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label class="form-label">Peso</label>
          <input id="profileWeightInput" class="form-input" value="${escapeHtml(current.weight || '')}">
        </div>
        <div>
          <label class="form-label">Estatura</label>
          <input id="profileHeightInput" class="form-input" value="${escapeHtml(current.height || '')}">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label class="form-label">Edad</label>
          <input id="profileAgeInput" class="form-input" value="${escapeHtml(current.age || '')}">
        </div>
        <div>
          <label class="form-label">División</label>
          <input id="profileSplitInput" class="form-input" value="${escapeHtml(current.split || '')}">
        </div>
      </div>

      <label class="form-label">Nota</label>
      <textarea id="profileNoteInput" class="form-textarea">${escapeHtml(current.note || '')}</textarea>

      <div class="mini-actions">
        <button id="cancelProfileEdit" class="mini-btn">Cancelar</button>
        <button id="saveProfileEdit" class="mini-btn primary">Guardar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.onclick = (event) => { if (event.target === overlay) overlay.remove(); };
  document.getElementById('cancelProfileEdit').onclick = () => overlay.remove();
  document.getElementById('saveProfileEdit').onclick = async () => {
    const updatedProfile = {
      name: document.getElementById('profileNameInput').value.trim(),
      goal: document.getElementById('profileGoalInput').value.trim(),
      weight: document.getElementById('profileWeightInput').value.trim(),
      height: document.getElementById('profileHeightInput').value.trim(),
      age: document.getElementById('profileAgeInput').value.trim(),
      split: document.getElementById('profileSplitInput').value.trim(),
      note: document.getElementById('profileNoteInput').value.trim(),
      photo: current.photo || ''
    };

    saveProfileLocal(updatedProfile);
    overlay.remove();
    await renderProfile();
    showToast('✅ Perfil guardado');
  };
}

async function handleProfilePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    let profile = getProfileLocal();
    profile.photo = e.target.result;

    // La foto se queda local para no subir ni descargar base64 desde servidor.
    saveProfileLocal(profile);
    await renderProfile();
    showToast('✅ Foto guardada');
  };

  reader.readAsDataURL(file);
}

function createRoutineCopy(routine) {
  const baseId = `${routine.id || 'rutina'}_copia`;
  let nextId = baseId;
  let counter = 2;

  while (ROUTINES.some(r => r.id === nextId)) {
    nextId = `${baseId}_${counter}`;
    counter += 1;
  }

  return {
    ...cloneData(routine),
    id: nextId,
    name: `${routine.name} copia`,
    day: routine.day || 'Lunes',
    exercises: cloneData(routine.exercises || [])
  };
}

function duplicateRoutine(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  ROUTINES.push(createRoutineCopy(routine));
  saveRoutinesLocal();
  renderHome();
  showToast('✅ Rutina duplicada');
}

function moveRoutine(routineId, direction) {
  const index = ROUTINES.findIndex(r => r.id === routineId);
  if (index < 0) return;

  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= ROUTINES.length) {
    showToast('⚠️ No se puede mover más');
    return;
  }

  const [routine] = ROUTINES.splice(index, 1);
  ROUTINES.splice(nextIndex, 0, routine);

  saveRoutinesLocal();
  renderHome();
  showToast('✅ Orden actualizado');
}

function getSmartExerciseNote(ex, lastEx) {
  if (!ex) return '';

  if (isCardioExercise(ex)) {
    return `
      <div class="smart-exercise-note">
        <div class="smart-exercise-note-title">Nota inteligente</div>
        <div class="smart-exercise-note-text">Cardio: registra tiempo y distancia reales. Mantén ritmo sostenible y evita cambiar muchas variables el mismo día.</div>
      </div>
    `;
  }

  if (isBodyweightExercise(ex)) {
    return `
      <div class="smart-exercise-note">
        <div class="smart-exercise-note-title">Nota inteligente</div>
        <div class="smart-exercise-note-text">Peso corporal: prioriza rango completo, control y repeticiones limpias antes de añadir dificultad.</div>
      </div>
    `;
  }

  if (!lastEx) {
    return `
      <div class="smart-exercise-note">
        <div class="smart-exercise-note-title">Nota inteligente</div>
        <div class="smart-exercise-note-text">Primer registro: elige una carga estable, evita llegar al fallo y deja una referencia clara para la próxima sesión.</div>
      </div>
    `;
  }

  const validSets = getValidSets(lastEx.sets);
  const best = getBestSet(lastEx.sets);
  const totalVolume = Math.round(getVolume(lastEx.sets));

  if (!validSets.length || !best) {
    return `
      <div class="smart-exercise-note">
        <div class="smart-exercise-note-title">Nota inteligente</div>
        <div class="smart-exercise-note-text">La sesión anterior no tiene datos suficientes. Hoy busca completar todas las series con peso y repeticiones bien registradas.</div>
      </div>
    `;
  }

  const reps = validSets.map(s => parseFloat(s.reps) || 0).filter(Boolean);
  const minReps = reps.length ? Math.min(...reps) : 0;
  const maxReps = reps.length ? Math.max(...reps) : 0;

  let text = `Última referencia: mejor serie ${best.weight} lb × ${best.reps}, volumen ${totalVolume.toLocaleString()} lb.`;

  if (minReps > 0 && minReps < 8) {
    text += ' Mantén la carga y busca subir repeticiones antes de aumentar peso.';
  } else if (minReps >= 10 && maxReps >= 12) {
    text += ' Puedes intentar una subida pequeña de carga si la técnica se mantiene limpia.';
  } else {
    text += ' Objetivo: igualar la carga y sumar al menos una repetición total con buena técnica.';
  }

  return `
    <div class="smart-exercise-note">
      <div class="smart-exercise-note-title">Nota inteligente</div>
      <div class="smart-exercise-note-text">${text}</div>
    </div>
  `;
}
function getRoutineExerciseCatalog(extraExercises = []) {
  const cardioExercises = [
    { name: 'Bicicleta', sets: 1, type: 'cardio' },
    { name: 'Caminadora', sets: 1, type: 'cardio' },
    { name: 'Elíptica', sets: 1, type: 'cardio' },
    { name: 'Escaladora', sets: 1, type: 'cardio' }
  ];

  const source = [
    ...cardioExercises,
    ...((DEFAULT_ROUTINES || []).flatMap(r => r.exercises || [])),
    ...((ROUTINES || []).flatMap(r => r.exercises || [])),
    ...(extraExercises || [])
  ];

  const map = new Map();

  source.forEach(ex => {
    const name = String(ex?.name || '').trim();
    if (!name) return;

    const key = normalizeText(name);
    if (!map.has(key)) {
      map.set(key, {
        name,
        sets: Math.max(1, parseInt(ex.sets, 10) || 3),
        note: ex.note || '',
        type: ex.type || (isCardioExerciseName(name) ? 'cardio' : null),
        bodyweight: ex.bodyweight === true || isBodyweightExerciseName(name)
      });
    }
  });

  return Array.from(map.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

function routineExerciseOptionsHtml(selectedName = '') {
  const catalog = getRoutineExerciseCatalog(selectedName ? [{ name: selectedName }] : []);
  const selectedKey = normalizeText(selectedName);

  return `
    <option value="">Seleccionar ejercicio</option>
    ${catalog.map(ex => `
      <option value="${escapeHtml(ex.name)}" ${normalizeText(ex.name) === selectedKey ? 'selected' : ''}>
        ${escapeHtml(ex.name)}
      </option>
    `).join('')}
    <option value="__custom__">+ Escribir ejercicio nuevo</option>
  `;
}

function routineExerciseRowHtml(ex = {}, index = 0) {
  const name = ex.name || '';
  const sets = Math.max(1, parseInt(ex.sets, 10) || 3);
  const note = ex.note || '';

  return `
    <div class="routine-exercise-editor-row" style="margin-top:12px;padding:12px;border-radius:18px;background:rgba(255,255,255,.035);border:1px solid rgba(238,210,146,.12);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="routine-exercise-number" style="width:28px;height:28px;border-radius:10px;display:grid;place-items:center;background:rgba(216,184,102,.10);color:var(--gold-soft);font-size:12px;font-weight:900;">
            ${index + 1}
          </div>
          <div style="color:var(--gold-soft);font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">
            Ejercicio
          </div>
        </div>

        <div style="display:flex;gap:6px;">
          <button type="button" class="ghost-link" onclick="moveRoutineExerciseEditorRow(this, -1)">↑</button>
          <button type="button" class="ghost-link" onclick="moveRoutineExerciseEditorRow(this, 1)">↓</button>
          <button type="button" class="ghost-link" style="color:#ff8b91;" onclick="deleteRoutineExerciseEditorRow(this)">Eliminar</button>
        </div>
      </div>

      <select class="form-select routine-exercise-select" onchange="handleRoutineExerciseSelect(this)">
        ${routineExerciseOptionsHtml(name)}
      </select>

      <input class="form-input routine-exercise-custom" placeholder="Nombre del ejercicio nuevo" style="display:none;margin-top:8px;">

      <div style="display:grid;grid-template-columns:88px 1fr;gap:10px;margin-top:10px;">
        <div>
          <label class="form-label" style="margin-top:0;">Series</label>
          <input type="number" min="1" class="form-input routine-exercise-sets" value="${sets}" inputmode="numeric">
        </div>
        <div>
          <label class="form-label" style="margin-top:0;">Nota</label>
          <input class="form-input routine-exercise-note" value="${escapeHtml(note)}" placeholder="Opcional">
        </div>
      </div>
    </div>
  `;
}

function refreshRoutineExerciseEditorIndexes() {
  document.querySelectorAll('#routineExerciseRows .routine-exercise-editor-row').forEach((row, index) => {
    const number = row.querySelector('.routine-exercise-number');
    if (number) number.textContent = index + 1;
  });
}

function handleRoutineExerciseSelect(select) {
  const row = select.closest('.routine-exercise-editor-row');
  if (!row) return;

  const customInput = row.querySelector('.routine-exercise-custom');
  if (!customInput) return;

  if (select.value === '__custom__') {
    customInput.style.display = 'block';
    customInput.focus();
  } else {
    customInput.value = '';
    customInput.style.display = 'none';
  }
}

function addRoutineExerciseEditorRow() {
  const container = document.getElementById('routineExerciseRows');
  if (!container) return;

  container.insertAdjacentHTML('beforeend', routineExerciseRowHtml({ name: '', sets: 3 }, container.children.length));
  refreshRoutineExerciseEditorIndexes();
}

function deleteRoutineExerciseEditorRow(button) {
  const container = document.getElementById('routineExerciseRows');
  const row = button.closest('.routine-exercise-editor-row');
  if (!container || !row) return;

  if (container.children.length <= 1) {
    showToast('⚠️ Debe quedar al menos un ejercicio');
    return;
  }

  row.remove();
  refreshRoutineExerciseEditorIndexes();
}

function moveRoutineExerciseEditorRow(button, direction) {
  const row = button.closest('.routine-exercise-editor-row');
  const container = document.getElementById('routineExerciseRows');
  if (!row || !container) return;

  if (direction < 0 && row.previousElementSibling) {
    container.insertBefore(row, row.previousElementSibling);
  }

  if (direction > 0 && row.nextElementSibling) {
    container.insertBefore(row.nextElementSibling, row);
  }

  refreshRoutineExerciseEditorIndexes();
}

function collectRoutineExercisesFromEditor() {
  const rows = Array.from(document.querySelectorAll('#routineExerciseRows .routine-exercise-editor-row'));

  return rows.map(row => {
    const select = row.querySelector('.routine-exercise-select');
    const custom = row.querySelector('.routine-exercise-custom');
    const setsInput = row.querySelector('.routine-exercise-sets');
    const noteInput = row.querySelector('.routine-exercise-note');

    const selectedName = select?.value || '';
    const customName = custom?.value.trim() || '';
    const name = selectedName === '__custom__' ? customName : selectedName;
    const sets = Math.max(1, parseInt(setsInput?.value, 10) || 3);
    const note = noteInput?.value.trim() || '';

    if (!name) return null;

    const catalogItem = getRoutineExerciseCatalog([{ name }])
      .find(ex => normalizeText(ex.name) === normalizeText(name));

    return {
      name,
      sets,
      ...(note ? { note } : {}),
      ...(catalogItem?.type ? { type: catalogItem.type } : {}),
      ...(catalogItem?.bodyweight ? { bodyweight: true } : {})
    };
  }).filter(Boolean);
}

function editRoutine(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  const oldOverlay = document.getElementById('routineEditOverlay');
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'routineEditOverlay';
  overlay.className = 'edit-overlay';
  overlay.innerHTML = `
    <div class="edit-overlay-card">
      <div class="edit-title">Editar rutina</div>

      <label class="form-label">Nombre</label>
      <input id="routineNameInput" class="form-input" value="${escapeHtml(routine.name)}">

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label class="form-label">Día</label>
          <select id="routineDayInput" class="form-select">
            ${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(day => `<option value="${day}" ${normalizeText(day) === normalizeText(routine.day) ? 'selected' : ''}>${day}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Icono</label>
          <input id="routineEmojiInput" class="form-input" value="${escapeHtml(routine.emoji || '🏋️')}">
        </div>
      </div>

      <label class="form-label">Descripción</label>
      <input id="routineDescInput" class="form-input" value="${escapeHtml(routine.desc || '')}">

      <label class="form-label">Ejercicios</label>
      <div id="routineExerciseRows">
        ${(routine.exercises || []).map((ex, index) => routineExerciseRowHtml(ex, index)).join('')}
      </div>

      <button type="button" class="add-set-btn" style="margin-top:12px;" onclick="addRoutineExerciseEditorRow()">
        + Agregar ejercicio
      </button>

      <div style="font-size:12px;color:var(--muted);line-height:1.45;margin-top:8px;">
        Selecciona ejercicios de la lista, ajusta series y agrega nota opcional.
      </div>

      <div class="mini-actions">
        <button id="cancelRoutineEdit" class="mini-btn">Cancelar</button>
        <button id="moveRoutineUpBtn" class="mini-btn">Subir</button>
        <button id="moveRoutineDownBtn" class="mini-btn">Bajar</button>
        <button id="duplicateRoutineBtn" class="mini-btn">Duplicar</button>
        <button id="resetRoutinesBtn" class="mini-btn danger">Restaurar base</button>
        <button id="saveRoutineEdit" class="mini-btn primary">Guardar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.onclick = (event) => { if (event.target === overlay) overlay.remove(); };

  document.getElementById('cancelRoutineEdit').onclick = () => overlay.remove();

  document.getElementById('moveRoutineUpBtn').onclick = () => {
    moveRoutine(routineId, -1);
    overlay.remove();
  };

  document.getElementById('moveRoutineDownBtn').onclick = () => {
    moveRoutine(routineId, 1);
    overlay.remove();
  };

  document.getElementById('duplicateRoutineBtn').onclick = () => {
    duplicateRoutine(routineId);
    overlay.remove();
  };

  document.getElementById('resetRoutinesBtn').onclick = () => {
    overlay.remove();
    resetRoutinesToDefault();
  };

  document.getElementById('saveRoutineEdit').onclick = () => {
    const name = document.getElementById('routineNameInput').value.trim();
    const day = document.getElementById('routineDayInput').value.trim();
    const emoji = document.getElementById('routineEmojiInput').value.trim() || '🏋️';
    const desc = document.getElementById('routineDescInput').value.trim();
    const exercises = collectRoutineExercisesFromEditor();

    if (!name || !exercises.length) {
      showToast('⚠️ Falta nombre o ejercicios');
      return;
    }

    routine.name = name;
    routine.day = day;
    routine.emoji = emoji;
    routine.desc = desc;
    routine.exercises = exercises;

    saveRoutinesLocal();
    overlay.remove();
    renderHome();
    showToast('✅ Rutina guardada');
  };
}

async function getAccountDisplayName() {
  const localName = getProfileLocal()?.name;
  if (localName) return localName;
  return 'Usuario local';
}


let trainingSwipeStartY = 0;
let trainingSwipeStartX = 0;
let trainingSwipeStartedAtTop = false;

function setupTrainingSwipeToHide() {
  const screen = document.getElementById('sessionScreen');
  if (!screen || screen.dataset.trainingSwipeReady === '1') return;
  screen.dataset.trainingSwipeReady = '1';

  screen.addEventListener('touchstart', event => {
    if (!document.body.classList.contains('training-active') || !currentSession) return;
    const touch = event.touches[0];
    trainingSwipeStartY = touch.clientY;
    trainingSwipeStartX = touch.clientX;
    trainingSwipeStartedAtTop = screen.scrollTop <= 8;
  }, { passive: true });

  screen.addEventListener('touchend', event => {
    if (!document.body.classList.contains('training-active') || !currentSession) return;
    const touch = event.changedTouches[0];
    const deltaY = touch.clientY - trainingSwipeStartY;
    const deltaX = Math.abs(touch.clientX - trainingSwipeStartX);

    if (trainingSwipeStartedAtTop && deltaY > 80 && deltaX < 90) {
      goBack();
    }
  }, { passive: true });
}

function setHistoryFilter(filterId) {
  historyFilter = filterId || 'all';
  renderHistory();
}

async function deleteActiveLocalSession(session) {
  const s = normalizeSession(session);
  if (!s || !isActiveLocalSession(s)) return;
  removeSessionFromCaches(s);
}


async function discardSession() {
  if (editingSessionKey && !isActiveLocalSession(currentSession)) {
    currentSession = null;
    editingSessionKey = null;
    clearCurrentDraft();
    stopTimer();
    showScreen('history');
    return;
  }

  if (confirm('¿Descartar entrenamiento?')) {
    await deleteActiveLocalSession(currentSession);
    currentSession = null;
    editingSessionKey = null;
    clearCurrentDraft();
    stopTimer();
    showScreen('home');
  }
}

function goBack() {
  if (editingSessionKey) {
    currentSession = null;
    editingSessionKey = null;
    clearCurrentDraft();
    stopTimer();
    showScreen('history');
    return;
  }

  if (currentSession) {
    saveCurrentDraft();
    stopTimer();
    showToast('✅ Sesión guardada como borrador');
  }
  showScreen('home');
}


function getRoutineMark(routine) {
  return routine?.emoji || '🏋️';
}


function getRoutinePreviewComparison(routineId) {
  const last = getLastSession(routineId);

  if (!last) {
    return `
      <div class="routine-preview-compare">
        <div class="routine-preview-compare-label">Última sesión equivalente</div>
        <div class="routine-preview-compare-main">Sin registro previo</div>
        <div class="routine-preview-compare-text">Esta será la primera referencia para comparar progreso.</div>
      </div>
    `;
  }

  const stats = getSessionSummaryStats(last);
  const bestText = stats.bestSet
    ? `${escapeHtml(stats.bestSet.exerciseName)} · ${stats.bestSet.weight} lb × ${stats.bestSet.reps}`
    : 'Sin mejor serie registrada';

  return `
    <div class="routine-preview-compare">
      <div class="routine-preview-compare-label">Última sesión equivalente</div>
      <div class="routine-preview-compare-main">${formatDate(last.date)}</div>
      <div class="routine-preview-compare-grid">
        <span><strong>${stats.completedSets}</strong> series</span>
        <span><strong>${stats.totalVolume}</strong> lb volumen</span>
      </div>
      <div class="routine-preview-compare-text">Mejor serie: ${bestText}</div>
    </div>
  `;
}
function viewRoutine(routineId) {
  if (!currentUser) {
    showScreen('auth');
    showToast('🔒 Inicia sesión primero');
    return;
  }

  const routine = getRoutineById(routineId);
  if (!routine) { showToast('⚠️ Rutina no encontrada'); return; }

  const comparisonHtml = getRoutinePreviewComparison(routineId);

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('sessionScreen').classList.add('active');
  exitTrainingMode();
  document.body.classList.add('session-preview-active');

  const sessionBackBtn = document.querySelector('#sessionScreen .session-hide-btn');
  if (sessionBackBtn) {
    sessionBackBtn.textContent = '←';
    sessionBackBtn.setAttribute('aria-label', 'Regresar');
    sessionBackBtn.setAttribute('title', 'Regresar');
  }

  document.getElementById('sessionTitle').textContent = routine.name.toUpperCase();
  document.getElementById('sessionDate').innerHTML = '<span class="session-kicker">Lista para entrenar</span><div>Toca iniciar para comenzar</div>';

  document.getElementById('exerciseList').innerHTML = `
    <div class="session-overview">
      <div class="session-overview-top">
        <div>
          <div class="session-overview-title">${escapeHtml(routine.name)}</div>
          <div class="session-overview-sub">${escapeHtml(routine.desc || '')}</div>
        </div>
        <div class="session-progress-ring">${routine.exercises.length}</div>
      </div>

      <div class="session-stats-grid">
        <div class="session-stat-card">
          <div class="session-stat-label">Ejercicios</div>
          <div class="session-stat-value">${routine.exercises.length}</div>
        </div>
        <div class="session-stat-card">
          <div class="session-stat-label">Series</div>
          <div class="session-stat-value">${routine.exercises.reduce((acc, ex) => acc + ex.sets, 0)}</div>
        </div>
        <div class="session-stat-card">
          <div class="session-stat-label">Día</div>
          <div class="session-stat-value" style="font-size:16px;">${escapeHtml(routine.day || '--')}</div>
        </div>
      </div>

      ${comparisonHtml}
    </div>

    ${routine.exercises.map((ex, i) => `
      <div class="exercise-card session-preview-card">
        <div class="exercise-topline">
          <div class="exercise-index">${i + 1}</div>
          <div class="exercise-title-block">
            <div class="exercise-name">${escapeHtml(ex.name)}</div>
            <div class="session-preview-meta">${ex.sets} series ${ex.note ? '· ' + escapeHtml(ex.note) : ''}</div>
          </div>
        </div>
      </div>
    `).join('')}
  `;

  document.querySelector('.finish-btn').textContent = 'INICIAR ENTRENAMIENTO';
  document.querySelector('.finish-btn').onclick = () => { startSession(routineId); };
}

function startSession(routineId) {
  if (!currentUser) {
    showScreen('auth');
    showToast('🔒 Inicia sesión primero');
    return;
  }

  editingSessionKey = null;
  const routine = getRoutineById(routineId);
  if (!routine) { showToast('⚠️ Rutina no encontrada'); return; }

  const existingDraft = currentSession || getCurrentDraft();
  if (existingDraft) {
    const replace = confirm('Ya hay una sesión guardada. ¿Reemplazarla por una nueva sesión de ' + routine.name + '?');
    if (!replace) return;
    clearCurrentDraft();
    stopTimer();
  } else if (!confirm('¿Iniciar entrenamiento de ' + routine.name + '?')) {
    return;
  }

  document.body.classList.remove('session-preview-active');

  currentSession = {
    routineId,
    routineName: routine.name,
    date: new Date().toISOString(),
    status: 'active',
    inProgress: true,
    updatedAt: new Date().toISOString(),
    exercises: routine.exercises.map(ex => {
      const lastEx = getLastExerciseData(routineId, ex.name);
      return {
        name: ex.name,
        originalName: ex.name,
        note: ex.note || null,
        replaced: false,
        sets: Array.from({ length: ex.sets }, (_, i) => {
          const lastSet = lastEx?.sets?.[i];
          return { weight: lastSet?.weight || '', reps: lastSet?.reps || '', done: false };
        })
      };
    })
  };

  currentSession = markActiveSession(currentSession);
  currentSessionRevision = 0;
  saveCurrentDraft();
  renderHistory();
  document.getElementById('sessionTitle').textContent = routine.name.toUpperCase();
  document.getElementById('sessionDate').innerHTML = `<span class="session-kicker">Sesión en curso</span><div>${formatDateFull(new Date())}</div>`;
  renderExercises();

  document.querySelector('.finish-btn').textContent = 'TERMINAR SESIÓN';
  document.querySelector('.finish-btn').onclick = () => finishSession();

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('sessionScreen').classList.add('active');
  enterTrainingMode();
}


function updateSet(ei, si, field, value) {
  if (!currentSession?.exercises?.[ei]?.sets?.[si]) return;
  currentSession.exercises[ei].sets[si][field] = value;
  markCurrentSessionChanged();
  saveCurrentDraft();
  updateSessionCounters();
}
function updateNotes(ei, value) {
  if (!currentSession?.exercises?.[ei]) return;
  currentSession.exercises[ei].notes = value;
  markCurrentSessionChanged();
  saveCurrentDraft();
}
function updateSessionCounters() {
  if (!currentSession) return;

  const completed = currentSession.exercises.reduce((acc, ex) => {
    return acc + ex.sets.filter(st => st.done).length;
  }, 0);

  const completedEl = document.getElementById('completedSetsCounter');
  if (completedEl) completedEl.textContent = completed;
}


function replaceExercise(ei) {
  const cardioExercises = [
    { name: 'Bicicleta', sets: 1, type: 'cardio' },
    { name: 'Caminadora', sets: 1, type: 'cardio' },
    { name: 'Elíptica', sets: 1, type: 'cardio' },
    { name: 'Escaladora', sets: 1, type: 'cardio' }
  ];
  const allExercises = [...cardioExercises, ...ROUTINES.flatMap(r => r.exercises || [])];
  const uniqueExercises = allExercises
    .filter((ex, index, arr) => arr.findIndex(e => normalizeText(e.name) === normalizeText(ex.name)) === index)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  const oldOverlay = document.getElementById('exerciseChangeOverlay');
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'exerciseChangeOverlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.72);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
  `;

  overlay.innerHTML = `
    <div style="
      width: 100%;
      max-width: 430px;
      background: #241238;
      border: 1px solid rgba(205,180,120,0.22);
      border-radius: 22px;
      padding: 18px;
      box-shadow: 0 18px 48px rgba(0,0,0,0.45);
      color: #f7f2ea;
      font-family: 'DM Sans', sans-serif;
    ">
      <div style="
        font-family: 'Bebas Neue', sans-serif;
        font-size: 26px;
        letter-spacing: 1.5px;
        color: #c9a44c;
        margin-bottom: 12px;
      ">
        Cambiar ejercicio
      </div>

      <label style="font-size:12px;color:#a89cb8;text-transform:uppercase;letter-spacing:1px;">
        Selecciona uno de la lista
      </label>

      <select id="exerciseSelect" style="
        width:100%;
        margin-top:8px;
        margin-bottom:14px;
        padding:13px 12px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.12);
        background:#12051f;
        color:#f7f2ea;
        font-size:14px;
        font-family:'DM Sans', sans-serif;
      ">
        ${uniqueExercises.map((ex, i) => `
          <option value="${i}">${ex.name}</option>
        `).join('')}
      </select>

      <label style="font-size:12px;color:#a89cb8;text-transform:uppercase;letter-spacing:1px;">
        O escribe uno nuevo
      </label>

      <input id="customExerciseInput" type="text" placeholder="Ejemplo: Press declinado en máquina" style="
        width:100%;
        margin-top:8px;
        margin-bottom:16px;
        padding:13px 12px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.12);
        background:#12051f;
        color:#f7f2ea;
        font-size:14px;
        font-family:'DM Sans', sans-serif;
      ">

      <div style="display:flex;gap:10px;">
        <button id="cancelExerciseChange" style="
          flex:1;
          padding:13px;
          border-radius:12px;
          border:1px solid rgba(205,180,120,0.18);
          background:rgba(255,255,255,0.04);
          color:#c9a44c;
          font-family:'Bebas Neue', sans-serif;
          font-size:18px;
          letter-spacing:1px;
          cursor:pointer;
        ">
          Cancelar
        </button>

        <button id="applyExerciseChange" style="
          flex:1;
          padding:13px;
          border-radius:12px;
          border:none;
          background:#c9a44c;
          color:#12051f;
          font-family:'Bebas Neue', sans-serif;
          font-size:18px;
          letter-spacing:1px;
          cursor:pointer;
        ">
          Aplicar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('cancelExerciseChange').onclick = () => {
    overlay.remove();
  };

  overlay.onclick = (event) => {
    if (event.target === overlay) overlay.remove();
  };

  document.getElementById('applyExerciseChange').onclick = () => {
    const selectedIndex = parseInt(document.getElementById('exerciseSelect').value, 10);
    const customName = document.getElementById('customExerciseInput').value.trim();

    const selected = customName
      ? { name: customName, note: null, type: isCardioExerciseName(customName) ? 'cardio' : null }
      : uniqueExercises[selectedIndex];

    if (!selected || !selected.name) {
      showToast('⚠️ Selecciona o escribe un ejercicio');
      return;
    }

    const lastEx = getLastExerciseData(currentSession.routineId, selected.name);
    const previousExercise = currentSession.exercises[ei];
    const currentSetsCount = previousExercise.sets.length;
    const previousNotes = previousExercise.notes || '';
    const originalName = previousExercise.originalName || previousExercise.name;

    currentSession.exercises[ei] = {
      name: selected.name,
      originalName,
      replaced: selected.name !== originalName,
      note: selected.note || null,
      type: selected.type || (isCardioExerciseName(selected.name) ? 'cardio' : null),
      notes: previousNotes,
      sets: Array.from({ length: currentSetsCount }, (_, i) => {
        const lastSet = lastEx?.sets?.[i];
        return {
          weight: lastSet?.weight || previousExercise.sets[i]?.weight || '',
          reps: lastSet?.reps || previousExercise.sets[i]?.reps || '',
          done: false
        };
      })
    };

    markCurrentSessionChanged();
    overlay.remove();
    saveCurrentDraft();
    renderExercises();
    showToast('✅ Ejercicio cambiado');
  };
}


async function finishSession() {
  if (!currentUser) {
    showScreen('auth');
    showToast('🔒 Inicia sesión primero');
    return;
  }

  if (!currentSession) {
    showToast('⚠️ No hay una sesión activa');
    return;
  }

  const doneSets = currentSession.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).length, 0);
  if (doneSets === 0) {
    showToast('⚠️ Marca al menos una serie como completada');
    return;
  }

  clearTimeout(currentSessionSaveTimer);
  currentSessionSaveTimer = null;
  currentSessionSavePending = false;

  const wasEditing = !!editingSessionKey;
  const finishedSession = markFinishedSession(currentSession);
  const ok = wasEditing
    ? await updateSavedSession(editingSessionKey, finishedSession)
    : await saveSession(finishedSession);
  if (ok === false) return;

  currentSession = null;
  currentSessionRevision = 0;
  editingSessionKey = null;
  clearCurrentDraft();
  stopTimer();
  exitTrainingMode();
  setSessionsLocal(getFinishedSessions());

  const finishBtn = document.querySelector('.finish-btn');
  if (finishBtn) {
    finishBtn.textContent = 'INICIAR ENTRENAMIENTO';
    finishBtn.onclick = null;
  }

  renderHome();
  renderHistory();
  showPostSessionSavedMessage(finishedSession, wasEditing);
}


function closeExportMenu() {
  const overlay = document.getElementById('exportMenuOverlay');
  if (overlay) overlay.remove();
}

function openExportMenu() {
  closeExportMenu();

  const overlay = document.createElement('div');
  overlay.id = 'exportMenuOverlay';
  overlay.className = 'edit-overlay';
  overlay.innerHTML = `
    <div class="edit-overlay-card">
      <div class="action-sheet-title">Exportar historial</div>
      <div class="action-sheet-sub">Elige el formato. JSON conserva la estructura completa; CSV sirve para Excel.</div>
      <div class="action-sheet-grid">
        <button class="mini-btn primary" onclick="closeExportMenu(); exportSessionsCsv();">CSV para Excel</button>
        <button class="mini-btn" onclick="closeExportMenu(); exportSessions();">JSON completo</button>
        <button class="mini-btn danger" onclick="closeExportMenu();">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.onclick = event => {
    if (event.target === overlay) closeExportMenu();
  };
}

function closeSessionActions() {
  const overlay = document.getElementById('sessionActionsOverlay');
  if (overlay) overlay.remove();
}

function openSessionActions(index) {
  const session = getSessionByIndex(index);
  if (!session) return;

  closeSessionActions();

  const overlay = document.createElement('div');
  overlay.id = 'sessionActionsOverlay';
  overlay.className = 'edit-overlay';
  overlay.innerHTML = `
    <div class="edit-overlay-card">
      <div class="action-sheet-title">${escapeHtml(session.routineName)}</div>
      <div class="action-sheet-sub">${formatDateFull(new Date(session.date))}</div>
      <div class="action-sheet-grid">
        ${isActiveLocalSession(session) ? `<button class="mini-btn primary" onclick="closeSessionActions(); editSavedSession(${index});">Continuar</button>` : `<button class="mini-btn primary" onclick="closeSessionActions(); showDetail(${index});">Ver detalle</button>`}
        <button class="mini-btn" onclick="closeSessionActions(); editSavedSession(${index});">${isActiveLocalSession(session) ? 'Abrir' : 'Editar'}</button>
        <button class="mini-btn" onclick="closeSessionActions(); changeSavedSessionDate(${index});">Cambiar fecha</button>
        <button class="mini-btn" onclick="closeSessionActions(); openShareMenu(${index});">Compartir / copiar</button>
        <button class="mini-btn danger" onclick="closeSessionActions(); deleteSession(${index});">Eliminar</button>
        <button class="mini-btn" onclick="closeSessionActions();">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.onclick = event => {
    if (event.target === overlay) closeSessionActions();
  };
}

async function deleteSession(index) {
  const session = getSessionByIndex(index);
  if (!session) return;
  if (!confirm('¿Eliminar esta sesión del historial?')) return;

  removeSessionFromCaches(session);
  renderHome();
  renderHistory();
  showToast('🗑️ Sesión eliminada');
}


function showDetail(index) {
  const sessions = getSessions();
  const s = sessions[index];
  const doneSets = s.exercises.reduce((acc, ex) => acc + ex.sets.filter(st => st.done).length, 0);

  const content = `
    <div class="detail-shell">
      <div class="detail-head">
        <div>
          <div class="eyebrow">Detalle</div>
          <div class="detail-title">${s.routineName}</div>
          <div class="detail-sub">${formatDateFull(new Date(s.date))}</div>
        </div>
        <div class="detail-badge">
          <div class="detail-badge-value">${doneSets}</div>
          <div class="detail-badge-label">Series</div>
        </div>
      </div>
      <div class="detail-actions">
        <button onclick="editSavedSession(${index})" class="mini-btn">Editar</button>
        <button onclick="changeSavedSessionDate(${index})" class="mini-btn">Fecha</button>
        <button onclick="openShareMenu(${index})" class="mini-btn primary full">Compartir</button>
      </div>
    </div>
    ${s.exercises.map(ex => `
      <div class="exercise-card detail-exercise-card">
        <div class="detail-exercise-title">${ex.name}</div>
        <div class="sets-table" style="padding:0;">
          ${ex.sets.filter(st => st.done).map((st, i) => `
            <div class="detail-set">
              <div class="detail-set-num">${i + 1}</div>
              <div class="detail-set-data">
                <span class="detail-set-weight">${displaySetWeight(st, ex.name)}</span>
                <span class="detail-set-reps">${isCardioExerciseName(ex.name) ? ' · ' : ' × '}${displaySetReps(st, ex.name)}</span>
              </div>
            </div>
          `).join('')}
          ${ex.notes ? `<div class="detail-notes"><div class="detail-notes-title">Notas</div><div style="font-size:13px;line-height:1.5;color:var(--text);">${ex.notes}</div></div>` : ''}
        </div>
      </div>
    `).join('')}
  `;

  document.getElementById('detailContent').innerHTML = content;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('detailScreen').classList.add('active');
  exitTrainingMode();
}

let forjaAudioReady = false;
let forjaLastUnlockTry = 0;

function unlockTimerAudio() {
  try {
    const nowMs = Date.now();
    if (forjaAudioReady && nowMs - forjaLastUnlockTry < 3000) return;
    forjaLastUnlockTry = nowMs;

    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }

    if (!audioCtx) return;

    const finishUnlock = () => {
      try {
        /* Pulso casi silencioso: ayuda a iPhone a desbloquear Web Audio desde un toque real. */
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.00001, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.035);
        forjaAudioReady = true;
      } catch (e) {
        console.warn('finishUnlock', e);
      }
    };

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(finishUnlock).catch(() => {});
    } else if (audioCtx.state === 'running') {
      finishUnlock();
    }
  } catch (e) {
    console.warn('unlockTimerAudio', e);
  }
}

function forjaAlarmTone(freq, delay, duration, volume) {
  if (!audioCtx || audioCtx.state !== 'running') return;

  const startAt = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.04);
}

function playTimerBeep() {
  unlockTimerAudio();

  if (!audioCtx || audioCtx.state !== 'running') {
    showToast('🔕 Toca la pantalla y sube el volumen');
    return;
  }

  /* Alarma fuerte en dos ráfagas. */
  forjaAlarmTone(880, 0.00, 0.22, 0.42);
  forjaAlarmTone(1175, 0.28, 0.22, 0.42);
  forjaAlarmTone(1568, 0.56, 0.38, 0.48);
  forjaAlarmTone(880, 1.08, 0.22, 0.42);
  forjaAlarmTone(1175, 1.36, 0.22, 0.42);
  forjaAlarmTone(1568, 1.64, 0.48, 0.52);

  if (navigator.vibrate) {
    navigator.vibrate([300, 120, 300, 120, 500]);
  }
}

function handleTimerTick() {
  if (!timerEndTime) return;
  const remainingMs = timerEndTime - Date.now();
  if (remainingMs <= 0) {
    stopTimer();
    playTimerBeep();
    showToast('⏱ Descanso terminado — siguiente serie');
  } else {
    updateTimerDisplay();
  }
}


['touchstart', 'pointerdown', 'click'].forEach(type => {
  document.addEventListener(type, unlockTimerAudio, { passive: true });
});


function updateTimerDisplay() {
  const remainingMs = timerPausedRemainingMs !== null
    ? timerPausedRemainingMs
    : (timerEndTime ? Math.max(timerEndTime - Date.now(), 0) : 0);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  document.getElementById('timerDisplay').textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

function getSummary(sets) {
  const done = sets.filter(s => s.done || s.weight);
  if (!done.length) return 'Sin datos';
  const w = done[0].weight;
  const avgR = Math.round(done.reduce((a, s) => a + (parseFloat(s.reps) || 0), 0) / done.length);
  return `${done.length} series · ${w} lbs · ~${avgR} reps`;
}

function formatDate(iso) {
  const d = new Date(iso);
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function formatDateFull(d) {
  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}


function formatDateForFile(iso) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function safeFileName(text) {
  return String(text || 'forja')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'forja';
}

function getCompletedSets(exercise) {
  return (exercise.sets || []).filter(st => st.done);
}

function getSessionTotals(session) {
  const doneSets = session.exercises.reduce((acc, ex) => acc + getCompletedSets(ex).length, 0);
  const totalReps = session.exercises.reduce((acc, ex) => {
    return acc + getCompletedSets(ex).reduce((sum, st) => sum + (parseFloat(st.reps) || 0), 0);
  }, 0);
  const totalVolume = session.exercises.reduce((acc, ex) => {
    return acc + getCompletedSets(ex).reduce((sum, st) => {
      return sum + ((parseFloat(st.weight) || 0) * (parseFloat(st.reps) || 0));
    }, 0);
  }, 0);
  return { doneSets, totalReps, totalVolume, exercises: session.exercises.length };
}

function formatExerciseTxt(exercise) {
  const lines = [];
  const done = getCompletedSets(exercise);
  lines.push(exercise.name);

  if (!done.length) {
    lines.push('Sin series completadas.');
  } else {
    done.forEach((st, i) => {
      const weight = st.weight || '--';
      const reps = st.reps || '--';
      lines.push(`Serie ${i + 1}: ${weight} lb x ${reps} reps`);
    });
  }

  if (exercise.replaced && exercise.originalName) lines.push(`Sustituye a: ${exercise.originalName}`);
  if (exercise.notes) lines.push(`Notas: ${exercise.notes}`);
  return lines.join('\n');
}

function formatSessionTxt(session) {
  const totals = getSessionTotals(session);
  const lines = [];

  lines.push(session.routineName.toUpperCase());
  lines.push(formatDateFull(new Date(session.date)));
  lines.push('');
  lines.push(`Series completadas: ${totals.doneSets}`);
  lines.push(`Repeticiones totales: ${totals.totalReps}`);
  lines.push(`Volumen total: ${Math.round(totals.totalVolume).toLocaleString()} lb`);
  lines.push('');

  session.exercises.forEach((ex, i) => {
    lines.push(`EJERCICIO ${i + 1}`);
    lines.push(formatExerciseTxt(ex));
    lines.push('');
  });

  return lines.join('\n').trim();
}

function formatSessionCsv(session) {
  const rows = [['fecha','rutina','ejercicio','serie','peso_lb','repeticiones','volumen_lb','sustituye_a','notas']];

  session.exercises.forEach(ex => {
    getCompletedSets(ex).forEach((set, index) => {
      const weight = parseFloat(set.weight) || 0;
      const reps = parseFloat(set.reps) || 0;
      rows.push([
        formatDateForFile(session.date),
        session.routineName,
        ex.name,
        index + 1,
        set.weight || '',
        set.reps || '',
        weight * reps,
        ex.replaced ? (ex.originalName || '') : '',
        ex.notes || ''
      ]);
    });
  });

  return rows.map(row => row.map(csvEscape).join(',')).join('\n');
}

function formatCompactSession(session) {
  const totals = getSessionTotals(session);
  const lines = [];

  lines.push(`${session.routineName} — ${formatDateFull(new Date(session.date))}`);
  lines.push(`Resumen: ${totals.doneSets} series, ${totals.totalReps} reps, ${Math.round(totals.totalVolume).toLocaleString()} lb de volumen.`);
  lines.push('');

  session.exercises.forEach(ex => {
    const done = getCompletedSets(ex);
    const setsText = done.length
      ? done.map(st => `${st.weight || '--'} lb x ${st.reps || '--'}`).join(' | ')
      : 'sin series completadas';
    lines.push(`${ex.name}: ${setsText}`);
    if (ex.replaced && ex.originalName) lines.push(`Sustituye a: ${ex.originalName}`);
    if (ex.notes) lines.push(`Notas: ${ex.notes}`);
  });

  return lines.join('\n');
}

function formatAnalysisTxt(session) {
  const lines = [];

  lines.push('ANALIZA MI ENTRENAMIENTO');
  lines.push('');
  lines.push(`Rutina: ${session.routineName}`);
  lines.push(`Fecha: ${formatDateFull(new Date(session.date))}`);
  lines.push('Objetivo: ganar músculo, progresar sin sacrificar técnica.');
  lines.push('');
  lines.push('ENTRENAMIENTO ACTUAL:');
  lines.push(formatCompactSession(session));
  lines.push('');
  lines.push('Usa el historial que ya te he compartido en esta conversación. No incluyo sesión anterior para evitar duplicar datos.');
  lines.push('');
  lines.push('Dime exactamente:');
  lines.push('1. dónde progresé');
  lines.push('2. dónde bajé rendimiento');
  lines.push('3. qué debo intentar la próxima vez');
  lines.push('4. si debo subir, mantener o bajar peso en cada ejercicio');
  lines.push('5. qué correcciones técnicas debo cuidar');

  return lines.join('\n');
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyTextToClipboard(text, successMessage, fallbackFilename) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (!ok) throw new Error('Copia bloqueada');
    }
    showToast(successMessage || '✅ Copiado');
  } catch (error) {
    console.warn('copyTextToClipboard', error);
    downloadTextFile(fallbackFilename || 'forja-entrenamiento.txt', text, 'text/plain;charset=utf-8;');
    showToast('⚠️ No se pudo copiar; descargué TXT');
  }
}

function getSessionByIndex(index) {
  const session = getSessions()[index];
  if (!session) showToast('⚠️ No encontré esa sesión');
  return session;
}

function copySessionTxt(index) {
  const session = getSessionByIndex(index);
  if (!session) return;
  const filename = `${safeFileName(session.routineName)}-${formatDateForFile(session.date)}.txt`;
  copyTextToClipboard(formatSessionTxt(session), '✅ Entrenamiento copiado', filename);
}

function copyAnalysisTxt(index) {
  const session = getSessionByIndex(index);
  if (!session) return;
  const filename = `${safeFileName(session.routineName)}-${formatDateForFile(session.date)}-para-chad.txt`;
  copyTextToClipboard(formatAnalysisTxt(session), '✅ Texto para Chad copiado', filename);
}

function exportSessionCsv(index) {
  const session = getSessionByIndex(index);
  if (!session) return;
  const filename = `${safeFileName(session.routineName)}-${formatDateForFile(session.date)}.csv`;
  downloadTextFile(filename, '\uFEFF' + formatSessionCsv(session), 'text/csv;charset=utf-8;');
  showToast('✅ CSV descargado');
}

async function shareSessionTxt(index) {
  const session = getSessionByIndex(index);
  if (!session) return;
  const text = formatSessionTxt(session);

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${session.routineName} — ${formatDateForFile(session.date)}`,
        text
      });
      showToast('✅ Compartido');
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      console.warn('shareSessionTxt', error);
    }
  }

  const filename = `${safeFileName(session.routineName)}-${formatDateForFile(session.date)}.txt`;
  copyTextToClipboard(text, '✅ Compartir no disponible; copié TXT', filename);
}

function closeShareMenu() {
  const overlay = document.getElementById('shareMenuOverlay');
  if (overlay) overlay.remove();
}

function openShareMenu(index) {
  const session = getSessionByIndex(index);
  if (!session) return;

  closeShareMenu();

  const overlay = document.createElement('div');
  overlay.id = 'shareMenuOverlay';
  overlay.className = 'edit-overlay';

  overlay.innerHTML = `
    <div class="edit-overlay-card">
      <div class="edit-title">Compartir entrenamiento</div>

      <div style="font-size:13px;color:var(--muted);line-height:1.45;margin-bottom:14px;">
        ${escapeHtml(session.routineName)} · ${formatDate(session.date)}
      </div>

      <div style="display:grid;gap:10px;">
        <button class="mini-btn primary" style="width:100%;padding:13px;" onclick="handleShareMenuOption(${index}, 'chad')">
          Para Chad
        </button>

        <button class="mini-btn" style="width:100%;padding:13px;" onclick="handleShareMenuOption(${index}, 'txt')">
          TXT limpio
        </button>

        <button class="mini-btn" style="width:100%;padding:13px;" onclick="handleShareMenuOption(${index}, 'csv')">
          CSV de esta sesión
        </button>

        <button class="mini-btn primary" style="width:100%;padding:13px;" onclick="handleShareMenuOption(${index}, 'imagen')">
          Tarjeta transparente
        </button>

        <button class="mini-btn" style="width:100%;padding:13px;" onclick="handleShareMenuOption(${index}, 'redes')">
          Texto para redes
        </button>

        <button class="mini-btn danger" style="width:100%;padding:13px;" onclick="closeShareMenu()">
          Cancelar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.onclick = event => {
    if (event.target === overlay) closeShareMenu();
  };
}

async function handleShareMenuOption(index, type) {
  if (type === 'chad') {
    copyAnalysisTxt(index);
    closeShareMenu();
    return;
  }

  if (type === 'txt') {
    copySessionTxt(index);
    closeShareMenu();
    return;
  }

  if (type === 'csv') {
    exportSessionCsv(index);
    closeShareMenu();
    return;
  }

  if (type === 'imagen') {
    closeShareMenu();
    openSocialImageBuilder(index);
    return;
  }

  if (type === 'redes') {
    await shareSessionSocialTxt(index);
    closeShareMenu();
  }
}

function formatSessionSocialTxt(session) {
  const totals = getSessionTotals(session);

  return [
    `${session.routineName} terminado 💥`,
    '',
    `Series: ${totals.doneSets}`,
    `Repeticiones: ${totals.totalReps}`,
    `Volumen: ${Math.round(totals.totalVolume).toLocaleString()} lb`,
    `Fecha: ${formatDateFull(new Date(session.date))}`
  ].join('\n');
}

async function shareSessionSocialTxt(index) {
  const session = getSessionByIndex(index);
  if (!session) return;

  const text = formatSessionSocialTxt(session);

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${session.routineName} — ${formatDateForFile(session.date)}`,
        text
      });
      showToast('✅ Compartido');
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      console.warn('shareSessionSocialTxt', error);
    }
  }

  const filename = `${safeFileName(session.routineName)}-${formatDateForFile(session.date)}-redes.txt`;
  copyTextToClipboard(text, '✅ Resumen para redes copiado', filename);
}
let forjaSocialImageSession = null;
let forjaSocialImageFile = null;

function closeSocialImageBuilder() {
  const overlay = document.getElementById('socialImageBuilderOverlay');
  if (overlay) overlay.remove();
  forjaSocialImageSession = null;
  forjaSocialImageFile = null;
}

function openSocialImageBuilder(source) {
  const session = typeof source === 'number' ? getSessionByIndex(source) : normalizeSession(source);
  if (!session) return;

  closeSocialImageBuilder();

  forjaSocialImageSession = cloneData(stripRuntimeMeta(session));
  forjaSocialImageFile = null;

  const overlay = document.createElement('div');
  overlay.id = 'socialImageBuilderOverlay';
  overlay.className = 'edit-overlay';

  overlay.innerHTML = `
    <div class="edit-overlay-card">
      <div class="edit-title">Tarjeta transparente</div>

      <div style="font-size:13px;color:var(--muted);line-height:1.45;margin-bottom:14px;">
        FORJA generará un PNG transparente. Úsalo en Instagram encima de la foto que elijas.
      </div>

      <div style="margin-top:14px;padding:14px;border-radius:22px;border:1px solid rgba(238,210,146,.18);background:rgba(255,255,255,.025);">
        <div style="color:var(--gold-soft);font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">
          Vista de contenido
        </div>
        <div style="color:var(--text);font-size:15px;font-weight:900;">
          ${escapeHtml(session.routineName)}
        </div>
        <div style="margin-top:6px;color:var(--muted);font-size:13px;">
          ${formatDateFull(new Date(session.date))}
        </div>
      </div>

      <div class="mini-actions">
        <button class="mini-btn danger" onclick="closeSocialImageBuilder()">Cancelar</button>
        <button class="mini-btn" onclick="downloadForjaSocialImage()">Descargar PNG</button>
        <button class="mini-btn primary full" onclick="shareForjaSocialImage()">Compartir PNG</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.onclick = event => {
    if (event.target === overlay) closeSocialImageBuilder();
  };
}

function handleForjaSocialPhotoInput(input) {
  const file = input?.files?.[0] || null;
  forjaSocialImageFile = file;

  const label = document.getElementById('forjaSocialPhotoName');
  if (label) {
    label.textContent = file
      ? `Foto seleccionada: ${file.name}`
      : 'Ninguna foto seleccionada.';
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function drawCoverImage(ctx, img, canvasW, canvasH) {
  const scale = Math.max(canvasW / img.width, canvasH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = (canvasW - drawW) / 2;
  const drawY = (canvasH - drawH) / 2;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text || '').split(' ');
  const lines = [];
  let line = '';

  words.forEach(word => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });

  if (line) lines.push(line);

  const visibleLines = lines.slice(0, maxLines);
  visibleLines.forEach((item, index) => {
    const finalText = index === maxLines - 1 && lines.length > maxLines
      ? item.replace(/\s+\S*$/, '') + '…'
      : item;

    ctx.fillText(finalText, x, y + index * lineHeight);
  });

  return y + visibleLines.length * lineHeight;
}

function getForjaSocialImageFileName(session) {
  return `${safeFileName(session.routineName)}-${formatDateForFile(session.date)}-forja.png`;
}

async function createForjaSocialImageBlob(session, photoFile = null) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const stats = getSessionSummaryStats(session);
  const totals = getSessionTotals(session);
  const best = stats.bestSet;
  const bestExercise = best ? best.exerciseName : 'Sin mejor serie';
  const bestData = best ? `${best.weight} lb × ${best.reps}` : '--';

  const cardX = 54;
  const cardY = 54;
  const cardW = 972;
  const cardH = 1242;
  const radius = 64;

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = 'rgba(18, 5, 31, 0.58)';
  ctx.fill();

  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(240, 215, 138, 0.92)';
  ctx.stroke();

  ctx.save();
  drawRoundedRect(ctx, cardX + 18, cardY + 18, cardW - 36, cardH - 36, radius - 18);
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#f0d78a';
  ctx.font = '800 54px Arial';
  ctx.fillText('FORJA', cardX + 68, cardY + 70);

  ctx.fillStyle = 'rgba(242,237,244,0.78)';
  ctx.font = '800 32px Arial';
  ctx.fillText('ENTRENAMIENTO COMPLETADO', cardX + 68, cardY + 140);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 104px Arial';
  drawWrappedText(ctx, String(session.routineName || 'Rutina').toUpperCase(), cardX + 68, cardY + 220, cardW - 136, 104, 2);

  ctx.fillStyle = 'rgba(242,237,244,0.76)';
  ctx.font = '500 32px Arial';
  ctx.fillText(formatDateFull(new Date(session.date)), cardX + 68, cardY + 460);

  const statY = cardY + 570;
  const statW = (cardW - 136 - 28) / 3;

  const labels = [
    { label: 'SERIES', value: stats.completedSets },
    { label: 'REPS', value: totals.totalReps },
    { label: 'VOLUMEN', value: `${Math.round(stats.totalVolume).toLocaleString()} lb` }
  ];

  labels.forEach((item, index) => {
    const x = cardX + 68 + index * (statW + 14);

    drawRoundedRect(ctx, x, statY, statW, 158, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fill();

    ctx.fillStyle = '#f0d78a';
    ctx.font = '800 24px Arial';
    ctx.fillText(item.label, x + 24, statY + 28);

    ctx.fillStyle = '#ffffff';
    ctx.font = item.label === 'VOLUMEN' ? '900 36px Arial' : '900 60px Arial';
    ctx.fillText(String(item.value), x + 24, statY + 82);
  });

  const bestY = cardY + 820;

  ctx.fillStyle = '#f0d78a';
  ctx.font = '800 30px Arial';
  ctx.fillText('MEJOR SERIE', cardX + 68, bestY);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 42px Arial';
  drawWrappedText(ctx, bestExercise, cardX + 68, bestY + 54, cardW - 136, 48, 2);

  ctx.fillStyle = 'rgba(242,237,244,0.86)';
  ctx.font = '800 40px Arial';
  ctx.fillText(bestData, cardX + 68, bestY + 168);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.76)';
  ctx.font = '800 32px Arial';
  ctx.fillText('Alejandro · Cuerpo en construcción', w / 2, cardY + cardH - 110);

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png', 0.95);
  });
}

function downloadBlobFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function downloadForjaSocialImage() {
  if (!forjaSocialImageSession) {
    showToast('⚠️ No hay sesión para generar');
    return;
  }

  try {
    const blob = await createForjaSocialImageBlob(forjaSocialImageSession, forjaSocialImageFile);
    if (!blob) throw new Error('No se pudo generar PNG');

    downloadBlobFile(getForjaSocialImageFileName(forjaSocialImageSession), blob);
    showToast('✅ PNG descargado');
  } catch (error) {
    console.error('downloadForjaSocialImage', error);
    showToast('❌ No se pudo generar imagen');
  }
}

async function shareForjaSocialImage() {
  if (!forjaSocialImageSession) {
    showToast('⚠️ No hay sesión para generar');
    return;
  }

  try {
    const blob = await createForjaSocialImageBlob(forjaSocialImageSession, forjaSocialImageFile);
    if (!blob) throw new Error('No se pudo generar PNG');

    const filename = getForjaSocialImageFileName(forjaSocialImageSession);
    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `${forjaSocialImageSession.routineName} — FORJA`,
        text: 'Entrenamiento completado en FORJA.',
        files: [file]
      });
      showToast('✅ Imagen compartida');
      return;
    }

    downloadBlobFile(filename, blob);
    showToast('⚠️ Compartir no disponible; descargué PNG');
  } catch (error) {
    if (error && error.name === 'AbortError') return;
    console.error('shareForjaSocialImage', error);
    showToast('❌ No se pudo compartir imagen');
  }
}
function exportSessions() {
  const sessions = getSessions();
  if (!sessions.length) {
    showToast('⚠️ No hay sesiones para exportar');
    return;
  }

  const dataStr = JSON.stringify(sessions.map(stripRuntimeMeta), null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  a.href = url;
  a.download = `forja-sesiones-${yyyy}-${mm}-${dd}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
  showToast('✅ Sesiones exportadas');
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function exportSessionsCsv() {
  const sessions = getSessions();
  if (!sessions.length) {
    showToast('⚠️ No hay sesiones para exportar');
    return;
  }

  const rows = [['fecha','rutina','ejercicio','serie','peso_lb','repeticiones','volumen_lb','sustituye_a','notas']];
  sessions.map(stripRuntimeMeta).forEach(session => {
    session.exercises.forEach(ex => {
      ex.sets.forEach((set, index) => {
        if (!set.done && !set.weight && !set.reps) return;
        const weight = parseFloat(set.weight) || 0;
        const reps = parseFloat(set.reps) || 0;
        rows.push([
          session.date,
          session.routineName,
          ex.name,
          index + 1,
          set.weight || '',
          set.reps || '',
          weight * reps,
          ex.replaced ? (ex.originalName || '') : '',
          ex.notes || ''
        ]);
      });
    });
  });

  const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  a.href = url;
  a.download = `forja-sesiones-${yyyy}-${mm}-${dd}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('✅ CSV exportado');
}

window.addEventListener('pageshow', () => {
  if (!currentUser) return;
  renderHome();
  if (document.getElementById('historyScreen')?.classList.contains('active')) renderHistory();
}, { passive: true });

/* Auth listener anterior eliminado: la sesión se controla solo en el bloque final. */


function routineEmojiBySession(session) {
  const byId = (typeof getRoutineById === 'function' && session?.routineId) ? getRoutineById(session.routineId) : null;
  const byName = Array.isArray(ROUTINES) ? ROUTINES.find(r => r.name === session?.routineName) : null;
  return (byId || byName)?.emoji || '🏋️';
}

function shortDay(day) {
  return String(day || '').slice(0, 3).toUpperCase();
}

function safeJsString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getWeekStartMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekStatus(sessions) {
  const weekStart = getWeekStartMonday();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const weekSessions = (sessions || []).filter(s => {
    const d = new Date(s.date);
    return d >= weekStart && d < weekEnd;
  });

  const doneIds = new Set(weekSessions.map(s => s.routineId).filter(Boolean));
  const completed = ROUTINES.filter(r => doneIds.has(r.id));
  const pending = ROUTINES.filter(r => !doneIds.has(r.id));

  return {
    completedCount: completed.length,
    totalCount: ROUTINES.length,
    pendingCount: pending.length,
    pendingNames: pending.map(r => r.name).join(', '),
    completedNames: completed.map(r => r.name).join(', ')
  };
}
function renderHome() {
  const grid = document.getElementById('routineGrid');
  if (!grid) return;

  const sessions = getSessions();
  const totalSessions = sessions.length;
  const completedSets = sessions.reduce((acc, s) => acc + (s.exercises || []).reduce((sum, ex) => sum + ((ex.sets || []).filter(st => st.done).length), 0), 0);
  const latest = sessions[0];
  const todayRoutine = getTodayRoutine();
  const draft = currentSession || getCurrentDraft();
  const draftSavedAt = getDraftSavedAt();

  const todayExercises = todayRoutine ? (todayRoutine.exercises || []).length : 0;
  const todaySets = todayRoutine ? (todayRoutine.exercises || []).reduce((acc, ex) => acc + (parseInt(ex.sets, 10) || 0), 0) : 0;
  const todayLastSession = todayRoutine ? (sessions.find(s => s.routineId === todayRoutine.id) || null) : null;
  const todayLastText = todayLastSession ? formatDate(todayLastSession.date) : 'sin registro previo';
  const todayGoal = todayLastSession
    ? 'Objetivo: igualar o superar la última sesión con técnica limpia.'
    : 'Objetivo: primer registro limpio de esta rutina.';

  const weekStatus = getWeekStatus(sessions);

  const draftCard = draft ? `
    <div class="draft-card tap-card" onclick="resumeSavedSession()">
      <div class="routine-name">Sesión guardada</div>
      <div class="routine-meta">${escapeHtml(draft.routineName)} sin terminar${draftSavedAt ? ` · ${formatDate(draftSavedAt)}` : ''}</div>
    </div>
  ` : '';

  grid.innerHTML = `
    <div class="dashboard-hero ${todayRoutine ? 'tap-card' : ''}" ${todayRoutine ? `onclick="viewRoutine('${safeJsString(todayRoutine.id)}')"` : ''}>
      <div class="eyebrow">FORJA</div>
      <div class="hero-title">${todayRoutine ? 'Hoy toca ' + escapeHtml(todayRoutine.name) : 'Cuerpo en construcción'}</div>
      <div class="hero-sub">${todayRoutine ? escapeHtml(todayRoutine.desc || 'Rutina programada para hoy.') : 'Bitácora de entrenamiento, progreso y disciplina.'}</div>

      <div class="forja-hero-line">
        <strong>${totalSessions}</strong> sesiones · <strong>${completedSets}</strong> series hechas · última: <strong>${latest ? formatDate(latest.date) : 'sin registro'}</strong>
      </div>

      <div class="forja-week-panel">
        <div class="forja-week-top">
          <span>Semana actual</span>
          <strong>${weekStatus.completedCount}/${weekStatus.totalCount}</strong>
        </div>
        <div class="forja-week-bar">
          <div style="width:${Math.round((weekStatus.completedCount / weekStatus.totalCount) * 100)}%;"></div>
        </div>
        <div class="forja-week-text">
          ${weekStatus.pendingCount === 0
            ? 'Semana completa.'
            : `Pendiente: ${escapeHtml(weekStatus.pendingNames)}`
          }
        </div>
      </div>

      ${todayRoutine ? `
        <div class="session-stats-grid" style="margin-top:14px;">
          <div class="session-stat-card">
            <div class="session-stat-label">Ejercicios</div>
            <div class="session-stat-value">${todayExercises}</div>
          </div>
          <div class="session-stat-card">
            <div class="session-stat-label">Series</div>
            <div class="session-stat-value">${todaySets}</div>
          </div>
          <div class="session-stat-card">
            <div class="session-stat-label">Última vez</div>
            <div class="session-stat-value" style="font-size:16px;">${todayLastText}</div>
          </div>
        </div>

        <div class="today-plan-inline">
          <div class="today-plan-label">Plan de hoy</div>
          <div class="today-plan-text">${todayGoal}</div>
        </div>
      ` : ''}
    </div>

    ${draftCard}

    <div class="forja-training-list-title">ENTRENAMIENTOS</div>
    ${ROUTINES.map(r => {
      const last = sessions.find(s => s.routineId === r.id) || null;
      const lastText = last ? formatDate(last.date) : 'sin sesiones';
      const totalSets = (r.exercises || []).reduce((acc, ex) => acc + ex.sets, 0);
      const isToday = todayRoutine && todayRoutine.id === r.id;

      return `
        <div class="routine-card tap-card" onclick="viewRoutine('${safeJsString(r.id)}')" oncontextmenu="event.preventDefault(); editRoutine('${safeJsString(r.id)}')">
          <div class="routine-emoji routine-mark">${escapeHtml(r.emoji || '🏋️')}</div>
          <div class="routine-info">
            <div class="routine-name">${escapeHtml(r.name)}${isToday ? ' · HOY' : ''}</div>
            <div class="routine-meta">${escapeHtml(r.desc || '')}</div>
            <div class="forja-card-line"><strong>${shortDay(r.day)}</strong> · ${totalSets} series · última: ${lastText}</div>
          </div>
          <button class="routine-edit-btn" onclick="event.stopPropagation(); editRoutine('${safeJsString(r.id)}')" aria-label="Editar rutina" title="Editar rutina">⋯</button>
        </div>
      `;
    }).join('')}
  `;
}


function isBodyweightExerciseName(name) {
  const clean = normalizeText(name || '');
  return clean === 'fondo de triceps' || clean === 'fondos de triceps' || clean.includes('dominada') || clean === 'plancha';
}

function isBodyweightExercise(ex) {
  return !!(ex && (ex.bodyweight === true || isBodyweightExerciseName(ex.name)));
}

function isCardioExerciseName(name) {
  const clean = normalizeText(name || '');
  return clean === 'caminadora'
    || clean === 'caminadora inclinada'
    || clean === 'eliptica'
    || clean === 'bicicleta'
    || clean === 'escaladora';
}

function isCardioExercise(ex) {
  return !!(ex && (ex.type === 'cardio' || isCardioExerciseName(ex.name)));
}

function displaySetWeight(set, exName) {
  if (isCardioExerciseName(exName)) return `${set.weight || 0} min`;
  if (isBodyweightExerciseName(exName)) return 'Peso corporal';
  return `${set.weight || 0} lbs`;
}

function displaySetReps(set, exName) {
  if (isCardioExerciseName(exName)) return `${set.reps || 0} km`;
  return `${set.reps || 0} reps`;
}

function getSummaryForExercise(sets, exName) {
  const done = (sets || []).filter(s => s.done || s.weight || s.reps);
  if (!done.length) return 'Sin datos';
  if (isCardioExerciseName(exName)) {
    const totalMin = done.reduce((a, s) => a + (parseFloat(s.weight) || 0), 0);
    const totalKm = done.reduce((a, s) => a + (parseFloat(s.reps) || 0), 0);
    return `${done.length} registro${done.length === 1 ? '' : 's'} · ${totalMin || 0} min · ${totalKm || 0} km`;
  }
  const avgR = Math.round(done.reduce((a, s) => a + (parseFloat(s.reps) || 0), 0) / done.length);
  if (isBodyweightExerciseName(exName)) return `${done.length} series · peso corporal · ~${avgR} reps`;
  const w = done[0].weight;
  return `${done.length} series · ${w} lbs · ~${avgR} reps`;
}

let forjaCardioTimerInterval = null;

function getCardioTimer(set) {
  if (!set.cardioTimer || typeof set.cardioTimer !== 'object') {
    set.cardioTimer = { elapsedMs: 0, startedAt: null, running: false };
  }

  set.cardioTimer.elapsedMs = Math.max(0, Number(set.cardioTimer.elapsedMs) || 0);
  set.cardioTimer.startedAt = set.cardioTimer.startedAt ? Number(set.cardioTimer.startedAt) : null;
  set.cardioTimer.running = set.cardioTimer.running === true;

  return set.cardioTimer;
}
function getCardioElapsedMs(set) {
  const timer = getCardioTimer(set);
  let elapsed = timer.elapsedMs;

  if (timer.running && timer.startedAt) {
    elapsed += Math.max(0, Date.now() - timer.startedAt);
    return Math.max(0, elapsed);
  }

  if (elapsed <= 0) {
    const manualMinutes = parseFloat(set.weight);
    if (!Number.isNaN(manualMinutes) && manualMinutes > 0) {
      elapsed = manualMinutes * 60000;
    }
  }

  return Math.max(0, elapsed);
}

function formatCardioElapsed(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatCardioMinutesValue(ms) {
  const minutes = Math.max(0, ms) / 60000;
  const rounded = Math.round(minutes * 10) / 10;
  return String(rounded).replace(/\.0$/, '');
}

function updateCardioDoneUi(ei, si) {
  const set = currentSession?.exercises?.[ei]?.sets?.[si];
  if (!set) return;

  const row = document.getElementById(`setrow-${ei}-${si}`);
  const kmInput = document.getElementById(`reps-${ei}-${si}`);
  const hiddenTime = document.getElementById(`weight-${ei}-${si}`);
  const finishBtn = document.getElementById(`cardio-finish-${ei}-${si}`);

  if (hiddenTime) hiddenTime.value = set.weight || '';
  if (kmInput) kmInput.className = `set-input ${set.done ? 'completed' : ''}`;

  if (finishBtn) {
    finishBtn.className = `cardio-action-btn ${set.done ? 'done' : ''}`;
    finishBtn.textContent = set.done ? '✓' : '✓';
  }

  if (row) row.dataset.done = set.done ? '1' : '0';
}

function updateCardioTimerDisplay(ei, si) {
  const set = currentSession?.exercises?.[ei]?.sets?.[si];
  if (!set) return;

  const display = document.getElementById(`cardio-time-${ei}-${si}`);
  const playBtn = document.getElementById(`cardio-play-${ei}-${si}`);
  const pauseBtn = document.getElementById(`cardio-pause-${ei}-${si}`);
  const timer = getCardioTimer(set);

  if (display) {
    display.textContent = set.done && set.weight
      ? `${set.weight} min`
      : formatCardioElapsed(getCardioElapsedMs(set));
  }

  if (playBtn) playBtn.textContent = timer.running ? '▶' : '▶';
  if (pauseBtn) pauseBtn.textContent = timer.running ? '⏸' : '⏸';

  updateCardioDoneUi(ei, si);
}

function updateCardioTimerDisplays() {
  if (!currentSession) return;

  document.querySelectorAll('[data-cardio-timer="1"]').forEach(el => {
    const ei = parseInt(el.dataset.ei, 10);
    const si = parseInt(el.dataset.si, 10);
    if (!Number.isNaN(ei) && !Number.isNaN(si)) {
      updateCardioTimerDisplay(ei, si);
    }
  });
}
function startCardioTimer(ei, si) {
  const set = currentSession?.exercises?.[ei]?.sets?.[si];
  if (!set) return;

  if (set.done) {
    showToast('✅ Cardio ya marcado');
    return;
  }

  const timer = getCardioTimer(set);
  if (timer.running) return;

  timer.startedAt = Date.now();
  timer.running = true;
  markCurrentSessionChanged();

  ensureCardioTimerInterval();
  updateCardioTimerDisplay(ei, si);
  saveCurrentDraft();
}

function pauseCardioTimer(ei, si) {
  const set = currentSession?.exercises?.[ei]?.sets?.[si];
  if (!set) return;

  const timer = getCardioTimer(set);
  if (!timer.running) return;

  timer.elapsedMs = getCardioElapsedMs(set);
  timer.startedAt = null;
  timer.running = false;
  markCurrentSessionChanged();

  saveCurrentDraft();
  updateCardioTimerDisplay(ei, si);
}
function finishCardioTimer(ei, si) {
  const set = currentSession?.exercises?.[ei]?.sets?.[si];
  if (!set) return;

  const timer = getCardioTimer(set);
  const elapsedMs = getCardioElapsedMs(set);

  if (elapsedMs <= 0 && !set.weight) {
    showToast('⚠️ Inicia el cronómetro o escribe minutos');
    return;
  }

  timer.elapsedMs = elapsedMs;
  timer.startedAt = null;
  timer.running = false;

  set.weight = formatCardioMinutesValue(elapsedMs);
  set.done = true;
  markCurrentSessionChanged();

  updateSessionCounters();
  updateCardioTimerDisplay(ei, si);
  saveCurrentDraft();
  showToast('✅ Cardio terminado');
}

function ensureCardioTimerInterval() {
  if (forjaCardioTimerInterval) return;
  forjaCardioTimerInterval = setInterval(updateCardioTimerDisplays, 1000);
}

window.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateCardioTimerDisplays();
}, { passive: true });

window.addEventListener('focus', updateCardioTimerDisplays, { passive: true });
window.addEventListener('pageshow', updateCardioTimerDisplays, { passive: true });

ensureCardioTimerInterval();
function renderExercises() {
  const list = document.getElementById('exerciseList');
  if (!list || !currentSession) return;

  list.innerHTML = `
    <div class="session-overview">
      <div class="session-overview-top">
        <div>
          <div class="session-overview-title">${currentSession.routineName}</div>
          <div class="session-overview-sub">Registra tus series, ajusta ejercicios y añade notas sin salir de la sesión.</div>
        </div>
        <div class="session-progress-ring">${currentSession.exercises.length}</div>
      </div>
      <div class="session-stats-grid">
        <div class="session-stat-card">
          <div class="session-stat-label">Ejercicios</div>
          <div class="session-stat-value">${currentSession.exercises.length}</div>
        </div>
        <div class="session-stat-card">
          <div class="session-stat-label">Series planeadas</div>
          <div class="session-stat-value">${currentSession.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)}</div>
        </div>
        <div class="session-stat-card">
          <div class="session-stat-label">Completadas</div>
          <div id="completedSetsCounter" class="session-stat-value">${currentSession.exercises.reduce((acc, ex) => acc + ex.sets.filter(st => st.done).length, 0)}</div>
        </div>
      </div>
    </div>
    ${currentSession.exercises.map((ex, ei) => {
      const bodyweight = isBodyweightExercise(ex);
      const cardio = isCardioExercise(ex);
      const lastEx = getLastExerciseData(currentSession.routineId, ex.name);
      const prevHtml = lastEx ? `
        <div class="prev-info">
          📊 Anterior: <span>${getSummaryForExercise(lastEx.sets, ex.name)}</span>
        </div>
      ` : '';
      const insightHtml = getExerciseInsight(lastEx, ex);
      const smartNoteHtml = getSmartExerciseNote(ex, lastEx);
      const replacementHtml = ex.replaced && ex.originalName ? `<div class="prev-info">↔ Sustituye a: <span>${escapeHtml(ex.originalName)}</span></div>` : '';

      const setsHtml = ex.sets.map((set, si) => {
        if (cardio) {
          const timer = getCardioTimer(set);
          const elapsedText = set.done && set.weight
            ? `${set.weight} min`
            : formatCardioElapsed(getCardioElapsedMs(set));

          return `
            <div class="set-row cardio-set-row" id="setrow-${ei}-${si}" data-done="${set.done ? '1' : '0'}" ontouchstart="forjaSetSwipeStart(event)" ontouchend="forjaSetSwipeEnd(event,${ei},${si})">
              <div class="set-num">${si + 1}</div>

              <div class="cardio-time-panel">
                <div class="cardio-time-label">Tiempo</div>

                <div class="cardio-time-display" id="cardio-time-${ei}-${si}" data-cardio-timer="1" data-ei="${ei}" data-si="${si}">
                  ${elapsedText}
                </div>

                <input type="hidden" id="weight-${ei}-${si}" value="${set.weight || ''}">

                <div class="cardio-actions">
                  <button type="button" class="cardio-action-btn" id="cardio-play-${ei}-${si}" onclick="startCardioTimer(${ei},${si})">▶</button>
                  <button type="button" class="cardio-action-btn" id="cardio-pause-${ei}-${si}" onclick="pauseCardioTimer(${ei},${si})">⏸</button>
                  <button type="button" class="cardio-action-btn ${set.done ? 'done' : ''}" id="cardio-finish-${ei}-${si}" onclick="finishCardioTimer(${ei},${si})">✓</button>
                </div>

                <div class="cardio-km-grid">
                  <div class="cardio-km-label">KM</div>
                  <input type="number" class="set-input ${set.done ? 'completed' : ''}" id="reps-${ei}-${si}" placeholder="km" value="${set.reps || ''}" oninput="updateSet(${ei},${si},'reps',this.value)" inputmode="decimal">
                </div>
              </div>
            </div>
          `;
        }
        if (bodyweight) {
          return `
            <div class="set-row bodyweight-set" id="setrow-${ei}-${si}" ontouchstart="forjaSetSwipeStart(event)" ontouchend="forjaSetSwipeEnd(event,${ei},${si})">
              <div class="set-num">${si + 1}</div>
              <input type="number" class="set-input ${set.done ? 'completed' : ''}" id="reps-${ei}-${si}" placeholder="${lastEx?.sets?.[si]?.reps || 'reps'}" value="${set.reps || ''}" oninput="updateSet(${ei},${si},'reps',this.value)" inputmode="numeric">
              <button type="button" class="set-check ${set.done ? 'done' : ''}" onclick="toggleSet(${ei},${si})">${set.done ? '✓' : ''}</button>
            </div>
          `;
        }
        return `
          <div class="set-row" id="setrow-${ei}-${si}" ontouchstart="forjaSetSwipeStart(event)" ontouchend="forjaSetSwipeEnd(event,${ei},${si})">
            <div class="set-num">${si + 1}</div>
            <input type="number" class="set-input ${set.done ? 'completed' : ''}" id="weight-${ei}-${si}" placeholder="${lastEx?.sets?.[si]?.weight || 'lbs'}" value="${set.weight || ''}" oninput="updateSet(${ei},${si},'weight',this.value)" inputmode="decimal">
            <input type="number" class="set-input ${set.done ? 'completed' : ''}" id="reps-${ei}-${si}" placeholder="${lastEx?.sets?.[si]?.reps || 'reps'}" value="${set.reps || ''}" oninput="updateSet(${ei},${si},'reps',this.value)" inputmode="numeric">
            <button type="button" class="set-check ${set.done ? 'done' : ''}" onclick="toggleSet(${ei},${si})">${set.done ? '✓' : ''}</button>
          </div>
        `;
      }).join('');

      return `
        <div class="exercise-card training-card">
          <div class="exercise-header">
            <div class="exercise-topline">
              <div class="exercise-index">${ei + 1}</div>
              <div class="exercise-title-block">
                <div class="exercise-name">${ex.name}</div>
                <div class="exercise-submeta">${ex.sets.length} ${cardio ? 'registro activo' : 'series activas'}${bodyweight ? ' · peso corporal' : ''}${cardio ? ' · tiempo / distancia' : ''}</div>
              </div>
            </div>
            ${lastEx ? '<div class="prev-badge">ANTERIOR ↑</div>' : ''}
          </div>

          ${ex.note ? `<div class="prev-info">⚠️ ${ex.note}</div>` : ''}

          <div class="exercise-tools" style="justify-content:space-between;">
            <button type="button" class="ghost-link" onclick="deleteExercise(${ei})" style="color:#ff6b6b;">🗑️ Eliminar ejercicio</button>
            <button type="button" class="ghost-link" onclick="replaceExercise(${ei})">✏️ Cambiar ejercicio</button>
          </div>

          ${replacementHtml}
          ${prevHtml}
          ${insightHtml}
          ${smartNoteHtml}

          <div class="sets-table">
            <div class="sets-header ${bodyweight ? 'bodyweight-header' : ''}">
              <div></div>
              ${cardio ? '<div style="text-align:center">TIEMPO</div><div style="text-align:center">KM</div>' : (bodyweight ? '<div class="bodyweight-reps-label">REPS</div>' : '<div style="text-align:center">PESO</div><div style="text-align:center">REPS</div>')}
              <div></div>
            </div>
            ${setsHtml}
            <button type="button" class="add-set-btn" onclick="addSet(${ei})">+ Agregar serie</button>
          </div>

          <div class="notes-shell">
            <textarea class="notes-input" rows="2" placeholder="Notas técnicas, sensación, tempo, RIR..." oninput="updateNotes(${ei}, this.value)">${ex.notes || ''}</textarea>
          </div>
        </div>
      `;
    }).join('')}
    <button type="button" class="add-set-btn" onclick="addExerciseToSession()" style="margin-top:18px; touch-action:manipulation;">
      <span class="add-exercise-text">+ Agregar ejercicio</span>
    </button>
  `;
}

function deleteExercise(ei) {
  if (!currentSession?.exercises?.[ei]) return;

  if (currentSession.exercises.length <= 1) {
    showToast('⚠️ Debe quedar al menos un ejercicio');
    return;
  }

  const ex = currentSession.exercises[ei];
  const hasData = ex.sets?.some(st => st.done || st.weight || st.reps) || ex.notes;

  if (hasData && !confirm(`¿Eliminar "${ex.name}" y sus datos de esta sesión?`)) return;
  if (!hasData && !confirm(`¿Eliminar "${ex.name}" de esta sesión?`)) return;

  currentSession.exercises.splice(ei, 1);
  markCurrentSessionChanged();
  saveCurrentDraft();
  renderExercises();
  showToast('🗑️ Ejercicio eliminado');
}

function addSet(ei) {
  const ex = currentSession.exercises[ei];
  const lastSet = ex.sets[ex.sets.length - 1];

  if (isCardioExercise(ex)) {
    ex.sets.push({
      weight: '',
      reps: lastSet?.reps || '',
      done: false,
      cardioTimer: { elapsedMs: 0, startedAt: null, running: false }
    });
  } else {
    ex.sets.push({
      weight: isBodyweightExercise(ex) ? '0' : (lastSet?.weight || ''),
      reps: lastSet?.reps || '',
      done: false
    });
  }

  markCurrentSessionChanged();
  saveCurrentDraft();
  renderExercises();
}

let forjaSetSwipeX = 0;
let forjaSetSwipeY = 0;

function forjaTouchStartedOnInteractiveControl(event) {
  const target = event?.target;
  return !!(target?.closest && target.closest('button, input, textarea, select'));
}

function forjaSetSwipeStart(event) {
  if (forjaTouchStartedOnInteractiveControl(event)) {
    forjaSetSwipeX = 0;
    forjaSetSwipeY = 0;
    return;
  }

  const touch = event.changedTouches && event.changedTouches[0];
  if (!touch) return;
  forjaSetSwipeX = touch.clientX;
  forjaSetSwipeY = touch.clientY;
}

function forjaSetSwipeEnd(event, ei, si) {
  if (forjaTouchStartedOnInteractiveControl(event)) return;

  const touch = event.changedTouches && event.changedTouches[0];
  if (!touch) return;
  const dx = touch.clientX - forjaSetSwipeX;
  const dy = touch.clientY - forjaSetSwipeY;
  if (dx < -70 && Math.abs(dy) < 45) deleteSet(ei, si);
}

function deleteSet(ei, si) {
  if (!currentSession?.exercises?.[ei]?.sets?.[si]) return;
  const ex = currentSession.exercises[ei];
  const set = ex.sets[si];
  const hasData = !!(set.weight || set.reps || set.done);
  const msg = hasData ? '¿Eliminar esta serie y sus datos?' : '¿Eliminar esta serie?';
  if (!confirm(msg)) return;
  ex.sets.splice(si, 1);
  if (!ex.sets.length) ex.sets.push({ weight: isBodyweightExercise(ex) ? '0' : '', reps: '', done: false });
  markCurrentSessionChanged();
  saveCurrentDraft();
  renderExercises();
  updateSessionCounters();
  showToast('🗑️ Serie eliminada');
}

function addExerciseToSession() {
  if (!currentSession) return;

  const cardioExercises = [
    { name: 'Bicicleta', sets: 1, type: 'cardio' },
    { name: 'Caminadora', sets: 1, type: 'cardio' },
    { name: 'Elíptica', sets: 1, type: 'cardio' },
    { name: 'Escaladora', sets: 1, type: 'cardio' }
  ];

  const allExercises = [...cardioExercises, ...ROUTINES.flatMap(r => r.exercises || [])];
  const uniqueExercises = allExercises
    .filter((ex, index, arr) => arr.findIndex(e => normalizeText(e.name) === normalizeText(ex.name)) === index)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  const oldOverlay = document.getElementById('exerciseAddOverlay');
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'exerciseAddOverlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.72);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
  `;

  overlay.innerHTML = `
    <div style="
      width: 100%;
      max-width: 430px;
      background: #241238;
      border: 1px solid rgba(205,180,120,0.22);
      border-radius: 22px;
      padding: 18px;
      box-shadow: 0 18px 48px rgba(0,0,0,0.45);
      color: #f7f2ea;
      font-family: 'DM Sans', sans-serif;
    ">
      <div style="
        font-family: 'Bebas Neue', sans-serif;
        font-size: 26px;
        letter-spacing: 1.5px;
        color: #c9a44c;
        margin-bottom: 12px;
      ">Agregar ejercicio</div>

      <label style="font-size:12px;color:#a89cb8;text-transform:uppercase;letter-spacing:1px;">Selecciona uno</label>
      <select id="exerciseAddSelect" style="
        width:100%;
        margin-top:8px;
        margin-bottom:14px;
        padding:13px 12px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.12);
        background:#12051f;
        color:#f7f2ea;
        font-size:14px;
        font-family:'DM Sans', sans-serif;
      ">
        ${uniqueExercises.map((ex, i) => `<option value="${i}">${escapeHtml(ex.name)}</option>`).join('')}
      </select>

      <label style="font-size:12px;color:#a89cb8;text-transform:uppercase;letter-spacing:1px;">O escribe uno nuevo</label>
      <input id="customExerciseAddInput" type="text" placeholder="Ejemplo: Caminadora inclinada" style="
        width:100%;
        margin-top:8px;
        margin-bottom:16px;
        padding:13px 12px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.12);
        background:#12051f;
        color:#f7f2ea;
        font-size:14px;
        font-family:'DM Sans', sans-serif;
      ">

      <div style="display:flex;gap:10px;">
        <button id="cancelExerciseAdd" style="
          flex:1;
          padding:13px;
          border-radius:12px;
          border:1px solid rgba(205,180,120,0.18);
          background:rgba(255,255,255,0.04);
          color:#c9a44c;
          font-family:'Bebas Neue', sans-serif;
          font-size:18px;
          letter-spacing:1px;
          cursor:pointer;
        ">Cancelar</button>
        <button id="applyExerciseAdd" style="
          flex:1;
          padding:13px;
          border-radius:12px;
          border:none;
          background:#c9a44c;
          color:#12051f;
          font-family:'Bebas Neue', sans-serif;
          font-size:18px;
          letter-spacing:1px;
          cursor:pointer;
        ">Agregar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById('cancelExerciseAdd').onclick = () => overlay.remove();
  overlay.onclick = (event) => { if (event.target === overlay) overlay.remove(); };

  document.getElementById('applyExerciseAdd').onclick = () => {
    const selectedIndex = parseInt(document.getElementById('exerciseAddSelect').value, 10);
    const customName = document.getElementById('customExerciseAddInput').value.trim();
    const selected = customName ? { name: customName, sets: 1, note: null, type: isCardioExerciseName(customName) ? 'cardio' : null } : uniqueExercises[selectedIndex];
    if (!selected?.name) {
      showToast('⚠️ Selecciona o escribe un ejercicio');
      return;
    }

    const lastEx = getLastExerciseData(currentSession.routineId, selected.name);
    const setCount = Math.max(1, Number(selected.sets) || 1);
    currentSession.exercises.push({
      name: selected.name,
      originalName: selected.name,
      note: selected.note || null,
      replaced: false,
      added: true,
      type: selected.type || (isCardioExerciseName(selected.name) ? 'cardio' : null),
      sets: Array.from({ length: setCount }, (_, i) => {
        const lastSet = lastEx?.sets?.[i];
        return { weight: lastSet?.weight || '', reps: lastSet?.reps || '', done: false };
      })
    });

    markCurrentSessionChanged();
    overlay.remove();
    saveCurrentDraft();
    renderExercises();
    updateSessionCounters();
    showToast('✅ Ejercicio agregado');
  };
}

let forjaTimerInterval = null;
let forjaTimerState = { active:false, endAt:null, pausedMs:null };
const FORJA_TIMER_KEY = 'forja_rest_timer_state_v3';

function readStoredTimer() {
  try {
    const saved = JSON.parse(localStorage.getItem(FORJA_TIMER_KEY) || 'null');
    if (saved && saved.active) forjaTimerState = saved;
  } catch {}
}

function saveStoredTimer() {
  if (!forjaTimerState.active) localStorage.removeItem(FORJA_TIMER_KEY);
  else localStorage.setItem(FORJA_TIMER_KEY, JSON.stringify(forjaTimerState));
}

function timerRemainingMs() {
  if (!forjaTimerState.active) return 0;
  if (forjaTimerState.pausedMs !== null) return Math.max(0, forjaTimerState.pausedMs || 0);
  if (!forjaTimerState.endAt) return 0;
  return Math.max(0, forjaTimerState.endAt - Date.now());
}

function renderTimer() {
  const wrap = document.querySelector('.timer-wrap');
  const display = document.getElementById('timerDisplay');
  const controls = document.getElementById('timerControls');
  const pauseBtn = document.getElementById('timerPauseBtn');
  if (wrap && wrap.parentElement !== document.body) document.body.appendChild(wrap);
  const ms = timerRemainingMs();

  if (!forjaTimerState.active || ms <= 0) {
    document.body.classList.remove('timer-active');
    if (display) { display.textContent = ''; display.classList.remove('visible'); }
    if (controls) controls.classList.remove('visible');
    if (pauseBtn) pauseBtn.textContent = '⏸';
    return;
  }

  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (display) {
    display.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
    display.classList.add('visible');
  }
  if (controls) controls.classList.add('visible');
  if (pauseBtn) pauseBtn.textContent = forjaTimerState.pausedMs !== null ? '▶' : '⏸';
  document.body.classList.add('timer-active');
}

function timerTick() {
  if (forjaTimerState.active && forjaTimerState.pausedMs === null && forjaTimerState.endAt && Date.now() >= forjaTimerState.endAt) {
    forjaTimerState = { active:false, endAt:null, pausedMs:null };
    saveStoredTimer();
    renderTimer();
    try { playTimerBeep(); } catch {}
    showToast('⏱ Descanso terminado — siguiente serie');
    return;
  }
  renderTimer();
}

function restartTimerInterval() {
  clearInterval(forjaTimerInterval);
  forjaTimerInterval = null;
  if (forjaTimerState.active && forjaTimerState.pausedMs === null) {
    forjaTimerInterval = setInterval(timerTick, 250);
  }
}

function startTimer(seconds) {
  const duration = Math.max(1, Number(seconds) || 120);
  unlockTimerAudio();
  forjaTimerState = { active:true, endAt: Date.now() + duration * 1000, pausedMs:null };
  saveStoredTimer();
  renderTimer();
  restartTimerInterval();
}

function adjustTimer(seconds) {
  if (!forjaTimerState.active) return;
  const delta = (Number(seconds) || 0) * 1000;
  if (forjaTimerState.pausedMs !== null) {
    forjaTimerState.pausedMs = Math.max(1000, forjaTimerState.pausedMs + delta);
  } else {
    forjaTimerState.endAt = Math.max(Date.now() + 1000, (forjaTimerState.endAt || Date.now()) + delta);
  }
  saveStoredTimer();
  renderTimer();
  restartTimerInterval();
}

function toggleTimerPause() {
  if (!forjaTimerState.active) return;
  if (forjaTimerState.pausedMs !== null) {
    forjaTimerState.endAt = Date.now() + forjaTimerState.pausedMs;
    forjaTimerState.pausedMs = null;
  } else {
    forjaTimerState.pausedMs = timerRemainingMs();
    forjaTimerState.endAt = null;
  }
  saveStoredTimer();
  renderTimer();
  restartTimerInterval();
}

function stopTimer() {
  clearInterval(forjaTimerInterval);
  forjaTimerInterval = null;
  forjaTimerState = { active:false, endAt:null, pausedMs:null };
  saveStoredTimer();
  renderTimer();
}

function getSessionBestSet(session) {
  const allSets = (session.exercises || []).flatMap(ex => {
    return (ex.sets || [])
      .filter(st => st.done && !isCardioExerciseName(ex.name))
      .map(st => ({
        exerciseName: ex.name,
        weight: parseFloat(st.weight) || 0,
        reps: parseFloat(st.reps) || 0
      }));
  });

  if (!allSets.length) return null;

  return allSets.reduce((best, set) => {
    const score = set.weight * set.reps;
    const bestScore = best.weight * best.reps;
    return score > bestScore ? set : best;
  }, allSets[0]);
}

function getSessionSummaryStats(session) {
  const exercises = session.exercises || [];

  const completedSets = exercises.reduce((acc, ex) => {
    return acc + (ex.sets || []).filter(st => st.done).length;
  }, 0);

  const totalVolume = exercises.reduce((acc, ex) => {
    if (isCardioExerciseName(ex.name)) return acc;
    return acc + getVolume(ex.sets || []);
  }, 0);

  const cardio = exercises
    .filter(ex => isCardioExerciseName(ex.name))
    .flatMap(ex => ex.sets || [])
    .filter(st => st.done);

  const cardioMinutes = cardio.reduce((acc, st) => acc + (parseFloat(st.weight) || 0), 0);
  const cardioKm = cardio.reduce((acc, st) => acc + (parseFloat(st.reps) || 0), 0);

  return {
    exercisesCount: exercises.length,
    completedSets,
    totalVolume: Math.round(totalVolume),
    cardioMinutes,
    cardioKm,
    bestSet: getSessionBestSet(session)
  };
}
function showPostSessionSavedMessage(session, wasEditing = false) {
  const oldOverlay = document.getElementById('postSessionSummaryOverlay');
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'postSessionSummaryOverlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(10, 3, 18, 0.82);
    backdrop-filter: blur(14px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
  `;

  overlay.innerHTML = `
    <div style="
      width: 100%;
      max-width: 420px;
      border-radius: 26px;
      padding: 22px;
      background: linear-gradient(180deg, rgba(45,24,69,.98), rgba(18,5,31,.98));
      border: 1px solid rgba(205,180,120,.22);
      box-shadow: 0 24px 70px rgba(0,0,0,.45);
      color: #f7f2ea;
      font-family: 'DM Sans', sans-serif;
    ">
      <div style="
        font-family: 'Bebas Neue', sans-serif;
        font-size: 34px;
        letter-spacing: 1.6px;
        color: #d8b65d;
        margin-bottom: 8px;
      ">
        Sesión guardada
      </div>

      <div style="font-size: 14px; color: #bfb3cc; line-height: 1.5; margin-bottom: 18px;">
        ${wasEditing ? 'Cambios guardados correctamente.' : 'Entrenamiento terminado correctamente.'}<br>
        <strong style="color:#f7f2ea;">${escapeHtml(session?.routineName || 'Rutina')}</strong><br>
        <span style="display:block;margin-top:10px;color:#d8b65d;">Si quieres compartir o generar tarjeta, ve a Historial.</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <button id="summaryGoHome" style="
          padding:14px;
          border-radius:14px;
          border:1px solid rgba(205,180,120,.24);
          background:rgba(255,255,255,.04);
          color:#d8b65d;
          font-family:'Bebas Neue', sans-serif;
          font-size:19px;
          letter-spacing:1px;
        ">Inicio</button>

        <button id="summaryGoHistory" style="
          padding:14px;
          border-radius:14px;
          border:none;
          background:#d8b65d;
          color:#12051f;
          font-family:'Bebas Neue', sans-serif;
          font-size:19px;
          letter-spacing:1px;
        ">Historial</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('summaryGoHome').onclick = () => {
    overlay.remove();
    showScreen('home');
  };

  document.getElementById('summaryGoHistory').onclick = () => {
    overlay.remove();
    showScreen('history');
  };
}

function toggleSet(ei, si) {
  if (!currentSession?.exercises?.[ei]?.sets?.[si]) return;
  const ex = currentSession.exercises[ei];
  const bodyweight = isBodyweightExercise(ex);
  const cardio = isCardioExercise(ex);
  const set = ex.sets[si];
  const wEl = document.getElementById(`weight-${ei}-${si}`);
  const rEl = document.getElementById(`reps-${ei}-${si}`);
  if (!rEl) return;

  if (!set.done) {
    if (cardio) {
      set.weight = wEl ? (wEl.value || '') : '';
      set.reps = rEl.value || '';
      if (wEl) wEl.value = set.weight;
    } else if (bodyweight) {
      set.weight = '0';
      set.reps = rEl.value || rEl.placeholder;
    } else {
      set.weight = wEl ? (wEl.value || wEl.placeholder) : '';
      set.reps = rEl.value || rEl.placeholder;
      if (wEl) wEl.value = set.weight;
    }
    rEl.value = set.reps;
  }

  set.done = !set.done;
  markCurrentSessionChanged();
  if (wEl) wEl.className = `set-input ${set.done ? 'completed' : ''}`;
  rEl.className = `set-input ${set.done ? 'completed' : ''}`;

  const btn = document.querySelector(`#setrow-${ei}-${si} .set-check`);
  if (btn) {
    btn.className = `set-check ${set.done ? 'done' : ''}`;
    btn.textContent = set.done ? '✓' : '';
  }

  updateSessionCounters();
  saveCurrentDraft();

  if (set.done && !cardio) {
    const t = {
      'Elevacion Laterales (Mancuerna)': 75,
      'Tirón a la Cara': 75,
      'Elevación de Gemelos Sentado': 75,
      'Elevación de Gemelos de Pie (Máquina)': 75,
      'Extensión de Pierna': 90,
      'Curl de Bíceps (Barra)': 90,
      'Curl Martillo (Mancuerna)': 90,
      'Aperturas (Máquina)': 90,
      'Fondo de Tríceps': 90,
      'Tríceps con Polea': 90,
      'Vuelos invertidos para deltoides posteriores (mancuerna)': 90,
      'Sentadilla Búlgara': 120,
      'Curl de Pierna Sentado': 120,
      'Jalón al Pecho (Cable)': 120,
      'Jalón al Pecho - Agarre Cerrado (Cable)': 120,
      'Remo Sentado con Agarre en V (Cable)': 120,
      'Press de Hombros Sentado (Barra)': 120,
      'Press de Hombros (Mancuerna)': 120,
      'Press de Banca Inclinado (Mancuerna)': 150,
      'Remo Inclinado (Barra)': 150,
      'Press de Piernas': 150,
      'Sentadilla Hack (Máquina)': 180,
      'Peso Muerto Rumano (Barra)': 180,
      'Press de Banca (Barra)': 180
    };
    startTimer(t[ex.name] || 120);
  }
}

function enterTrainingMode() {
  document.body.classList.remove('session-preview-active');
  document.body.classList.add('training-active');
  const actions = document.querySelector('#sessionScreen .session-legacy-actions');
  if (actions) {
    const buttons = actions.querySelectorAll('button');
    if (buttons[0]) {
      buttons[0].onclick = minimizeSession;
      buttons[0].textContent = '⌄';
      buttons[0].setAttribute('aria-label', 'Ocultar entrenamiento');
      buttons[0].setAttribute('title', 'Ocultar entrenamiento');
    }
    if (buttons[1]) buttons[1].onclick = discardSession;
  }
  renderTimer();
}

function exitTrainingMode() {
  document.body.classList.remove('training-active');
  renderTimer();
}

function minimizeSession() {
  if (!currentSession) {
    showScreen('home');
    return;
  }
  if (!editingSessionKey) saveCurrentDraft();
  exitTrainingMode();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const home = document.getElementById('homeScreen');
  if (home) home.classList.add('active');
  const firstNav = document.querySelectorAll('.nav-btn')[0];
  if (firstNav) firstNav.classList.add('active');
  setSessionsLocal(getSessionsLocal());
  renderHome();
  renderHistory();
  showToast('✅ Entrenamiento oculto');
}

window.addEventListener('visibilitychange', () => { readStoredTimer(); timerTick(); restartTimerInterval(); }, { passive:true });
window.addEventListener('focus', () => { readStoredTimer(); timerTick(); restartTimerInterval(); }, { passive:true });
window.addEventListener('pageshow', () => { readStoredTimer(); timerTick(); restartTimerInterval(); }, { passive:true });
window.addEventListener('touchstart', () => { unlockTimerAudio(); readStoredTimer(); timerTick(); restartTimerInterval(); }, { passive:true });
window.addEventListener('pointerdown', () => { unlockTimerAudio(); readStoredTimer(); timerTick(); restartTimerInterval(); }, { passive:true });
readStoredTimer();
renderTimer();
restartTimerInterval();


// Modo local y respaldos
let authBootDone = false;
let authBusy = false;


function setAuthLocked(locked) {
  document.body.classList.toggle('auth-locked', false);
}

function setAuthStatus(message, isError = false) {
  const el = document.getElementById('authStatus');
  if (!el) return;
  el.textContent = message || '';
  el.style.color = isError ? '#ffb4b4' : '';
}

function getForjaBackupPayload() {
  return {
    app: 'FORJA',
    storage: 'local',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: getProfileLocal(),
    routines: getRoutinesLocal(),
    sessions: getSessionsLocal()
  };
}

function downloadForjaBackup() {
  const payload = getForjaBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `forja-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('✅ Respaldo exportado');
}

function importForjaBackup(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const payload = JSON.parse(e.target.result || '{}');
      const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
      const routines = Array.isArray(payload.routines) ? payload.routines : [];
      const profile = payload.profile && typeof payload.profile === 'object' ? payload.profile : null;

      if (!sessions.length && !routines.length && !profile) throw new Error('El archivo no parece ser un respaldo de FORJA.');

      if (routines.length) {
        ROUTINES = cloneData(routines);
        cacheRoutinesLocal();
      }
      if (sessions.length) {
        setSessionsLocal(dedupeSessions([...sessions, ...getSessionsLocal()]));
        localSessionsCache = getSessionsLocal();
        localSessionsLoaded = true;
      }
      if (profile) saveProfileLocal({ ...getDefaultProfile(), ...profile });

      renderAuthLoggedIn();
      renderHome();
      renderHistory();
      if (document.getElementById('profileScreen')?.classList.contains('active')) await renderProfile();
      showToast('✅ Respaldo importado');
    } catch (error) {
      console.error('importForjaBackup', error);
      showToast('❌ No se pudo importar el respaldo');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function renderAuthLoading(statusText = 'Cargando datos locales…') {
  renderAuthLoggedIn(statusText);
}

function renderAuthLoggedOut(statusText = 'FORJA funciona localmente en este dispositivo.') {
  renderAuthLoggedIn(statusText);
}

function renderAuthLoggedIn(statusText = 'Datos guardados solo en este dispositivo.') {
  currentUser = LOCAL_USER;
  localSessionsCache = getSessionsLocal();
  localSessionsLoaded = true;
  const panel = document.getElementById('authPanel');
  if (!panel) return;
  const sessionsCount = getSessionsLocal().length;
  const routinesCount = getRoutinesLocal().length;
  panel.innerHTML = `
    <div class="profile-shell">
      <div class="profile-head">
        <div>
          <div class="eyebrow">Modo local</div>
          <div class="profile-name">FORJA</div>
          <div class="profile-sub">${escapeHtml(statusText)}</div>
        </div>
        <div class="profile-badge">
          <div class="profile-badge-value">${sessionsCount}</div>
          <div class="profile-badge-label">Sesiones</div>
        </div>
      </div>
      <div class="profile-note">
        <div class="profile-note-title">Almacenamiento</div>
        <div>Sin servidor y sin cuenta. El historial, perfil y rutinas se guardan en el almacenamiento local de este dispositivo.</div>
      </div>
      <div class="profile-actions">
        <button class="ghost-btn" onclick="downloadForjaBackup()">Exportar respaldo JSON</button>
        <button class="ghost-btn" onclick="document.getElementById('forjaBackupInput').click()">Importar respaldo JSON</button>
        <input id="forjaBackupInput" type="file" accept="application/json,.json" style="display:none" onchange="importForjaBackup(event)">
      </div>
      <div class="profile-note" style="margin-top:14px;">
        <div class="profile-note-title">Resumen local</div>
        <div>${routinesCount} rutinas guardadas · ${sessionsCount} sesiones en historial</div>
      </div>
    </div>
  `;
}

async function getAuthUserFast() {
  return LOCAL_USER;
}

async function renderAuthStatus() {
  renderAuthLoggedIn();
}

async function afterLogin(user = LOCAL_USER) {
  currentUser = LOCAL_USER;
  localSessionsCache = getSessionsLocal();
  localSessionsLoaded = true;
  routinesLocalLoaded = true;
  setAuthLocked(false);
  renderAuthLoggedIn();
  await ensureRoutinesReady(false);
  renderHome();
  renderHistory();
  if (document.getElementById('profileScreen')?.classList.contains('active')) await renderProfile();
}

async function signIn() {
  await afterLogin(LOCAL_USER);
  showToast('✅ Modo local activo');
}

async function signUp() {
  await afterLogin(LOCAL_USER);
  showToast('✅ Modo local activo');
}

async function signOut() {
  await afterLogin(LOCAL_USER);
  showToast('💾 Tus datos siguen guardados localmente');
}

window.signIn = signIn;
window.signUp = signUp;
window.signOut = signOut;
window.downloadForjaBackup = downloadForjaBackup;
window.importForjaBackup = importForjaBackup;

async function ensureLocalHistoryReady(force = false) {
  localSessionsCache = getSessionsLocal();
  localSessionsLoaded = true;
  return localSessionsCache;
}


function activateOnlyScreen(name) {
  const screenMap = {
    home: 'homeScreen',
    history: 'historyScreen',
    session: 'sessionScreen',
    detail: 'detailScreen',
    profile: 'profileScreen',
    auth: 'authScreen'
  };

  const targetId = screenMap[name] || 'homeScreen';

  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });

  const target = document.getElementById(targetId);
  if (target) target.classList.add('active');
}

function updateBottomNav(name) {
  const navMap = {
    home: 0,
    history: 1,
    profile: 2,
    auth: 3
  };

  document.querySelectorAll('.nav-btn').forEach((button, index) => {
    button.classList.toggle('active', navMap[name] === index);
  });
}


function showScreen(name) {
  const goingToSession = name === 'session';

  if (!goingToSession) document.body.classList.remove('session-preview-active');

  if (currentSession && !goingToSession) {
    if (!editingSessionKey) saveCurrentDraft();
    renderTimer();
  }

  activateOnlyScreen(name);
  updateBottomNav(name);

  if (name === 'auth') {
    renderAuthLoggedIn();
    return;
  }

  if (name === 'session' && currentSession) enterTrainingMode();
  else exitTrainingMode();

  setAuthLocked(false);

  if (name === 'history') {
    renderHistory();
    return;
  }

  if (name === 'home') {
    renderHome();
    ensureRoutinesReady(false).then(renderHome);
    return;
  }

  if (name === 'profile') { try { renderProfile(); } catch (error) { console.warn('renderProfile', error); } }
}


async function initApp() {
  currentUser = LOCAL_USER;
  localSessionsCache = getSessionsLocal();
  localSessionsLoaded = true;
  authBootDone = true;
  setAuthLocked(false);
  await ensureRoutinesReady(false);
  activateOnlyScreen('home');
  updateBottomNav('home');
  renderAuthLoggedIn();
  renderHome();
  renderHistory();
}


// Modo local: no hay login, listener remoto ni restauración desde servidor.


// Recuperación local de sesiones
function forjaLooksLikeSession(obj) {
  return !!obj && typeof obj === 'object' && !Array.isArray(obj) &&
    (obj.routineName || obj.routine_name || obj.name) &&
    (obj.date || obj.finishedAt || obj.startedAt || obj.created_at) &&
    Array.isArray(obj.exercises);
}

function forjaCollectSessionsDeep(value, out, depth = 0) {
  if (!value || depth > 4) return;
  if (Array.isArray(value)) {
    for (const item of value) forjaCollectSessionsDeep(item, out, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;
  if (forjaLooksLikeSession(value)) {
    out.push(value);
    return;
  }
  for (const key of Object.keys(value)) {
    if (/routine|profile|timer|auth|user/i.test(key)) continue;
    forjaCollectSessionsDeep(value[key], out, depth + 1);
  }
}

function getAllRecoverableLocalSessions() {
  const found = [];
  try {
    const directKeys = ['gymlog_sessions', 'forja_sessions', 'sessions', 'forja_history', 'gymlog_history'];
    for (const key of directKeys) {
      try { forjaCollectSessionsDeep(JSON.parse(localStorage.getItem(key) || 'null'), found); } catch {}
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (!/session|history|forja|gymlog/i.test(key)) continue;
      if (/current|timer|routine|profile|auth|servidor/i.test(key)) continue;
      try { forjaCollectSessionsDeep(JSON.parse(localStorage.getItem(key) || 'null'), found); } catch {}
    }
  } catch (error) {
    console.warn('getAllRecoverableLocalSessions', error);
  }
  return dedupeSessions(found);
}

function getSessionsLocal() {
  return dedupeSessions(readSessionsArrayFromStorageKey('gymlog_sessions'));
}


function getSessions() {
  localSessionsCache = getSessionsLocal();
  localSessionsLoaded = true;
  return dedupeSessions(getSessionsLocal()).filter(s => !shouldHideFromHistory(s));
}


function getSessionDoneSets(session) {
  const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
  return exercises.reduce((acc, ex) => {
    return acc + ((ex.sets || []).filter(st => st.done).length);
  }, 0);
}

function getSessionVolume(session) {
  const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
  return exercises.reduce((acc, ex) => {
    if (!ex || isCardioExerciseName(ex.name)) return acc;
    return acc + ((ex.sets || []).filter(st => st.done).reduce((sum, st) => {
      return sum + (parseFloat(st.weight) || 0) * (parseFloat(st.reps) || 0);
    }, 0));
  }, 0);
}

function getProgressChartsHtml(sessions) {
  const chartSessions = (sessions || []).slice(0, 8).reverse();

  if (!chartSessions.length) return '';

  const volumes = chartSessions.map(s => getSessionVolume(s));
  const sets = chartSessions.map(s => getSessionDoneSets(s));

  const maxVolume = Math.max(...volumes, 1);
  const maxSets = Math.max(...sets, 1);

  return `
    <div class="progress-chart-panel">
      <div class="progress-chart-head">
        <div>
          <div class="progress-chart-label">Gráficas de progreso</div>
          <div class="progress-chart-sub">Últimas ${chartSessions.length} sesiones visibles</div>
        </div>
      </div>

      <div class="progress-chart-block">
        <div class="progress-chart-title">Volumen por sesión</div>
        <div class="progress-bars">
          ${chartSessions.map((s, i) => `
            <div class="progress-bar-row">
              <div class="progress-bar-date">${formatDate(s.date)}</div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width:${Math.max(6, Math.round((volumes[i] / maxVolume) * 100))}%;"></div>
              </div>
              <div class="progress-bar-value">${Math.round(volumes[i]).toLocaleString()}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="progress-chart-block">
        <div class="progress-chart-title">Series por sesión</div>
        <div class="progress-bars">
          ${chartSessions.map((s, i) => `
            <div class="progress-bar-row">
              <div class="progress-bar-date">${formatDate(s.date)}</div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill soft" style="width:${Math.max(6, Math.round((sets[i] / maxSets) * 100))}%;"></div>
              </div>
              <div class="progress-bar-value">${sets[i]}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}
function getExerciseRecords(sessions) {
  const records = {};

  (sessions || []).forEach(session => {
    const date = session.date || '';

    (session.exercises || []).forEach(ex => {
      if (!ex || !ex.name || isCardioExerciseName(ex.name)) return;

      (ex.sets || []).forEach(st => {
        if (!st || !st.done) return;

        const weight = parseFloat(st.weight) || 0;
        const reps = parseFloat(st.reps) || 0;
        if (weight <= 0 || reps <= 0) return;

        const score = weight * reps;
        const name = ex.name;

        if (!records[name]) {
          records[name] = {
            name,
            bestWeight: { weight, reps, date },
            bestSet: { weight, reps, score, date }
          };
          return;
        }

        const currentWeight = records[name].bestWeight;
        if (weight > currentWeight.weight || (weight === currentWeight.weight && reps > currentWeight.reps)) {
          records[name].bestWeight = { weight, reps, date };
        }

        const currentSet = records[name].bestSet;
        if (score > currentSet.score) {
          records[name].bestSet = { weight, reps, score, date };
        }
      });
    });
  });

  return Object.values(records).sort((a, b) => a.name.localeCompare(b.name));
}

function getExerciseRecordsHtml(sessions) {
  const records = getExerciseRecords(sessions);

  if (!records.length) return '';

  return `
    <div class="exercise-records-panel">
      <div class="exercise-records-head">
        <div>
          <div class="exercise-records-label">Mejores marcas</div>
          <div class="exercise-records-sub">Récords por ejercicio registrado</div>
        </div>
        <strong>${records.length}</strong>
      </div>

      <div class="exercise-records-list">
        ${records.slice(0, 6).map(record => `
          <div class="exercise-record-row">
            <div class="exercise-record-name">${escapeHtml(record.name)}</div>
            <div class="exercise-record-data">
              <span><strong>${record.bestWeight.weight}</strong> lb × ${record.bestWeight.reps}</span>
              <span><strong>${Math.round(record.bestSet.score).toLocaleString()}</strong> vol. serie</span>
              <span>${formatDate(record.bestWeight.date)}</span>
            </div>
          </div>
        `).join('')}
      </div>

      ${records.length > 6 ? `<div class="exercise-records-more">Mostrando 6 de ${records.length} ejercicios.</div>` : ''}
    </div>
  `;
}
function getRoutineStatsHtml(sessions) {
  const stats = {};

  (sessions || []).forEach(session => {
    const key = session.routineId || session.routineName || 'sin_rutina';
    const name = session.routineName || 'Sesión';

    if (!stats[key]) {
      stats[key] = {
        name,
        sessions: 0,
        sets: 0,
        volume: 0,
        lastDate: session.date || ''
      };
    }

    stats[key].sessions += 1;
    stats[key].sets += getSessionDoneSets(session);
    stats[key].volume += getSessionVolume(session);

    if (session.date && (!stats[key].lastDate || new Date(session.date) > new Date(stats[key].lastDate))) {
      stats[key].lastDate = session.date;
    }
  });

  const rows = Object.values(stats).sort((a, b) => b.sessions - a.sessions || b.volume - a.volume);
  if (!rows.length) return '';

  return `
    <div class="routine-stats-panel">
      <div class="routine-stats-head">
        <div>
          <div class="routine-stats-label">Resumen por rutina</div>
          <div class="routine-stats-sub">Sesiones, series y volumen por tipo de entrenamiento</div>
        </div>
        <strong>${rows.length}</strong>
      </div>

      <div class="routine-stats-list">
        ${rows.map(row => `
          <div class="routine-stats-row">
            <div>
              <div class="routine-stats-name">${escapeHtml(row.name)}</div>
              <div class="routine-stats-date">Última: ${formatDate(row.lastDate)}</div>
            </div>
            <div class="routine-stats-data">
              <span><strong>${row.sessions}</strong> sesiones</span>
              <span><strong>${row.sets}</strong> series</span>
              <span><strong>${Math.round(row.volume).toLocaleString()}</strong> vol.</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function getCardioStatsHtml(sessions) {
  let records = 0;
  let minutes = 0;
  let km = 0;
  const byName = {};

  (sessions || []).forEach(session => {
    (session.exercises || []).forEach(ex => {
      if (!isCardioExerciseName(ex.name)) return;

      const done = (ex.sets || []).filter(st => st.done || st.weight || st.reps);
      if (!done.length) return;

      if (!byName[ex.name]) byName[ex.name] = { name: ex.name, records: 0, minutes: 0, km: 0 };

      done.forEach(st => {
        const min = parseFloat(st.weight) || 0;
        const distance = parseFloat(st.reps) || 0;

        records += 1;
        minutes += min;
        km += distance;

        byName[ex.name].records += 1;
        byName[ex.name].minutes += min;
        byName[ex.name].km += distance;
      });
    });
  });

  const rows = Object.values(byName).sort((a, b) => b.minutes - a.minutes || b.km - a.km);
  if (!records) return '';

  return `
    <div class="cardio-stats-panel">
      <div class="cardio-stats-head">
        <div>
          <div class="cardio-stats-label">Cardio</div>
          <div class="cardio-stats-sub">Resumen según las sesiones visibles</div>
        </div>
        <strong>${Math.round(minutes)} min</strong>
      </div>

      <div class="cardio-stats-main">
        <div><strong>${records}</strong><span>registros</span></div>
        <div><strong>${Math.round(km * 10) / 10}</strong><span>km</span></div>
        <div><strong>${Math.round(minutes)}</strong><span>min</span></div>
      </div>

      <div class="cardio-stats-list">
        ${rows.map(row => `
          <div class="cardio-stats-row">
            <span>${escapeHtml(row.name)}</span>
            <strong>${Math.round(row.minutes)} min · ${Math.round(row.km * 10) / 10} km</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
function setProfileProgressPanel(panelId) {
  profileProgressPanel = profileProgressPanel === panelId ? '' : panelId;
  renderProfile();
}

function getProfileProgressHtml(sessions) {
  const tabs = [
    { id: 'charts', label: 'Gráficas' },
    { id: 'routines', label: 'Rutinas' },
    { id: 'records', label: 'Récords' },
    { id: 'cardio', label: 'Cardio' }
  ];

  const buttonsHtml = `
    <div class="profile-progress-actions">
      ${tabs.map(tab => `
        <button class="profile-progress-btn ${profileProgressPanel === tab.id ? 'active' : ''}" onclick="setProfileProgressPanel('${tab.id}')">
          ${tab.label}
        </button>
      `).join('')}
    </div>
  `;

  if (!sessions || sessions.length === 0) {
    return buttonsHtml + `<div class="profile-progress-content"><div class="profile-progress-empty">Todavía no hay sesiones suficientes para mostrar progreso.</div></div>`;
  }

  let panelHtml = '';

  if (profileProgressPanel === 'charts') panelHtml = getProgressChartsHtml(sessions);
  if (profileProgressPanel === 'routines') panelHtml = getRoutineStatsHtml(sessions);
  if (profileProgressPanel === 'records') panelHtml = getExerciseRecordsHtml(sessions);
  if (profileProgressPanel === 'cardio') panelHtml = getCardioStatsHtml(sessions);

  if (!profileProgressPanel) {
    panelHtml = `<div class="profile-progress-empty">Elige una sección para ver tu progreso sin saturar la pantalla.</div>`;
  }

  if (!panelHtml) {
    panelHtml = `<div class="profile-progress-empty">No hay datos para esta sección todavía.</div>`;
  }

  return buttonsHtml + `<div class="profile-progress-content">${panelHtml}</div>`;
}
function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;

  const sessions = getSessions();

  if (!sessions.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No hay sesiones guardadas todavía.<br>Cuando termines un entrenamiento aparecerá aquí.</div></div>`;
    return;
  }

    const filterOptions = [
    { id: 'all', name: 'Todos' },
    ...ROUTINES.map(r => ({ id: r.id, name: r.name }))
  ];

  const visibleSessions = historyFilter === 'all'
    ? sessions
    : sessions.filter(s => s.routineId === historyFilter);

  const filtersHtml = `
    <div class="history-filter-row">
      ${filterOptions.map(opt => `
        <button class="history-filter-chip ${historyFilter === opt.id ? 'active' : ''}" onclick="setHistoryFilter('${safeJsString(opt.id)}')">
          ${escapeHtml(opt.name)}
        </button>
      `).join('')}
    </div>
  `;

  if (!visibleSessions.length) {
    list.innerHTML = filtersHtml + `<div class="empty"><div class="empty-icon">📊</div><div class="empty-text">No hay sesiones de esta rutina todavía.</div></div>`;
    return;
  }

  list.innerHTML = `
    ${filtersHtml}

    ${visibleSessions.map((s) => {
    const i = sessions.findIndex(item => sessionKey(item) === sessionKey(s));
    const active = isActiveLocalSession(s);
    const exercises = Array.isArray(s.exercises) ? s.exercises : [];
    const doneSets = exercises.reduce((acc, ex) => acc + ((ex.sets || []).filter(st => st.done).length), 0);
    const volume = exercises.reduce((acc, ex) => acc + ((ex.sets || []).reduce((a, st) => a + (parseFloat(st.weight) || 0) * (parseFloat(st.reps) || 0), 0)), 0);
    const emoji = typeof routineEmojiBySession === 'function' ? routineEmojiBySession(s) : '🏋️';
    return `
      <div class="history-card clean-history-card ${active ? 'active-session-card' : ''}"
        onclick="if(!window.__forjaLongPressDone){${active ? `editSavedSession(${i})` : `showDetail(${i})`}} window.__forjaLongPressDone=false;"
        oncontextmenu="event.preventDefault(); openSessionActions(${i});"
        onpointerdown="forjaStartLongPress(event, ${i})"
        onpointerup="forjaEndLongPress()"
        onpointerleave="forjaEndLongPress()"
        onpointercancel="forjaEndLongPress()">
        <div class="history-clean-top">
          <div class="history-symbol">${escapeHtml(emoji)}</div>
          <div class="history-clean-main">
            <div class="history-name">${escapeHtml(s.routineName || 'Sesión')}${active ? ' <span style="font-size:11px;letter-spacing:.8px;color:#f3c969;margin-left:6px;">EN CURSO</span>' : ''}</div>
            <div class="routine-meta">${exercises.length} ejercicios registrados${active ? ' · borrador local' : ''}</div>
          </div>
          <div class="history-date-clean">${formatDate(s.date)}</div>
        </div>
        <div class="forja-history-details">
          <span><strong>${doneSets}</strong> series</span>
          <span><strong>${Math.round(volume).toLocaleString()}</strong> vol.</span>
          <span><strong>${exercises.length}</strong> ejercicios</span>
        </div>
      </div>
    `;
      }).join('')}
  `;

}

initApp();
