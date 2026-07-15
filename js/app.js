/* ==========================================================================
   FitTrack — Aplicação principal
   Estrutura em "componentes": cada render* monta um pedaço da UI.
   ========================================================================== */

let state = loadState();
let currentView = 'dashboard';
let currentProfileTab = 'perfil';
let exerciseFilter = 'todos';
let exerciseSearch = '';
let historyFilter = 'semana';
let runnerCtx = null; // contexto ativo do treino em execução

function persist(){ saveState(state); }

/* -------------------------------------------------------------------- */
/* Treinos personalizados: mescla os overrides salvos pelo usuário      */
/* por cima dos templates padrão (data.js nunca é alterado em si)      */
/* -------------------------------------------------------------------- */
function getTemplate(id){
  const base = WORKOUT_TEMPLATES[id];
  if(!base) return base;
  const override = state.templateOverrides && state.templateOverrides[id];
  if(!override) return base;
  return Object.assign({}, base, override.exercises ? {exercises: override.exercises} : {});
}

/* -------------------------------------------------------------------- */
/* Boot                                                                  */
/* -------------------------------------------------------------------- */
function boot(){
  applyTheme();
  renderShell();
  navigate('dashboard');
  maybeGenerateNotifications();
  setTimeout(()=>{
    const loader = document.getElementById('loader');
    if(loader){ loader.style.opacity='0'; setTimeout(()=>loader.remove(),400); }
  }, 500);
}

function applyTheme(){
  document.body.classList.toggle('light', state.user.theme==='light');
}

/* -------------------------------------------------------------------- */
/* Shell: sidebar + mobile nav                                          */
/* -------------------------------------------------------------------- */
const NAV_ITEMS = [
  {id:'dashboard', label:'Início', icon:'🏠'},
  {id:'agenda', label:'Agenda', icon:'📅'},
  {id:'editor', label:'Editar Treinos', icon:'✏️'},
  {id:'exercises', label:'Exercícios', icon:'📚'},
  {id:'history', label:'Histórico', icon:'🕓'},
  {id:'stats', label:'Estatísticas', icon:'📊'},
  {id:'profile', label:'Perfil', icon:'👤'},
];

function renderShell(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">FT</div><div class="brand-name">FitTrack</div></div>
      <nav class="nav" id="sidebarNav"></nav>
      <div class="sidebar-footer">
        <div class="theme-toggle" id="themeToggle" role="button">
          <span>${state.user.theme==='light'?'☀️ Modo claro':'🌙 Modo escuro'}</span>
          <div class="switch"></div>
        </div>
      </div>
    </aside>
    <main class="view-wrap" id="viewWrap"></main>
    <nav class="mobile-nav" id="mobileNav"></nav>
    <div class="toast-wrap" id="toastWrap"></div>
  `;
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  renderNavLists();
}

function renderNavLists(){
  const html = NAV_ITEMS.map(n=>`
    <button class="nav-item ${currentView===n.id?'active':''}" data-nav="${n.id}">
      <span class="ico">${n.icon}</span><span class="lbl">${n.label}</span>
    </button>`).join('');
  document.getElementById('sidebarNav').innerHTML = html;
  document.getElementById('mobileNav').innerHTML = html;
  document.querySelectorAll('[data-nav]').forEach(btn=>{
    btn.addEventListener('click', ()=>navigate(btn.dataset.nav));
  });
}

function toggleTheme(){
  state.user.theme = state.user.theme==='light' ? 'dark' : 'light';
  persist();
  applyTheme();
  document.getElementById('themeToggle').innerHTML = `
    <span>${state.user.theme==='light'?'☀️ Modo claro':'🌙 Modo escuro'}</span>
    <div class="switch"></div>`;
}

function navigate(view){
  currentView = view;
  renderNavLists();
  const wrap = document.getElementById('viewWrap');
  wrap.classList.remove('view-enter');
  void wrap.offsetWidth;
  wrap.classList.add('view-enter');
  const renderers = {
    dashboard: renderDashboard,
    agenda: renderAgenda,
    editor: renderEditor,
    exercises: renderExercises,
    history: renderHistory,
    stats: renderStats,
    profile: renderProfile,
  };
  (renderers[view]||renderDashboard)();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* -------------------------------------------------------------------- */
/* Toasts / notificações                                                */
/* -------------------------------------------------------------------- */
function showToast(title, message, emoji){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div style="font-size:18px;">${emoji||'🔔'}</div><div><b>${title}</b><span>${message}</span></div>`;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .4s, transform .4s'; el.style.opacity='0'; el.style.transform='translateX(30px)'; setTimeout(()=>el.remove(),400); }, 4200);
}

function pushNotification(title, message, emoji){
  state.notifications.unshift({id:cryptoId(), title, message, emoji, date:Date.now(), read:false});
  state.notifications = state.notifications.slice(0,30);
  persist();
  showToast(title, message, emoji);
}

function maybeGenerateNotifications(){
  const todayPlanId = state.weekPlan[new Date().getDay()];
  const template = getTemplate(todayPlanId);
  if(template && template.id!=='descanso' && !state.completedDates[todayKey()]){
    showToast('Hora do treino!', `Hoje é dia de ${template.name}. Vamos lá?`, '⏰');
  }
  // dias sem treinar
  const lastDate = Object.keys(state.completedDates).sort().pop();
  if(lastDate){
    const diffDays = Math.floor((Date.now()-new Date(lastDate+'T00:00:00').getTime())/86400000);
    if(diffDays>=2){
      showToast('Sentimos sua falta', `Você está há ${diffDays} dias sem treinar.`, '📉');
    }
  }
}

/* -------------------------------------------------------------------- */
/* Confetti                                                             */
/* -------------------------------------------------------------------- */
function launchConfetti(){
  const colors = ['#4F8EF7','#22C55E','#EF4444','#FFFFFF','#F5F5F5'];
  for(let i=0;i<60;i++){
    const piece = document.createElement('div');
    piece.className='confetti-piece';
    piece.style.left = Math.random()*100+'vw';
    piece.style.background = colors[Math.floor(Math.random()*colors.length)];
    piece.style.animationDuration = (2+Math.random()*1.6)+'s';
    piece.style.opacity = String(0.7+Math.random()*0.3);
    piece.style.transform = `rotate(${Math.random()*360}deg)`;
    document.body.appendChild(piece);
    setTimeout(()=>piece.remove(), 4000);
  }
}

/* -------------------------------------------------------------------- */
/* Helpers de dados                                                     */
/* -------------------------------------------------------------------- */
function weekProgress(){
  const days = Object.keys(state.weekPlan).filter(d=>getTemplate(state.weekPlan[d]).id!=='descanso');
  const total = days.length;
  const start = startOfWeek(new Date());
  let done = 0;
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const key = todayKey(d);
    const planId = state.weekPlan[d.getDay()];
    if(getTemplate(planId) && getTemplate(planId).id!=='descanso' && state.completedDates[key]) done++;
  }
  return {done, total};
}

function startOfWeek(d){
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate()-day);
  date.setHours(0,0,0,0);
  return date;
}

function nextWorkout(){
  const d = new Date();
  for(let i=0;i<7;i++){
    const check = new Date(d); check.setDate(d.getDate()+i);
    const planId = state.weekPlan[check.getDay()];
    const tpl = getTemplate(planId);
    if(tpl && tpl.id!=='descanso' && !state.completedDates[todayKey(check)]){
      return {template:tpl, date:check, isToday:i===0};
    }
  }
  return null;
}

function lastLoadFor(exerciseId, beforeDate){
  const logs = state.exerciseLoads[exerciseId]||[];
  const prior = logs.filter(l=> !beforeDate || l.date < beforeDate);
  if(prior.length===0) return null;
  return prior[prior.length-1];
}

function bmi(){
  const h = (state.user.height||170)/100;
  return (state.user.weight/(h*h)).toFixed(1);
}

function fmtDate(key){
  const [y,m,d] = key.split('-');
  return `${d}/${m}/${y}`;
}

/* ======================================================================
   VIEW: DASHBOARD
   ====================================================================== */
function renderDashboard(){
  const wrap = document.getElementById('viewWrap');
  const wp = weekProgress();
  const streak = computeStreak(state.completedDates);
  state.streakCache = streak;
  const nw = nextWorkout();
  const hour = new Date().getHours();
  const greet = hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';

  wrap.innerHTML = `
    <div class="view-header">
      <div class="greeting">
        <h1>${greet}, ${escapeHtml(state.user.name)} 👋</h1>
        <p>Vamos continuar sua evolução hoje.</p>
      </div>
      <div class="header-actions">
        <button class="icon-btn" id="notifBtn">🔔${state.notifications.some(n=>!n.read)?'<span class="badge-dot"></span>':''}</button>
      </div>
    </div>

    <div class="grid grid-3" id="dashStats">
      <div class="card stat-card">
        <span class="stat-label">Treinos na semana</span>
        <span class="stat-value">${wp.done} <span style="font-size:15px;color:var(--text-dim);font-weight:600;">de ${wp.total}</span></span>
        <div class="progress-track" style="margin-top:6px;"><div class="progress-fill" id="weekBar"></div></div>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Sequência</span>
        <span class="stat-value streak-badge">🔥 ${streak}</span>
        <span class="stat-sub">dias seguidos treinando</span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Peso atual</span>
        <span class="stat-value">${state.user.weight} <span style="font-size:14px;color:var(--text-dim);">kg</span></span>
        <span class="stat-sub">IMC ${bmi()}</span>
      </div>
    </div>

    <div class="section-title">Próximo treino</div>
    <div class="card interactive" id="nextWorkoutCard" style="cursor:pointer;">
      ${nw ? `
        <div style="display:flex;align-items:center;gap:14px;">
          <div class="list-row-icon" style="width:56px;height:56px;font-size:24px;">${MUSCLE_ICONS[nw.template.muscle]||'🏋️'}</div>
          <div style="flex:1;">
            <div style="font-weight:800;font-size:17px;">${nw.template.name}</div>
            <div style="color:var(--text-dim);font-size:13px;margin-top:2px;">${nw.isToday?'Hoje':WEEKDAY_NAMES[nw.date.getDay()]} · ${nw.template.estimatedTime} min · ${nw.template.exercises.length} exercícios</div>
          </div>
          <button class="btn btn-primary" id="continueBtn">Continuar treino</button>
        </div>
      ` : `<div class="empty-state"><span class="emoji">🎉</span>Você concluiu todos os treinos da semana!</div>`}
    </div>

    <div class="section-title">Esta semana <span class="link" data-nav="agenda">ver agenda</span></div>
    <div id="miniWeek"></div>

    <div class="section-title">Metas de hoje <span class="link" data-nav="profile">ver todas</span></div>
    <div id="miniGoals"></div>
  `;

  requestAnimationFrame(()=>{
    const bar = document.getElementById('weekBar');
    if(bar) bar.style.width = (wp.total? (wp.done/wp.total*100):0)+'%';
  });

  renderMiniWeek();
  renderMiniGoals();

  document.getElementById('notifBtn').addEventListener('click', openNotifPanel);
  if(nw){
    document.getElementById('nextWorkoutCard').addEventListener('click', (e)=>{
      if(e.target.id==='continueBtn') return;
      startCheckinFlow(nw.template.id, todayKey(nw.date));
    });
    document.getElementById('continueBtn').addEventListener('click', (e)=>{
      e.stopPropagation();
      startCheckinFlow(nw.template.id, todayKey(nw.date));
    });
  }
  wrap.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.nav)));
}

function renderMiniWeek(){
  const el = document.getElementById('miniWeek');
  if(!el) return;
  const start = startOfWeek(new Date());
  let html = '<div class="week-grid">';
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const key = todayKey(d);
    const planId = state.weekPlan[d.getDay()];
    const tpl = getTemplate(planId);
    const isToday = key===todayKey();
    const done = !!state.completedDates[key];
    const isRest = tpl.id==='descanso';
    html += `<div class="day-card ${isToday?'today':''} ${done?'done':''} ${isRest?'rest':''}">
      <span class="day-name">${WEEKDAY_SHORT[d.getDay()]}</span>
      <span class="day-status">${isRest?'💤':done?'✅':'⬜'}</span>
      <span class="day-workout">${isRest?'Descanso':tpl.name}</span>
    </div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

function renderMiniGoals(){
  const el = document.getElementById('miniGoals');
  if(!el) return;
  const goals = state.goals.slice(0,3);
  if(goals.length===0){ el.innerHTML = `<div class="empty-state"><span class="emoji">🎯</span>Nenhuma meta criada ainda.</div>`; return; }
  el.innerHTML = goals.map(g=>`
    <div class="list-row goal-row ${g.done?'done':''}" data-goal="${g.id}" style="cursor:pointer;">
      <div class="goal-check">${g.done?'✓':''}</div>
      <div class="list-row-body"><div class="list-row-title">${escapeHtml(g.text)}</div></div>
    </div>`).join('');
  el.querySelectorAll('[data-goal]').forEach(row=>{
    row.addEventListener('click', ()=>{
      const g = state.goals.find(x=>x.id===row.dataset.goal);
      g.done = !g.done;
      persist();
      renderMiniGoals();
    });
  });
}

/* ======================================================================
   VIEW: AGENDA
   ====================================================================== */
function renderAgenda(){
  const wrap = document.getElementById('viewWrap');
  const start = startOfWeek(new Date());
  wrap.innerHTML = `
    <div class="view-header">
      <div class="greeting"><h1>Agenda Semanal</h1><p>Seu cronograma de treinos da semana.</p></div>
    </div>
    <div class="week-grid" id="agendaGrid"></div>
    <div class="section-title">Detalhes dos treinos</div>
    <div id="agendaList"></div>
  `;
  const grid = document.getElementById('agendaGrid');
  const list = document.getElementById('agendaList');
  let gridHtml='', listHtml='';
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const key = todayKey(d);
    const planId = state.weekPlan[d.getDay()];
    const tpl = getTemplate(planId);
    const isToday = key===todayKey();
    const done = !!state.completedDates[key];
    const isRest = tpl.id==='descanso';
    gridHtml += `<div class="day-card ${isToday?'today':''} ${done?'done':''} ${isRest?'rest':''}" data-day="${d.getDay()}" style="cursor:pointer;">
      <span class="day-name">${WEEKDAY_SHORT[d.getDay()]}</span>
      <span class="day-status">${isRest?'💤':done?'✅':'⬜'}</span>
      <span class="day-workout">${isRest?'Descanso':tpl.name}</span>
    </div>`;
    listHtml += `<div class="list-row" data-daydetail="${d.getDay()}" style="cursor:${isRest?'default':'pointer'};">
      <div class="list-row-icon">${isRest?'💤':MUSCLE_ICONS[tpl.muscle]||'🏋️'}</div>
      <div class="list-row-body">
        <div class="list-row-title">${WEEKDAY_NAMES[d.getDay()]} · ${tpl.name}</div>
        <div class="list-row-sub">${isRest?'Dia de recuperação':`${tpl.estimatedTime} min · ${tpl.exercises.length} exercícios`}</div>
      </div>
      <div>${isRest?'':done?'<span style="color:var(--green);font-weight:700;">✔ Feito</span>':'<span style="color:var(--text-dim);">→</span>'}</div>
    </div>`;
  }
  grid.innerHTML = gridHtml;
  list.innerHTML = listHtml;
  document.querySelectorAll('[data-day],[data-daydetail]').forEach(elm=>{
    elm.addEventListener('click', ()=>{
      const day = elm.dataset.day || elm.dataset.daydetail;
      const planId = state.weekPlan[day];
      const tpl = getTemplate(planId);
      if(tpl.id==='descanso') return;
      const d = new Date(start); d.setDate(start.getDate() + ((Number(day)-start.getDay()+7)%7));
      openWorkoutDetail(tpl.id, todayKey(d));
    });
  });
}

/* ======================================================================
   EDITOR DE TREINOS — trocar o treino de cada dia, ajustar exercícios,
   criar exercícios novos e adicionar/remover exercícios de um treino
   ====================================================================== */
const SCHEDULE_DAY_ORDER = [1,2,3,4,5,6,0]; // Segunda ... Domingo

function allExercises(){
  return EXERCISE_LIBRARY.concat(state.customExercises||[]);
}

function renderEditor(){
  const wrap = document.getElementById('viewWrap');
  wrap.innerHTML = `
    <div class="view-header"><div class="greeting"><h1>Editar Treinos</h1><p>Troque o treino de cada dia, ajuste exercícios ou crie os seus.</p></div></div>

    <div class="section-title">Cronograma da semana</div>
    <div class="card" style="margin-bottom:20px;">
      <div id="scheduleRows"></div>
    </div>

    <div class="section-title">Editar exercícios de um treino</div>
    <div class="card" style="margin-bottom:20px;">
      <div class="field">
        <label>Escolha o treino</label>
        <select id="editorTemplateSelect"></select>
      </div>
      <div id="editorExerciseList"></div>
      <div class="field-row" style="margin-top:14px;align-items:flex-end;">
        <div class="field" style="margin-bottom:0;">
          <label>Adicionar exercício a este treino</label>
          <select id="addExerciseSelect"></select>
        </div>
        <button class="btn btn-ghost" id="addExerciseBtn" style="height:44px;">Adicionar</button>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
        <button class="btn btn-primary" id="saveTemplateBtn">Salvar alterações</button>
        <button class="btn btn-ghost" id="resetTemplateBtn">Restaurar padrão</button>
      </div>
    </div>

    <div class="section-title">Criar exercício novo</div>
    <div class="card">
      <div class="field"><label>Nome</label><input type="text" id="newExName" placeholder="Ex: Stiff com halteres"></div>
      <div class="field">
        <label>Grupo muscular</label>
        <select id="newExMuscle">
          ${Object.keys(MUSCLE_ICONS).map(m=>`<option value="${m}">${MUSCLE_ICONS[m]} ${capitalize(m)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Descrição</label><input type="text" id="newExDesc" placeholder="Pra que serve esse exercício"></div>
      <div class="field"><label>Como executar</label><input type="text" id="newExExec" placeholder="Passo a passo da execução"></div>
      <div class="field"><label>Erros comuns (opcional)</label><input type="text" id="newExMistakes" placeholder="O que evitar"></div>
      <button class="btn btn-primary btn-block" id="createExerciseBtn">Criar exercício</button>
    </div>
  `;
  renderScheduleRows();
  const templateSelect = document.getElementById('editorTemplateSelect');
  templateSelect.innerHTML = Object.keys(WORKOUT_TEMPLATES)
    .filter(id=>id!=='descanso')
    .map(id=>`<option value="${id}">${WORKOUT_TEMPLATES[id].name}</option>`).join('');
  templateSelect.addEventListener('change', ()=>renderEditorExercises(templateSelect.value));
  renderEditorExercises(templateSelect.value);

  document.getElementById('saveTemplateBtn').addEventListener('click', ()=>saveTemplateEdits(templateSelect.value));
  document.getElementById('resetTemplateBtn').addEventListener('click', ()=>resetTemplateEdits(templateSelect.value));
  document.getElementById('addExerciseBtn').addEventListener('click', ()=>{
    const exId = document.getElementById('addExerciseSelect').value;
    if(exId) addExerciseToTemplate(templateSelect.value, exId);
  });
  document.getElementById('createExerciseBtn').addEventListener('click', createCustomExercise);
}

function renderScheduleRows(){
  const rows = document.getElementById('scheduleRows');
  rows.innerHTML = SCHEDULE_DAY_ORDER.map(day=>`
    <div class="field" style="margin-bottom:12px;">
      <label>${WEEKDAY_NAMES[day]}</label>
      <select data-schedday="${day}">
        ${Object.keys(WORKOUT_TEMPLATES).map(id=>`<option value="${id}" ${state.weekPlan[day]===id?'selected':''}>${WORKOUT_TEMPLATES[id].name}</option>`).join('')}
      </select>
    </div>
  `).join('');
  rows.querySelectorAll('[data-schedday]').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      state.weekPlan[Number(sel.dataset.schedday)] = sel.value;
      persist();
      showToast('Cronograma atualizado', `${WEEKDAY_NAMES[Number(sel.dataset.schedday)]} agora é ${WORKOUT_TEMPLATES[sel.value].name}.`, '📅');
    });
  });
}

function renderEditorExercises(templateId){
  const list = document.getElementById('editorExerciseList');
  const tpl = getTemplate(templateId);
  if(!tpl){ list.innerHTML=''; return; }
  const hasOverride = !!(state.templateOverrides && state.templateOverrides[templateId]);
  list.innerHTML = `
    ${hasOverride?'<div class="chip active" style="margin:14px 0 4px;">✏️ Personalizado</div>':''}
    ${tpl.exercises.map((ex,i)=>{
      const e = findExercise(ex.exerciseId);
      return `<div class="list-row" style="align-items:flex-start;">
        <div class="list-row-icon">${MUSCLE_ICONS[e?.muscle]||'🏋️'}</div>
        <div class="list-row-body">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div class="list-row-title">${e?e.name:ex.exerciseId}</div>
            <button class="icon-btn" data-remove-idx="${i}" title="Remover" style="width:32px;height:32px;font-size:14px;flex-shrink:0;">🗑️</button>
          </div>
          <div class="field-row" style="margin-top:10px;">
            <div class="field" style="margin-bottom:0;"><label>Séries</label><input type="number" min="1" data-idx="${i}" data-key="sets" value="${ex.sets}"></div>
            <div class="field" style="margin-bottom:0;"><label>Repetições</label><input type="number" min="1" data-idx="${i}" data-key="reps" value="${ex.reps}"></div>
          </div>
          <div class="field-row" style="margin-top:10px;">
            <div class="field" style="margin-bottom:0;"><label>Carga (kg)</label><input type="number" min="0" step="0.5" data-idx="${i}" data-key="load" value="${ex.load}"></div>
            <div class="field" style="margin-bottom:0;"><label>Descanso (seg)</label><input type="number" min="0" data-idx="${i}" data-key="rest" value="${ex.rest}"></div>
          </div>
        </div>
      </div>`;
    }).join('')}
  `;
  list.querySelectorAll('[data-remove-idx]').forEach(btn=>{
    btn.addEventListener('click', ()=>removeExerciseFromTemplate(templateId, Number(btn.dataset.removeIdx)));
  });

  const addSelect = document.getElementById('addExerciseSelect');
  const inTemplateIds = tpl.exercises.map(ex=>ex.exerciseId);
  const options = allExercises().filter(e=>!inTemplateIds.includes(e.id));
  addSelect.innerHTML = options.length
    ? options.map(e=>`<option value="${e.id}">${MUSCLE_ICONS[e.muscle]||'🏋️'} ${e.name}</option>`).join('')
    : `<option value="">Todos os exercícios já estão nesse treino</option>`;
}

function saveTemplateEdits(templateId){
  const base = getTemplate(templateId);
  if(!base) return;
  const newExercises = base.exercises.map((ex,i)=>{
    const sets = Number(document.querySelector(`[data-idx="${i}"][data-key="sets"]`).value)||ex.sets;
    const reps = Number(document.querySelector(`[data-idx="${i}"][data-key="reps"]`).value)||ex.reps;
    const load = Number(document.querySelector(`[data-idx="${i}"][data-key="load"]`).value);
    const rest = Number(document.querySelector(`[data-idx="${i}"][data-key="rest"]`).value);
    return Object.assign({}, ex, {sets, reps, load:isNaN(load)?ex.load:load, rest:isNaN(rest)?ex.rest:rest});
  });
  state.templateOverrides = state.templateOverrides || {};
  state.templateOverrides[templateId] = {exercises:newExercises};
  persist();
  showToast('Treino atualizado', `${WORKOUT_TEMPLATES[templateId].name} foi salvo com suas alterações.`, '✅');
  renderEditorExercises(templateId);
}

function resetTemplateEdits(templateId){
  if(state.templateOverrides){ delete state.templateOverrides[templateId]; }
  persist();
  showToast('Treino restaurado', `${WORKOUT_TEMPLATES[templateId].name} voltou ao padrão original.`, '↩️');
  renderEditorExercises(templateId);
}

function addExerciseToTemplate(templateId, exerciseId){
  const tpl = getTemplate(templateId);
  const newExercises = tpl.exercises.concat([{exerciseId, sets:3, reps:10, load:0, rest:60}]);
  state.templateOverrides = state.templateOverrides || {};
  state.templateOverrides[templateId] = {exercises:newExercises};
  persist();
  const e = findExercise(exerciseId);
  showToast('Exercício adicionado', `${e?e.name:exerciseId} foi adicionado ao treino.`, '➕');
  renderEditorExercises(templateId);
}

function removeExerciseFromTemplate(templateId, idx){
  const tpl = getTemplate(templateId);
  const newExercises = tpl.exercises.filter((_,i)=>i!==idx);
  state.templateOverrides = state.templateOverrides || {};
  state.templateOverrides[templateId] = {exercises:newExercises};
  persist();
  showToast('Exercício removido', 'O exercício foi removido do treino.', '🗑️');
  renderEditorExercises(templateId);
}

function createCustomExercise(){
  const name = document.getElementById('newExName').value.trim();
  if(!name){ showToast('Falta o nome', 'Escreva um nome pro exercício antes de criar.', '⚠️'); return; }
  const ex = {
    id: 'ex_custom_'+cryptoId(),
    name,
    muscle: document.getElementById('newExMuscle').value,
    desc: document.getElementById('newExDesc').value.trim(),
    execution: document.getElementById('newExExec').value.trim(),
    mistakes: document.getElementById('newExMistakes').value.trim(),
  };
  state.customExercises = state.customExercises || [];
  state.customExercises.push(ex);
  persist();
  showToast('Exercício criado', `${ex.name} já está disponível pra adicionar em qualquer treino.`, '🆕');
  document.getElementById('newExName').value='';
  document.getElementById('newExDesc').value='';
  document.getElementById('newExExec').value='';
  document.getElementById('newExMistakes').value='';
  renderEditorExercises(document.getElementById('editorTemplateSelect').value);
}

function openWorkoutDetail(templateId, dateKey){
  const tpl = getTemplate(templateId);
  const done = !!state.completedDates[dateKey];
  openModal(`
    <h2 style="margin-bottom:4px;">${tpl.name}</h2>
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px;">${tpl.description}</p>
    <div class="chip-row" style="margin-bottom:16px;">
      <span class="chip">⏱ ${tpl.estimatedTime} min</span>
      <span class="chip">📋 ${tpl.exercises.length} exercícios</span>
      ${done?'<span class="chip active">✔ Concluído</span>':''}
    </div>
    <div>
      ${tpl.exercises.map(ex=>{
        const e = findExercise(ex.exerciseId);
        return `<div class="list-row">
          <div class="list-row-icon">${MUSCLE_ICONS[e.muscle]}</div>
          <div class="list-row-body">
            <div class="list-row-title">${e.name}</div>
            <div class="list-row-sub">${ex.sets} séries × ${ex.reps} reps ${ex.load?`· ${ex.load}kg`:''}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:10px;" id="startFromModal">${done?'Refazer treino':'Iniciar treino'}</button>
  `);
  document.getElementById('startFromModal').addEventListener('click', ()=>{
    closeModal();
    startCheckinFlow(templateId, dateKey);
  });
}

/* ======================================================================
   CHECK-IN DIÁRIO
   ====================================================================== */
function startCheckinFlow(templateId, dateKey){
  const key = todayKey();
  if(state.checkins[key]){
    openRunner(templateId, dateKey, state.checkins[key]);
    return;
  }
  openModal(`
    <h2 style="text-align:center;margin-bottom:6px;">Como você está hoje?</h2>
    <p style="text-align:center;color:var(--text-dim);font-size:13px;margin-bottom:18px;">Isso nos ajuda a ajustar a intensidade do treino.</p>
    <div class="mood-row" id="moodRow">
      ${MOODS.map(m=>`<button class="mood-opt" data-mood="${m.id}"><span class="em">${m.emoji}</span><span>${m.label}</span></button>`).join('')}
    </div>
  `);
  document.querySelectorAll('[data-mood]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const mood = btn.dataset.mood;
      state.checkins[key] = mood;
      persist();
      closeModal();
      if(mood==='tired' || mood==='exhausted'){
        showToast('Ajuste sugerido', 'Notamos que você está cansado(a). Considere diminuir um pouco a carga hoje.', '💡');
      }
      openRunner(templateId, dateKey, mood);
    });
  });
}

/* ======================================================================
   WORKOUT RUNNER (execução do treino)
   ====================================================================== */
function openRunner(templateId, dateKey, mood){
  const tpl = getTemplate(templateId);
  const loadMultiplier = (mood==='tired')?0.9:(mood==='exhausted')?0.8:1;
  runnerCtx = {
    templateId, dateKey, mood,
    exIndex:0,
    startTime:Date.now(),
    sets: tpl.exercises.map(ex=>{
      const n = ex.sets||1;
      return Array.from({length:n}, ()=>({
        weight: ex.load ? Math.round(ex.load*loadMultiplier) : 0,
        reps: ex.reps||0,
        notes:'',
        done:false,
      }));
    }),
  };
  let el = document.getElementById('runnerRoot');
  if(!el){ el = document.createElement('div'); el.id='runnerRoot'; document.body.appendChild(el); }
  el.innerHTML = `<div class="runner" id="runnerEl"></div>`;
  requestAnimationFrame(()=>document.getElementById('runnerEl').classList.add('open'));
  renderRunnerExercise();
}

function closeRunner(){
  const el = document.getElementById('runnerEl');
  if(el){ el.classList.remove('open'); setTimeout(()=>{ const root=document.getElementById('runnerRoot'); if(root) root.innerHTML=''; },350); }
  RestTimer.stop();
  removeTimerFab();
  runnerCtx = null;
}

function renderRunnerExercise(){
  const runnerEl = document.getElementById('runnerEl');
  if(!runnerEl || !runnerCtx) return;
  const tpl = getTemplate(runnerCtx.templateId);
  const exDef = tpl.exercises[runnerCtx.exIndex];
  const e = findExercise(exDef.exerciseId);
  const setsArr = runnerCtx.sets[runnerCtx.exIndex];
  const last = lastLoadFor(exDef.exerciseId, todayKey());
  const allDone = setsArr.every(s=>s.done);
  const isLast = runnerCtx.exIndex === tpl.exercises.length-1;

  runnerEl.innerHTML = `
    <div class="runner-header">
      <button class="icon-btn" id="runnerClose">✕</button>
      <div style="font-weight:700;font-size:13px;color:var(--text-dim);">${runnerCtx.exIndex+1} / ${tpl.exercises.length}</div>
      <button class="icon-btn" id="runnerRestBtn">⏱</button>
    </div>
    <div class="runner-body">
      <div class="progress-track" style="max-width:400px;margin-bottom:20px;"><div class="progress-fill thin" style="width:${((runnerCtx.exIndex)/tpl.exercises.length*100)}%"></div></div>
      <div class="runner-exercise-media">${MUSCLE_ICONS[e.muscle]||'🏋️'}</div>
      <div class="runner-title">${e.name}</div>
      <div class="runner-muscle">${capitalize(e.muscle)} · ${exDef.sets} séries × ${exDef.reps} reps</div>
      ${last ? `<div class="rest-compare">Semana passada: <b>${last.weight}kg</b> · Hoje sugerido: <b>${exDef.load||0}kg</b></div>` : ''}

      <div class="set-tracker" id="setTracker">
        ${setsArr.map((s,i)=>`
          <div class="set-row ${s.done?'done':''}" data-set="${i}">
            <div class="set-num">${i+1}</div>
            <div class="set-field"><label>Kg</label><input type="number" min="0" step="0.5" value="${s.weight}" data-field="weight" data-set="${i}"></div>
            <div class="set-field"><label>Reps</label><input type="number" min="0" value="${s.reps}" data-field="reps" data-set="${i}"></div>
            <button class="set-check" data-check="${i}">${s.done?'✓':''}</button>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" id="showInfoBtn" style="margin-top:16px;">ℹ️ Ver execução correta</button>
    </div>
    <div class="runner-footer">
      ${isLast && allDone
        ? `<button class="btn btn-success btn-block" id="finishWorkoutBtn">🎉 Concluir treino</button>`
        : `<button class="btn btn-primary btn-block" id="nextExerciseBtn" ${allDone?'':'disabled'}>${isLast?'Concluir treino':'Próximo exercício'}</button>`
      }
    </div>
  `;

  document.getElementById('runnerClose').addEventListener('click', ()=>{
    if(confirm('Sair do treino? Seu progresso nesta sessão será perdido.')) closeRunner();
  });
  document.getElementById('runnerRestBtn').addEventListener('click', ()=>openRestTimerPicker(exDef.rest||60));
  document.getElementById('showInfoBtn').addEventListener('click', ()=>openExerciseModal(e.id));

  runnerEl.querySelectorAll('[data-field]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const i = Number(inp.dataset.set);
      setsArr[i][inp.dataset.field] = Number(inp.value)||0;
    });
  });
  runnerEl.querySelectorAll('[data-check]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const i = Number(btn.dataset.check);
      setsArr[i].done = !setsArr[i].done;
      if(setsArr[i].done){
        openRestTimerPicker(exDef.rest||60, true);
      }
      renderRunnerExercise();
    });
  });
  const nextBtn = document.getElementById('nextExerciseBtn');
  if(nextBtn) nextBtn.addEventListener('click', goToNextExercise);
  const finishBtn = document.getElementById('finishWorkoutBtn');
  if(finishBtn) finishBtn.addEventListener('click', finishWorkout);
}

function goToNextExercise(){
  const tpl = getTemplate(runnerCtx.templateId);
  if(runnerCtx.exIndex < tpl.exercises.length-1){
    runnerCtx.exIndex++;
    renderRunnerExercise();
  } else {
    finishWorkout();
  }
}

function openRestTimerPicker(defaultSeconds, autoStart){
  removeTimerFab();
  const fab = document.createElement('div');
  fab.className = 'timer-fab';
  fab.id = 'timerFab';
  document.body.appendChild(fab);
  const options = [30,60,90,120];
  function startWith(sec){
    RestTimer.start(sec, (rem,total)=>{
      fab.innerHTML = `<div>${Math.max(0,rem)}s</div><div style="font-size:8px;">descanso</div>`;
    }, ()=>{
      fab.innerHTML = `✅`;
      showToast('Descanso finalizado', 'Hora de voltar para a próxima série!', '⏱');
      setTimeout(removeTimerFab, 2000);
    });
  }
  if(autoStart){
    startWith(defaultSeconds);
    fab.addEventListener('click', ()=>{
      if(confirm('Pular descanso?')) removeTimerFab();
    });
  } else {
    openModal(`
      <h2 style="margin-bottom:14px;">Cronômetro de descanso</h2>
      <div class="chip-row">
        ${options.map(o=>`<button class="chip" data-sec="${o}">${o}s</button>`).join('')}
      </div>
    `);
    document.querySelectorAll('[data-sec]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        closeModal();
        startWith(Number(btn.dataset.sec));
      });
    });
  }
}

function removeTimerFab(){
  const fab = document.getElementById('timerFab');
  if(fab) fab.remove();
}

function finishWorkout(){
  const tpl = getTemplate(runnerCtx.templateId);
  const durationMin = Math.max(1, Math.round((Date.now()-runnerCtx.startTime)/60000));
  let volume = 0;
  const exercisesLog = tpl.exercises.map((exDef,i)=>{
    const sets = runnerCtx.sets[i].map(s=>({weight:s.weight, reps:s.reps, notes:s.notes, done:s.done}));
    sets.forEach(s=>{ if(s.done) volume += (s.weight*s.reps); });
    return {exerciseId:exDef.exerciseId, sets};
  });
  const calories = Math.round(volume*0.05 + durationMin*4);
  const session = {
    id:cryptoId(), templateId:runnerCtx.templateId, name:tpl.name,
    date: runnerCtx.dateKey, duration:durationMin, volume, calories, exercisesLog,
  };
  state.history.push(session);
  state.completedDates[runnerCtx.dateKey] = runnerCtx.templateId;

  // registra evolução de carga por exercício + verifica recorde
  let newRecord = false;
  exercisesLog.forEach(el=>{
    const maxWeight = Math.max(0, ...el.sets.filter(s=>s.done).map(s=>s.weight));
    if(maxWeight<=0) return;
    if(!state.exerciseLoads[el.exerciseId]) state.exerciseLoads[el.exerciseId]=[];
    const prevMax = Math.max(0, ...state.exerciseLoads[el.exerciseId].map(l=>l.weight));
    if(maxWeight>prevMax && prevMax>0) newRecord = true;
    state.exerciseLoads[el.exerciseId].push({date:runnerCtx.dateKey, weight:maxWeight, reps:el.sets[0]?.reps||0});
  });

  // marca meta de treino do dia como progresso implícito (não força conclusão)
  state.streak = computeStreak(state.completedDates);

  // verifica semana completa
  const wp = weekProgressAfterSave();
  if(wp.done===wp.total && wp.total>0){
    state.fullWeeksCompleted = (state.fullWeeksCompleted||0)+1;
  }

  persist();
  checkAchievements();

  if(newRecord) pushNotification('Novo recorde! 🎉', 'Você superou sua carga anterior em um exercício.', '🏆');

  showCompletionScreen(session);
}

function weekProgressAfterSave(){ return weekProgress(); }

function showCompletionScreen(session){
  const runnerEl = document.getElementById('runnerEl');
  runnerEl.innerHTML = `
    <div class="runner-body" style="justify-content:center;flex:1;">
      <div class="celebrate">
        <div class="emoji">🎉</div>
        <h2>Parabéns!</h2>
        <p>Treino concluído com sucesso.</p>
        <div class="celebrate-stats">
          <div><b>${session.duration}min</b><span>Duração</span></div>
          <div><b>${session.volume}kg</b><span>Volume</span></div>
          <div><b>${session.calories}</b><span>Kcal</span></div>
        </div>
        <button class="btn btn-primary btn-block" id="closeCelebrate">Concluir</button>
      </div>
    </div>
  `;
  launchConfetti();
  document.getElementById('closeCelebrate').addEventListener('click', ()=>{
    closeRunner();
    navigate('dashboard');
  });
}

/* ======================================================================
   VIEW: EXERCÍCIOS
   ====================================================================== */
const MUSCLE_FILTERS = ['todos','peito','costas','pernas','gluteos','ombros','biceps','triceps','abdomen','cardio'];
const MUSCLE_LABELS = {todos:'Todos', peito:'Peito', costas:'Costas', pernas:'Pernas', gluteos:'Glúteos', ombros:'Ombros', biceps:'Bíceps', triceps:'Tríceps', abdomen:'Abdômen', cardio:'Cardio'};

function renderExercises(){
  const wrap = document.getElementById('viewWrap');
  wrap.innerHTML = `
    <div class="view-header"><div class="greeting"><h1>Exercícios</h1><p>Biblioteca completa com instruções detalhadas.</p></div></div>
    <div class="field"><input type="text" id="exSearch" placeholder="🔍 Pesquisar exercícios..." value="${escapeHtml(exerciseSearch)}"></div>
    <div class="chip-row" id="exFilters" style="margin-bottom:18px;">
      ${MUSCLE_FILTERS.map(m=>`<button class="chip ${exerciseFilter===m?'active':''}" data-filter="${m}">${MUSCLE_LABELS[m]}</button>`).join('')}
    </div>
    <div class="grid grid-3" id="exGrid"></div>
  `;
  document.getElementById('exSearch').addEventListener('input', (e)=>{ exerciseSearch=e.target.value; renderExGrid(); });
  document.querySelectorAll('[data-filter]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ exerciseFilter=btn.dataset.filter; renderExercises(); });
  });
  renderExGrid();
}

function renderExGrid(){
  const grid = document.getElementById('exGrid');
  const filtered = allExercises().filter(e=>
    (exerciseFilter==='todos'||e.muscle===exerciseFilter) &&
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );
  if(filtered.length===0){ grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="emoji">🔍</span>Nenhum exercício encontrado.</div>`; return; }
  grid.innerHTML = filtered.map(e=>`
    <div class="card exercise-card interactive" data-ex="${e.id}">
      <div class="exercise-thumb">${MUSCLE_ICONS[e.muscle]}</div>
      <div class="exercise-name">${e.name}</div>
      <div class="exercise-meta">${e.desc.slice(0,46)}${e.desc.length>46?'…':''}</div>
      <span class="muscle-tag">${MUSCLE_LABELS[e.muscle]}</span>
    </div>`).join('');
  grid.querySelectorAll('[data-ex]').forEach(card=>{
    card.addEventListener('click', ()=>openExerciseModal(card.dataset.ex));
  });
}

function openExerciseModal(exId){
  const e = findExercise(exId);
  const logs = state.exerciseLoads[exId]||[];
  const lastLog = logs[logs.length-1];
  openModal(`
    <div class="exercise-thumb" style="aspect-ratio:16/8;font-size:52px;">${MUSCLE_ICONS[e.muscle]}</div>
    <h2 style="margin:14px 0 4px;">${e.name}</h2>
    <span class="muscle-tag">${MUSCLE_LABELS[e.muscle]}</span>
    <p style="margin-top:14px;font-size:13.5px;color:var(--text-dim);line-height:1.6;">${e.desc}</p>
    <hr class="sep">
    <h4 style="font-size:13px;margin-bottom:6px;">✅ Execução correta</h4>
    <p style="font-size:13px;color:var(--text-dim);line-height:1.6;margin-bottom:14px;">${e.execution}</p>
    <h4 style="font-size:13px;margin-bottom:6px;">⚠️ Erros comuns</h4>
    <p style="font-size:13px;color:var(--text-dim);line-height:1.6;">${e.mistakes}</p>
    ${lastLog?`<hr class="sep"><h4 style="font-size:13px;margin-bottom:6px;">📈 Última carga registrada</h4><p style="font-size:13px;">${lastLog.weight}kg em ${fmtDate(lastLog.date)}</p>`:''}
  `);
}

/* ======================================================================
   VIEW: HISTÓRICO
   ====================================================================== */
function renderHistory(){
  const wrap = document.getElementById('viewWrap');
  wrap.innerHTML = `
    <div class="view-header"><div class="greeting"><h1>Histórico</h1><p>Todos os treinos que você já realizou.</p></div></div>
    <div class="chip-row" style="margin-bottom:18px;">
      ${['semana','mes','ano','tudo'].map(f=>`<button class="chip ${historyFilter===f?'active':''}" data-hfilter="${f}">${({semana:'Semana',mes:'Mês',ano:'Ano',tudo:'Tudo'})[f]}</button>`).join('')}
    </div>
    <div id="historyList"></div>
  `;
  document.querySelectorAll('[data-hfilter]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ historyFilter=btn.dataset.hfilter; renderHistory(); });
  });
  renderHistoryList();
}

function renderHistoryList(){
  const list = document.getElementById('historyList');
  const now = new Date();
  let cutoff = new Date(0);
  if(historyFilter==='semana') cutoff = startOfWeek(now);
  else if(historyFilter==='mes'){ cutoff = new Date(now.getFullYear(), now.getMonth(),1); }
  else if(historyFilter==='ano'){ cutoff = new Date(now.getFullYear(),0,1); }

  const sessions = [...state.history].filter(s=> new Date(s.date+'T00:00:00') >= cutoff).sort((a,b)=>b.date.localeCompare(a.date));
  if(sessions.length===0){ list.innerHTML = `<div class="empty-state"><span class="emoji">🗂️</span>Nenhum treino registrado neste período.</div>`; return; }
  list.innerHTML = sessions.map(s=>`
    <div class="list-row" data-session="${s.id}" style="cursor:pointer;">
      <div class="list-row-icon">${MUSCLE_ICONS[getTemplate(s.templateId)?.muscle]||'🏋️'}</div>
      <div class="list-row-body">
        <div class="list-row-title">${s.name}</div>
        <div class="list-row-sub">${fmtDate(s.date)} · ${s.duration}min · ${s.volume}kg volume · ${s.calories}kcal</div>
      </div>
      <div style="color:var(--text-dim);">→</div>
    </div>`).join('');
  list.querySelectorAll('[data-session]').forEach(row=>{
    row.addEventListener('click', ()=>openSessionDetail(row.dataset.session));
  });
}

function openSessionDetail(id){
  const s = state.history.find(x=>x.id===id);
  if(!s) return;
  openModal(`
    <h2>${s.name}</h2>
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px;">${fmtDate(s.date)} · ${s.duration} min</p>
    <div class="grid grid-3" style="margin-bottom:16px;">
      <div class="card stat-card"><span class="stat-label">Volume</span><span class="stat-value" style="font-size:18px;">${s.volume}kg</span></div>
      <div class="card stat-card"><span class="stat-label">Calorias</span><span class="stat-value" style="font-size:18px;">${s.calories}</span></div>
      <div class="card stat-card"><span class="stat-label">Duração</span><span class="stat-value" style="font-size:18px;">${s.duration}min</span></div>
    </div>
    ${s.exercisesLog.map(el=>{
      const e = findExercise(el.exerciseId);
      return `<div class="list-row" style="display:block;">
        <div class="list-row-title" style="margin-bottom:6px;">${e?e.name:el.exerciseId}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${el.sets.map((st,i)=>`<span class="chip">Série ${i+1}: ${st.weight}kg × ${st.reps}</span>`).join('')}
        </div>
      </div>`;
    }).join('')}
  `);
}

/* ======================================================================
   VIEW: ESTATÍSTICAS
   ====================================================================== */
function renderStats(){
  const wrap = document.getElementById('viewWrap');
  wrap.innerHTML = `
    <div class="view-header"><div class="greeting"><h1>Estatísticas</h1><p>Sua evolução em números.</p></div></div>
    <div class="grid grid-4" style="margin-bottom:10px;">
      <div class="card stat-card"><span class="stat-label">Streak atual</span><span class="stat-value">🔥 ${computeStreak(state.completedDates)}</span></div>
      <div class="card stat-card"><span class="stat-label">Total treinado</span><span class="stat-value">${state.history.length}</span><span class="stat-sub">treinos</span></div>
      <div class="card stat-card"><span class="stat-label">Tempo total</span><span class="stat-value">${Math.round(state.history.reduce((a,h)=>a+h.duration,0)/60)}h</span></div>
      <div class="card stat-card"><span class="stat-label">Volume semanal</span><span class="stat-value">${weeklyVolume()}kg</span></div>
    </div>

    <div class="section-title">Treinos por semana (últimas 8 semanas)</div>
    <div class="card" id="chartWorkoutsWeek"></div>

    <div class="section-title">Peso corporal</div>
    <div class="card" id="chartWeight"></div>

    <div class="section-title">Carga levantada (últimas sessões)</div>
    <div class="card" id="chartVolume"></div>
  `;
  renderBarChart(document.getElementById('chartWorkoutsWeek'), workoutsPerWeekData());
  renderLineChart(document.getElementById('chartWeight'), weightSeriesData());
  renderBarChart(document.getElementById('chartVolume'), volumeSeriesData());
}

function weeklyVolume(){
  const start = startOfWeek(new Date());
  return state.history.filter(h=>new Date(h.date+'T00:00:00')>=start).reduce((a,h)=>a+h.volume,0);
}

function workoutsPerWeekData(){
  const weeks = [];
  for(let i=7;i>=0;i--){
    const s = startOfWeek(new Date()); s.setDate(s.getDate()-i*7);
    const e = new Date(s); e.setDate(s.getDate()+7);
    const count = state.history.filter(h=>{ const d=new Date(h.date+'T00:00:00'); return d>=s && d<e; }).length;
    weeks.push({label: `${s.getDate()}/${s.getMonth()+1}`, value: count});
  }
  return weeks;
}

function weightSeriesData(){
  const log = [...(state.weightLog||[])].sort((a,b)=>a.date.localeCompare(b.date));
  if(log.length===0 && state.user.weight){
    return [{label:'Início', value:state.user.startWeight||state.user.weight},{label:'Hoje', value:state.user.weight}];
  }
  return log.map(l=>({label:fmtDate(l.date).slice(0,5), value:l.weight}));
}

function volumeSeriesData(){
  const recent = [...state.history].sort((a,b)=>a.date.localeCompare(b.date)).slice(-8);
  return recent.map(h=>({label:fmtDate(h.date).slice(0,5), value:h.volume}));
}

/* ======================================================================
   VIEW: PERFIL (tabs: perfil, metas, progresso, conquistas, config)
   ====================================================================== */
function renderProfile(){
  const wrap = document.getElementById('viewWrap');
  const tabs = [
    {id:'perfil', label:'Perfil'},
    {id:'metas', label:'Metas'},
    {id:'progresso', label:'Progresso'},
    {id:'conquistas', label:'Conquistas'},
    {id:'config', label:'Configurações'},
  ];
  wrap.innerHTML = `
    <div class="view-header"><div class="greeting"><h1>Perfil</h1><p>Suas informações e preferências.</p></div></div>
    <div class="tabs" id="profileTabs">
      ${tabs.map(t=>`<button class="tab-btn ${currentProfileTab===t.id?'active':''}" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="profileTabContent"></div>
  `;
  document.querySelectorAll('[data-tab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ currentProfileTab=btn.dataset.tab; renderProfile(); });
  });
  const renderers = {
    perfil: renderTabPerfil, metas: renderTabMetas, progresso: renderTabProgresso,
    conquistas: renderTabConquistas, config: renderTabConfig,
  };
  renderers[currentProfileTab]();
}

function renderTabPerfil(){
  const c = document.getElementById('profileTabContent');
  const u = state.user;
  c.innerHTML = `
    <div class="card">
      <div class="field"><label>Nome</label><input type="text" id="pName" value="${escapeHtml(u.name)}"></div>
      <div class="field-row">
        <div class="field"><label>Altura (cm)</label><input type="number" id="pHeight" value="${u.height}"></div>
        <div class="field"><label>Peso (kg)</label><input type="number" step="0.1" id="pWeight" value="${u.weight}"></div>
      </div>
      <div class="field"><label>Objetivo</label>
        <select id="pGoal">
          ${['hipertrofia','emagrecimento','forca','condicionamento'].map(g=>`<option value="${g}" ${u.goal===g?'selected':''}>${capitalize(g==='forca'?'força':g)}</option>`).join('')}
        </select>
      </div>
      <div class="field-row">
        <div class="field"><label>Dias disponíveis/semana</label><input type="number" min="1" max="7" id="pDays" value="${u.availableDays}"></div>
        <div class="field"><label>Tempo médio por treino (min)</label><input type="number" id="pTime" value="${u.avgWorkoutTime}"></div>
      </div>
      <button class="btn btn-primary btn-block" id="saveProfile">Salvar alterações</button>
    </div>
  `;
  document.getElementById('saveProfile').addEventListener('click', ()=>{
    const newWeight = Number(document.getElementById('pWeight').value)||u.weight;
    if(newWeight !== u.weight){
      state.weightLog.push({date:todayKey(), weight:newWeight});
    }
    state.user.name = document.getElementById('pName').value.trim()||u.name;
    state.user.height = Number(document.getElementById('pHeight').value)||u.height;
    state.user.weight = newWeight;
    state.user.goal = document.getElementById('pGoal').value;
    state.user.availableDays = Number(document.getElementById('pDays').value)||u.availableDays;
    state.user.avgWorkoutTime = Number(document.getElementById('pTime').value)||u.avgWorkoutTime;
    persist();
    showToast('Perfil atualizado', 'Suas informações foram salvas.', '✅');
    renderNavLists();
  });
}

function renderTabMetas(){
  const c = document.getElementById('profileTabContent');
  c.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div class="field-row" style="align-items:flex-end;">
        <div class="field" style="margin-bottom:0;"><label>Nova meta</label><input type="text" id="newGoalInput" placeholder="Ex: Treinar 5 dias"></div>
        <button class="btn btn-primary" id="addGoalBtn" style="height:44px;">Adicionar</button>
      </div>
    </div>
    <div id="goalsList"></div>
  `;
  document.getElementById('addGoalBtn').addEventListener('click', ()=>{
    const input = document.getElementById('newGoalInput');
    if(!input.value.trim()) return;
    state.goals.push({id:cryptoId(), text:input.value.trim(), done:false, category:'geral'});
    persist();
    renderTabMetas();
  });
  renderGoalsList();
}

function renderGoalsList(){
  const list = document.getElementById('goalsList');
  if(state.goals.length===0){ list.innerHTML = `<div class="empty-state"><span class="emoji">🎯</span>Crie sua primeira meta.</div>`; return; }
  list.innerHTML = state.goals.map(g=>`
    <div class="list-row goal-row ${g.done?'done':''}">
      <div class="goal-check" data-toggle="${g.id}" style="cursor:pointer;">${g.done?'✓':''}</div>
      <div class="list-row-body"><div class="list-row-title">${escapeHtml(g.text)}</div></div>
      <button class="icon-btn" data-delgoal="${g.id}" style="width:32px;height:32px;font-size:13px;">🗑️</button>
    </div>`).join('');
  list.querySelectorAll('[data-toggle]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const g = state.goals.find(g=>g.id===el.dataset.toggle);
      g.done = !g.done;
      persist();
      renderGoalsList();
    });
  });
  list.querySelectorAll('[data-delgoal]').forEach(el=>{
    el.addEventListener('click', ()=>{ state.goals = state.goals.filter(g=>g.id!==el.dataset.delgoal); persist(); renderGoalsList(); });
  });
}

function renderTabProgresso(){
  const c = document.getElementById('profileTabContent');
  const u = state.user;
  const maxLoad = Math.max(0, ...Object.values(state.exerciseLoads).flat().map(l=>l.weight));
  c.innerHTML = `
    <div class="grid grid-3">
      <div class="card stat-card"><span class="stat-label">Peso inicial</span><span class="stat-value">${u.startWeight||u.weight}kg</span></div>
      <div class="card stat-card"><span class="stat-label">Peso atual</span><span class="stat-value">${u.weight}kg</span></div>
      <div class="card stat-card"><span class="stat-label">IMC</span><span class="stat-value">${bmi()}</span></div>
      <div class="card stat-card"><span class="stat-label">Treinos realizados</span><span class="stat-value">${state.history.length}</span></div>
      <div class="card stat-card"><span class="stat-label">Dias consecutivos</span><span class="stat-value">🔥 ${computeStreak(state.completedDates)}</span></div>
      <div class="card stat-card"><span class="stat-label">Maior carga</span><span class="stat-value">${maxLoad}kg</span></div>
    </div>
    <div class="section-title">Comparação mensal de volume</div>
    <div class="card" id="progressChart"></div>
  `;
  const now = new Date();
  const months = [];
  for(let i=5;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const next = new Date(now.getFullYear(), now.getMonth()-i+1, 1);
    const vol = state.history.filter(h=>{const hd=new Date(h.date+'T00:00:00'); return hd>=d && hd<next;}).reduce((a,h)=>a+h.volume,0);
    months.push({label:d.toLocaleDateString('pt-BR',{month:'short'}), value:vol});
  }
  renderBarChart(document.getElementById('progressChart'), months);
}

function renderTabConquistas(){
  const c = document.getElementById('profileTabContent');
  checkAchievements();
  c.innerHTML = `<div class="grid grid-4">
    ${ACHIEVEMENTS.map(a=>{
      const unlocked = state.unlockedAchievements.includes(a.id);
      return `<div class="card ach-card ${unlocked?'unlocked':''}">
        <span class="ach-emoji">${a.emoji}</span>
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function checkAchievements(){
  const snapshot = {history:state.history, streak:computeStreak(state.completedDates), fullWeeksCompleted:state.fullWeeksCompleted||0};
  ACHIEVEMENTS.forEach(a=>{
    if(!state.unlockedAchievements.includes(a.id) && a.check(snapshot)){
      state.unlockedAchievements.push(a.id);
      pushNotification('Conquista desbloqueada!', a.name, a.emoji);
    }
  });
  persist();
}

function renderTabConfig(){
  const c = document.getElementById('profileTabContent');
  c.innerHTML = `
    <div class="card" style="margin-bottom:14px;">
      <div class="theme-toggle" id="cfgThemeToggle" style="cursor:pointer;">
        <span>${state.user.theme==='light'?'☀️ Modo claro':'🌙 Modo escuro'}</span><div class="switch"></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <div class="field"><label>Idioma</label><select disabled><option>Português (Brasil)</option></select></div>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <h4 style="margin-bottom:10px;font-size:13px;">Backup de dados</h4>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-ghost" id="exportBtn">⬇️ Exportar histórico</button>
        <label class="btn btn-ghost" style="cursor:pointer;">⬆️ Importar histórico<input type="file" id="importInput" accept="application/json" style="display:none;"></label>
      </div>
    </div>
    <div class="card">
      <h4 style="margin-bottom:10px;font-size:13px;color:var(--red);">Zona de risco</h4>
      <button class="btn btn-danger btn-block" id="clearDataBtn">Limpar todos os dados</button>
    </div>
  `;
  document.getElementById('cfgThemeToggle').addEventListener('click', ()=>{ toggleTheme(); renderTabConfig(); });
  document.getElementById('exportBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fittrack_backup.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('Exportado', 'Seu backup foi baixado com sucesso.', '⬇️');
  });
  document.getElementById('importInput').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const imported = JSON.parse(reader.result);
        state = Object.assign(defaultState(), imported);
        persist();
        applyTheme();
        showToast('Importado', 'Seus dados foram restaurados.', '✅');
        navigate('dashboard');
      }catch(err){
        showToast('Erro', 'Arquivo inválido.', '⚠️');
      }
    };
    reader.readAsText(file);
  });
  document.getElementById('clearDataBtn').addEventListener('click', ()=>{
    if(confirm('Tem certeza? Todos os seus dados serão apagados permanentemente.')){
      localStorage.removeItem(STORAGE_KEY);
      state = defaultState();
      persist();
      applyTheme();
      showToast('Dados apagados', 'Começando do zero.', '🗑️');
      navigate('dashboard');
    }
  });
}

/* ======================================================================
   NOTIFICAÇÕES (painel)
   ====================================================================== */
function openNotifPanel(){
  state.notifications.forEach(n=>n.read=true);
  persist();
  if(state.notifications.length===0){
    openModal(`<h2 style="margin-bottom:10px;">Notificações</h2><div class="empty-state"><span class="emoji">🔔</span>Nenhuma notificação ainda.</div>`);
    return;
  }
  openModal(`
    <h2 style="margin-bottom:14px;">Notificações</h2>
    ${state.notifications.map(n=>`
      <div class="list-row">
        <div class="list-row-icon">${n.emoji||'🔔'}</div>
        <div class="list-row-body">
          <div class="list-row-title">${n.title}</div>
          <div class="list-row-sub">${n.message}</div>
        </div>
      </div>`).join('')}
  `);
}

/* ======================================================================
   MODAL genérico
   ====================================================================== */
function openModal(innerHtml){
  let overlay = document.getElementById('modalOverlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'modalOverlay';
    overlay.className = 'overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeModal(); });
  }
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div><button class="modal-close" id="modalCloseBtn">✕</button><div id="modalBody">${innerHtml}</div></div>`;
  requestAnimationFrame(()=>overlay.classList.add('open'));
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
}
function closeModal(){
  const overlay = document.getElementById('modalOverlay');
  if(overlay) overlay.classList.remove('open');
}

/* ======================================================================
   Utils
   ====================================================================== */
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function capitalize(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }

document.addEventListener('DOMContentLoaded', boot);
