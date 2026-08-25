/* ==========================================================================
   FitTrack — Aplicação principal
   Estrutura em "componentes": cada render* monta um pedaço da UI.
   ========================================================================== */

let state = defaultState();
let currentView = 'dashboard';
let currentProfileTab = 'perfil';
let exerciseFilter = 'todos';
let exerciseSearch = '';
let workoutPickerFilter = 'todos';
let workoutPickerSearch = '';
let historyFilter = 'semana';
let runnerCtx = null; // contexto ativo do treino em execução
let authUser = null;
let authAppRendered = false;
let authListenerReady = false;

function persist(){ return saveState(state); }

async function loadSupabaseProfile(){
  if(!authUser || typeof PROFILE === 'undefined') return {ok:false, skipped:true};
  const result = await PROFILE.load(authUser);
  if(result.ok && result.profile){
    state.user = PROFILE.applyRowToUser(state.user, result.profile);
    persist();
  }
  return result;
}

async function saveSupabaseProfile(options){
  if(!authUser || typeof PROFILE === 'undefined') return {ok:false, skipped:true};
  const result = await PROFILE.save(authUser, state.user);
  if(result.ok && result.profile){
    state.user = PROFILE.applyRowToUser(state.user, result.profile);
    persist();
  } else if(!options?.silent && result.message){
    showToast('Perfil local salvo', result.message, '⚠️');
  }
  return result;
}

function saveSupabaseProfileQuietly(){
  saveSupabaseProfile({silent:true});
}

function withTimeout(promise, ms, fallback){
  return Promise.race([
    promise,
    new Promise(resolve=>setTimeout(()=>resolve(fallback), ms)),
  ]);
}

/* -------------------------------------------------------------------- */
/* Treinos e Progresso: mescla os overrides salvos pelo usuário      */
/* por cima dos templates padrão (data.js nunca é alterado em si)      */
/* -------------------------------------------------------------------- */
function getTemplate(id){
  if(state.customTemplates && state.customTemplates[id]) return state.customTemplates[id];
  const base = WORKOUT_TEMPLATES[id];
  if(!base) return base;
  const override = state.templateOverrides && state.templateOverrides[id];
  if(!override) return base;
  return Object.assign({}, base, override.exercises ? {exercises: override.exercises} : {});
}

function isCustomTemplate(id){
  return !!(state.customTemplates && state.customTemplates[id]);
}

function ensureFavorites(){
  state.favoriteExercises = Array.isArray(state.favoriteExercises) ? state.favoriteExercises : [];
  state.favoriteWorkouts = Array.isArray(state.favoriteWorkouts) ? state.favoriteWorkouts : [];
}

function isFavoriteExercise(exerciseId){
  ensureFavorites();
  return state.favoriteExercises.includes(exerciseId);
}

function isFavoriteWorkout(templateId){
  ensureFavorites();
  return state.favoriteWorkouts.includes(templateId);
}

function toggleFavoriteExercise(exerciseId){
  ensureFavorites();
  state.favoriteExercises = isFavoriteExercise(exerciseId)
    ? state.favoriteExercises.filter(id=>id!==exerciseId)
    : state.favoriteExercises.concat(exerciseId);
  persist();
}

function toggleFavoriteWorkout(templateId){
  ensureFavorites();
  state.favoriteWorkouts = isFavoriteWorkout(templateId)
    ? state.favoriteWorkouts.filter(id=>id!==templateId)
    : state.favoriteWorkouts.concat(templateId);
  persist();
}

function muscleVisual(muscle, options){
  const size = options?.size || 'md';
  const label = MUSCLE_LABELS?.[muscle] || capitalize(muscle || 'exercício');
  const hot = {
    peito:`<path class="mv-hot" d="M47 50c-8-2-14 2-17 9 6 5 15 6 23 2V49c-2 0-4 0-6 1Zm26 0c8-2 14 2 17 9-6 5-15 6-23 2V49c2 0 4 0 6 1Z"/>`,
    costas:`<path class="mv-hot" d="M35 42c6 1 14 8 19 21l-8 28c-9-10-15-25-11-49Zm50 0c-6 1-14 8-19 21l8 28c9-10 15-25 11-49Z"/>`,
    pernas:`<path class="mv-hot" d="M43 92h17l-5 54H39l4-54Zm37 0H63l5 54h16l-4-54Z"/>`,
    gluteos:`<path class="mv-hot" d="M41 80c6-9 16-12 24-6 0 16-15 24-29 17 0-4 2-8 5-11Zm38 0c-6-9-16-12-24-6 0 16 15 24 29 17 0-4-2-8-5-11Z"/>`,
    ombros:`<path class="mv-hot" d="M25 45c9-12 20-10 26-4-4 7-12 13-23 14-3-2-4-6-3-10Zm70 0c-9-12-20-10-26-4 4 7 12 13 23 14 3-2 4-6 3-10Z"/>`,
    biceps:`<path class="mv-hot" d="M24 58c7 2 12 7 14 15l-8 28c-10-4-13-16-8-29l2-14Zm72 0c-7 2-12 7-14 15l8 28c10-4 13-16 8-29l-2-14Z"/>`,
    triceps:`<path class="mv-hot" d="M30 55c7 1 12 6 14 14l-5 27c-9-5-14-15-11-29l2-12Zm60 0c-7 1-12 6-14 14l5 27c9-5 14-15 11-29l-2-12Z"/>`,
    abdomen:`<path class="mv-hot" d="M48 62h24v10H48V62Zm-2 13h28v11H46V75Zm2 14h24v12H48V89Z"/>`,
    cardio:`<path class="mv-hot" d="M60 52c7-13 28-7 28 10 0 18-20 29-28 39-8-10-28-21-28-39 0-17 21-23 28-10Z"/>`,
    peito:`<path class="mv-hot" d="M43 52c-7 0-12 4-15 10 7 6 17 8 27 4V53c-4-1-8-1-12-1Zm34 0c7 0 12 4 15 10-7 6-17 8-27 4V53c4-1 8-1 12-1Z"/>`,
    costas:`<path class="mv-hot" d="M38 43c7 3 14 12 18 26l-9 27c-10-10-16-28-13-47l4-6Zm44 0c-7 3-14 12-18 26l9 27c10-10 16-28 13-47l-4-6Z"/>`,
    pernas:`<path class="mv-hot" d="M42 92h16l-4 54H38l4-54Zm20 0h16l4 54H66l-4-54Z"/>`,
    gluteos:`<path class="mv-hot" d="M41 80c5-8 13-11 19-7 0 13-10 20-23 18 0-4 1-8 4-11Zm38 0c-5-8-13-11-19-7 0 13 10 20 23 18 0-4-1-8-4-11Z"/>`,
    ombros:`<path class="mv-hot" d="M28 45c8-8 17-7 23-3-4 8-11 12-22 13-2-2-3-6-1-10Zm64 0c-8-8-17-7-23-3 4 8 11 12 22 13 2-2 3-6 1-10Z"/>`,
    biceps:`<path class="mv-hot" d="M25 61c7 2 11 7 12 14l-7 25c-8-5-11-15-7-28l2-11Zm70 0c-7 2-11 7-12 14l7 25c8-5 11-15 7-28l-2-11Z"/>`,
    triceps:`<path class="mv-hot" d="M31 57c6 2 10 6 12 13l-5 25c-8-5-12-15-9-27l2-11Zm58 0c-6 2-10 6-12 13l5 25c8-5 12-15 9-27l-2-11Z"/>`,
    abdomen:`<path class="mv-hot" d="M49 61h22v9H49v-9Zm-2 12h26v10H47V73Zm2 13h22v11H49V86Z"/>`,
    cardio:`<path class="mv-hot" d="M43 64c5-7 12-8 17-3v37c-10-6-18-17-17-34Zm34 0c-5-7-12-8-17-3v37c10-6 18-17 17-34Z"/>`,
  }[muscle] || `<circle class="mv-hot" cx="60" cy="76" r="18"/>`;
  return `
    <div class="muscle-visual muscle-visual-${size} muscle-${muscle||'geral'}" role="img" aria-label="${escapeHtml(label)}">
      <svg viewBox="0 0 120 160" aria-hidden="true" focusable="false">
        <circle class="mv-body" cx="60" cy="23" r="14"/>
        <path class="mv-body" d="M44 42c7-5 25-5 32 0 7 16 7 33 0 50H44c-7-17-7-34 0-50Z"/>
        <path class="mv-body" d="M42 47c-13 2-21 14-22 31l-2 24c5 4 12 4 16 0l5-25c2-8 6-14 12-17l-9-13Z"/>
        <path class="mv-body" d="M78 47c13 2 21 14 22 31l2 24c-5 4-12 4-16 0l-5-25c-2-8-6-14-12-17l9-13Z"/>
        <path class="mv-body" d="M45 91h30l8 55c-5 4-12 4-17 1l-6-43-6 43c-5 3-12 3-17-1l8-55Z"/>
        ${hot}
      </svg>
    </div>
  `;
}

const EXERCISE_IMAGES = {
  ex_abducao_cabo:'assets/exercises/ex_abdutora.png',
  ex_abducao_elastico:'assets/exercises/ex_abdutora.png',
  ex_abdutora:'assets/exercises/ex_abdutora.png',
  ex_afundo:'assets/exercises/ex_afundo.png',
  ex_afundo_andando:'assets/exercises/ex_afundo.png',
  ex_agachamento:'assets/exercises/ex_agachamento.png',
  ex_agachamento_bulgaro:'assets/exercises/ex_agachamento_bulgaro.png',
  ex_agachamento_smith:'assets/exercises/ex_agachamento_smith.png',
  ex_agachamento_sumo:'assets/exercises/ex_agachamento_sumo.png',
  ex_arnold_press:'assets/exercises/ex_desenvolvimento.png',
  ex_barra_fixa_assistida:'assets/exercises/ex_barra_fixa_assistida.png',
  ex_bom_dia:'assets/exercises/ex_bom_dia.png',
  ex_cadeira_extensora:'assets/exercises/ex_cadeira_extensora.png',
  ex_cadeira_flexora:'assets/exercises/ex_mesa_flexora.png',
  ex_coice_maquina:'assets/exercises/ex_kickback.png',
  ex_crossover:'assets/exercises/ex_crossover.png',
  ex_crossover_alto:'assets/exercises/ex_crossover.png',
  ex_crossover_baixo:'assets/exercises/ex_crossover.png',
  ex_crucifixo:'assets/exercises/ex_crucifixo_maquina.png',
  ex_crucifixo_inverso:'assets/exercises/ex_face_pull.png',
  ex_crucifixo_maquina:'assets/exercises/ex_crucifixo_maquina.png',
  ex_desenvolvimento:'assets/exercises/ex_desenvolvimento.png',
  ex_desenvolvimento_maquina:'assets/exercises/ex_desenvolvimento_maquina.png',
  ex_elevacao_frontal:'assets/exercises/ex_elevacao_frontal.png',
  ex_elevacao_lateral:'assets/exercises/ex_elevacao_lateral.png',
  ex_elevacao_lateral_cabo:'assets/exercises/ex_elevacao_lateral_cabo.png',
  ex_elevacao_pelvica:'assets/exercises/ex_hip_thrust.png',
  ex_encolhimento:'assets/exercises/ex_encolhimento.png',
  ex_extensao_quadril_banco:'assets/exercises/ex_kickback.png',
  ex_extensora_unilateral:'assets/exercises/ex_cadeira_extensora.png',
  ex_face_pull:'assets/exercises/ex_face_pull.png',
  ex_flexao_bracos:'assets/exercises/ex_flexao_bracos.png',
  ex_flexao_inclinada:'assets/exercises/ex_flexao_bracos.png',
  ex_flexora_unilateral:'assets/exercises/ex_mesa_flexora.png',
  ex_hack_squat:'assets/exercises/ex_hack_squat.png',
  ex_hip_thrust:'assets/exercises/ex_hip_thrust.png',
  ex_kickback:'assets/exercises/ex_kickback.png',
  ex_leg_press:'assets/exercises/ex_leg_press.png',
  ex_leg_press_unilateral:'assets/exercises/ex_leg_press.png',
  ex_levantamento_romeno:'assets/exercises/ex_levantamento_romeno.png',
  ex_mesa_flexora:'assets/exercises/ex_mesa_flexora.png',
  ex_panturrilha_legpress:'assets/exercises/ex_panturrilha_legpress.png',
  ex_panturrilha_pe:'assets/exercises/ex_panturrilha_pe.png',
  ex_panturrilha_sentada:'assets/exercises/ex_panturrilha_sentada.png',
  ex_passada:'assets/exercises/ex_afundo.png',
  ex_ponte_gluteos:'assets/exercises/ex_hip_thrust.png',
  ex_pullover_cabo:'assets/exercises/ex_pullover_cabo.png',
  ex_puxada:'assets/exercises/ex_puxada.png',
  ex_puxada_neutra:'assets/exercises/ex_puxada_neutra.png',
  ex_puxada_supinada:'assets/exercises/ex_puxada_supinada.png',
  ex_remada:'assets/exercises/ex_remada.png',
  ex_remada_alta:'assets/exercises/ex_face_pull.png',
  ex_remada_baixa:'assets/exercises/ex_remada_baixa.png',
  ex_remada_cavalinho:'assets/exercises/ex_remada_cavalinho.png',
  ex_remada_maquina:'assets/exercises/ex_remada_maquina.png',
  ex_remada_serrote:'assets/exercises/ex_remada_unilateral.png',
  ex_remada_unilateral:'assets/exercises/ex_remada_unilateral.png',
  ex_rosca_alternada:'assets/exercises/ex_rosca_direta.png',
  ex_rosca_cabo:'assets/exercises/ex_rosca_direta.png',
  ex_rosca_concentrada:'assets/exercises/ex_rosca_direta.png',
  ex_rosca_direta:'assets/exercises/ex_rosca_direta.png',
  ex_rosca_inclinada:'assets/exercises/ex_rosca_direta.png',
  ex_rosca_martelo:'assets/exercises/ex_rosca_martelo.png',
  ex_rosca_scott:'assets/exercises/ex_rosca_scott.png',
  ex_sissy_squat:'assets/exercises/ex_sissy_squat.png',
  ex_step_up:'assets/exercises/ex_step_up.png',
  ex_stiff:'assets/exercises/ex_stiff.png',
  ex_supino:'assets/exercises/ex_supino.png',
  ex_supino_declinado:'assets/exercises/ex_supino_declinado.png',
  ex_supino_halteres:'assets/exercises/ex_supino_halteres.png',
  ex_supino_inclinado:'assets/exercises/ex_supino_inclinado.png',
  ex_supino_maquina:'assets/exercises/ex_supino_maquina.png',
  ex_terra_sumo:'assets/exercises/ex_terra_sumo.png',
  ex_terra_tradicional:'assets/exercises/ex_terra_tradicional.png',
  ex_triceps_banco:'assets/exercises/ex_triceps_banco.png',
  ex_triceps_barra_reta:'assets/exercises/ex_triceps_corda.png',
  ex_triceps_coice:'assets/exercises/ex_kickback.png',
  ex_triceps_corda:'assets/exercises/ex_triceps_corda.png',
  ex_triceps_frances:'assets/exercises/ex_triceps_corda.png',
  ex_triceps_maquina:'assets/exercises/ex_triceps_corda.png',
  ex_triceps_mergulho_banco:'assets/exercises/ex_triceps_banco.png',
  ex_triceps_testa:'assets/exercises/ex_triceps_testa.png',
  ex_voador_cabo:'assets/exercises/ex_crossover.png',
};

const EXERCISE_EMOJIS = {
  ex_abdominal:'🔥',
  ex_abdominal_infra:'🔥',
  ex_abdominal_maquina:'🔥',
  ex_air_bike:'🚴',
  ex_bike:'🚴',
  ex_bird_dog:'🧘',
  ex_burpee:'⚡',
  ex_caminhada_inclinada:'🚶',
  ex_crunch_cabo:'🔥',
  ex_dead_bug:'🧘',
  ex_eliptico:'🏃',
  ex_escada:'🪜',
  ex_esteira:'🏃',
  ex_elevacao_pernas:'🔥',
  ex_mobilidade_quadril:'🧘',
  ex_mobilidade_toracica:'🧘',
  ex_mountain_climber:'⚡',
  ex_polichinelo:'⭐',
  ex_prancha:'⏱️',
  ex_prancha_lateral:'⏱️',
  ex_pular_corda:'🪢',
  ex_remo_ergometro:'🚣',
};

const MUSCLE_EMOJIS = {
  abdomen:'🔥',
  biceps:'💪',
  cardio:'🏃',
  costas:'🏋️',
  gluteos:'🍑',
  ombros:'💪',
  peito:'🏋️',
  pernas:'🦵',
  triceps:'💪',
};

function exerciseEmoji(exercise){
  const emoji = EXERCISE_EMOJIS[exercise?.id] || MUSCLE_EMOJIS[exercise?.muscle] || '🏋️';
  return `<span class="exercise-emoji" aria-hidden="true">${emoji}</span>`;
}

function exerciseMedia(exercise, options){
  if(!exercise) return '🏋️';
  const image = EXERCISE_IMAGES[exercise.id];
  if(image){
    return `<img class="exercise-photo" src="${image}" alt="${escapeHtml(exercise.name)}" loading="lazy">`;
  }
  return exerciseEmoji(exercise);
}

function ensureOnboarding(){
  state.onboarding = state.onboarding && typeof state.onboarding === 'object'
    ? state.onboarding
    : {completed:false, completedAt:null};
  return state.onboarding;
}

function shouldShowOnboarding(){
  const onboarding = ensureOnboarding();
  return !onboarding.completed;
}

function completeOnboarding(){
  const onboarding = ensureOnboarding();
  onboarding.completed = true;
  onboarding.completedAt = new Date().toISOString();
  persist();
}

/* Todos os treinos disponíveis: fixos (data.js) + criados pelo usuário.
   includeRest=true também inclui a opção "Descanso" (usada no cronograma). */
function allTemplateIds(includeRest){
  const builtins = Object.keys(WORKOUT_TEMPLATES).filter(id=>includeRest || id!=='descanso');
  const custom = Object.keys(state.customTemplates||{});
  return builtins.concat(custom);
}

/* -------------------------------------------------------------------- */
/* Boot                                                                  */
/* -------------------------------------------------------------------- */
async function boot(){
  try{
    applyTheme();
    setupKeyboardAccessibility();
    setupAuthStateListener();

    if(!CONFIG.FEATURES.AUTH){
      state = activateUserStorage(null);
      renderAuthenticatedApp();
      hideLoader();
      return;
    }

    if(!SupabaseClient.isConfigured()){
      renderAuthScreen('config');
      hideLoader();
      return;
    }

    const session = await withTimeout(AUTH.getSession(), 7000, null);
    authUser = session?.user || null;
    if(authUser){
      state = activateUserStorage(authUser);
      await loadSupabaseProfile();
      applyTheme();
      renderAuthenticatedApp();
    } else {
      state = defaultState();
      renderAuthScreen(isPasswordRecoveryUrl() ? 'reset' : 'signin');
    }
    hideLoader();
  }catch(error){
    console.error('[FitTrack Boot] failed', error);
    renderBootError();
    hideLoader();
  }
}

function renderAuthenticatedApp(){
  renderShell();
  navigate(shouldShowOnboarding() ? 'onboarding' : 'dashboard');
  maybeGenerateNotifications();
  checkForRecoverableSession();
  authAppRendered = true;
}

function hideLoader(){
  setTimeout(()=>{
    const loader = document.getElementById('loader');
    if(loader){ loader.style.opacity='0'; setTimeout(()=>loader.remove(),400); }
  }, 500);
}

function renderBootError(){
  const app = document.getElementById('app');
  if(!app) return;
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-panel">
        <div class="auth-brand">
          <img src="icons/icon-192.png" alt="" class="brand-mark">
          <div>
            <div class="brand-name">FitTrack</div>
            <span>${CONFIG.VERSION}</span>
          </div>
        </div>
        <div class="auth-copy">
          <h1>Não foi possível carregar</h1>
          <p>Atualize a página. Se continuar, limpe o cache do navegador e tente novamente.</p>
        </div>
        <button class="btn btn-primary btn-block" type="button" id="reloadAppBtn">Tentar novamente</button>
      </section>
    </main>
  `;
  document.getElementById('reloadAppBtn')?.addEventListener('click', ()=>window.location.reload());
}

function setupAuthStateListener(){
  if(authListenerReady || !CONFIG.FEATURES.AUTH || !SupabaseClient.isConfigured()) return;
  authListenerReady = true;
  AUTH.onAuthStateChange(async (event, session)=>{
    authUser = session?.user || null;
    if(event==='PASSWORD_RECOVERY'){
      renderAuthScreen('reset');
      return;
    }
    if(event==='SIGNED_IN'){
      closeModal();
      state = activateUserStorage(session.user);
      await loadSupabaseProfile();
      applyTheme();
      if(!authAppRendered) renderAuthenticatedApp();
      else if(currentView==='profile') renderProfile();
      return;
    }
    if(event==='SIGNED_OUT'){
      authUser = null;
      authAppRendered = false;
      closeRunner();
      state = defaultState();
      renderAuthScreen('signin');
      return;
    }
    if(event==='TOKEN_REFRESHED' && session){
      authUser = session.user;
    }
  });
}

function isPasswordRecoveryUrl(){
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  return hash.get('type')==='recovery' || query.get('type')==='recovery';
}

/* ======================================================================
   AUTENTICAÇÃO
   ====================================================================== */
function renderAuthScreen(mode, message){
  mode = mode || 'signin';
  const app = document.getElementById('app');
  const titles = {
    signin: ['Entrar no FitTrack', 'Acesse sua conta para continuar.'],
    signup: ['Criar conta', 'Seus treinos locais continuam seguros neste aparelho.'],
    forgot: ['Recuperar senha', 'Enviaremos um link para você definir uma nova senha.'],
    reset: ['Nova senha', 'Defina uma nova senha para sua conta.'],
    config: ['Configurar Supabase', 'Adicione a URL e a chave pública do projeto para ativar contas.'],
  };
  const [title, subtitle] = titles[mode] || titles.signin;
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-panel">
        <div class="auth-brand">
          <img src="icons/icon-192.png" alt="" class="brand-mark">
          <div>
            <div class="brand-name">FitTrack</div>
            <span>${CONFIG.VERSION}</span>
          </div>
        </div>
        <div class="auth-copy">
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        ${message ? `<div class="auth-message">${message}</div>` : ''}
        ${authFormMarkup(mode)}
      </section>
      <div class="toast-wrap" id="toastWrap"></div>
    </main>
  `;
  wireAuthForm(mode);
}

function authFormMarkup(mode){
  if(mode==='config'){
    return `
      <div class="auth-note">
        <b>Configuração necessária</b>
        <span>Preencha <code>CONFIG.SUPABASE.URL</code> e <code>CONFIG.SUPABASE.PUBLISHABLE_KEY</code> em <code>js/config.js</code>. Use somente a chave pública/anon.</span>
      </div>
    `;
  }
  if(mode==='signup'){
    return `
      <form class="auth-form" id="authForm" novalidate>
        ${authField('name','Nome','text','Seu nome')}
        ${authField('email','Email','email','voce@email.com')}
        ${authField('password','Senha','password','Mínimo de 6 caracteres')}
        ${authField('confirmPassword','Confirmar senha','password','Repita sua senha')}
        <button class="btn btn-primary btn-block" type="submit">Criar conta</button>
        <button class="btn btn-ghost btn-block" type="button" data-auth-mode="signin">Já tenho conta</button>
      </form>
    `;
  }
  if(mode==='forgot'){
    return `
      <form class="auth-form" id="authForm" novalidate>
        ${authField('email','Email','email','voce@email.com')}
        <button class="btn btn-primary btn-block" type="submit">Enviar email de recuperação</button>
        <button class="btn btn-ghost btn-block" type="button" data-auth-mode="signin">Voltar para entrar</button>
      </form>
    `;
  }
  if(mode==='reset'){
    return `
      <form class="auth-form" id="authForm" novalidate>
        ${authField('password','Nova senha','password','Mínimo de 6 caracteres')}
        ${authField('confirmPassword','Confirmar nova senha','password','Repita sua senha')}
        <button class="btn btn-primary btn-block" type="submit">Atualizar senha</button>
      </form>
    `;
  }
  return `
    <form class="auth-form" id="authForm" novalidate>
      ${authField('email','Email','email','voce@email.com')}
      ${authField('password','Senha','password','Sua senha')}
      <button class="btn btn-primary btn-block" type="submit">Entrar</button>
      <button class="btn btn-ghost btn-block" type="button" data-auth-mode="signup">Criar conta</button>
      <button class="auth-link" type="button" data-auth-mode="forgot">Esqueci minha senha</button>
    </form>
  `;
}

function authField(id, label, type, placeholder){
  return `
    <div class="field" id="${id}Field">
      <label for="${id}Input">${label}</label>
      <input id="${id}Input" type="${type}" placeholder="${placeholder}" autocomplete="${authAutocomplete(id, type)}">
    </div>
  `;
}

function authAutocomplete(id, type){
  if(id==='name') return 'name';
  if(id==='email') return 'email';
  if(id==='confirmPassword') return 'new-password';
  return type==='password' ? 'current-password' : 'off';
}

function wireAuthForm(mode){
  document.querySelectorAll('[data-auth-mode]').forEach(btn=>{
    btn.addEventListener('click', ()=>renderAuthScreen(btn.dataset.authMode));
  });
  const form = document.getElementById('authForm');
  if(!form) return;
  form.addEventListener('submit', async (event)=>{
    event.preventDefault();
    clearAuthErrors(form);
    setAuthBusy(form, true);
    try{
      if(mode==='signin') await submitSignIn(form);
      if(mode==='signup') await submitSignUp(form);
      if(mode==='forgot') await submitForgotPassword(form);
      if(mode==='reset') await submitNewPassword(form);
    } finally {
      setAuthBusy(form, false);
    }
  });
}

function authValue(id){
  return document.getElementById(id+'Input')?.value.trim() || '';
}

function clearAuthErrors(root){
  root.querySelectorAll('.field.invalid').forEach(field=>field.classList.remove('invalid'));
  root.querySelectorAll('.field-error').forEach(el=>el.remove());
}

function setAuthError(id, message){
  const field = document.getElementById(id+'Field');
  if(!field) return;
  field.classList.add('invalid');
  field.insertAdjacentHTML('beforeend', `<span class="field-error">${message}</span>`);
}

function setAuthBusy(form, busy){
  form.querySelectorAll('button,input').forEach(el=>el.disabled = busy);
}

function validateEmailField(){
  const email = authValue('email');
  if(!AUTH.isValidEmail(email)){
    setAuthError('email','Informe um email válido.');
    return null;
  }
  return email;
}

function validatePasswordFields(requireConfirm){
  const password = authValue('password');
  const passwordError = AUTH.validatePassword(password);
  if(passwordError){
    setAuthError('password', passwordError);
    return null;
  }
  if(requireConfirm && password !== authValue('confirmPassword')){
    setAuthError('confirmPassword','As senhas precisam ser iguais.');
    return null;
  }
  return password;
}

async function submitSignIn(){
  const email = validateEmailField();
  const password = validatePasswordFields(false);
  if(!email || !password) return;
  const result = await AUTH.signIn({email, password});
  if(!result.ok){
    setAuthError('password', result.message || 'Email ou senha incorretos.');
    return;
  }
}

async function submitSignUp(){
  const name = authValue('name');
  if(!name) setAuthError('name','Informe seu nome.');
  const email = validateEmailField();
  const password = validatePasswordFields(true);
  if(!name || !email || !password) return;
  const result = await AUTH.signUp({name, email, password});
  if(!result.ok){
    setAuthError('email', result.message || 'Não foi possível criar a conta.');
    return;
  }
  if(result.needsEmailConfirmation){
    renderAuthScreen('signin','Conta criada! Verifique seu email para confirmar sua conta.');
  }
}

async function submitForgotPassword(){
  const email = validateEmailField();
  if(!email) return;
  const result = await AUTH.resetPassword(email);
  if(!result.ok){
    setAuthError('email', result.message || 'Não foi possível enviar o email.');
    return;
  }
  renderAuthScreen('signin','Se esse email estiver cadastrado, você receberá um link para redefinir a senha.');
}

async function submitNewPassword(){
  const password = validatePasswordFields(true);
  if(!password) return;
  const result = await AUTH.updatePassword(password);
  if(!result.ok){
    setAuthError('password', result.message || 'Não foi possível atualizar a senha.');
    return;
  }
  history.replaceState(null, '', window.location.pathname);
  await AUTH.signOut();
  renderAuthScreen('signin','Senha atualizada. Entre novamente para continuar.');
}

/* ======================================================================
   RECUPERAÇÃO DE TREINO EM ANDAMENTO
   ====================================================================== */
function checkForRecoverableSession(){
  const s = state.activeWorkoutSession;
  if(!isValidActiveSession(s)) return;
  const tpl = getTemplate(s.templateId);
  const doneSets = s.sets.reduce((a,ex)=>a+ex.filter(x=>x.done).length,0);
  const totalSets = s.sets.reduce((a,ex)=>a+ex.length,0);
  const startedDate = new Date(s.startedAt);
  openModal(`
    <h2 style="margin-bottom:6px;">Você tem um treino em andamento</h2>
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px;">${tpl.name} · iniciado ${fmtDate(todayKey(startedDate))} às ${String(startedDate.getHours()).padStart(2,'0')}:${String(startedDate.getMinutes()).padStart(2,'0')}</p>
    <div class="progress-track" style="margin-bottom:8px;"><div class="progress-fill" style="width:${totalSets?Math.round(doneSets/totalSets*100):0}%;"></div></div>
    <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:18px;">${doneSets} de ${totalSets} séries concluídas</p>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" id="discardSessionBtn" style="flex:1;">Descartar</button>
      <button class="btn btn-primary" id="resumeSessionBtn" style="flex:1;">Continuar treino</button>
    </div>
  `);
  document.getElementById('discardSessionBtn').addEventListener('click', ()=>{
    discardActiveSession();
    closeModal();
    showToast('Treino descartado', 'Você pode começar um novo quando quiser.', '🗑️');
  });
  document.getElementById('resumeSessionBtn').addEventListener('click', ()=>{
    closeModal();
    resumeActiveSession(s);
  });
}

function resumeActiveSession(s){
  const tpl = getTemplate(s.templateId);
  runnerCtx = {
    id: s.id, templateId: s.templateId, dateKey: s.dateKey, mood: s.mood,
    exIndex: s.exIndex, startTime: s.startedAt,
    lastCompleted: s.lastCompleted, restState: s.restState,
    exercises: Array.isArray(s.exercises) ? s.exercises : (tpl?.exercises||[]).map(ex=>Object.assign({}, ex)),
    sets: s.sets,
  };
  let el = document.getElementById('runnerRoot');
  if(!el){ el = document.createElement('div'); el.id='runnerRoot'; document.body.appendChild(el); }
  el.innerHTML = `<div class="runner" id="runnerEl"></div>`;
  requestAnimationFrame(()=>document.getElementById('runnerEl').classList.add('open'));
  renderRunnerExercise();
  startRunnerClock();

  if(runnerCtx.restState){
    const remaining = Math.round((runnerCtx.restState.endsAt-Date.now())/1000);
    if(runnerCtx.restState.paused){
      // estava pausado — reabre já pausado, sem deixar o tempo correr
      startRestOverlay(runnerCtx.restState.pausedRemaining, Date.now()+runnerCtx.restState.pausedRemaining*1000);
      document.getElementById('restPauseBtn')?.click();
    } else if(remaining>0){
      startRestOverlay(remaining, runnerCtx.restState.endsAt);
    } else {
      runnerCtx.restState = null;
      persistRunnerSession();
      showToast('Descanso já tinha terminado', 'Hora de voltar para a próxima série!', '⏱');
    }
  }
  showToast('Treino retomado', 'Continuando de onde você parou.', '▶️');
}

/* ======================================================================
   ACESSIBILIDADE — torna "divs clicáveis" operáveis por teclado
   ======================================================================
   O app usa vários cards/linhas com onclick em vez de <button> (cards de
   dia da agenda, atalhos do Home, resultados de busca de exercício etc).
   Em vez de reescrever cada tela pra usar <button>, esta função varre o
   conteúdo recém-renderizado, dá tabindex+role="button" pra esses
   elementos, e o listener global abaixo faz Enter/Espaço funcionar como
   clique — chamado uma vez, cobre o app inteiro. */
const CLICKABLE_DIV_SELECTOR = '[data-nav],[data-day],[data-daydetail],[data-addex],[data-mood],[data-tpl],[data-goal],[data-session],[data-toggle],[data-freeworkout],[data-replace-exercise],.theme-toggle,.card.interactive';

function makeInteractiveElementsAccessible(root){
  (root||document).querySelectorAll(CLICKABLE_DIV_SELECTOR).forEach(el=>{
    const tag = el.tagName.toLowerCase();
    if(tag==='button'||tag==='a'||tag==='input'||tag==='select'||tag==='textarea') return;
    if(!el.hasAttribute('tabindex')) el.setAttribute('tabindex','0');
    if(!el.hasAttribute('role')) el.setAttribute('role','button');
  });
}

function setupKeyboardAccessibility(){
  document.addEventListener('keydown', (e)=>{
    if(e.key!=='Enter' && e.key!==' ') return;
    const el = e.target;
    if(el && el.getAttribute && el.getAttribute('role')==='button' && el.tagName!=='BUTTON'){
      e.preventDefault();
      el.click();
    }
  });
}

function applyTheme(){
  document.body.classList.toggle('light', state.user.theme==='light');
}

/* -------------------------------------------------------------------- */
/* Shell: sidebar + mobile nav                                          */
/* -------------------------------------------------------------------- */
const NAV_ITEMS = [
  {id:'dashboard', label:'Início', icon:'home'},
  {id:'treino', label:'Treino', icon:'dumbbell'},
  {id:'progresso', label:'Progresso', icon:'trending-up'},
  {id:'profile', label:'Perfil', icon:'user'},
];

function renderShell(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand"><img src="icons/icon-192.png" alt="" class="brand-mark"><div class="brand-name">FitTrack</div></div>
      <nav class="nav" id="sidebarNav"></nav>
      <div class="sidebar-footer">
        <div class="theme-toggle" id="themeToggle" role="button">
          <span style="display:inline-flex;align-items:center;gap:8px;">${icon(state.user.theme==='light'?'sun':'moon',{size:16})}${state.user.theme==='light'?'Modo claro':'Modo escuro'}</span>
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
      <span class="ico">${icon(n.icon)}</span><span class="lbl">${n.label}</span>
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
  saveSupabaseProfileQuietly();
  applyTheme();
  document.getElementById('themeToggle').innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:8px;">${icon(state.user.theme==='light'?'sun':'moon',{size:16})}${state.user.theme==='light'?'Modo claro':'Modo escuro'}</span>
    <div class="switch"></div>`;
}

function navigate(view, subTab){
  // rotas antigas (de antes da navegação ser reduzida) mapeadas pra dentro
  // das novas sub-abas — assim nenhum link/atalho existente quebra
  const legacyMap = {
    agenda: {view:'treino', tab:'agenda'},
    editor: {view:'treino', tab:'editor'},
    exercises: {view:'treino', tab:'exercicios'},
    history: {view:'progresso', tab:'historico'},
    stats: {view:'progresso', tab:'geral'},
  };
  if(legacyMap[view]){
    subTab = subTab || legacyMap[view].tab;
    view = legacyMap[view].view;
  }
  if(view==='treino' && subTab) currentTreinoTab = subTab;
  if(view==='progresso' && subTab) currentProgressoTab = subTab;
  if(view==='profile' && subTab) currentProfileTab = subTab;

  currentView = view;
  renderNavLists();
  const wrap = document.getElementById('viewWrap');
  wrap.classList.remove('view-enter');
  void wrap.offsetWidth;
  wrap.classList.add('view-enter');
  const renderers = {
    onboarding: renderOnboarding,
    dashboard: renderDashboard,
    treino: renderTreino,
    progresso: renderProgresso,
    profile: renderProfile,
  };
  (renderers[view]||renderDashboard)();
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({top:0,behavior:prefersReducedMotion?'auto':'smooth'});
}

/* -------------------------------------------------------------------- */
/* Toasts / notificações                                                */
/* -------------------------------------------------------------------- */
function showToast(title, message, emoji){
  let wrap = document.getElementById('toastWrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    wrap.id = 'toastWrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  const iconEl = document.createElement('div');
  iconEl.className = 'toast-icon';
  iconEl.textContent = emoji || '🔔';
  const body = document.createElement('div');
  const titleEl = document.createElement('b');
  titleEl.textContent = title || 'FitTrack';
  const messageEl = document.createElement('span');
  messageEl.textContent = message || '';
  body.append(titleEl, messageEl);
  el.append(iconEl, body);
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
  const today = todayKey();
  const suggestion = smartWorkoutSuggestion(today);
  if(suggestion.template && !state.completedDates[today]){
    showToast('Hora do treino!', `Sugestão de hoje: ${suggestion.template.name}.`, '⏰');
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
  const total = days.length || Number(state.user.availableDays)||0;
  const start = startOfWeek(new Date());
  const end = new Date(start.getTime()+7*86400000);
  const done = Object.keys(state.completedDates||{}).filter(key=>{
    const d = new Date(key+'T00:00:00');
    return d>=start && d<end;
  }).length;
  return {done: total ? Math.min(done, total) : done, total: total || done};
}

function dayPlanFor(dateKey){
  if(typeof Calendar !== 'undefined' && Calendar.getDayPlan){
    return Calendar.getDayPlan(dateKey);
  }
  const d = new Date(dateKey+'T00:00:00');
  const templateId = state.weekPlan[d.getDay()];
  const tpl = getTemplate(templateId);
  if(!tpl || tpl.id==='descanso') return {type:'rest', label:'Descanso', isOverride:false};
  return {type:'workout', templateId, tpl, label:tpl.name, isOverride:false};
}

function recentWorkoutMuscles(days){
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days || 3));
  return (state.history || [])
    .filter(session=>new Date((session.date || session.completed_at || todayKey())+'T00:00:00') >= cutoff)
    .map(session=>getTemplate(session.templateId)?.muscle)
    .filter(Boolean);
}

function templateHasMuscle(tpl, muscle){
  if(!tpl || !muscle) return false;
  if(tpl.muscle===muscle) return true;
  return (tpl.exercises || []).some(ex=>findExercise(ex.exerciseId)?.muscle===muscle);
}

function templateHasAnyMuscle(tpl, muscles){
  return (muscles || []).some(muscle=>templateHasMuscle(tpl, muscle));
}

function workoutScore(templateId, context){
  const tpl = getTemplate(templateId);
  if(!tpl || tpl.id==='descanso') return {score:-999, reasons:[]};
  const user = state.user || {};
  const reasons = [];
  let score = 0;

  if(templateId === context.plannedId){
    score += context.isOverride ? 38 : 28;
    reasons.push(context.isOverride ? 'respeita sua remarcação' : 'segue seu plano');
  }
  if(isFavoriteWorkout(templateId)){
    score += 18;
    reasons.push('está salvo nos favoritos');
  }

  const avgTime = Number(user.avgWorkoutTime || 45);
  const diff = Math.abs(Number(tpl.estimatedTime || avgTime) - avgTime);
  if(diff <= 10){
    score += 16;
    reasons.push(`cabe em ${avgTime} min`);
  } else if(diff > 25){
    score -= 12;
  }

  const focus = Array.isArray(user.focusAreas) ? user.focusAreas : [];
  if(focus.length && templateHasAnyMuscle(tpl, focus)){
    score += 18;
    reasons.push('combina com seu foco');
  }

  if(user.goal==='hipertrofia' && ['gluteos','pernas','peito','costas'].includes(tpl.muscle)){
    score += 12;
    reasons.push('bom para hipertrofia');
  }
  if(user.goal==='emagrecimento' && (tpl.id==='full_body_condicionamento' || templateHasMuscle(tpl, 'cardio'))){
    score += 16;
    reasons.push('ajuda no gasto semanal');
  }
  if(user.goal==='condicionamento' && (tpl.id==='full_body_condicionamento' || templateHasMuscle(tpl, 'cardio'))){
    score += 18;
    reasons.push('prioriza condicionamento');
  }
  if(user.goal==='forca' && !templateHasMuscle(tpl, 'cardio')){
    score += 10;
    reasons.push('mantém treino de força');
  }

  if(context.recentMuscles.includes(tpl.muscle)){
    score -= 16;
  } else if(tpl.muscle){
    score += 8;
    reasons.push('evita repetir o mesmo foco');
  }

  const limitations = Array.isArray(user.limitations) ? user.limitations : [];
  if(limitations.includes('tempo') && Number(tpl.estimatedTime || 0) <= 60){
    score += 10;
    reasons.push('mais enxuto');
  }

  return {score, reasons:[...new Set(reasons)].slice(0,3)};
}

function smartWorkoutSuggestion(dateKey){
  const plan = dayPlanFor(dateKey);
  const plannedId = plan.type==='workout' ? plan.templateId : null;
  const context = {
    plannedId,
    isOverride: !!plan.isOverride,
    recentMuscles: recentWorkoutMuscles(3),
  };
  const ranked = allTemplateIds(false)
    .map(id=>({id, tpl:getTemplate(id), result:workoutScore(id, context)}))
    .filter(item=>item.tpl && item.tpl.id!=='descanso')
    .sort((a,b)=>{
      if(b.result.score !== a.result.score) return b.result.score - a.result.score;
      return a.tpl.name.localeCompare(b.tpl.name);
    });
  const best = ranked[0] || null;
  if(!best) return {template:null, templateId:null, plan, reason:'Escolha qualquer treino salvo.', alternatives:[]};
  const alternatives = ranked.slice(1,4).map(item=>item.id);
  return {
    template:best.tpl,
    templateId:best.id,
    plan,
    reason:best.result.reasons.join(' · ') || 'boa opção para hoje',
    alternatives,
  };
}

function nextWorkout(){
  const d = new Date();
  const today = todayKey(d);
  if(!state.completedDates[today]){
    const suggestion = smartWorkoutSuggestion(today);
    return {
      template: suggestion.template,
      suggestion,
      date:d,
      isToday:true,
      freeChoice:true,
    };
  }
  for(let i=0;i<7;i++){
    const check = new Date(d); check.setDate(d.getDate()+i);
    const key = todayKey(check);
    const plan = dayPlanFor(key);
    if(plan.type==='workout' && plan.tpl && !state.completedDates[key]){
      return {template:plan.tpl, suggestion:{template:plan.tpl, templateId:plan.templateId, plan, reason:plan.isOverride?'remarcado na agenda':'próximo no plano', alternatives:[]}, date:check, isToday:i===0};
    }
  }
  return null;
}

/* Próximo treino agendado DEPOIS do que já aparece no card principal —
   pra dar uma prévia do que vem a seguir, sem duplicar o que já é hero. */
function upcomingAfterHero(nw){
  const from = nw ? new Date(nw.date) : new Date();
  for(let i=1;i<=7;i++){
    const check = new Date(from); check.setDate(from.getDate()+i);
    const planId = state.weekPlan[check.getDay()];
    const tpl = getTemplate(planId);
    if(tpl && tpl.id!=='descanso'){
      return {template:tpl, date:check};
    }
  }
  return null;
}

/* Estimativa de calorias pra um treino ainda não realizado, usando o mesmo
   cálculo aplicado a sessões concluídas (volume*0.05 + minutos*4), só que
   com o volume PLANEJADO do treino (séries×reps×carga) em vez do real. */
function estimatedCalories(tpl){
  const plannedVolume = tpl.exercises.reduce((sum,ex)=>sum + (ex.sets*ex.reps*(ex.load||0)), 0);
  return Math.round(plannedVolume*0.05 + (tpl.estimatedTime||30)*4);
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

/* ======================================================================
   VIEW: ONBOARDING
   ====================================================================== */
const ONBOARDING_GOALS = [
  {id:'hipertrofia', label:'Hipertrofia', detail:'Ganhar massa e evoluir cargas'},
  {id:'emagrecimento', label:'Emagrecimento', detail:'Manter constância e gasto semanal'},
  {id:'forca', label:'Força', detail:'Priorizar progressão e técnica'},
  {id:'condicionamento', label:'Condicionamento', detail:'Treinar melhor, respirar melhor'},
];

const ONBOARDING_LEVELS = [
  {id:'iniciante', label:'Iniciante'},
  {id:'intermediario', label:'Intermediária'},
  {id:'avancado', label:'Avançada'},
];

const ONBOARDING_DAYS = [2,3,4,5,6];
const ONBOARDING_TIMES = [30,45,60,75];

const ONBOARDING_FOCUS = [
  {id:'gluteos', label:'Glúteos'},
  {id:'pernas', label:'Pernas'},
  {id:'costas', label:'Costas'},
  {id:'peito', label:'Peito'},
  {id:'ombros', label:'Ombros'},
  {id:'abdomen', label:'Abdômen'},
  {id:'cardio', label:'Cardio'},
];

const ONBOARDING_LIMITATIONS = [
  {id:'joelho', label:'Joelho'},
  {id:'lombar', label:'Lombar'},
  {id:'ombro', label:'Ombro'},
  {id:'tempo', label:'Pouco tempo'},
  {id:'equipamento', label:'Pouco equipamento'},
];

function recommendedWeekPlan(days, goal){
  const plan = {
    0:'descanso',
    1:'descanso',
    2:'descanso',
    3:'descanso',
    4:'descanso',
    5:'descanso',
    6:'descanso',
  };
  const base = goal==='condicionamento'
    ? ['full_body_condicionamento','gluteo_posterior','peito_ombro_triceps','quadriceps_panturrilha','costas_biceps_abdomen','full_body_condicionamento']
    : ['gluteo_posterior','costas_biceps_abdomen','quadriceps_panturrilha','peito_ombro_triceps','gluteo_enfase','full_body_condicionamento'];
  const daySlots = {
    2:[1,4],
    3:[1,3,5],
    4:[1,2,4,5],
    5:[1,2,3,4,5],
    6:[1,2,3,4,5,6],
  }[Math.max(2, Math.min(6, Number(days)||3))];
  daySlots.forEach((day, index)=>{ plan[day] = base[index] || 'full_body_condicionamento'; });
  return plan;
}

function onboardingChoiceButtons(name, options, selected, extra){
  return options.map(option=>{
    const value = String(option.id ?? option);
    const label = option.label ?? option;
    const detail = option.detail ? `<span>${option.detail}</span>` : '';
    return `
      <button class="onboarding-choice ${String(selected)===value?'active':''}" type="button" data-onboarding-choice="${name}" data-value="${value}">
        <strong>${label}</strong>
        ${detail}
      </button>
    `;
  }).join('') + (extra || '');
}

function onboardingMultiButtons(name, options, selected){
  const selectedSet = new Set(selected || []);
  return options.map(option=>`
    <button class="chip ${selectedSet.has(option.id)?'active':''}" type="button" data-onboarding-multi="${name}" data-value="${option.id}">
      ${option.label}
    </button>
  `).join('');
}

function getOnboardingSingle(name){
  return document.querySelector(`[data-onboarding-choice="${name}"].active`)?.dataset.value || '';
}

function getOnboardingMulti(name){
  return [...document.querySelectorAll(`[data-onboarding-multi="${name}"].active`)].map(btn=>btn.dataset.value);
}

function setOnboardingChoice(button){
  document.querySelectorAll(`[data-onboarding-choice="${button.dataset.onboardingChoice}"]`).forEach(el=>el.classList.remove('active'));
  button.classList.add('active');
}

function toggleOnboardingMulti(button){
  button.classList.toggle('active');
}

function renderOnboarding(){
  const wrap = document.getElementById('viewWrap');
  const u = state.user;
  const selectedGoal = u.goal || 'hipertrofia';
  const selectedDays = Number(u.availableDays || 3);
  const selectedTime = Number(u.avgWorkoutTime || 45);
  const selectedLevel = u.level || 'iniciante';
  const selectedFocus = Array.isArray(u.focusAreas) ? u.focusAreas : [];
  const selectedLimitations = Array.isArray(u.limitations) ? u.limitations : [];

  wrap.innerHTML = `
    <div class="view-header onboarding-header">
      <div class="greeting">
        <h1>Vamos ajustar seu FitTrack</h1>
        <p>Seu treino fica mais livre quando o app entende sua rotina.</p>
      </div>
    </div>

    <div class="onboarding-grid">
      <section class="card onboarding-card">
        <div class="section-title">Perfil</div>
        <div class="field"><label>Nome</label><input type="text" id="onboardingName" value="${escapeHtml(u.name||'')}" placeholder="Seu nome"></div>
        <div class="field-row">
          <div class="field"><label>Altura (cm)</label><input type="number" id="onboardingHeight" value="${u.height||''}"></div>
          <div class="field"><label>Peso (kg)</label><input type="number" step="0.1" id="onboardingWeight" value="${u.weight||''}"></div>
        </div>
      </section>

      <section class="card onboarding-card">
        <div class="section-title">Objetivo principal</div>
        <div class="onboarding-choice-grid">
          ${onboardingChoiceButtons('goal', ONBOARDING_GOALS, selectedGoal)}
        </div>
      </section>

      <section class="card onboarding-card">
        <div class="section-title">Rotina</div>
        <label class="onboarding-label">Dias por semana</label>
        <div class="onboarding-inline">
          ${onboardingChoiceButtons('days', ONBOARDING_DAYS.map(d=>({id:d,label:`${d} dias`})), selectedDays)}
        </div>
        <label class="onboarding-label">Tempo médio</label>
        <div class="onboarding-inline">
          ${onboardingChoiceButtons('time', ONBOARDING_TIMES.map(t=>({id:t,label:`${t} min`})), selectedTime)}
        </div>
      </section>

      <section class="card onboarding-card">
        <div class="section-title">Nível e foco</div>
        <label class="onboarding-label">Experiência</label>
        <div class="onboarding-inline">
          ${onboardingChoiceButtons('level', ONBOARDING_LEVELS, selectedLevel)}
        </div>
        <label class="onboarding-label">Áreas que você quer priorizar</label>
        <div class="chip-row">
          ${onboardingMultiButtons('focus', ONBOARDING_FOCUS, selectedFocus)}
        </div>
      </section>

      <section class="card onboarding-card">
        <div class="section-title">Atenções</div>
        <div class="chip-row">
          ${onboardingMultiButtons('limitations', ONBOARDING_LIMITATIONS, selectedLimitations)}
        </div>
      </section>
    </div>

    <div class="onboarding-actions">
      <button class="btn btn-primary" id="finishOnboardingBtn">Salvar e começar</button>
      <button class="btn btn-ghost" id="skipOnboardingBtn">Agora não</button>
    </div>
  `;

  wrap.querySelectorAll('[data-onboarding-choice]').forEach(btn=>{
    btn.addEventListener('click', ()=>setOnboardingChoice(btn));
  });
  wrap.querySelectorAll('[data-onboarding-multi]').forEach(btn=>{
    btn.addEventListener('click', ()=>toggleOnboardingMulti(btn));
  });
  document.getElementById('skipOnboardingBtn').addEventListener('click', ()=>{
    completeOnboarding();
    navigate('dashboard');
  });
  document.getElementById('finishOnboardingBtn').addEventListener('click', saveOnboarding);
}

async function saveOnboarding(){
  const button = document.getElementById('finishOnboardingBtn');
  button.disabled = true;
  button.textContent = 'Salvando...';

  const weight = Number(document.getElementById('onboardingWeight').value) || state.user.weight;
  if(weight && weight !== state.user.weight){
    state.weightLog.push({date:todayKey(), weight});
  }

  state.user.name = document.getElementById('onboardingName').value.trim() || state.user.name || 'Usuária FitTrack';
  state.user.height = Number(document.getElementById('onboardingHeight').value) || state.user.height;
  state.user.weight = weight;
  state.user.goal = getOnboardingSingle('goal') || state.user.goal || 'hipertrofia';
  state.user.availableDays = Number(getOnboardingSingle('days')) || state.user.availableDays || 3;
  state.user.avgWorkoutTime = Number(getOnboardingSingle('time')) || state.user.avgWorkoutTime || 45;
  state.user.level = getOnboardingSingle('level') || state.user.level || 'iniciante';
  state.user.focusAreas = getOnboardingMulti('focus');
  state.user.limitations = getOnboardingMulti('limitations');
  state.weekPlan = recommendedWeekPlan(state.user.availableDays, state.user.goal);
  completeOnboarding();

  const remote = await saveSupabaseProfile({silent:true});
  if(remote.ok){
    showToast('FitTrack ajustado', 'Seu perfil foi salvo neste aparelho e no Supabase.', '✅');
  } else {
    showToast('FitTrack ajustado', 'Seu perfil foi salvo neste aparelho.', '✅');
  }
  navigate('dashboard');
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
  const lastSession = [...state.history].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const lastAchievement = [...state.unlockedAchievements].reverse().map(id=>ACHIEVEMENTS.find(a=>a.id===id)).find(Boolean);
  const nextAchievement = ACHIEVEMENTS.find(a=>!state.unlockedAchievements.includes(a.id));
  const upcoming = upcomingAfterHero(nw);
  const pr = Analytics.latestPR();
  const lastWeight = [...(state.weightLog||[])].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const goalsTotal = state.goals.length;
  const goalsDone = state.goals.filter(g=>g.done).length;

  wrap.innerHTML = `
    <div class="view-header">
      <div class="greeting">
        <h1>${greet}, ${escapeHtml(state.user.name)} 👋</h1>
        <p>Vamos continuar sua evolução hoje.</p>
      </div>
      <div class="header-actions">
        <button class="icon-btn" id="notifBtn" aria-label="Ver notificações">${icon('bell')}${state.notifications.some(n=>!n.read)?'<span class="badge-dot"></span>':''}</button>
      </div>
    </div>

    <div class="card hero-card ${nw?'interactive':''}" id="nextWorkoutCard" ${nw?'style="cursor:pointer;"':''}>
      ${nw ? `
        <div class="hero-eyebrow">${nw.freeChoice?'Sugestão de hoje':nw.isToday?'Treino de hoje':WEEKDAY_NAMES[nw.date.getDay()]}</div>
        <div style="display:flex;align-items:center;gap:16px;">
          <div class="list-row-icon" style="width:56px;height:56px;font-size:24px;flex-shrink:0;">${nw.template ? (MUSCLE_ICONS[nw.template.muscle]||'🏋️') : '🏋️'}</div>
          <div style="min-width:0;">
            <div style="font-weight:800;font-size:19px;">${nw.template ? nw.template.name : 'Treino livre'}</div>
            <div class="hero-meta">
              ${nw.template ? `
                <span>⏱️ ${nw.template.estimatedTime} min</span>
                <span>🏋️ ${nw.template.exercises.length} exercícios</span>
                <span>🔥 ~${estimatedCalories(nw.template)} kcal</span>
              ` : '<span>Escolha qualquer treino salvo</span>'}
            </div>
            ${nw.suggestion?.reason ? `<div style="font-size:12.5px;color:var(--text-dim);line-height:1.45;margin-top:6px;">${escapeHtml(nw.suggestion.reason)}</div>` : ''}
          </div>
        </div>
        ${nw.freeChoice && nw.template ? `
          <div class="hero-actions">
            <button class="btn btn-primary hero-cta" id="startSuggestedBtn">Começar sugerido</button>
            <button class="btn btn-ghost hero-cta" id="chooseWorkoutBtn">Escolher outro</button>
          </div>
        ` : nw.freeChoice ? `<button class="btn btn-primary hero-cta" id="chooseWorkoutBtn">Escolher treino</button>` : `<button class="btn btn-primary hero-cta" id="continueBtn">Começar treino</button>`}
      ` : `<div class="empty-state"><span class="emoji">🎉</span>Você concluiu todos os treinos da semana! Aproveite pra descansar.</div>`}
    </div>

    <details class="dash-section">
      <summary>
        <span class="dash-section-title">Progresso</span>
        <span class="dash-section-glance">🔥 ${streak} dia${streak===1?'':'s'} · ${wp.done}/${wp.total} essa semana</span>
      </summary>
      <div class="dash-section-body">
        <div class="grid grid-3" style="margin-bottom:16px;">
          <div class="card stat-card"><span class="stat-label">Sequência</span><span class="stat-value">🔥 ${streak}</span></div>
          <div class="card stat-card"><span class="stat-label">Treinos/semana</span><span class="stat-value">${wp.done}<span style="font-size:13px;color:var(--text-dim);">/${wp.total}</span></span></div>
          <div class="card stat-card"><span class="stat-label">Peso atual</span><span class="stat-value">${state.user.weight}<span style="font-size:13px;color:var(--text-dim);">kg</span></span></div>
        </div>

        <div class="section-title" style="margin-top:0;">Último recorde</div>
        ${pr ? `
          <div class="card mini-preview-row pr-celebration" style="margin-bottom:16px;">
            <div class="list-row-icon" style="background:rgba(166,111,252,.15);">🏆</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:14px;">${pr.label}</div>
              <div style="color:var(--text-dim);font-size:12.5px;">${pr.value}${pr.date?' · '+fmtDate(pr.date):''}</div>
            </div>
          </div>
        ` : `<div class="empty-state" style="margin-bottom:16px;"><span class="emoji">🏋️</span>Seus recordes de carga aparecem aqui.</div>`}

        <div class="section-title">Último peso registrado</div>
        ${lastWeight ? `
          <div class="card mini-preview-row" style="margin-bottom:16px;">
            <div class="list-row-icon">⚖️</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:14px;">${WorkoutProgression.formatKg(lastWeight.weight)}</div>
              <div style="color:var(--text-dim);font-size:12.5px;">${fmtDate(lastWeight.date)}</div>
            </div>
          </div>
        ` : `<div class="empty-state" style="margin-bottom:16px;"><span class="emoji">⚖️</span>Registre seu peso pra acompanhar aqui.</div>`}

        <div class="section-title">Metas <span class="link" data-nav="profile" data-navtab="metas">ver todas</span></div>
        <div class="progress-track" style="margin-bottom:10px;"><div class="progress-fill" style="width:${goalsTotal?Math.round(goalsDone/goalsTotal*100):0}%;"></div></div>
        <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:10px;">${goalsDone} de ${goalsTotal} metas concluídas</p>
        <div id="miniGoals"></div>
      </div>
    </details>

    <details class="dash-section">
      <summary>
        <span class="dash-section-title">Atividade</span>
        <span class="dash-section-glance">${lastAchievement?lastAchievement.name:(lastSession?lastSession.name:'sem atividade ainda')}</span>
      </summary>
      <div class="dash-section-body">
        <div class="section-title" style="margin-top:0;">Próximo treino agendado</div>
        ${upcoming ? `
          <div class="card mini-preview-row" style="margin-bottom:16px;">
            <div class="list-row-icon">${MUSCLE_ICONS[upcoming.template.muscle]||'🏋️'}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:14px;">${upcoming.template.name}</div>
              <div style="color:var(--text-dim);font-size:12.5px;">${WEEKDAY_NAMES[upcoming.date.getDay()]}</div>
            </div>
          </div>
        ` : `<div class="empty-state" style="margin-bottom:16px;"><span class="emoji">📅</span>Nada mais agendado essa semana.</div>`}

        <div class="section-title">Conquista recente <span class="link" data-nav="progresso" data-navtab="conquistas">ver todas</span></div>
        ${lastAchievement ? `
          <div class="card interactive mini-preview-row" data-nav="progresso" data-navtab="conquistas" style="cursor:pointer;margin-bottom:16px;">
            <div class="list-row-icon" style="font-size:24px;">${lastAchievement.emoji}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:14px;">${lastAchievement.name}</div>
              <div style="color:var(--text-dim);font-size:12.5px;">Desbloqueada · ${lastAchievement.desc}</div>
            </div>
          </div>
        ` : nextAchievement ? `
          <div class="card mini-preview-row" style="opacity:.65;margin-bottom:16px;">
            <div class="list-row-icon" style="font-size:24px;filter:grayscale(1);">${nextAchievement.emoji}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:14px;">${nextAchievement.name}</div>
              <div style="color:var(--text-dim);font-size:12.5px;">Próxima meta · ${nextAchievement.desc}</div>
            </div>
          </div>
        ` : `<div class="empty-state" style="margin-bottom:16px;"><span class="emoji">🏆</span>Suas conquistas aparecem aqui.</div>`}

        <div class="section-title">Atividade recente <span class="link" data-nav="history">ver tudo</span></div>
        ${lastSession ? `
          <div class="card interactive mini-preview-row" data-nav="history" style="cursor:pointer;">
            <div class="list-row-icon">${MUSCLE_ICONS[getTemplate(lastSession.templateId)?.muscle]||'🏋️'}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:14px;">${lastSession.name}</div>
              <div style="color:var(--text-dim);font-size:12.5px;">${fmtDate(lastSession.date)} · ${lastSession.duration} min · ${workoutDisplayMetrics(lastSession).totalLoad>0 ? WorkoutProgression.formatKg(workoutDisplayMetrics(lastSession).totalLoad)+' carga' : 'peso corporal'} · ${workoutDisplayMetrics(lastSession).totalReps} reps</div>
            </div>
          </div>
        ` : `<div class="empty-state"><span class="emoji">📋</span>Seu histórico de treinos aparece aqui.</div>`}
      </div>
    </details>
  `;

  renderMiniGoals();

  document.getElementById('notifBtn').addEventListener('click', openNotifPanel);
  if(nw){
    document.getElementById('nextWorkoutCard').addEventListener('click', (e)=>{
      if(['continueBtn','startSuggestedBtn','chooseWorkoutBtn'].includes(e.target.id)) return;
      if(nw.freeChoice) openWorkoutPicker(todayKey(nw.date), nw.template?.id);
      else startCheckinFlow(nw.template.id, todayKey(nw.date));
    });
    const continueBtn = document.getElementById('continueBtn');
    if(continueBtn){
      continueBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        startCheckinFlow(nw.template.id, todayKey(nw.date));
      });
    }
    const startSuggestedBtn = document.getElementById('startSuggestedBtn');
    if(startSuggestedBtn){
      startSuggestedBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        if(!nw.template) return openWorkoutPicker(todayKey(nw.date), null);
        startCheckinFlow(nw.template.id, todayKey(nw.date));
      });
    }
    const chooseWorkoutBtn = document.getElementById('chooseWorkoutBtn');
    if(chooseWorkoutBtn){
      chooseWorkoutBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        openWorkoutPicker(todayKey(nw.date), nw.template?.id);
      });
    }
  }
  wrap.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.nav, el.dataset.navtab)));
  makeInteractiveElementsAccessible(wrap);
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
/* ======================================================================
   TREINO — agrupa Agenda, Editar Treinos e Exercícios em sub-abas
   ====================================================================== */
let currentTreinoTab = 'agenda';

function renderTreino(){
  agendaWeekOffset = 0;
  calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const wrap = document.getElementById('viewWrap');
  const tabs = [
    {id:'agenda', label:'Agenda'},
    {id:'calendario', label:'Calendário'},
    {id:'editor', label:'Editar Treinos'},
    {id:'exercicios', label:'Exercícios'},
  ];
  wrap.innerHTML = `
    <div class="view-header"><div class="greeting"><h1>Treino</h1><p>Sua agenda, seus treinos e sua biblioteca de exercícios.</p></div></div>
    <div class="tabs" id="treinoTabs">
      ${tabs.map(t=>`<button class="tab-btn ${currentTreinoTab===t.id?'active':''}" data-treinotab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="treinoTabContent"></div>
  `;
  document.querySelectorAll('[data-treinotab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ currentTreinoTab=btn.dataset.treinotab; renderTreino(); });
  });
  const renderers = {agenda: renderAgenda, calendario: renderCalendarView, editor: renderEditor, exercicios: renderExercises};
  renderers[currentTreinoTab]();
  makeInteractiveElementsAccessible(document.getElementById('treinoTabContent'));
}

/* ======================================================================
   CALENDÁRIO — planejador mensal, heatmap e remarcação inteligente
   (lógica de dados em calendar.js — aqui é só a tela)
   ====================================================================== */
let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const CAL_STATUS_META = {
  done:      {label:'Concluído', color:'var(--green)',  icon:'check'},
  missed:    {label:'Perdido',   color:'var(--red)',    icon:'x'},
  scheduled: {label:'Agendado',  color:'var(--blue)',    icon:'dumbbell'},
  rest:      {label:'Descanso',  color:'var(--text-faint)', icon:'moon'},
  cardio:    {label:'Cardio',    color:'var(--purple)', icon:'trending-up'},
  mobility:  {label:'Mobilidade',color:'var(--purple)', icon:'check'},
  custom:    {label:'Atividade', color:'var(--purple)', icon:'plus'},
};

function renderCalendarView(){
  const wrap = document.getElementById('treinoTabContent');
  const cons = Calendar.consistencyStats();
  const missed = Calendar.missedWorkouts();
  const suggestions = Calendar.smartSuggestions();
  const recovery = Calendar.weekMuscleRecovery();
  const year = calendarCursor.getFullYear(), month = calendarCursor.getMonth();
  const monthLabel = calendarCursor.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const grid = Calendar.monthGrid(year, month);
  const hasAnyPlan = Object.values(state.weekPlan).some(id=>{ const t=getTemplate(id); return t && t.id!=='descanso'; }) || Object.keys(state.scheduleOverrides).length>0;

  wrap.innerHTML = `
    <div class="grid grid-4" style="margin-bottom:18px;">
      <div class="card stat-card"><span class="stat-label">Sequência</span><span class="stat-value">🔥 ${cons.streak}</span></div>
      <div class="card stat-card"><span class="stat-label">Maior sequência</span><span class="stat-value">${cons.best}</span></div>
      <div class="card stat-card"><span class="stat-label">Semana</span><span class="stat-value">${cons.weekDone}<span style="font-size:12px;color:var(--text-dim);">/${cons.weekTotal}</span></span></div>
      <div class="card stat-card"><span class="stat-label">Consistência do mês</span><span class="stat-value">${cons.monthPct}%</span></div>
    </div>

    ${missed.length ? `
      <div class="analysis-banner warning" id="rescheduleBanner">
        <div style="flex:1;">
          ⚠️ Você perdeu o treino de <b>${WEEKDAY_NAMES[missed[0].date.getDay()]}</b> (${missed[0].plan.label}). Quer remarcar pra hoje?
          <div style="display:flex;gap:10px;margin-top:10px;">
            <button class="btn btn-primary btn-sm" id="rescheduleAcceptBtn">Remarcar pra hoje</button>
            <button class="btn btn-ghost btn-sm" id="rescheduleDismissBtn">Dispensar</button>
          </div>
        </div>
      </div>
    ` : ''}

    ${suggestions.length ? `
      <div class="section-title" style="margin-top:0;">Sugestões</div>
      <div style="margin-bottom:18px;">${suggestions.map(s=>`<div class="card insight-card">${s}</div>`).join('')}</div>
    ` : ''}

    ${recovery.some(r=>r.warning) ? `
      <div class="section-title" style="margin-top:0;">Recuperação muscular</div>
      <div class="card" style="margin-bottom:18px;">
        ${recovery.map(r=>`<span class="chip ${r.warning?'':'active'}" style="${r.warning?'border-color:var(--red);color:var(--red);':''}margin:0 6px 6px 0;">${r.label} · ${r.days}x essa semana${r.warning?' ⚠️':''}</span>`).join('')}
      </div>
    ` : ''}

    <div class="agenda-week-nav">
      <button class="icon-btn" id="calPrevMonth" aria-label="Mês anterior">${icon('chevron-left')}</button>
      <div class="agenda-week-label"><span style="text-transform:capitalize;">${monthLabel}</span></div>
      <button class="icon-btn" id="calNextMonth" aria-label="Próximo mês">${icon('chevron-right')}</button>
    </div>

    ${hasAnyPlan ? `
      <div class="cal-grid" id="calGrid" role="grid" aria-label="Calendário de treinos">
        ${['D','S','T','Q','Q','S','S'].map(d=>`<div class="cal-weekday">${d}</div>`).join('')}
        ${grid.map(cell=>{
          if(!cell) return `<div class="cal-cell cal-empty"></div>`;
          const meta = CAL_STATUS_META[cell.status];
          const draggable = cell.status==='scheduled'||cell.status==='missed'||cell.status==='done';
          return `<div class="cal-cell ${cell.isToday?'today':''} ${draggable?'cal-draggable':''}" data-datekey="${cell.dateKey}" tabindex="0" role="gridcell" aria-label="${cell.date.getDate()} - ${meta.label}${cell.isToday?' - hoje':''}">
            <span class="cal-daynum">${cell.date.getDate()}</span>
            <span class="cal-dot" style="background:${meta.color};" title="${meta.label}"></span>
          </div>`;
        }).join('')}
      </div>
      <div class="cal-legend">
        ${Object.entries(CAL_STATUS_META).map(([k,m])=>`<span class="cal-legend-item"><span class="cal-dot" style="background:${m.color};"></span>${m.label}</span>`).join('')}
      </div>
    ` : `<div class="empty-state" style="margin-bottom:18px;"><span class="emoji">📅</span>Vamos planejar seu primeiro treino.<div style="margin-top:14px;"><button class="btn btn-primary" data-nav="treino" data-navtab="editor">Criar plano de treino</button></div></div>`}

    <div class="section-title">Constância <span style="font-size:11px;color:var(--text-faint);font-weight:400;">(últimas 12 semanas)</span></div>
    <div class="card" id="calHeatmap" style="overflow-x:auto;"></div>
  `;

  document.getElementById('calPrevMonth').addEventListener('click', ()=>{
    calendarCursor = new Date(year, month-1, 1);
    renderCalendarView();
  });
  document.getElementById('calNextMonth').addEventListener('click', ()=>{
    calendarCursor = new Date(year, month+1, 1);
    renderCalendarView();
  });

  const rescheduleAccept = document.getElementById('rescheduleAcceptBtn');
  if(rescheduleAccept) rescheduleAccept.addEventListener('click', ()=>{
    const m = missed[0];
    Calendar.moveWorkout(m.dateKey, todayKey());
    showToast('Treino remarcado', `${m.plan.label} movido para hoje.`, '📅');
    renderCalendarView();
  });
  const rescheduleDismiss = document.getElementById('rescheduleDismissBtn');
  if(rescheduleDismiss) rescheduleDismiss.addEventListener('click', ()=>{
    state.rescheduleDismissed[missed[0].dateKey] = true;
    persist();
    renderCalendarView();
  });

  wrap.querySelectorAll('.cal-cell[data-datekey]').forEach(cell=>{
    cell.addEventListener('click', ()=>openDayDetail(cell.dataset.datekey));
    cell.addEventListener('keydown', (e)=>{
      if(e.key==='Enter' || e.key===' '){ e.preventDefault(); openDayDetail(cell.dataset.datekey); }
    });
    if(cell.classList.contains('cal-draggable')) attachCalendarDragHandlers(cell);
  });
  wrap.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.nav, el.dataset.navtab)));

  renderCalendarHeatmap();
}

function renderCalendarHeatmap(){
  const el = document.getElementById('calHeatmap');
  if(!el) return;
  const days = Calendar.heatmapData(12);
  const levelColor = ['var(--border)','rgba(51,85,255,.35)','rgba(51,85,255,.65)','var(--blue)'];
  const weeks = [];
  for(let i=0;i<days.length;i+=7) weeks.push(days.slice(i,i+7));
  el.innerHTML = `<div class="heatmap-grid">
    ${weeks.map(week=>`<div class="heatmap-col">
      ${week.map(d=>`<div class="heatmap-cell" style="background:${levelColor[d.level]};" title="${fmtDate(d.dateKey)} · ${WorkoutProgression.formatKg(d.volume)} volume de treino"></div>`).join('')}
    </div>`).join('')}
  </div>`;
}

function openDayDetail(dateKey){
  const plan = Calendar.getDayPlan(dateKey);
  const done = !!state.completedDates[dateKey];
  const session = state.history.find(h=>h.date===dateKey);
  const isPast = dateKey<todayKey();
  const isFuture = dateKey>todayKey();

  if(plan.type!=='workout'){
    const meta = Calendar.DAY_TYPE_META[plan.type]||{label:plan.label};
    openModal(`
      <h2 style="margin-bottom:6px;">${fmtDate(dateKey)}</h2>
      <p style="color:var(--text-dim);font-size:13px;">${meta.label}${plan.label && plan.label!==meta.label?': '+plan.label:''}</p>
      ${dateKey<=todayKey() && !state.completedDates[dateKey] ? `<button class="btn btn-primary btn-block" style="margin-top:16px;" id="startFreeFromRestDay">Escolher treino</button>` : ''}
    `);
    const freeBtn = document.getElementById('startFreeFromRestDay');
    if(freeBtn) freeBtn.addEventListener('click', ()=>{
      closeModal();
      openWorkoutPicker(dateKey);
    });
    return;
  }

  const tpl = plan.tpl;
  let bodyExtra = '';
  if(session){
    const metrics = workoutDisplayMetrics(session);
    const prsThatDay = Analytics.detectPRs().filter(pr=>pr.date===dateKey);
    bodyExtra = `
      <div class="chip-row" style="margin:14px 0;">
        <span class="chip active">✔ Concluído</span>
        <span class="chip">${session.duration} min</span>
        <span class="chip">${metrics.totalLoad>0 ? WorkoutProgression.formatKg(metrics.totalLoad)+' carga' : 'peso corporal'}</span>
        <span class="chip">${metrics.totalReps} reps</span>
        <span class="chip">${WorkoutProgression.formatKg(metrics.trainingVolume)} volume</span>
        <span class="chip">${session.calories} kcal</span>
      </div>
      ${prsThatDay.length?`<div class="card" style="margin-bottom:14px;"><div class="list-row-title">🏆 Recordes nesse dia</div>${prsThatDay.map(pr=>`<p style="font-size:12.5px;color:var(--text-dim);margin-top:4px;">${pr.label}: ${pr.value}</p>`).join('')}</div>`:''}
    `;
  } else if(isPast){
    bodyExtra = `<div class="chip-row" style="margin:14px 0;"><span class="chip" style="color:var(--red);border-color:var(--red);">Não realizado</span></div>`;
  }

  openModal(`
    <h2 style="margin-bottom:4px;">${tpl.name}</h2>
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:4px;">${fmtDate(dateKey)}</p>
    <div class="chip-row" style="margin-bottom:16px;">
      <span class="chip">⏱ ${tpl.estimatedTime} min</span>
      <span class="chip">📋 ${tpl.exercises.length} exercícios</span>
    </div>
    ${bodyExtra}
    <div>
      ${tpl.exercises.map(ex=>{
        const e = findExercise(ex.exerciseId);
        return `<div class="list-row">
          <div class="list-row-icon visual-icon">${exerciseMedia(e, {size:'icon'})}</div>
          <div class="list-row-body">
            <div class="list-row-title">${e.name}</div>
            <div class="list-row-sub">${ex.sets} séries × ${ex.reps} reps ${ex.load?`· ${WorkoutProgression.formatKg(ex.load)}`:''}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${!done && !isFuture ? `
      <button class="btn btn-primary btn-block" style="margin-top:10px;" id="startFromDayDetail">Iniciar treino sugerido</button>
      <button class="btn btn-ghost btn-block" style="margin-top:10px;" id="chooseFromDayDetail">Escolher outro treino</button>
    ` : ''}
  `);
  const startBtn = document.getElementById('startFromDayDetail');
  if(startBtn) startBtn.addEventListener('click', ()=>{
    closeModal();
    startCheckinFlow(plan.templateId, dateKey);
  });
  const chooseBtn = document.getElementById('chooseFromDayDetail');
  if(chooseBtn) chooseBtn.addEventListener('click', ()=>{
    closeModal();
    openWorkoutPicker(dateKey, plan.templateId);
  });
}

/* Arrastar um dia de treino pra outra célula do calendário — Pointer
   Events (mouse e touch), mesma técnica usada no editor de treinos. */
let calDragCtx = null;

function attachCalendarDragHandlers(cell){
  cell.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    calDragCtx = {fromKey: cell.dataset.datekey, cell};
    cell.classList.add('cal-dragging');
    const onMove = (e)=>{
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const dropCell = target && target.closest('.cal-cell[data-datekey]');
      document.querySelectorAll('.cal-drop-target').forEach(c=>c.classList.remove('cal-drop-target'));
      if(dropCell && dropCell!==cell) dropCell.classList.add('cal-drop-target');
    };
    const onUp = (e)=>{
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      cell.classList.remove('cal-dragging');
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const dropCell = target && target.closest('.cal-cell[data-datekey]');
      document.querySelectorAll('.cal-drop-target').forEach(c=>c.classList.remove('cal-drop-target'));
      if(dropCell && dropCell!==cell && calDragCtx){
        const moved = Calendar.moveWorkout(calDragCtx.fromKey, dropCell.dataset.datekey);
        if(moved){ showToast('Treino movido', 'Cronograma atualizado.', '📅'); renderCalendarView(); }
        else showToast('Não foi possível mover', 'Esse dia já tem um treino agendado.', '⚠️');
      }
      calDragCtx = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

/* ======================================================================
   AGENDA — cronograma semanal, com navegação entre semanas
   ====================================================================== */
let agendaWeekOffset = 0; // 0 = semana atual; -1 = anterior; +1 = próxima

function renderAgenda(){
  const wrap = document.getElementById('treinoTabContent');
  const start = new Date(startOfWeek(new Date()).getTime() + agendaWeekOffset*7*86400000);
  const end = new Date(start.getTime() + 6*86400000);
  const isCurrentWeek = agendaWeekOffset===0;
  const rangeLabel = `${start.getDate()} ${MONTH_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTH_SHORT[end.getMonth()]}`;

  let doneCount = 0, totalWorkoutDays = 0;
  const days = [];
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const key = todayKey(d);
    const planId = state.weekPlan[d.getDay()];
    const tpl = getTemplate(planId);
    const isToday = key===todayKey();
    const done = !!state.completedDates[key];
    const isRest = tpl.id==='descanso';
    if(!isRest){ totalWorkoutDays++; if(done) doneCount++; }
    days.push({d, key, tpl, isToday, done, isRest});
  }
  const wp = weekProgress();
  const weekComplete = isCurrentWeek && wp.total>0 && wp.done>=wp.total;

  wrap.innerHTML = `
    <div class="agenda-week-nav">
      <button class="icon-btn" id="agendaPrevWeek" aria-label="Semana anterior">${icon('chevron-left')}</button>
      <div class="agenda-week-label">
        <span>${isCurrentWeek?'Esta semana':rangeLabel}</span>
        ${isCurrentWeek?`<span class="agenda-week-sub">${rangeLabel}</span>`:''}
      </div>
      <button class="icon-btn" id="agendaNextWeek" aria-label="Próxima semana">${icon('chevron-right')}</button>
    </div>

    ${weekComplete?`<div class="agenda-complete-banner">${icon('check',{size:16})} Semana completa! Todos os treinos feitos.</div>`:''}

    <div class="week-grid" id="agendaGrid"></div>
    <div class="section-title">Próximos passos</div>
    <div id="agendaList"></div>
  `;

  const grid = document.getElementById('agendaGrid');
  const list = document.getElementById('agendaList');
  let gridHtml='', listHtml='';

  days.forEach(({d,key,tpl,isToday,done,isRest})=>{
    gridHtml += `<div class="day-card ${isToday?'today':''} ${done?'done':''} ${isRest?'rest':''}" data-day="${d.getDay()}" data-weekoffset="${agendaWeekOffset}" ${isRest?'':'style="cursor:pointer;"'} ${isToday?'aria-label="Hoje"':''}>
      <span class="day-name">${WEEKDAY_SHORT[d.getDay()]}</span>
      <span class="day-status">${isRest?icon('moon',{size:15}):done?icon('check',{size:15}):''}</span>
      <span class="day-workout">${isRest?'Descanso':tpl.name}</span>
    </div>`;
    listHtml += `<div class="list-row ${isRest?'list-row-muted':''}" data-daydetail="${d.getDay()}" data-weekoffset="${agendaWeekOffset}" ${isRest?'':'style="cursor:pointer;"'}>
      <div class="list-row-icon">${isRest?icon('moon',{size:18}):MUSCLE_ICONS[tpl.muscle]||'🏋️'}</div>
      <div class="list-row-body">
        <div class="list-row-title">${WEEKDAY_NAMES[d.getDay()]}${isToday?' · Hoje':''} · ${tpl.name}</div>
        <div class="list-row-sub">${isRest?'Dia de recuperação':`${tpl.estimatedTime} min · ${tpl.exercises.length} exercícios`}</div>
      </div>
      <div class="list-row-trail">${isRest?'':done?`<span class="done-badge">${icon('check',{size:13})} Feito</span>`:icon('chevron-right',{size:16})}</div>
    </div>`;
  });
  grid.innerHTML = gridHtml;
  list.innerHTML = listHtml;

  document.querySelectorAll('[data-day],[data-daydetail]').forEach(elm=>{
    elm.addEventListener('click', ()=>{
      const day = elm.dataset.day || elm.dataset.daydetail;
      const planId = state.weekPlan[day];
      const tpl = getTemplate(planId);
      const d = new Date(start); d.setDate(start.getDate() + ((Number(day)-start.getDay()+7)%7));
      const dateKey = todayKey(d);
      if(tpl.id==='descanso'){
        if(dateKey<=todayKey() && !state.completedDates[dateKey]) openWorkoutPicker(dateKey);
        return;
      }
      openWorkoutDetail(tpl.id, dateKey);
    });
  });
  document.getElementById('agendaPrevWeek').addEventListener('click', ()=>{ agendaWeekOffset--; renderAgenda(); });
  document.getElementById('agendaNextWeek').addEventListener('click', ()=>{ agendaWeekOffset++; renderAgenda(); });
  makeInteractiveElementsAccessible(wrap);
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
  const wrap = document.getElementById('treinoTabContent');
  wrap.innerHTML = `
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
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
        <button class="btn btn-ghost" id="duplicateTemplateBtn">📄 Duplicar este treino</button>
        <button class="btn btn-ghost" id="renameTemplateBtn" style="display:none;">✏️ Renomear</button>
        <button class="btn btn-ghost" id="deleteTemplateBtn" style="display:none;color:var(--red);">🗑️ Excluir treino</button>
      </div>
      <div id="editorExerciseList"></div>
      <div class="section-title" style="margin-top:20px;">Adicionar exercício</div>
      <div class="field"><input type="text" id="addExerciseSearch" placeholder="🔍 Pesquisar exercício..."></div>
      <div id="addExerciseResults"></div>
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
  populateTemplateSelect(templateSelect);
  templateSelect.addEventListener('change', ()=>renderEditorExercises(templateSelect.value));
  renderEditorExercises(templateSelect.value);

  document.getElementById('saveTemplateBtn').addEventListener('click', ()=>saveTemplateEdits(templateSelect.value));
  document.getElementById('resetTemplateBtn').addEventListener('click', ()=>resetTemplateEdits(templateSelect.value));
  document.getElementById('addExerciseSearch').addEventListener('input', (e)=>{
    renderAddExerciseSearch(templateSelect.value, e.target.value);
  });
  document.getElementById('createExerciseBtn').addEventListener('click', createCustomExercise);
  document.getElementById('duplicateTemplateBtn').addEventListener('click', ()=>duplicateTemplate(templateSelect.value));
  document.getElementById('renameTemplateBtn').addEventListener('click', ()=>renameCustomTemplate(templateSelect.value));
  document.getElementById('deleteTemplateBtn').addEventListener('click', ()=>deleteCustomTemplate(templateSelect.value));
}

function populateTemplateSelect(selectEl, keepValue){
  const ids = allTemplateIds(false);
  selectEl.innerHTML = ids.map(id=>`<option value="${id}" ${id===keepValue?'selected':''}>${getTemplate(id).name}</option>`).join('');
}

function renderScheduleRows(){
  const rows = document.getElementById('scheduleRows');
  const ids = allTemplateIds(true);
  rows.innerHTML = SCHEDULE_DAY_ORDER.map(day=>`
    <div class="field" style="margin-bottom:12px;">
      <label>${WEEKDAY_NAMES[day]}</label>
      <select data-schedday="${day}">
        ${ids.map(id=>`<option value="${id}" ${state.weekPlan[day]===id?'selected':''}>${getTemplate(id).name}</option>`).join('')}
      </select>
    </div>
  `).join('');
  rows.querySelectorAll('[data-schedday]').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      state.weekPlan[Number(sel.dataset.schedday)] = sel.value;
      persist();
      showToast('Cronograma atualizado', `${WEEKDAY_NAMES[Number(sel.dataset.schedday)]} agora é ${getTemplate(sel.value).name}.`, '📅');
    });
  });
}

function renderEditorExercises(templateId){
  const list = document.getElementById('editorExerciseList');
  const tpl = getTemplate(templateId);
  if(!tpl){ list.innerHTML=''; return; }
  const custom = isCustomTemplate(templateId);
  const hasOverride = !custom && !!(state.templateOverrides && state.templateOverrides[templateId]);
  document.getElementById('renameTemplateBtn').style.display = custom ? '' : 'none';
  document.getElementById('deleteTemplateBtn').style.display = custom ? '' : 'none';
  document.getElementById('resetTemplateBtn').style.display = custom ? 'none' : '';
  list.innerHTML = `
    ${custom?'<div class="chip active" style="margin:14px 0 4px;">📄 Treino próprio</div>':''}
    ${hasOverride?'<div class="chip active" style="margin:14px 0 4px;">✏️ Personalizado</div>':''}
    ${tpl.exercises.length>1?'<p class="drag-hint">Arraste pelo ⠿ pra reordenar</p>':''}
    ${tpl.exercises.map((ex,i)=>{
      const e = findExercise(ex.exerciseId);
      return `<div class="list-row draggable-row" style="align-items:flex-start;" data-exidx="${i}" data-exerciseid="${ex.exerciseId}">
        <div class="drag-handle" aria-label="Reordenar">⠿</div>
        <div class="list-row-icon visual-icon">${exerciseMedia(e, {size:'icon'})}</div>
        <div class="list-row-body">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div class="list-row-title">${e?e.name:ex.exerciseId}</div>
            <button class="icon-btn" data-remove-idx="${i}" title="Remover" aria-label="Remover exercício" style="flex-shrink:0;">${icon('trash-2',{size:16})}</button>
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
  attachExerciseDragHandlers(list, templateId);
  renderAddExerciseSearch(templateId, '');
}

/* ------------------------------------------------------------------ */
/* Adicionar exercício — busca em vez de dropdown (estilo Notion):    */
/* digitar filtra a lista, clicar num resultado já adiciona.          */
/* ------------------------------------------------------------------ */
function renderAddExerciseSearch(templateId, query){
  const results = document.getElementById('addExerciseResults');
  if(!results) return;
  const tpl = getTemplate(templateId);
  const inTemplateIds = tpl.exercises.map(ex=>ex.exerciseId);
  const q = query.trim().toLowerCase();
  const matches = allExercises()
    .filter(e=>!inTemplateIds.includes(e.id))
    .filter(e=>!q || e.name.toLowerCase().includes(q))
    .slice(0, 8);
  results.innerHTML = matches.length ? matches.map(e=>`
    <div class="list-row add-exercise-row" data-addex="${e.id}" style="cursor:pointer;">
      <div class="list-row-icon visual-icon">${exerciseMedia(e, {size:'icon'})}</div>
      <div class="list-row-body">
        <div class="list-row-title">${e.name}</div>
        <div class="list-row-sub">${capitalize(e.muscle)}</div>
      </div>
      <div class="icon-btn" style="width:32px;height:32px;color:var(--accent);flex-shrink:0;">${icon('plus',{size:16})}</div>
    </div>
  `).join('') : `<div class="empty-state" style="padding:16px 0;"><span class="emoji">🔍</span>${q?'Nenhum exercício encontrado.':'Todos os exercícios já estão nesse treino.'}</div>`;
  results.querySelectorAll('[data-addex]').forEach(row=>{
    row.addEventListener('click', ()=>{
      addExerciseToTemplate(templateId, row.dataset.addex);
      const searchInput = document.getElementById('addExerciseSearch');
      if(searchInput) searchInput.value = '';
    });
  });
}

/* ------------------------------------------------------------------ */
/* Reordenar exercícios com arrastar-e-soltar (mouse e touch, via      */
/* Pointer Events — funciona igual em desktop e celular).             */
/* ------------------------------------------------------------------ */
let exerciseDragCtx = null;

function attachExerciseDragHandlers(list, templateId){
  list.querySelectorAll('.draggable-row').forEach(row=>{
    const handle = row.querySelector('.drag-handle');
    if(!handle) return;
    handle.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      exerciseDragCtx = {templateId, row, list};
      row.classList.add('dragging');
      const onMove = (e)=>onExerciseDragMove(e);
      const onUp = (e)=>{
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        onExerciseDragEnd();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  });
}

function onExerciseDragMove(e){
  if(!exerciseDragCtx) return;
  const {row, list} = exerciseDragCtx;
  const siblings = Array.from(list.querySelectorAll('.draggable-row')).filter(el=>el!==row);
  let inserted = false;
  for(const sib of siblings){
    const rect = sib.getBoundingClientRect();
    if(e.clientY < rect.top + rect.height/2){
      list.insertBefore(row, sib);
      inserted = true;
      break;
    }
  }
  if(!inserted) list.appendChild(row);
}

function onExerciseDragEnd(){
  if(!exerciseDragCtx) return;
  const {row, list, templateId} = exerciseDragCtx;
  row.classList.remove('dragging');
  const newOrderIds = Array.from(list.querySelectorAll('.draggable-row')).map(el=>el.dataset.exerciseid);
  const tpl = getTemplate(templateId);
  const queues = {};
  tpl.exercises.forEach(ex=>{ (queues[ex.exerciseId]=queues[ex.exerciseId]||[]).push(ex); });
  const newExercises = newOrderIds.map(id=>queues[id].shift());
  persistTemplateExercises(templateId, newExercises);
  exerciseDragCtx = null;
  renderEditorExercises(templateId);
}

/* Salva a lista de exercícios de um treino no lugar certo: se for um
   treino criado pelo usuário, edita ele diretamente; se for um treino
   fixo, salva como override por cima do padrão. */
function persistTemplateExercises(templateId, exercises){
  if(isCustomTemplate(templateId)){
    state.customTemplates[templateId] = Object.assign({}, state.customTemplates[templateId], {exercises});
  } else {
    state.templateOverrides = state.templateOverrides || {};
    state.templateOverrides[templateId] = {exercises};
  }
  persist();
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
  persistTemplateExercises(templateId, newExercises);
  showToast('Treino atualizado', `${getTemplate(templateId).name} foi salvo com suas alterações.`, '✅');
  renderEditorExercises(templateId);
}

function resetTemplateEdits(templateId){
  if(isCustomTemplate(templateId)) return; // não se aplica a treinos próprios
  if(state.templateOverrides){ delete state.templateOverrides[templateId]; }
  persist();
  showToast('Treino restaurado', `${WORKOUT_TEMPLATES[templateId].name} voltou ao padrão original.`, '↩️');
  renderEditorExercises(templateId);
}

function addExerciseToTemplate(templateId, exerciseId){
  const tpl = getTemplate(templateId);
  const newExercises = tpl.exercises.concat([{exerciseId, sets:3, reps:10, load:0, rest:60}]);
  persistTemplateExercises(templateId, newExercises);
  const e = findExercise(exerciseId);
  showToast('Exercício adicionado', `${e?e.name:exerciseId} foi adicionado ao treino.`, '➕');
  renderEditorExercises(templateId);
}

function removeExerciseFromTemplate(templateId, idx){
  const tpl = getTemplate(templateId);
  const newExercises = tpl.exercises.filter((_,i)=>i!==idx);
  persistTemplateExercises(templateId, newExercises);
  showToast('Exercício removido', 'O exercício foi removido do treino.', '🗑️');
  renderEditorExercises(templateId);
}

function duplicateTemplate(sourceId){
  const src = getTemplate(sourceId);
  if(!src) return;
  const newId = 'custom_'+cryptoId();
  state.customTemplates = state.customTemplates || {};
  state.customTemplates[newId] = {
    id: newId,
    name: src.name + ' (cópia)',
    muscle: src.muscle,
    description: src.description,
    estimatedTime: src.estimatedTime,
    exercises: JSON.parse(JSON.stringify(src.exercises)),
  };
  persist();
  showToast('Treino duplicado', `"${state.customTemplates[newId].name}" já pode ser editado à vontade.`, '📄');
  const templateSelect = document.getElementById('editorTemplateSelect');
  populateTemplateSelect(templateSelect, newId);
  renderScheduleRows();
  renderEditorExercises(newId);
}

function renameCustomTemplate(templateId){
  if(!isCustomTemplate(templateId)) return;
  const current = state.customTemplates[templateId].name;
  openModal(`
    <h2 style="margin-bottom:16px;">Renomear treino</h2>
    <div class="field"><label>Nome</label><input type="text" id="renameInput" value="${escapeHtml(current)}" autofocus></div>
    <button class="btn btn-primary btn-block" id="renameSaveBtn">Salvar</button>
  `);
  document.getElementById('renameSaveBtn').addEventListener('click', ()=>{
    const newName = document.getElementById('renameInput').value.trim();
    if(!newName) return;
    state.customTemplates[templateId].name = newName;
    persist();
    closeModal();
    showToast('Treino renomeado', `Agora chamado de "${newName}".`, '✏️');
    const templateSelect = document.getElementById('editorTemplateSelect');
    populateTemplateSelect(templateSelect, templateId);
    renderScheduleRows();
    renderEditorExercises(templateId);
  });
}

function deleteCustomTemplate(templateId){
  if(!isCustomTemplate(templateId)) return;
  const name = state.customTemplates[templateId].name;
  openModal(`
    <h2 style="margin-bottom:8px;">Excluir "${escapeHtml(name)}"?</h2>
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:18px;">Se esse treino estiver em algum dia do cronograma, o dia vira Descanso. Essa ação não pode ser desfeita.</p>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" id="cancelDeleteBtn" style="flex:1;">Cancelar</button>
      <button class="btn btn-danger" id="confirmDeleteBtn" style="flex:1;">Excluir</button>
    </div>
  `);
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeModal);
  document.getElementById('confirmDeleteBtn').addEventListener('click', ()=>{
    delete state.customTemplates[templateId];
    Object.keys(state.weekPlan).forEach(day=>{
      if(state.weekPlan[day]===templateId) state.weekPlan[day]='descanso';
    });
    persist();
    closeModal();
    showToast('Treino excluído', `"${name}" foi removido.`, '🗑️');
    const templateSelect = document.getElementById('editorTemplateSelect');
    populateTemplateSelect(templateSelect);
    renderScheduleRows();
    renderEditorExercises(templateSelect.value);
  });
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
          <div class="list-row-icon visual-icon">${exerciseMedia(e, {size:'icon'})}</div>
          <div class="list-row-body">
            <div class="list-row-title">${e.name}</div>
            <div class="list-row-sub">${ex.sets} séries × ${ex.reps} reps ${ex.load?`· ${WorkoutProgression.formatKg(ex.load)}`:''}</div>
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

function workoutChoiceIds(preferredId){
  ensureFavorites();
  const context = {plannedId:preferredId, isOverride:false, recentMuscles:recentWorkoutMuscles(3)};
  const ids = allTemplateIds(false).sort((a,b)=>{
    const aPreferred = a===preferredId ? 1 : 0;
    const bPreferred = b===preferredId ? 1 : 0;
    if(aPreferred!==bPreferred) return bPreferred-aPreferred;
    const aFav = isFavoriteWorkout(a) ? 1 : 0;
    const bFav = isFavoriteWorkout(b) ? 1 : 0;
    if(aFav!==bFav) return bFav-aFav;
    const scoreDiff = workoutScore(b, context).score - workoutScore(a, context).score;
    if(scoreDiff!==0) return scoreDiff;
    return getTemplate(a).name.localeCompare(getTemplate(b).name);
  });
  if(!preferredId || !ids.includes(preferredId)) return ids;
  return ids;
}

const WORKOUT_PICKER_FILTERS = [
  {id:'todos', label:'Todos'},
  {id:'favoritos', label:'Favoritos'},
  {id:'inferiores', label:'Inferiores'},
  {id:'superiores', label:'Superiores'},
  {id:'cardio', label:'Cardio'},
  {id:'rapido', label:'Rápido'},
];

function workoutMatchesPickerFilter(templateId){
  const tpl = getTemplate(templateId);
  if(!tpl) return false;
  if(workoutPickerFilter==='favoritos') return isFavoriteWorkout(templateId);
  if(workoutPickerFilter==='cardio') return tpl.muscle==='cardio' || tpl.exercises.some(ex=>findExercise(ex.exerciseId)?.muscle==='cardio');
  if(workoutPickerFilter==='rapido') return Number(tpl.estimatedTime||0)<=60;
  if(workoutPickerFilter==='inferiores') return ['pernas','gluteos'].includes(tpl.muscle) || tpl.exercises.some(ex=>['pernas','gluteos'].includes(findExercise(ex.exerciseId)?.muscle));
  if(workoutPickerFilter==='superiores') return ['peito','costas','ombros','biceps','triceps'].includes(tpl.muscle) || tpl.exercises.some(ex=>['peito','costas','ombros','biceps','triceps'].includes(findExercise(ex.exerciseId)?.muscle));
  return true;
}

function renderWorkoutPickerList(dateKey, preferredId){
  const list = document.getElementById('workoutPickerList');
  if(!list) return;
  const q = workoutPickerSearch.trim().toLowerCase();
  const ids = workoutChoiceIds(preferredId).filter(id=>{
    const tpl = getTemplate(id);
    return workoutMatchesPickerFilter(id) && (!q || tpl.name.toLowerCase().includes(q) || (tpl.description||'').toLowerCase().includes(q));
  });
  if(!ids.length){
    list.innerHTML = `<div class="empty-state compact"><span class="emoji">🔎</span>Nenhum treino encontrado.</div>`;
    return;
  }
  list.innerHTML = ids.map(id=>{
    const tpl = getTemplate(id);
    const fav = isFavoriteWorkout(id);
    const score = workoutScore(id, {plannedId:preferredId, isOverride:false, recentMuscles:recentWorkoutMuscles(3)});
    const reason = score.reasons[0] ? ` · ${score.reasons[0]}` : '';
    return `<div class="list-row" data-freeworkout="${id}" style="cursor:pointer;">
      <div class="list-row-icon">${MUSCLE_ICONS[tpl.muscle]||'🏋️'}</div>
      <div class="list-row-body">
        <div class="list-row-title">${tpl.name}${id===preferredId?' · sugerido':''}${fav?' · salvo':''}</div>
        <div class="list-row-sub">${tpl.estimatedTime} min · ${tpl.exercises.length} exercícios${escapeHtml(reason)}</div>
      </div>
      <button class="btn btn-ghost btn-sm" data-fav-workout="${id}">${fav?'Salvo':'Favoritar'}</button>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-freeworkout]').forEach(row=>{
    row.addEventListener('click', ()=>{
      const templateId = row.dataset.freeworkout;
      closeModal();
      startCheckinFlow(templateId, dateKey);
    });
  });
  list.querySelectorAll('[data-fav-workout]').forEach(btn=>{
    btn.addEventListener('click', (event)=>{
      event.stopPropagation();
      toggleFavoriteWorkout(btn.dataset.favWorkout);
      renderWorkoutPickerList(dateKey, preferredId);
    });
  });
  makeInteractiveElementsAccessible(list);
}

function openWorkoutPicker(dateKey, preferredId){
  workoutPickerFilter = 'todos';
  workoutPickerSearch = '';
  const ids = workoutChoiceIds(preferredId);
  if(!ids.length){
    openModal(`
      <h2 style="margin-bottom:8px;">Nenhum treino disponível</h2>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px;">Crie ou restaure um treino para começar.</p>
      <button class="btn btn-primary btn-block" id="goEditorFromPicker">Editar treinos</button>
    `);
    document.getElementById('goEditorFromPicker').addEventListener('click', ()=>{
      closeModal();
      navigate('treino', 'editor');
    });
    return;
  }
  openModal(`
    <h2 style="margin-bottom:6px;">Escolher treino</h2>
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px;">${fmtDate(dateKey)} conta como treinado quando você concluir qualquer opção abaixo.</p>
    <div class="field" style="margin-bottom:12px;"><input type="text" id="workoutPickerSearch" placeholder="Buscar treino..."></div>
    <div class="chip-row" id="workoutPickerFilters" style="margin-bottom:12px;">
      ${WORKOUT_PICKER_FILTERS.map(f=>`<button class="chip ${workoutPickerFilter===f.id?'active':''}" data-workout-picker-filter="${f.id}">${f.label}</button>`).join('')}
    </div>
    <div id="workoutPickerList"></div>
  `);
  document.getElementById('workoutPickerSearch').addEventListener('input', (event)=>{
    workoutPickerSearch = event.target.value;
    renderWorkoutPickerList(dateKey, preferredId);
  });
  document.querySelectorAll('[data-workout-picker-filter]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      workoutPickerFilter = btn.dataset.workoutPickerFilter;
      document.querySelectorAll('[data-workout-picker-filter]').forEach(el=>el.classList.toggle('active', el===btn));
      renderWorkoutPickerList(dateKey, preferredId);
    });
  });
  renderWorkoutPickerList(dateKey, preferredId);
  makeInteractiveElementsAccessible(document.getElementById('modalOverlay'));
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
  const exercises = tpl.exercises.map(ex=>Object.assign({}, ex));
  runnerCtx = {
    id: cryptoId(),
    templateId, dateKey, mood,
    exIndex:0,
    startTime:Date.now(),
    lastCompleted:null, // {exIndex,setIndex} — pra permitir desfazer a última série marcada
    restState:null,      // {endsAt(timestamp), totalSeconds, paused, pausedRemaining} — null quando não tá descansando
    exercises,
    sets: exercises.map(ex=>{
      const n = ex.sets||1;
      // Defaults vêm da última performance real do histórico concluído.
      // exerciseLoads segue como fallback de compatibilidade para dados antigos.
      const lastSet = WorkoutProgression.mostRecentValidSet(state.history, ex.exerciseId, dateKey);
      const legacyLoads = state.exerciseLoads[ex.exerciseId]||[];
      const legacyLoad = legacyLoads.length ? legacyLoads[legacyLoads.length-1].weight : null;
      const baseLoad = lastSet ? lastSet.weight : (legacyLoad || ex.load || 0);
      const baseReps = lastSet ? lastSet.reps : (ex.reps||0);
      return Array.from({length:n}, ()=>({
        weight: baseLoad ? Math.round(baseLoad*loadMultiplier) : 0,
        reps: baseReps,
        notes:'',
        done:false,
        skipped:false,
      }));
    }),
  };
  let el = document.getElementById('runnerRoot');
  if(!el){ el = document.createElement('div'); el.id='runnerRoot'; document.body.appendChild(el); }
  el.innerHTML = `<div class="runner" id="runnerEl"></div>`;
  requestAnimationFrame(()=>document.getElementById('runnerEl').classList.add('open'));
  renderRunnerExercise();
  startRunnerClock();
  persistRunnerSession(); // já salva assim que o treino começa — sobrevive mesmo se sair antes da 1ª série
}

/* ======================================================================
   PERSISTÊNCIA DO TREINO EM ANDAMENTO — sobrevive a fechar o app,
   recarregar a página, trocar de app ou o sistema encerrar o PWA.
   ======================================================================
   O treino ativo vive só na memória (runnerCtx) igual antes, mas agora
   TODA mudança relevante também é escrita em state.activeWorkoutSession
   e salva no localStorage (via persist(), a mesma função que o resto do
   app já usa) — sem inventar um caminho de armazenamento paralelo. */
function persistRunnerSession(){
  if(!runnerCtx) return;
  state.activeWorkoutSession = {
    id: runnerCtx.id,
    templateId: runnerCtx.templateId,
    dateKey: runnerCtx.dateKey,
    mood: runnerCtx.mood,
    status: 'active',
    startedAt: runnerCtx.startTime,
    exIndex: runnerCtx.exIndex,
    exercises: runnerCtx.exercises,
    sets: runnerCtx.sets,
    lastCompleted: runnerCtx.lastCompleted,
    restState: runnerCtx.restState,
  };
  persist();
}

/* Confere se uma sessão salva tem o formato mínimo esperado antes de
   confiar nela — dado corrompido vira "sem treino ativo" em vez de
   quebrar o app. */
function isValidActiveSession(s){
  if(!s || typeof s!=='object') return false;
  if(s.status!=='active') return false;
  if(!s.templateId || !Array.isArray(s.sets)) return false;
  if(!getTemplate(s.templateId)) return false;
  return true;
}

function discardActiveSession(){
  if(state.activeWorkoutSession) state.activeWorkoutSession.status = 'discarded';
  state.activeWorkoutSession = null;
  persist();
}

/* Relógio do treino: atualiza só o texto do cabeçalho a cada segundo, sem
   re-renderizar a tela inteira — evita trabalho desnecessário enquanto a
   pessoa está no meio de uma série. */
function startRunnerClock(){
  stopRunnerClock();
  updateRunnerClock();
  runnerCtx.clockInterval = setInterval(updateRunnerClock, 1000);
}
function stopRunnerClock(){
  if(runnerCtx && runnerCtx.clockInterval){ clearInterval(runnerCtx.clockInterval); runnerCtx.clockInterval=null; }
}
function updateRunnerClock(){
  if(!runnerCtx) return;
  const elapsedEl = document.getElementById('runnerElapsed');
  const remainingEl = document.getElementById('runnerRemaining');
  if(!elapsedEl && !remainingEl) return;
  const elapsedMin = (Date.now()-runnerCtx.startTime)/60000;
  const mm = Math.floor(elapsedMin), ss = Math.floor((elapsedMin-mm)*60);
  if(elapsedEl) elapsedEl.textContent = `${mm}:${String(ss).padStart(2,'0')}`;
  if(remainingEl){
    const tpl = getTemplate(runnerCtx.templateId);
    const remain = Math.max(0, Math.round((tpl.estimatedTime||30) - elapsedMin));
    remainingEl.textContent = `~${remain} min restantes`;
  }
}

function closeRunner(){
  const el = document.getElementById('runnerEl');
  if(el){ el.classList.remove('open'); setTimeout(()=>{ const root=document.getElementById('runnerRoot'); if(root) root.innerHTML=''; },350); }
  RestTimer.stop();
  removeTimerFab();
  stopRunnerClock();
  const overlay = document.getElementById('restOverlay');
  if(overlay) overlay.remove();
  runnerCtx = null;
}

function formatSetLine(set){
  return setDisplayText(set);
}

function renderPreviousPerformance(previous){
  if(!previous){
    return `<div class="previous-performance empty"><span>Workout anterior</span><b>Primeira vez</b></div>`;
  }
  return `
    <div class="previous-performance">
      <span>Workout anterior</span>
      <div class="previous-set-list">
        ${previous.sets.map(set=>`<b>${formatSetLine(set)}</b>`).join('')}
      </div>
    </div>
  `;
}

function runnerExercises(){
  if(!runnerCtx) return [];
  if(Array.isArray(runnerCtx.exercises) && runnerCtx.exercises.length) return runnerCtx.exercises;
  const tpl = getTemplate(runnerCtx.templateId);
  runnerCtx.exercises = (tpl?.exercises||[]).map(ex=>Object.assign({}, ex));
  return runnerCtx.exercises;
}

function currentRunnerExerciseDef(){
  return runnerExercises()[runnerCtx.exIndex];
}

function firstOpenSetIndex(setsArr){
  const index = setsArr.findIndex(s=>!s.done && !s.skipped);
  return index>=0 ? index : -1;
}

function adjustRunnerSetValue(setIndex, field, delta){
  if(!runnerCtx) return;
  const setsArr = runnerCtx.sets[runnerCtx.exIndex];
  const set = setsArr && setsArr[setIndex];
  if(!set || set.done || set.skipped) return;
  const min = 0;
  const next = Math.max(min, Number(set[field]||0) + delta);
  set[field] = field==='weight' ? Math.round(next*10)/10 : Math.round(next);
  persistRunnerSession();
  renderRunnerExercise();
}

function setRunnerSetValue(setIndex, field, value){
  if(!runnerCtx) return;
  const setsArr = runnerCtx.sets[runnerCtx.exIndex];
  const set = setsArr && setsArr[setIndex];
  if(!set || set.done || set.skipped) return;
  const next = Math.max(0, Number(value)||0);
  set[field] = field==='weight' ? Math.round(next*10)/10 : Math.round(next);
  debouncedPersistRunnerSession();
}

function completeRunnerSet(setIndex, options){
  if(!runnerCtx) return;
  const exDef = currentRunnerExerciseDef();
  const exercise = findExercise(exDef.exerciseId);
  const setsArr = runnerCtx.sets[runnerCtx.exIndex];
  const set = setsArr[setIndex];
  if(!set || set.done || set.skipped) return;

  set.done = true;
  runnerCtx.lastCompleted = {exIndex:runnerCtx.exIndex, setIndex};
  persistRunnerSession();

  const pr = WorkoutProgression.detectSetPR(state.history, exDef.exerciseId, set, setsArr, runnerCtx.dateKey);
  if(pr){
    showToast('Novo PR', `${exercise ? exercise.name : exDef.exerciseId} — ${pr.value}`, '🏆');
  } else {
    showToast('1 série concluída', 'Desfazer disponível no descanso.', '✅');
  }

  if(!options || options.startRest!==false) openRestTimerPicker(exDef.rest||60, true);
  renderRunnerExercise();
}

function renderRunnerExercise(){
  const runnerEl = document.getElementById('runnerEl');
  if(!runnerEl || !runnerCtx) return;
  const tpl = getTemplate(runnerCtx.templateId);
  const exercises = runnerExercises();
  const exDef = exercises[runnerCtx.exIndex];
  const e = findExercise(exDef.exerciseId);
  const setsArr = runnerCtx.sets[runnerCtx.exIndex];
  const allDone = setsArr.every(s=>s.done || s.skipped);
  const isLast = runnerCtx.exIndex === exercises.length-1;
  const doneCount = setsArr.filter(s=>s.done).length;
  const progressPct = ((runnerCtx.exIndex + (setsArr.length?doneCount/setsArr.length:0)) / exercises.length) * 100;
  const previous = WorkoutProgression.previousPerformance(state.history, exDef.exerciseId, runnerCtx.dateKey);
  const activeSetIndex = firstOpenSetIndex(setsArr);
  const activeSet = activeSetIndex>=0 ? setsArr[activeSetIndex] : null;
  const weightStep = WorkoutProgression.inferWeightStep(exDef, previous);
  const summary = WorkoutProgression.exerciseSummary(state.history, exDef.exerciseId, setsArr, runnerCtx.dateKey);
  const progression = WorkoutProgression.progressionSuggestion({
    history: state.history,
    exerciseId: exDef.exerciseId,
    exercise: e,
    exerciseDef: exDef,
    currentSets: setsArr,
    beforeDate: runnerCtx.dateKey,
  });

  runnerEl.innerHTML = `
    <div class="runner-header">
      <button class="icon-btn" id="runnerClose" aria-label="Fechar treino">${icon('x')}</button>
      <div class="runner-header-mid">
        <div class="runner-counter">${runnerCtx.exIndex+1} / ${exercises.length}</div>
        <div class="runner-clock"><span id="runnerElapsed">0:00</span> · <span id="runnerRemaining">~${tpl.estimatedTime||30} min restantes</span></div>
      </div>
      <button class="icon-btn" id="runnerRestBtn" aria-label="Cronômetro de descanso">${icon('clock')}</button>
    </div>
    <div class="runner-body" id="runnerScrollArea">
      <div class="progress-track" style="max-width:400px;margin-bottom:20px;" role="progressbar" aria-valuenow="${Math.round(progressPct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso do treino"><div class="progress-fill thin" style="width:${progressPct}%"></div></div>
      <div class="runner-exercise-media ${allDone?'complete':''}" id="runnerMedia">${exerciseMedia(e, {size:'hero'})}</div>
      <div class="runner-title">${e.name}</div>
      <div class="runner-muscle">${capitalize(e.muscle)} · ${exDef.sets} séries × ${exDef.reps} reps · ⏱ ${exDef.rest||60}s descanso</div>
      ${renderPreviousPerformance(previous)}

      ${activeSet ? `
        <div class="quick-set-card" data-quick-set="${activeSetIndex}" tabindex="0" aria-label="Registrar série ${activeSetIndex+1}">
          <div class="quick-set-head">
            <span>Série ${activeSetIndex+1} de ${setsArr.length}</span>
            ${runnerCtx.lastCompleted?`<button class="btn btn-ghost btn-sm" id="runnerUndoBtn">Desfazer</button>`:''}
          </div>
          <div class="quick-control" data-control="weight">
            <button class="quick-step" data-adjust-field="weight" data-adjust-set="${activeSetIndex}" data-adjust-delta="${-weightStep}" aria-label="Diminuir carga">−</button>
            <div class="quick-value">
              <label for="quickWeightInput">Peso</label>
              <input id="quickWeightInput" type="number" min="0" step="${weightStep}" inputmode="decimal" value="${activeSet.weight}" data-quick-field="weight" data-quick-set="${activeSetIndex}" aria-label="Carga da série atual">
            </div>
            <button class="quick-step" data-adjust-field="weight" data-adjust-set="${activeSetIndex}" data-adjust-delta="${weightStep}" aria-label="Aumentar carga">+</button>
          </div>
          <div class="quick-control" data-control="reps">
            <button class="quick-step" data-adjust-field="reps" data-adjust-set="${activeSetIndex}" data-adjust-delta="-1" aria-label="Diminuir repetições">−</button>
            <div class="quick-value">
              <label for="quickRepsInput">Reps</label>
              <input id="quickRepsInput" type="number" min="0" step="1" inputmode="numeric" value="${activeSet.reps}" data-quick-field="reps" data-quick-set="${activeSetIndex}" aria-label="Repetições da série atual">
            </div>
            <button class="quick-step" data-adjust-field="reps" data-adjust-set="${activeSetIndex}" data-adjust-delta="1" aria-label="Aumentar repetições">+</button>
          </div>
          <button class="btn btn-primary btn-block quick-complete" data-complete-set="${activeSetIndex}">Concluir série</button>
        </div>
      ` : `
        <div class="quick-set-card complete">
          <div class="quick-done-title">Todas as séries deste exercício foram registradas.</div>
          ${runnerCtx.lastCompleted?`<button class="btn btn-ghost btn-sm" id="runnerUndoBtn">Desfazer última série</button>`:''}
        </div>
      `}

      <div class="set-tracker" id="setTracker">
        ${setsArr.map((s,i)=>`
          <div class="set-row ${s.done?'done':''} ${s.skipped?'skipped':''}" data-set="${i}">
            <div class="set-num">${i+1}</div>
            ${s.skipped ? `
              <div class="set-skipped-label">Série pulada</div>
              <button class="btn btn-ghost btn-sm" data-unskip="${i}">Reverter</button>
            ` : `
              <div class="set-field"><label>Kg</label><input type="number" min="0" step="${weightStep}" value="${s.weight}" data-field="weight" data-set="${i}" aria-label="Carga da série ${i+1}"></div>
              <div class="set-field"><label>Reps</label><input type="number" min="0" value="${s.reps}" data-field="reps" data-set="${i}" aria-label="Repetições da série ${i+1}"></div>
              <button class="icon-btn set-skip-btn" data-skip="${i}" aria-label="Pular série ${i+1}" title="Pular série">${icon('x',{size:14})}</button>
              <button class="set-check" data-check="${i}" aria-label="${s.done?'Série concluída':'Concluir série '+(i+1)}">${s.done?icon('check',{size:18}):''}</button>
            `}
          </div>
        `).join('')}
      </div>
      <div class="exercise-summary">
        <div><span>Séries</span><b>${summary.setsCompleted}/${setsArr.length}</b></div>
        <div><span>Reps</span><b>${summary.totalReps}</b></div>
        <div><span>Carga total</span><b>${WorkoutProgression.formatKg(summary.totalLoad)}</b></div>
        <div><span>Volume</span><b>${WorkoutProgression.formatKg(summary.trainingVolume)}</b></div>
        <div><span>Volume anterior</span><b>${summary.previousVolume ? WorkoutProgression.formatKg(summary.previousVolume) : '—'}</b></div>
        <div><span>Atual vs anterior</span><b>${summary.deltaPct===null ? '—' : `${summary.deltaPct>=0?'↑':'↓'} ${Math.abs(summary.deltaPct).toFixed(1)}%`}</b></div>
      </div>
      ${progression ? `<div class="progression-suggestion"><b>${progression.message}</b><span>${progression.next}</span></div>` : ''}
      <button class="btn btn-ghost btn-sm" id="showInfoBtn" style="margin-top:16px;">ℹ️ Ver execução correta</button>
      <button class="btn btn-ghost btn-sm" id="replaceExerciseBtn" style="margin-top:10px;">Substituir exercício</button>
    </div>
    <div class="runner-footer">
      ${isLast && allDone
        ? `<button class="btn btn-success btn-block" id="finishWorkoutBtn">🎉 Concluir treino</button>`
        : `<button class="btn btn-primary btn-block" id="nextExerciseBtn" ${allDone?'':'disabled'}>${isLast?'Concluir treino':'Próximo exercício'}</button>`
      }
    </div>
  `;

  document.getElementById('runnerClose').addEventListener('click', ()=>{
    if(confirm('Sair do treino? Seu progresso nesta sessão será perdido.')){
      discardActiveSession();
      closeRunner();
    }
  });
  document.getElementById('runnerRestBtn').addEventListener('click', ()=>openRestTimerPicker(exDef.rest||60));
  document.getElementById('showInfoBtn').addEventListener('click', ()=>openExerciseModal(e.id));
  document.getElementById('replaceExerciseBtn').addEventListener('click', openExerciseReplacementModal);

  runnerEl.querySelectorAll('[data-adjust-field]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      adjustRunnerSetValue(Number(btn.dataset.adjustSet), btn.dataset.adjustField, Number(btn.dataset.adjustDelta));
    });
  });
  runnerEl.querySelectorAll('[data-quick-field]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      setRunnerSetValue(Number(inp.dataset.quickSet), inp.dataset.quickField, inp.value);
    });
    inp.addEventListener('blur', ()=>{
      persistRunnerSession();
      renderRunnerExercise();
    });
  });
  runnerEl.querySelectorAll('[data-complete-set]').forEach(btn=>{
    btn.addEventListener('click', ()=>completeRunnerSet(Number(btn.dataset.completeSet)));
  });
  const quickCard = runnerEl.querySelector('[data-quick-set]');
  if(quickCard){
    quickCard.addEventListener('keydown', (event)=>{
      const isInput = ['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName);
      if(isInput) return;
      const setIndex = Number(quickCard.dataset.quickSet);
      if(event.key==='Enter'){
        event.preventDefault();
        completeRunnerSet(setIndex);
      } else if(event.key==='ArrowUp'){
        event.preventDefault();
        adjustRunnerSetValue(setIndex, 'weight', weightStep);
      } else if(event.key==='ArrowDown'){
        event.preventDefault();
        adjustRunnerSetValue(setIndex, 'weight', -weightStep);
      }
    });
  }
  const undoInlineBtn = document.getElementById('runnerUndoBtn');
  if(undoInlineBtn) undoInlineBtn.addEventListener('click', undoLastSet);

  runnerEl.querySelectorAll('[data-field]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const i = Number(inp.dataset.set);
      setsArr[i][inp.dataset.field] = Number(inp.value)||0;
      debouncedPersistRunnerSession();
    });
  });
  runnerEl.querySelectorAll('[data-check]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const i = Number(btn.dataset.check);
      if(setsArr[i].done){
        runnerCtx.lastCompleted = {exIndex:runnerCtx.exIndex, setIndex:i};
        undoLastSet();
      } else {
        completeRunnerSet(i);
      }
    });
  });
  runnerEl.querySelectorAll('[data-skip]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const i = Number(btn.dataset.skip);
      setsArr[i].skipped = true;
      setsArr[i].done = false;
      persistRunnerSession();
      renderRunnerExercise();
    });
  });
  runnerEl.querySelectorAll('[data-unskip]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const i = Number(btn.dataset.unskip);
      setsArr[i].skipped = false;
      persistRunnerSession();
      renderRunnerExercise();
    });
  });
  const nextBtn = document.getElementById('nextExerciseBtn');
  if(nextBtn) nextBtn.addEventListener('click', goToNextExercise);
  const finishBtn = document.getElementById('finishWorkoutBtn');
  if(finishBtn) finishBtn.addEventListener('click', finishWorkout);

  updateRunnerClock();
}

function replacementCandidates(query){
  if(!runnerCtx) return [];
  const exDef = currentRunnerExerciseDef();
  const current = findExercise(exDef.exerciseId);
  const q = String(query||'').trim().toLowerCase();
  return allExercises()
    .filter(ex=>ex.id!==exDef.exerciseId)
    .filter(ex=>!q || ex.name.toLowerCase().includes(q) || (MUSCLE_LABELS[ex.muscle]||ex.muscle).toLowerCase().includes(q))
    .sort((a,b)=>{
      const aSame = current && a.muscle===current.muscle ? 0 : 1;
      const bSame = current && b.muscle===current.muscle ? 0 : 1;
      if(aSame!==bSame) return aSame-bSame;
      const favDiff = Number(isFavoriteExercise(b.id))-Number(isFavoriteExercise(a.id));
      if(favDiff) return favDiff;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 18);
}

function openExerciseReplacementModal(){
  if(!runnerCtx) return;
  const setsArr = runnerCtx.sets[runnerCtx.exIndex]||[];
  if(setsArr.some(set=>set.done)){
    showToast('Séries já registradas', 'Substitua antes de concluir séries para manter o histórico correto.', '⚠️');
    return;
  }
  const exDef = currentRunnerExerciseDef();
  const current = findExercise(exDef.exerciseId);
  openModal(`
    <h2 style="margin-bottom:6px;">Substituir exercício</h2>
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px;">${current ? current.name : 'Exercício atual'}</p>
    <div class="field" style="margin-bottom:12px;"><input type="text" id="replacementSearch" placeholder="Buscar exercício..."></div>
    <div id="replacementList"></div>
  `);
  const input = document.getElementById('replacementSearch');
  function render(query){
    const list = document.getElementById('replacementList');
    const candidates = replacementCandidates(query);
    if(!candidates.length){
      list.innerHTML = `<div class="empty-state compact"><span class="emoji">🔎</span>Nenhum exercício encontrado.</div>`;
      return;
    }
    list.innerHTML = candidates.map(ex=>`
      <div class="list-row" data-replace-exercise="${ex.id}" style="cursor:pointer;">
          <div class="list-row-icon visual-icon">${exerciseMedia(ex, {size:'icon'})}</div>
          <div class="list-row-body">
          <div class="list-row-title">${ex.name}${isFavoriteExercise(ex.id)?' · salvo':''}</div>
          <div class="list-row-sub">${MUSCLE_LABELS[ex.muscle]||capitalize(ex.muscle)} · ${ex.desc.slice(0,64)}${ex.desc.length>64?'…':''}</div>
        </div>
        <div class="list-row-trail">${icon('chevron-right',{size:16})}</div>
      </div>
    `).join('');
    list.querySelectorAll('[data-replace-exercise]').forEach(row=>{
      row.addEventListener('click', ()=>{
        replaceRunnerExercise(row.dataset.replaceExercise);
      });
    });
  }
  input.addEventListener('input', ()=>render(input.value));
  render('');
  input.focus();
}

function replaceRunnerExercise(exerciseId){
  if(!runnerCtx) return;
  const replacement = findExercise(exerciseId);
  if(!replacement) return;
  const exercises = runnerExercises();
  const currentDef = exercises[runnerCtx.exIndex];
  const currentExercise = findExercise(currentDef.exerciseId);
  const setsArr = runnerCtx.sets[runnerCtx.exIndex]||[];
  if(setsArr.some(set=>set.done)){
    showToast('Séries já registradas', 'Substitua antes de concluir séries para manter o histórico correto.', '⚠️');
    return;
  }
  const previous = WorkoutProgression.mostRecentValidSet(state.history, exerciseId, runnerCtx.dateKey);
  const legacyLoads = state.exerciseLoads[exerciseId]||[];
  const legacyLoad = legacyLoads.length ? legacyLoads[legacyLoads.length-1].weight : null;
  const nextLoad = previous ? previous.weight : (legacyLoad ?? currentDef.load ?? 0);
  const nextReps = previous ? previous.reps : (currentDef.reps || setsArr[0]?.reps || 0);
  exercises[runnerCtx.exIndex] = Object.assign({}, currentDef, {
    exerciseId,
    load: nextLoad,
    reps: nextReps,
  });
  runnerCtx.sets[runnerCtx.exIndex] = setsArr.map(set=>Object.assign({}, set, {
    weight: nextLoad ? Math.round(Number(nextLoad)*10)/10 : 0,
    reps: nextReps,
    done:false,
    skipped:false,
  }));
  runnerCtx.lastCompleted = null;
  closeRestOverlay();
  persistRunnerSession();
  closeModal();
  showToast('Exercício substituído', `${currentExercise ? currentExercise.name : 'Exercício'} trocado por ${replacement.name}.`, '🔁');
  renderRunnerExercise();
}

/* Peso/reps mudam a cada tecla digitada — salvar a cada toque seria
   excessivo, então essas escritas usam um pequeno atraso (debounce).
   Ações críticas (marcar/pular série) NUNCA passam por aqui — são
   sempre salvas na hora, direto em persistRunnerSession(). */
let runnerSaveDebounce = null;
function debouncedPersistRunnerSession(){
  clearTimeout(runnerSaveDebounce);
  runnerSaveDebounce = setTimeout(persistRunnerSession, 500);
}

function goToNextExercise(){
  const exercises = runnerExercises();
  if(runnerCtx.exIndex < exercises.length-1){
    runnerCtx.exIndex++;
    persistRunnerSession();
    renderRunnerExercise();
    const scrollArea = document.getElementById('runnerScrollArea');
    if(scrollArea) scrollArea.scrollTop = 0;
  } else {
    finishWorkout();
  }
}

function getRestNextLabel(){
  if(!runnerCtx) return {kind:'none', text:''};
  const exercises = runnerExercises();
  const exDef = exercises[runnerCtx.exIndex];
  const setsArr = runnerCtx.sets[runnerCtx.exIndex];
  const allDone = setsArr.every(s=>s.done);
  if(!allDone){
    const e = findExercise(exDef.exerciseId);
    return {kind:'set', text:`Próxima série · ${e?e.name:''}`};
  }
  const isLast = runnerCtx.exIndex === exercises.length-1;
  if(isLast) return {kind:'finish', text:'Última série concluída — hora de finalizar! 🎉'};
  const nextDef = exercises[runnerCtx.exIndex+1];
  const nextE = findExercise(nextDef.exerciseId);
  return {kind:'exercise', text:`Próximo exercício · ${nextE?nextE.name:''}`};
}

function openRestTimerPicker(defaultSeconds, autoStart){
  if(autoStart){
    startRestOverlay(defaultSeconds);
  } else {
    openModal(`
      <h2 style="margin-bottom:14px;">Cronômetro de descanso</h2>
      <div class="chip-row">
        ${[30,60,90,120].map(o=>`<button class="chip" data-sec="${o}">${o}s</button>`).join('')}
      </div>
    `);
    document.querySelectorAll('[data-sec]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        closeModal();
        startRestOverlay(Number(btn.dataset.sec));
      });
    });
  }
}

const REST_MOTIVATION = [
  'Respira fundo. A próxima série te espera.',
  'Você já está mais forte que na última série.',
  'Hidrata e prepara — quase lá.',
  'Cada segundo de descanso também é treino.',
  'Foco no que vem a seguir.',
  'Consistência vence intensidade.',
];

function startRestOverlay(seconds, existingEndsAt){
  removeTimerFab();
  const next = getRestNextLabel();
  const showMotivation = Math.random()<0.5;
  const motivation = REST_MOTIVATION[Math.floor(Math.random()*REST_MOTIVATION.length)];
  const canUndo = !!runnerCtx.lastCompleted;
  const circumference = 2*Math.PI*90;

  // Fonte da verdade é o RELÓGIO (timestamp de término), não uma contagem
  // regressiva em memória — assim o tempo continua certo mesmo se o app
  // ficar em segundo plano (o navegador pode atrasar o setInterval, mas
  // recalculamos a partir de endsAt a cada tique, então se autocorrige).
  const endsAt = existingEndsAt || (Date.now() + seconds*1000);
  const initialRemaining = Math.max(0, Math.round((endsAt-Date.now())/1000));
  runnerCtx.restState = {endsAt, totalSeconds:seconds, paused:false, pausedRemaining:null};
  persistRunnerSession();

  const overlay = document.createElement('div');
  overlay.className = 'rest-overlay';
  overlay.id = 'restOverlay';
  overlay.innerHTML = `
    <div class="rest-overlay-inner">
      <div class="rest-eyebrow">Descanso</div>
      <div class="rest-ring">
        <svg viewBox="0 0 200 200">
          <circle class="rest-ring-bg" cx="100" cy="100" r="90"></circle>
          <circle class="rest-ring-fg" id="restRingFg" cx="100" cy="100" r="90" stroke-dasharray="${circumference}" stroke-dashoffset="0"></circle>
        </svg>
        <div class="rest-time" id="restTimeLabel" role="button" tabindex="0" title="Toque pra editar">${initialRemaining}</div>
      </div>
      <p class="rest-edit-hint">Toque no número pra editar</p>
      <div class="rest-next">
        <span class="rest-next-label">${next.kind==='finish'?'':'A seguir'}</span>
        <div class="rest-next-name">${next.text}</div>
      </div>
      ${showMotivation?`<p class="rest-motivation">${motivation}</p>`:''}
      <div class="rest-actions">
        <div class="rest-adjust-row">
          <button class="btn btn-ghost" id="restMinus15" aria-label="Tirar 15 segundos">−15s</button>
          <button class="btn btn-ghost" id="restPauseBtn" aria-label="Pausar cronômetro">${icon('clock',{size:16})}</button>
          <button class="btn btn-ghost" id="restAdd15" aria-label="Adicionar 15 segundos">+15s</button>
        </div>
        <button class="btn btn-primary hero-cta" id="restSkipBtn">Pular descanso</button>
        ${canUndo?`<button class="btn btn-ghost btn-sm" id="restUndoBtn">Desfazer última série</button>`:''}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('open'));

  const timeBox = overlay.querySelector('.rest-ring');

  function onTick(){
    if(!runnerCtx || !runnerCtx.restState) return;
    const clamped = Math.max(0, Math.round((runnerCtx.restState.endsAt-Date.now())/1000));
    const label = document.getElementById('restTimeLabel');
    if(label) label.textContent = clamped;
    const currentRing = document.getElementById('restRingFg');
    if(currentRing) currentRing.style.strokeDashoffset = circumference * (1 - clamped/Math.max(runnerCtx.restState.totalSeconds,1));
  }
  function onDone(){
    const label = document.getElementById('restTimeLabel');
    if(label) label.textContent = '0';
    showToast('Descanso finalizado', 'Hora de voltar para a próxima série!', '⏱');
    closeRestOverlay();
  }
  function restartAt(newSeconds){
    newSeconds = Math.max(1, Math.round(newSeconds));
    runnerCtx.restState = {endsAt: Date.now()+newSeconds*1000, totalSeconds:newSeconds, paused:false, pausedRemaining:null};
    persistRunnerSession();
    RestTimer.start(newSeconds, onTick, onDone);
  }

  if(initialRemaining<=0){ onDone(); }
  else RestTimer.start(initialRemaining, onTick, onDone);

  overlay.querySelector('#restSkipBtn').addEventListener('click', closeRestOverlay);
  overlay.querySelector('#restAdd15').addEventListener('click', ()=>restartAt(Math.round((runnerCtx.restState.endsAt-Date.now())/1000)+15));
  overlay.querySelector('#restMinus15').addEventListener('click', ()=>restartAt(Math.round((runnerCtx.restState.endsAt-Date.now())/1000)-15));

  const pauseBtn = overlay.querySelector('#restPauseBtn');
  pauseBtn.addEventListener('click', ()=>{
    if(RestTimer.isRunning()){
      RestTimer.pause();
      const remaining = Math.max(0, Math.round((runnerCtx.restState.endsAt-Date.now())/1000));
      runnerCtx.restState.paused = true;
      runnerCtx.restState.pausedRemaining = remaining;
      persistRunnerSession();
      pauseBtn.innerHTML = icon('check',{size:16}); // reaproveita um ícone claro de "retomar"
      pauseBtn.setAttribute('aria-label','Retomar cronômetro');
      overlay.classList.add('paused');
    } else {
      const remaining = runnerCtx.restState.pausedRemaining||0;
      runnerCtx.restState.endsAt = Date.now()+remaining*1000;
      runnerCtx.restState.paused = false;
      runnerCtx.restState.pausedRemaining = null;
      persistRunnerSession();
      RestTimer.resume();
      pauseBtn.innerHTML = icon('clock',{size:16});
      pauseBtn.setAttribute('aria-label','Pausar cronômetro');
      overlay.classList.remove('paused');
    }
  });

  const undoBtn = overlay.querySelector('#restUndoBtn');
  if(undoBtn) undoBtn.addEventListener('click', undoLastSet);

  function enterEditMode(){
    RestTimer.stop();
    const current = Math.max(0, Math.round((runnerCtx.restState.endsAt-Date.now())/1000)) || seconds;
    timeBox.innerHTML = `
      <svg viewBox="0 0 200 200">
        <circle class="rest-ring-bg" cx="100" cy="100" r="90"></circle>
        <circle class="rest-ring-fg" id="restRingFg" cx="100" cy="100" r="90" stroke-dasharray="${circumference}" stroke-dashoffset="0"></circle>
      </svg>
      <input type="number" id="restTimeInput" class="rest-time-input" min="5" step="5" value="${current}">
    `;
    const input = document.getElementById('restTimeInput');
    input.focus();
    input.select();
    function commit(){
      const val = Number(input.value);
      restartAt(val>0 ? val : current);
      rebuildRing();
    }
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){ e.preventDefault(); input.blur(); }
    });
  }

  function rebuildRing(){
    const remaining = Math.max(0, Math.round((runnerCtx.restState.endsAt-Date.now())/1000));
    timeBox.innerHTML = `
      <svg viewBox="0 0 200 200">
        <circle class="rest-ring-bg" cx="100" cy="100" r="90"></circle>
        <circle class="rest-ring-fg" id="restRingFg" cx="100" cy="100" r="90" stroke-dasharray="${circumference}" stroke-dashoffset="0"></circle>
      </svg>
      <div class="rest-time" id="restTimeLabel" role="button" tabindex="0" title="Toque pra editar">${remaining}</div>
    `;
    timeBox.querySelector('#restTimeLabel').addEventListener('click', enterEditMode);
  }

  timeBox.querySelector('#restTimeLabel').addEventListener('click', enterEditMode);
}

function undoLastSet(){
  if(!runnerCtx || !runnerCtx.lastCompleted) return;
  const {exIndex, setIndex} = runnerCtx.lastCompleted;
  if(runnerCtx.sets[exIndex] && runnerCtx.sets[exIndex][setIndex]){
    runnerCtx.sets[exIndex][setIndex].done = false;
  }
  runnerCtx.lastCompleted = null;
  closeRestOverlay();
  persistRunnerSession();
  if(exIndex===runnerCtx.exIndex) renderRunnerExercise();
  showToast('Série desfeita', 'Marcada como não concluída novamente.', '↩️');
}

function closeRestOverlay(){
  RestTimer.stop();
  if(runnerCtx){ runnerCtx.restState = null; persistRunnerSession(); }
  const overlay = document.getElementById('restOverlay');
  if(overlay){
    overlay.classList.remove('open');
    setTimeout(()=>overlay.remove(), 300);
  }
}

function removeTimerFab(){
  const fab = document.getElementById('timerFab');
  if(fab) fab.remove();
}

function finishWorkout(){
  stopRunnerClock();
  const tpl = getTemplate(runnerCtx.templateId);
  const exercises = runnerExercises();
  const durationMin = Math.max(1, Math.round((Date.now()-runnerCtx.startTime)/60000));
  let volume = 0, setsCompleted = 0;
  const exercisesLog = exercises.map((exDef,i)=>{
    const sets = runnerCtx.sets[i].map(s=>({weight:s.weight, reps:s.reps, notes:s.notes, done:s.done, skipped:s.skipped}));
    sets.forEach(s=>{ if(s.done){ volume += (s.weight*s.reps); setsCompleted++; } });
    return {exerciseId:exDef.exerciseId, sets};
  });
  const exercisesCompleted = exercisesLog.filter(el=>el.sets.some(s=>s.done)).length;
  const calories = Math.round(volume*0.05 + durationMin*4);
  const session = {
    id:cryptoId(), templateId:runnerCtx.templateId, name:tpl.name,
    date: runnerCtx.dateKey,
    startedAt: new Date(runnerCtx.startTime).toISOString(),
    completedAt: new Date().toISOString(),
    duration:durationMin, volume, calories, exercisesLog,
  };

  // -------------------------------------------------------------------
  // Grava tudo em memória, tenta salvar UMA vez, e só marca a sessão
  // ativa como concluída se esse save realmente funcionou — assim uma
  // falha de armazenamento (disco cheio, por ex.) nunca troca uma sessão
  // ativa recuperável por um treino que não foi salvo de verdade.
  // -------------------------------------------------------------------
  const rollback = {
    historyLength: state.history.length,
    completedDate: state.completedDates[runnerCtx.dateKey],
    activeSession: state.activeWorkoutSession,
    exerciseLoadsSnapshot: JSON.parse(JSON.stringify(state.exerciseLoads)),
    bestStreak: state.bestStreak,
    fullWeeksCompleted: state.fullWeeksCompleted,
  };

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
  const isNewStreakRecord = state.streak > (state.bestStreak||0) && state.streak>=2;
  if(isNewStreakRecord) state.bestStreak = state.streak;

  // verifica semana completa
  const wp = weekProgressAfterSave();
  if(wp.done===wp.total && wp.total>0){
    state.fullWeeksCompleted = (state.fullWeeksCompleted||0)+1;
  }

  state.activeWorkoutSession = null; // só vale se o persist() abaixo funcionar

  const ok = !!DB.saveWorkout(session);
  if(!ok){
    // desfaz tudo — o treino continua ativo e recuperável, nada se perde
    state.history.length = rollback.historyLength;
    if(rollback.completedDate===undefined) delete state.completedDates[runnerCtx.dateKey];
    else state.completedDates[runnerCtx.dateKey] = rollback.completedDate;
    state.exerciseLoads = rollback.exerciseLoadsSnapshot;
    state.bestStreak = rollback.bestStreak;
    state.fullWeeksCompleted = rollback.fullWeeksCompleted;
    state.activeWorkoutSession = rollback.activeSession;
    persistRunnerSession();
    showToast('Não foi possível salvar', 'Sem espaço de armazenamento. Seu treino continua salvo — tente novamente.', '⚠️');
    startRunnerClock();
    return;
  }

  checkAchievements();
  addXp(50);

  if(newRecord) pushNotification('Novo recorde! 🎉', 'Você superou sua carga anterior em um exercício.', '🏆');
  if(isNewStreakRecord) pushNotification('Novo recorde de sequência!', `${state.streak} dias treinando seguidos.`, '🔥');

  showCompletionScreen(session, {xp:50, newRecord, isNewStreakRecord, setsCompleted, exercisesCompleted, totalExercises:exercises.length});
}

const FINISH_MOTIVATION = [
  'Mais um passo na direção certa.',
  'Consistência é o que constrói resultado.',
  'Seu eu do futuro agradece esse treino.',
  'Descansa bem — você mereceu.',
  'Todo treino conta, inclusive esse.',
];

function weekProgressAfterSave(){ return weekProgress(); }

function showCompletionScreen(session, extra){
  extra = extra || {};
  const motivation = FINISH_MOTIVATION[Math.floor(Math.random()*FINISH_MOTIVATION.length)];
  const runnerEl = document.getElementById('runnerEl');
  const metrics = workoutDisplayMetrics(session);
  runnerEl.innerHTML = `
    <div class="runner-body" style="justify-content:center;flex:1;">
      <div class="celebrate">
        <div class="emoji">🎉</div>
        <h2>Parabéns!</h2>
        <p>Treino concluído com sucesso.</p>
        <div class="celebrate-stats">
          <div><b>${session.duration}min</b><span>Duração</span></div>
          <div><b>${metrics.totalLoad>0 ? WorkoutProgression.formatKg(metrics.totalLoad) : '0 kg'}</b><span>Carga total</span></div>
          <div><b>${metrics.totalReps}</b><span>Reps</span></div>
        </div>
        <div class="celebrate-stats">
          <div><b>${WorkoutProgression.formatKg(metrics.trainingVolume)}</b><span>Volume</span></div>
          <div><b>${session.calories}</b><span>Kcal</span></div>
          <div><b>${extra.exercisesCompleted||0}/${extra.totalExercises||0}</b><span>Exercícios</span></div>
        </div>
        <div class="celebrate-stats">
          <div><b>${extra.setsCompleted||0}</b><span>Séries</span></div>
          <div><b>🔥 ${state.streak}</b><span>Sequência</span></div>
        </div>
        <div class="xp-earned">+${extra.xp||0} XP</div>
        ${extra.isNewStreakRecord?`<p class="celebrate-extra">🔥 Novo recorde de sequência: ${state.streak} dias!</p>`:''}
        ${extra.newRecord?`<p class="celebrate-extra">🏆 Novo recorde de carga em algum exercício!</p>`:''}
        <p class="celebrate-motivation">${motivation}</p>
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
const MUSCLE_FILTERS = ['todos','favoritos','peito','costas','pernas','gluteos','ombros','biceps','triceps','abdomen','cardio'];
const MUSCLE_LABELS = {todos:'Todos', favoritos:'Favoritos', peito:'Peito', costas:'Costas', pernas:'Pernas', gluteos:'Glúteos', ombros:'Ombros', biceps:'Bíceps', triceps:'Tríceps', abdomen:'Abdômen', cardio:'Cardio'};

function renderExercises(){
  const wrap = document.getElementById('treinoTabContent');
  wrap.innerHTML = `
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
  const query = exerciseSearch.trim().toLowerCase();

const filtered = allExercises()
  .filter(e=>{
    const label = MUSCLE_LABELS[e.muscle] || e.muscle || '';
    const haystack = `${e.name} ${e.desc || ''} ${label}`.toLowerCase();

    return (
      (exerciseFilter === 'todos' || (exerciseFilter === 'favoritos' ? isFavoriteExercise(e.id) : e.muscle === exerciseFilter)) &&
      (!query || haystack.includes(query))
    );
  })
    .sort((a,b)=>{
      const favDiff = Number(isFavoriteExercise(b.id))-Number(isFavoriteExercise(a.id));
      return favDiff || a.name.localeCompare(b.name);
    });
if(filtered.length===0){
  grid.innerHTML = `
    <div class="empty-state" style="grid-column:1/-1;">
      <span class="emoji">🔍</span>
      <b>Nenhum exercício encontrado</b>
      <small>Tente buscar por nome, grupo muscular ou tipo de movimento.</small>
      <button class="btn btn-ghost btn-sm" id="clearExerciseSearch" style="margin-top:12px;">Limpar busca</button>
    </div>
  `;

  const clearBtn = document.getElementById('clearExerciseSearch');
  if(clearBtn){
    clearBtn.addEventListener('click', ()=>{
      exerciseSearch = '';
      exerciseFilter = 'todos';
      renderExercises();
    });
  }

  return;
}
  grid.innerHTML = filtered.map(e=>`
    <div class="card exercise-card interactive" data-ex="${e.id}">
      <div class="exercise-thumb">${exerciseMedia(e, {size:'card'})}</div>
     <div class="exercise-name">${e.name}</div>
<div class="exercise-meta">${e.desc.slice(0,58)}${e.desc.length>58?'…':''}</div>
<div class="exercise-card-footer">
  <span class="muscle-tag">${MUSCLE_LABELS[e.muscle]}</span>
  <span class="exercise-open-hint">Ver detalhes</span>
</div>
<button class="btn btn-ghost btn-sm" data-fav-ex="${e.id}" style="margin-top:10px;">${isFavoriteExercise(e.id)?'Salvo':'Favoritar'}</button>
    </div>`).join('');
  grid.querySelectorAll('[data-ex]').forEach(card=>{
    card.addEventListener('click', ()=>openExerciseModal(card.dataset.ex));
  });
  grid.querySelectorAll('[data-fav-ex]').forEach(btn=>{
    btn.addEventListener('click', (event)=>{
      event.stopPropagation();
      toggleFavoriteExercise(btn.dataset.favEx);
      renderExGrid();
    });
  });
}

function openExerciseModal(exId){
  const e = findExercise(exId) || {
    id:exId,
    name:'Exercício removido',
    muscle:'todos',
    desc:'Este exercício apareceu em treinos antigos, mas não está mais na biblioteca.',
    execution:'Sem instruções salvas para este exercício.',
    mistakes:'Sem observações salvas para este exercício.'
  };

  const stats = WorkoutProgression.getExerciseStats(state, exId);
  const favorite = isFavoriteExercise(exId);

  openModal(`
    <div class="exercise-detail">
      <div class="exercise-detail-media">
        ${exerciseMedia(e, {size:'large'})}
      </div>

      <div class="exercise-detail-header">
        <div>
          <h2>${escapeHtml(e.name)}</h2>
          <span class="muscle-tag">${MUSCLE_LABELS[e.muscle] || e.muscle || 'Exercício'}</span>
        </div>
      </div>

      <p class="exercise-detail-desc">${escapeHtml(e.desc || 'Sem descrição cadastrada.')}</p>

      <div class="exercise-detail-section">
        <h4>Execução correta</h4>
        <p>${escapeHtml(e.execution || 'Sem instruções salvas para este exercício.')}</p>
      </div>

      <div class="exercise-detail-section">
        <h4>Dicas e cuidados</h4>
        <p>${escapeHtml(e.mistakes || 'Sem observações salvas para este exercício.')}</p>
      </div>

      <div class="exercise-detail-stats">
        <div>
          <span>Sessões</span>
          <b>${stats.sessionsCount || 0}</b>
        </div>
        <div>
          <span>Último treino</span>
          <b>${stats.lastPerformed ? fmtDate(stats.lastPerformed) : 'Primeira vez'}</b>
        </div>
      </div>

      <button class="btn btn-primary btn-block" id="viewAnalyticsBtn">Ver evolução</button>
      <button class="btn btn-ghost btn-block" id="favoriteExerciseBtn">${favorite ? 'Remover dos favoritos' : 'Favoritar exercício'}</button>
    </div>
  `);

  const analyticsBtn = document.getElementById('viewAnalyticsBtn');
  if(analyticsBtn) analyticsBtn.addEventListener('click', ()=>openExerciseAnalytics(exId));

  const favoriteBtn = document.getElementById('favoriteExerciseBtn');
  if(favoriteBtn) favoriteBtn.addEventListener('click', ()=>{
    toggleFavoriteExercise(exId);
    openExerciseModal(exId);
    renderExGrid();
  });
}

let exerciseChartMetric = 'weight';
let exerciseChartRange = 'd90';
const EXERCISE_CHART_METRICS = [
  {id:'weight', label:'Carga'},
  {id:'reps', label:'Repetições'},
  {id:'volume', label:'Volume'},
  {id:'oneRm', label:'1RM estimado'},
];
const EXERCISE_CHART_RANGES = [
  {id:'d7', label:'7 dias'},
  {id:'d30', label:'30 dias'},
  {id:'d90', label:'90 dias'},
  {id:'m6', label:'6 meses'},
  {id:'y1', label:'1 ano'},
  {id:'all', label:'Tudo'},
];

/* ======================================================================
   FEATURE 10 — Tela de análise detalhada de um exercício
   ====================================================================== */
function openExerciseAnalytics(exId){
  const e = findExercise(exId) || {id:exId, name:'Exercício removido', muscle:'todos'};
  const sessions = WorkoutProgression.getExerciseHistory(state, exId);
  const stats = WorkoutProgression.getExerciseStats(state, exId);
  const prs = WorkoutProgression.getExercisePRs(state, exId);
  const trend = WorkoutProgression.getExerciseTrend(state, exId);
  const progress = WorkoutProgression.getExerciseProgress(state, exId);

  openModal(`
    <div class="exercise-history">
      <div class="exercise-history-header">
        <div class="exercise-history-icon">${exerciseMedia(e, {size:'icon'})}</div>
        <div>
          <h2>${e.name}</h2>
          <span class="muscle-tag">${MUSCLE_LABELS[e.muscle]||e.muscle||'Exercício'}</span>
        </div>
      </div>

      <div class="exercise-history-stats">
        <div><span>Sessões</span><b>${stats.sessionsCount}</b></div>
        <div><span>Último treino</span><b>${stats.lastPerformed ? fmtDate(stats.lastPerformed) : 'Primeira vez'}</b></div>
        <div><span>Melhor carga</span><b>${stats.bestWeight ? WorkoutProgression.formatKg(stats.bestWeight) : '—'}</b></div>
        <div><span>Mais reps em série</span><b>${stats.bestReps || '—'}</b></div>
        <div><span>Melhor 1RM</span><b>${stats.bestOneRm ? WorkoutProgression.formatKg(stats.bestOneRm) : '—'}</b></div>
        <div><span>Carga total</span><b>${WorkoutProgression.formatKg(stats.totalLoad)}</b></div>
        <div><span>Repetições</span><b>${stats.totalReps}</b></div>
        <div><span>Volume de treino</span><b>${WorkoutProgression.formatKg(stats.totalVolume)}</b></div>
      </div>

      <div class="section-title">Performance atual</div>
      ${stats.lastPerformance ? `
        <div class="card exercise-current">
          <span>Último treino · ${fmtDate(stats.lastPerformance.date)}</span>
          ${stats.lastPerformance.sets.map(set=>`<b>${WorkoutProgression.formatNumber(set.weight)} kg × ${set.reps}</b>`).join('')}
        </div>
      ` : `<div class="empty-state compact"><span class="emoji">📈</span>Primeira vez</div>`}

      <div class="section-title">Recordes</div>
      <div class="exercise-pr-grid">
        ${prs.map(pr=>`
          <div class="exercise-pr-card">
            <span>${pr.label}</span>
            <b>${pr.value}</b>
            <small>${pr.date ? fmtDate(pr.date) : ''}</small>
          </div>
        `).join('') || `<div class="empty-state compact">Sem recordes ainda.</div>`}
      </div>

      <div class="section-title">Tendência</div>
      <div class="exercise-trend ${trend.status}">
        <b>${trend.label}</b>
        <span>${trend.status==='insufficient' ? 'Registre mais sessões para comparar com segurança.' : `Comparando a média das 2 sessões mais recentes com as 2 anteriores: ${trend.deltaPct>=0?'+':''}${trend.deltaPct.toFixed(1)}%.`}</span>
      </div>

      ${progress ? `
        <div class="exercise-comparison-list">
          ${progress.map(item=>`
            <div>
              <span>${item.label}</span>
              <b>${item.text}</b>
              <strong>${item.pct>=0?'+':''}${item.pct.toFixed(1)}%</strong>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="section-title">Gráfico</div>
      <div class="exercise-chart-controls">
        <div class="chip-row">
          ${EXERCISE_CHART_METRICS.map(m=>`<button class="chip ${exerciseChartMetric===m.id?'active':''}" data-exchartmetric="${m.id}" aria-label="Mostrar ${m.label}">${m.label}</button>`).join('')}
        </div>
        <div class="chip-row">
          ${EXERCISE_CHART_RANGES.map(r=>`<button class="chip ${exerciseChartRange===r.id?'active':''}" data-exchartrange="${r.id}" aria-label="Período ${r.label}">${r.label}</button>`).join('')}
        </div>
      </div>
      <div class="card exercise-chart-card" id="exerciseProgressChart" role="img" aria-label="Gráfico de progresso do exercício"></div>

      <div class="section-title">Sessões</div>
      <div class="exercise-session-list">
        ${[...sessions].reverse().map((session,index)=>`
          <details class="exercise-session" ${index===0?'open':''}>
            <summary>
              <span>${fmtDate(session.date)}</span>
              <b>${session.totalLoad>0 ? WorkoutProgression.formatKg(session.totalLoad) + ' carga' : 'Peso corporal'} · ${session.totalReps} reps</b>
            </summary>
            <div class="exercise-session-sets">
              ${session.sets.map(set=>`<span>${setDisplayText(set)}</span>`).join('')}
              <small>Volume de treino: ${WorkoutProgression.formatKg(session.trainingVolume||session.volume)}</small>
              ${session.legacy?`<small>Registro antigo importado de cargas salvas.</small>`:''}
            </div>
          </details>
        `).join('') || `<div class="empty-state compact">Nenhuma sessão registrada.</div>`}
      </div>
    </div>
  `);
  renderExerciseProgressChart(exId);
  document.querySelectorAll('[data-exchartmetric]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ exerciseChartMetric = btn.dataset.exchartmetric; openExerciseAnalytics(exId); });
  });
  document.querySelectorAll('[data-exchartrange]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ exerciseChartRange = btn.dataset.exchartrange; openExerciseAnalytics(exId); });
  });
}

function renderExerciseProgressChart(exId){
  const chart = document.getElementById('exerciseProgressChart');
  if(!chart) return;
  const points = WorkoutProgression.getExerciseChartPoints(state, exId, exerciseChartMetric, exerciseChartRange);
  if(points.length<2){
    chart.innerHTML = `<div class="empty-state compact"><span class="emoji">📈</span>Dados insuficientes para este gráfico.</div>`;
    return;
  }
  renderLineChart(chart, points, {height:180});
}

function validDisplaySets(sets){
  return (sets||[]).filter(set=>
    set && set.done && !set.skipped &&
    set.weight !== undefined && set.weight !== null && set.weight !== '' &&
    Number(set.reps)>0 && Number(set.weight)>=0
  );
}

function setDisplayText(set){
  const weight = Number(set.weight)||0;
  const loadLabel = weight>0 ? WorkoutProgression.formatKg(weight) : 'Peso corporal';
  return `${loadLabel} × ${Number(set.reps)||0}`;
}

function workoutDisplayMetrics(session){
  const sets = (session.exercisesLog||[]).flatMap(ex=>validDisplaySets(ex.sets));
  return {
    totalLoad: sets.reduce((sum,set)=>sum+(Number(set.weight)||0),0),
    totalReps: sets.reduce((sum,set)=>sum+(Number(set.reps)||0),0),
    trainingVolume: sets.reduce((sum,set)=>sum+((Number(set.weight)||0) * (Number(set.reps)||0)),0),
  };
}

/* ======================================================================
   VIEW: HISTÓRICO
   ====================================================================== */
/* ======================================================================
   PROGRESSO — agrupa Estatísticas, Histórico e Conquistas em sub-abas
   ====================================================================== */
let currentProgressoTab = 'geral';

function renderProgresso(){
  const wrap = document.getElementById('viewWrap');
  const tabs = [
    {id:'geral', label:'Visão Geral'},
    {id:'analise', label:'Análise'},
    {id:'corpo', label:'Corpo'},
    {id:'historico', label:'Histórico'},
    {id:'conquistas', label:'Conquistas'},
  ];
  wrap.innerHTML = `
    <div class="view-header"><div class="greeting"><h1>Progresso</h1><p>Sua evolução em números, sessões e conquistas.</p></div></div>
    <div class="tabs" id="progressoTabs">
      ${tabs.map(t=>`<button class="tab-btn ${currentProgressoTab===t.id?'active':''}" data-progressotab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="progressoTabContent"></div>
  `;
  document.querySelectorAll('[data-progressotab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ currentProgressoTab=btn.dataset.progressotab; renderProgresso(); });
  });
  const renderers = {geral: renderStats, analise: renderAnalysis, corpo: renderBodyProgress, historico: renderHistory, conquistas: renderConquistas};
  renderers[currentProgressoTab]();
  makeInteractiveElementsAccessible(document.getElementById('progressoTabContent'));
}

/* ======================================================================
   ANÁLISE — sistema inteligente de progresso (Analytics, ver analytics.js)
   ====================================================================== */
function renderAnalysis(){
  const wrap = document.getElementById('progressoTabContent');
  const ws = Analytics.weeklySummary();
  const ms = Analytics.monthlySummary();
  const balance = Analytics.muscleBalance();
  const recovery = Analytics.recoveryInsight();
  const plateaus = Analytics.allPlateaus();
  const overloads = Analytics.allOverloadSuggestions();
  const insights = Analytics.smartInsights();
  const prs = Analytics.detectPRs().slice(0,5);

  const statusLabel = {balanced:'Equilibrado', under:'Pouco treinado', over:'Muito treinado', none:'Sem treino recente'};
  const statusColor = {balanced:'var(--green)', under:'var(--text-dim)', over:'var(--red)', none:'var(--text-faint)'};

  wrap.innerHTML = `
    ${recovery ? `<div class="analysis-banner ${recovery.level}">${recovery.level==='warning'?'⚠️':'💡'} ${recovery.message}</div>` : ''}

    ${insights.length ? `
      <div class="section-title" style="margin-top:0;">Insights</div>
      <div style="margin-bottom:20px;">
        ${insights.map(txt=>`<div class="card insight-card">${txt}</div>`).join('')}
      </div>
    ` : ''}

    <div class="section-title" style="margin-top:0;">Resumo da semana</div>
    <div class="grid grid-3" style="margin-bottom:20px;">
      <div class="card stat-card"><span class="stat-label">Treinos</span><span class="stat-value">${ws.workouts}</span></div>
      <div class="card stat-card"><span class="stat-label">Volume de treino</span><span class="stat-value">${WorkoutProgression.formatKg(ws.volume)}</span></div>
      <div class="card stat-card"><span class="stat-label">Kcal</span><span class="stat-value">${ws.calories}</span></div>
      <div class="card stat-card"><span class="stat-label">Duração média</span><span class="stat-value">${ws.avgDuration}<span style="font-size:12px;">min</span></span></div>
      <div class="card stat-card"><span class="stat-label">Grupo principal</span><span class="stat-value" style="font-size:16px;">${ws.topMuscle||'—'}</span></div>
      <div class="card stat-card"><span class="stat-label">Novos recordes</span><span class="stat-value">${ws.newPRs}</span></div>
    </div>

    <div class="section-title">Resumo do mês</div>
    <div class="grid grid-3" style="margin-bottom:20px;">
      <div class="card stat-card"><span class="stat-label">Treinos</span><span class="stat-value">${ms.workouts}</span></div>
      <div class="card stat-card"><span class="stat-label">Volume de treino</span><span class="stat-value">${WorkoutProgression.formatKg(ms.volume)}</span></div>
      <div class="card stat-card"><span class="stat-label">Peso corporal</span><span class="stat-value" style="font-size:16px;">${ms.weightTrend!=null?`${ms.weightTrend>0?'+':''}${WorkoutProgression.formatKg(Math.abs(ms.weightTrend))}`:'—'}</span></div>
    </div>
    ${ms.topExercises.length ? `
      <div class="card" style="margin-bottom:20px;">
        <div class="list-row-title" style="margin-bottom:10px;">Exercícios mais treinados no mês</div>
        ${ms.topExercises.map(ex=>`<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-top:1px solid var(--border);"><span>${ex.name}</span><span style="color:var(--text-dim);">${WorkoutProgression.formatKg(ex.volume)} volume</span></div>`).join('')}
      </div>
    `:''}

    <div class="section-title">Equilíbrio muscular <span style="font-size:11px;color:var(--text-faint);font-weight:400;">(últimas 4 semanas)</span></div>
    <div class="card" style="margin-bottom:20px;">
      ${balance.map(b=>`
        <div class="balance-row">
          <span class="balance-label">${b.label}</span>
          <div class="balance-track"><div class="balance-fill" style="width:${Math.min(100,b.weeklySets/14*100)}%;background:${statusColor[b.status]};"></div></div>
          <span class="balance-status" style="color:${statusColor[b.status]};">${statusLabel[b.status]}</span>
        </div>
      `).join('')}
    </div>

    ${plateaus.length ? `
      <div class="section-title">Possíveis platôs</div>
      <div style="margin-bottom:20px;">
        ${plateaus.map(p=>`
          <div class="card" style="margin-bottom:10px;">
            <div class="list-row-title">⚠️ ${p.exerciseName}</div>
            <p style="font-size:12.5px;color:var(--text-dim);margin:4px 0 10px;">Sem progresso há ${p.sessions} sessões (${p.reason}).</p>
            <div class="chip-row">${p.suggestions.map(s=>`<span class="chip">${s}</span>`).join('')}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${overloads.length ? `
      <div class="section-title">Pronto pra evoluir</div>
      <div style="margin-bottom:20px;">
        ${overloads.map(o=>`
          <div class="card" style="margin-bottom:10px;">
            <div class="list-row-title">💪 ${o.exerciseName}</div>
            <p style="font-size:12.5px;color:var(--text-dim);margin:4px 0 0;">${o.message}</p>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${prs.length ? `
      <div class="section-title">Últimos recordes</div>
      <div>
        ${prs.map(pr=>`
          <div class="card mini-preview-row" style="margin-bottom:10px;">
            <div class="list-row-icon">🏆</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:14px;">${pr.label}</div>
              <div style="color:var(--text-dim);font-size:12.5px;">${pr.value}${pr.date?' · '+fmtDate(pr.date):''}</div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : `<div class="empty-state"><span class="emoji">🏆</span>Seus recordes aparecem aqui conforme você treina.</div>`}
  `;
}

function renderHistory(){
  const wrap = document.getElementById('progressoTabContent');
  wrap.innerHTML = `
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
  list.innerHTML = sessions.map(s=>{
    const metrics = workoutDisplayMetrics(s);
    const loadLabel = metrics.totalLoad>0 ? `${WorkoutProgression.formatKg(metrics.totalLoad)} carga` : 'peso corporal';
    return `
    <div class="list-row" data-session="${s.id}" style="cursor:pointer;">
      <div class="list-row-icon">${MUSCLE_ICONS[getTemplate(s.templateId)?.muscle]||'🏋️'}</div>
      <div class="list-row-body">
        <div class="list-row-title">${s.name}</div>
        <div class="list-row-sub">${fmtDate(s.date)} · ${s.duration} min · ${loadLabel} · ${metrics.totalReps} reps</div>
        <div class="list-row-sub">Volume de treino: ${WorkoutProgression.formatKg(metrics.trainingVolume)}</div>
      </div>
      <div style="color:var(--text-dim);">→</div>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-session]').forEach(row=>{
    row.addEventListener('click', ()=>openSessionDetail(row.dataset.session));
  });
}

function openSessionDetail(id){
  const s = state.history.find(x=>x.id===id);
  if(!s) return;
  const metrics = workoutDisplayMetrics(s);
  openModal(`
    <h2>${s.name}</h2>
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px;">${fmtDate(s.date)} · ${s.duration} min</p>
    <div class="grid grid-4" style="margin-bottom:16px;">
      <div class="card stat-card"><span class="stat-label">Carga total</span><span class="stat-value" style="font-size:18px;">${metrics.totalLoad>0 ? WorkoutProgression.formatKg(metrics.totalLoad) : '0 kg'}</span></div>
      <div class="card stat-card"><span class="stat-label">Repetições</span><span class="stat-value" style="font-size:18px;">${metrics.totalReps}</span></div>
      <div class="card stat-card"><span class="stat-label">Volume</span><span class="stat-value" style="font-size:18px;">${WorkoutProgression.formatKg(metrics.trainingVolume)}</span></div>
      <div class="card stat-card"><span class="stat-label">Calorias</span><span class="stat-value" style="font-size:18px;">${s.calories}</span></div>
      <div class="card stat-card"><span class="stat-label">Duração</span><span class="stat-value" style="font-size:18px;">${s.duration}min</span></div>
    </div>
    ${s.exercisesLog.map(el=>{
      const e = findExercise(el.exerciseId);
      const sets = validDisplaySets(el.sets);
      const exMetrics = {
        totalLoad: sets.reduce((sum,set)=>sum+(Number(set.weight)||0),0),
        totalReps: sets.reduce((sum,set)=>sum+(Number(set.reps)||0),0),
        trainingVolume: sets.reduce((sum,set)=>sum+((Number(set.weight)||0)*(Number(set.reps)||0)),0),
      };
      return `<div class="list-row" style="display:block;">
        <div class="list-row-title" style="margin-bottom:6px;">${e?e.name:el.exerciseId}</div>
        <div class="list-row-sub" style="margin-bottom:8px;">${exMetrics.totalLoad>0 ? WorkoutProgression.formatKg(exMetrics.totalLoad) + ' carga' : 'Peso corporal'} · ${exMetrics.totalReps} reps · ${WorkoutProgression.formatKg(exMetrics.trainingVolume)} volume</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${(el.sets||[]).map((st,i)=>`<span class="chip">Série ${i+1}: ${setDisplayText(st)}</span>`).join('')}
        </div>
      </div>`;
    }).join('')}
  `);
}

/* ======================================================================
   VIEW: ESTATÍSTICAS
   ====================================================================== */
function sessionsInRange(fromDate, toDate){
  return (state.history||[]).filter(session=>{
    const date = new Date(session.date+'T00:00:00');
    return date>=fromDate && date<toDate;
  });
}

function summaryForSessions(sessions){
  const volume = sessions.reduce((sum,session)=>sum+(Number(session.volume)||0),0);
  const duration = sessions.reduce((sum,session)=>sum+(Number(session.duration)||0),0);
  const calories = sessions.reduce((sum,session)=>sum+(Number(session.calories)||0),0);
  const muscleCounts = {};
  sessions.forEach(session=>{
    const muscle = getTemplate(session.templateId)?.muscle;
    if(muscle) muscleCounts[muscle] = (muscleCounts[muscle]||0)+1;
  });
  const topMuscle = Object.entries(muscleCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
  return {
    sessions,
    count:sessions.length,
    volume,
    duration,
    calories,
    avgDuration:sessions.length ? Math.round(duration/sessions.length) : 0,
    topMuscle,
    bestSession:sessions.reduce((best,session)=>!best || (session.volume||0)>(best.volume||0) ? session : best, null),
  };
}

function progressOverviewData(){
  const start = startOfWeek(new Date());
  const end = new Date(start.getTime()+7*86400000);
  const previousStart = new Date(start.getTime()-7*86400000);
  const previousEnd = start;
  const current = summaryForSessions(sessionsInRange(start, end));
  const previous = summaryForSessions(sessionsInRange(previousStart, previousEnd));
  const planned = weekProgress().total || Number(state.user.availableDays)||0;
  const pct = planned ? Math.min(100, Math.round(current.count/planned*100)) : 0;
  return {current, previous, planned, pct};
}

function deltaText(current, previous, unit){
  const delta = current - previous;
  if(!previous && !current) return 'sem registro ainda';
  if(!previous && current) return 'começo da semana';
  if(delta===0) return 'igual à semana passada';
  const sign = delta>0 ? '+' : '-';
  const value = Math.abs(delta);
  return `${sign}${unit==='kg' ? WorkoutProgression.formatKg(value) : Math.round(value)+unit} vs semana passada`;
}

function progressCoachMessage(overview){
  const {current, previous, planned, pct} = overview;
  if(current.count===0) return 'Comece com um treino hoje. Qualquer treino concluído já conta para sua consistência.';
  if(planned && current.count>=planned) return 'Você bateu a meta semanal de treinos. Agora vale preservar recuperação e qualidade.';
  if(previous.count && current.count>previous.count) return 'Você já treinou mais do que na semana passada. Ótimo sinal de constância.';
  if(pct>=60) return 'Semana bem encaminhada. Mais um treino deixa sua consistência muito forte.';
  return 'Você já começou a semana. Escolha o treino que couber melhor hoje e mantenha o ritmo.';
}

function recentProgressHighlights(){
  const prs = Analytics.detectPRs().slice(0,3);
  const lastSession = [...(state.history||[])].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const highlights = prs.map(pr=>({type:'pr', icon:'🏆', title:pr.label, detail:`${pr.value}${pr.date?' · '+fmtDate(pr.date):''}`}));
  if(lastSession){
    highlights.push({
      type:'session',
      icon:'📋',
      title:`Último treino: ${lastSession.name}`,
      detail:`${fmtDate(lastSession.date)} · ${lastSession.duration} min · ${WorkoutProgression.formatKg(lastSession.volume||0)} volume`,
    });
  }
  return highlights.slice(0,4);
}

function renderStats(){
  const wrap = document.getElementById('progressoTabContent');
  const maxLoad = Math.max(0, ...Object.values(state.exerciseLoads).flat().map(l=>l.weight));
  const lvl = xpProgress(state.xp||0);
  const insights = generateInsights();
  const missions = getWeeklyMissions();
  const overview = progressOverviewData();
  const highlights = recentProgressHighlights();
  const current = overview.current;
  const previous = overview.previous;

  wrap.innerHTML = `
    <div class="progress-toolbar">
      <button class="btn btn-primary" id="quickWeightBtn">⚖️ Registrar peso</button>
    </div>

    <section class="card progress-overview">
      <div class="progress-overview-copy">
        <div class="hero-eyebrow">Resumo da semana</div>
        <h2>${current.count}/${overview.planned || current.count} treinos concluídos</h2>
        <p>${progressCoachMessage(overview)}</p>
      </div>
      <div class="progress-ring-large" style="--pct:${overview.pct};">
        <span>${overview.pct}%</span>
      </div>
    </section>

    <div class="grid grid-4 progress-kpi-grid">
      <div class="card stat-card"><span class="stat-label">Treinos</span><span class="stat-value">${current.count}</span><span class="stat-sub">${deltaText(current.count, previous.count, '')}</span></div>
      <div class="card stat-card"><span class="stat-label">Volume</span><span class="stat-value">${WorkoutProgression.formatKg(current.volume)}</span><span class="stat-sub">${deltaText(current.volume, previous.volume, 'kg')}</span></div>
      <div class="card stat-card"><span class="stat-label">Tempo</span><span class="stat-value">${current.duration}<span style="font-size:13px;color:var(--text-dim);">min</span></span><span class="stat-sub">${deltaText(current.duration, previous.duration, 'min')}</span></div>
      <div class="card stat-card"><span class="stat-label">Foco principal</span><span class="stat-value" style="font-size:18px;">${current.topMuscle ? MUSCLE_LABELS[current.topMuscle]||current.topMuscle : '—'}</span><span class="stat-sub">${current.avgDuration ? `média ${current.avgDuration} min` : 'sem média ainda'}</span></div>
    </div>

    ${insights.length?`
      <div class="section-title">Insights</div>
      <div style="margin-bottom:20px;">
        ${insights.map(i=>`<div class="card insight-card ${i.tone==='success'?'insight-success':''}">${i.text}</div>`).join('')}
      </div>
    `:''}

    <div class="progress-split">
      <section>
        <div class="section-title">Destaques recentes</div>
        <div class="progress-highlight-list">
          ${highlights.length ? highlights.map(item=>`
            <div class="card mini-preview-row">
              <div class="list-row-icon">${item.icon}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:14px;">${escapeHtml(item.title)}</div>
                <div style="color:var(--text-dim);font-size:12.5px;">${escapeHtml(item.detail)}</div>
              </div>
            </div>
          `).join('') : `<div class="empty-state"><span class="emoji">🏆</span>Seus destaques aparecem depois dos primeiros treinos.</div>`}
        </div>
      </section>

      <section>
        <div class="section-title">Nível</div>
        <div class="card progress-level-card">
          <div>
            <span class="stat-label">Nível ${lvl.level}</span>
            <strong>${state.xp||0} XP</strong>
            <small>Faltam ${lvl.next-(state.xp||0)} XP para o nível ${lvl.level+1}</small>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${lvl.pct}%;"></div></div>
        </div>
      </section>
    </div>

    <div class="section-title">Missões da semana</div>
    <div style="margin-bottom:20px;">
      ${missions.map(m=>`
        <div class="card mission-card">
          <div style="flex:1;min-width:0;">
            <div class="list-row-title">${m.label}</div>
            <div class="progress-track" style="margin-top:8px;"><div class="progress-fill" style="width:${Math.min(100,m.progress/m.total*100)}%;"></div></div>
          </div>
          ${m.claimed
            ?`<span class="chip active" style="flex-shrink:0;">✓ +${m.xp} XP</span>`
            :m.done?`<button class="btn btn-primary" data-claim="${m.id}" style="flex-shrink:0;">Resgatar +${m.xp} XP</button>`
            :`<span class="chip" style="flex-shrink:0;">${m.progress}/${m.total}</span>`}
        </div>
      `).join('')}
    </div>

    <div class="grid grid-4" style="margin-bottom:10px;">
      <div class="card stat-card"><span class="stat-label">Peso inicial</span><span class="stat-value">${WorkoutProgression.formatKg(state.user.startWeight||state.user.weight)}</span></div>
      <div class="card stat-card"><span class="stat-label">Streak atual</span><span class="stat-value">🔥 ${computeStreak(state.completedDates)}</span></div>
      <div class="card stat-card"><span class="stat-label">Total treinado</span><span class="stat-value">${state.history.length}</span><span class="stat-sub">treinos</span></div>
      <div class="card stat-card"><span class="stat-label">Maior carga</span><span class="stat-value">${WorkoutProgression.formatKg(maxLoad)}</span></div>
    </div>

    <div class="section-title">Treinos por semana (últimas 8 semanas)</div>
    <div class="card" id="chartWorkoutsWeek"></div>

    <div class="section-title">Peso corporal</div>
    <div class="card" id="chartWeight"></div>

    <div class="section-title">Medidas corporais</div>
    <div class="card" id="measurementsCard"></div>

    <div class="section-title">Volume de treino (últimas sessões)</div>
    <div class="card" id="chartVolume"></div>

    <div class="section-title">Comparação mensal de volume de treino</div>
    <div class="card" id="chartMonthlyVolume"></div>
  `;
  renderBarChart(document.getElementById('chartWorkoutsWeek'), workoutsPerWeekData());
  renderLineChart(document.getElementById('chartWeight'), weightSeriesData());
  renderBarChart(document.getElementById('chartVolume'), volumeSeriesData());
  renderBarChart(document.getElementById('chartMonthlyVolume'), monthlyVolumeData());
  renderMeasurementsCard();
  document.getElementById('quickWeightBtn').addEventListener('click', openQuickWeightModal);
  wrap.querySelectorAll('[data-claim]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ claimMission(btn.dataset.claim); renderStats(); });
  });
}

function monthlyVolumeData(){
  const now = new Date();
  const months = [];
  for(let i=5;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const next = new Date(now.getFullYear(), now.getMonth()-i+1, 1);
    const vol = state.history.filter(h=>{const hd=new Date(h.date+'T00:00:00'); return hd>=d && hd<next;}).reduce((a,h)=>a+h.volume,0);
    months.push({label:d.toLocaleDateString('pt-BR',{month:'short'}), value:vol});
  }
  return months;
}

function openQuickWeightModal(){
  openModal(`
    <h2 style="margin-bottom:4px;">Registrar peso</h2>
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px;">Peso atual: ${WorkoutProgression.formatKg(state.user.weight)}</p>
    <div class="field" id="quickWeightField"><label>Novo peso (kg)</label><input type="number" step="0.1" id="quickWeightInput" value="${state.user.weight}" autofocus></div>
    <button class="btn btn-primary btn-block" id="quickWeightSave">Salvar</button>
  `);
  document.getElementById('quickWeightSave').addEventListener('click', ()=>{
    const field = document.getElementById('quickWeightField');
    const w = Number(document.getElementById('quickWeightInput').value);
    field.querySelector('.field-error')?.remove();
    if(!w || w<=0){
      field.classList.add('invalid');
      field.insertAdjacentHTML('beforeend', `<span class="field-error">Informe um peso válido, maior que zero.</span>`);
      return;
    }
    state.weightLog.push({date:todayKey(), weight:w});
    state.user.weight = w;
    persist();
    saveSupabaseProfileQuietly();
    closeModal();
    showToast('Peso registrado', `${WorkoutProgression.formatKg(w)} salvo no seu histórico.`, '⚖️');
    renderStats();
  });
}

function renderMeasurementsCard(){
  const card = document.getElementById('measurementsCard');
  const log = [...(state.measurements||[])].sort((a,b)=>b.date.localeCompare(a.date));
  card.innerHTML = `
    <div class="field-row" style="align-items:flex-end;margin-bottom:14px;">
      <div class="field" style="margin-bottom:0;"><label>Braço (cm)</label><input type="number" step="0.5" id="mArm"></div>
      <div class="field" style="margin-bottom:0;"><label>Cintura (cm)</label><input type="number" step="0.5" id="mWaist"></div>
    </div>
    <div class="field-row" style="align-items:flex-end;margin-bottom:14px;">
      <div class="field" style="margin-bottom:0;"><label>Quadril (cm)</label><input type="number" step="0.5" id="mHips"></div>
      <div class="field" style="margin-bottom:0;"><label>Coxa (cm)</label><input type="number" step="0.5" id="mThigh"></div>
    </div>
    <button class="btn btn-ghost btn-block" id="mSaveBtn">Registrar medidas de hoje</button>
    ${log.length===0?'':`
      <div class="section-title" style="margin-top:18px;">Histórico</div>
      <div>
        ${log.slice(0,8).map(m=>`
          <div class="list-row">
            <div class="list-row-body">
              <div class="list-row-title">${fmtDate(m.date)}</div>
              <div class="list-row-sub">${[
                m.arm?`Braço ${m.arm}cm`:null,
                m.waist?`Cintura ${m.waist}cm`:null,
                m.hips?`Quadril ${m.hips}cm`:null,
                m.thigh?`Coxa ${m.thigh}cm`:null,
              ].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
  document.getElementById('mSaveBtn').addEventListener('click', ()=>{
    const entry = {
      date: todayKey(),
      arm: Number(document.getElementById('mArm').value)||null,
      waist: Number(document.getElementById('mWaist').value)||null,
      hips: Number(document.getElementById('mHips').value)||null,
      thigh: Number(document.getElementById('mThigh').value)||null,
    };
    if(!entry.arm && !entry.waist && !entry.hips && !entry.thigh){
      showToast('Nada pra salvar', 'Preencha ao menos uma medida.', '⚠️');
      return;
    }
    state.measurements = state.measurements || [];
    state.measurements.push(entry);
    persist();
    showToast('Medidas registradas', 'Seu histórico foi atualizado.', '📏');
    renderMeasurementsCard();
  });
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
    {id:'config', label:'Configurações'},
  ];
  if(!['perfil','metas','config'].includes(currentProfileTab)) currentProfileTab='perfil';
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
    perfil: renderTabPerfil, metas: renderTabMetas, config: renderTabConfig,
  };
  renderers[currentProfileTab]();
  makeInteractiveElementsAccessible(document.getElementById('profileTabContent'));
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
  document.getElementById('saveProfile').addEventListener('click', async ()=>{
    const button = document.getElementById('saveProfile');
    button.disabled = true;
    button.textContent = 'Salvando...';
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
    const remote = await saveSupabaseProfile();
    if(remote.ok){
      showToast('Perfil atualizado', 'Suas informações foram salvas no aparelho e no Supabase.', '✅');
    } else if(remote.skipped){
      showToast('Perfil atualizado', 'Suas informações foram salvas neste aparelho.', '✅');
    }
    renderNavLists();
    renderTabPerfil();
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
      <button class="icon-btn" data-delgoal="${g.id}" aria-label="Remover meta">${icon('trash-2',{size:15})}</button>
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

/* ======================================================================
   CORPO — fotos de progresso, medidas expandidas, antes/depois,
   gráficos, metas e linha do tempo (lógica em photos.js)
   ====================================================================== */
let bodyPhotoAngle = 'front';
let bodyChartMetric = 'weight';
let bodyChartRange = '90d';
const ANGLE_LABELS = {front:'Frente', side:'Lado', back:'Costas', custom:'Outro'};

function renderBodyProgress(){
  const wrap = document.getElementById('progressoTabContent');
  const newMilestones = BodyProgress.checkMilestones();
  newMilestones.forEach(ms=>pushNotification('Marco desbloqueado!', ms.label, ms.emoji));
  const insights = BodyProgress.bodyInsights();
  const photos = BodyProgress.photosByAngle(bodyPhotoAngle, false);
  const measurements = [...(state.measurements||[])].sort((a,b)=>b.date.localeCompare(a.date));
  const goals = state.bodyGoals||[];

  wrap.innerHTML = `
    ${insights.length ? `
      <div class="section-title" style="margin-top:0;">Insights</div>
      <div style="margin-bottom:20px;">${insights.map(t=>`<div class="card insight-card insight-success">${t}</div>`).join('')}</div>
    ` : ''}

    <div class="section-title" style="margin-top:0;">Fotos de progresso</div>
    <div class="chip-row" style="margin-bottom:12px;">
      ${Object.keys(ANGLE_LABELS).map(a=>`<button class="chip ${bodyPhotoAngle===a?'active':''}" data-angle="${a}">${ANGLE_LABELS[a]}</button>`).join('')}
    </div>
    <div class="photo-grid" id="photoGrid">
      <label class="photo-add-tile" for="photoUploadInput" tabindex="0" role="button" aria-label="Adicionar foto">
        ${icon('plus',{size:22})}<span>Adicionar</span>
      </label>
      <input type="file" id="photoUploadInput" accept="image/*" capture="environment" style="display:none;">
      ${photos.map(p=>`
        <div class="photo-tile" data-photo="${p.id}">
          <img src="${p.image}" alt="Foto de progresso — ${ANGLE_LABELS[p.angle]}, ${fmtDate(p.date)}" loading="lazy">
          <span class="photo-date">${fmtDate(p.date)}</span>
        </div>
      `).join('')}
    </div>
    ${photos.length===0?`<p style="font-size:12.5px;color:var(--text-dim);margin:-4px 0 20px;">Nenhuma foto de "${ANGLE_LABELS[bodyPhotoAngle]}" ainda.</p>`:''}

    <div class="section-title">Antes &amp; Depois</div>
    <div class="card" style="margin-bottom:20px;">
      <div class="field-row" style="align-items:flex-end;">
        <div class="field" style="margin-bottom:0;"><label>Data 1</label><input type="date" id="compareDateA"></div>
        <div class="field" style="margin-bottom:0;"><label>Data 2</label><input type="date" id="compareDateB"></div>
      </div>
      <button class="btn btn-primary btn-block" id="compareBtn" style="margin-top:12px;">Comparar</button>
      <div id="compareResult"></div>
    </div>

    <div class="section-title">Medidas corporais</div>
    <div class="card" style="margin-bottom:20px;">
      <div class="field-row"><div class="field"><label>Peso (kg)</label><input type="number" step="0.1" id="bmWeight"></div><div class="field"><label>% Gordura</label><input type="number" step="0.1" id="bmBodyFat"></div></div>
      <div class="field-row"><div class="field"><label>Peito (cm)</label><input type="number" step="0.5" id="bmChest"></div><div class="field"><label>Cintura (cm)</label><input type="number" step="0.5" id="bmWaist"></div></div>
      <div class="field-row"><div class="field"><label>Quadril (cm)</label><input type="number" step="0.5" id="bmHip"></div><div class="field"><label>Ombros (cm)</label><input type="number" step="0.5" id="bmShoulders"></div></div>
      <div class="field-row"><div class="field"><label>Pescoço (cm)</label><input type="number" step="0.5" id="bmNeck"></div><div class="field"></div></div>
      <div class="field-row"><div class="field"><label>Braço esq. (cm)</label><input type="number" step="0.5" id="bmArmL"></div><div class="field"><label>Braço dir. (cm)</label><input type="number" step="0.5" id="bmArmR"></div></div>
      <div class="field-row"><div class="field"><label>Antebraço esq. (cm)</label><input type="number" step="0.5" id="bmForearmL"></div><div class="field"><label>Antebraço dir. (cm)</label><input type="number" step="0.5" id="bmForearmR"></div></div>
      <div class="field-row"><div class="field"><label>Coxa esq. (cm)</label><input type="number" step="0.5" id="bmThighL"></div><div class="field"><label>Coxa dir. (cm)</label><input type="number" step="0.5" id="bmThighR"></div></div>
      <div class="field-row"><div class="field"><label>Panturrilha esq. (cm)</label><input type="number" step="0.5" id="bmCalfL"></div><div class="field"><label>Panturrilha dir. (cm)</label><input type="number" step="0.5" id="bmCalfR"></div></div>
      <button class="btn btn-ghost btn-block" id="bmSaveBtn" style="margin-top:6px;">Registrar medidas de hoje</button>
      ${measurements.length ? `
        <div class="section-title" style="margin-top:18px;">IMC · Massa magra (mais recente)</div>
        <div class="grid grid-2">
          <div class="stat-card"><span class="stat-label">IMC</span><span class="stat-value" style="font-size:16px;">${BodyProgress.computeBMI(measurements[0].weight)||'—'}</span></div>
          <div class="stat-card"><span class="stat-label">Massa magra</span><span class="stat-value" style="font-size:16px;">${BodyProgress.computeLeanMass(measurements[0].weight,measurements[0].bodyFat)||'—'}${BodyProgress.computeLeanMass(measurements[0].weight,measurements[0].bodyFat)?'kg':''}</span></div>
        </div>
      ` : ''}
    </div>

    <div class="section-title">Gráficos de evolução</div>
    <div class="chip-row" style="margin-bottom:8px;">
      ${Object.keys(BodyProgress.METRIC_LABELS).map(m=>`<button class="chip ${bodyChartMetric===m?'active':''}" data-metric="${m}">${BodyProgress.METRIC_LABELS[m]}</button>`).join('')}
    </div>
    <div class="chip-row" style="margin-bottom:12px;">
      ${Object.entries({'7d':'7 dias','30d':'30 dias','90d':'90 dias','1y':'1 ano',all:'Tudo'}).map(([k,l])=>`<button class="chip ${bodyChartRange===k?'active':''}" data-range="${k}" style="font-size:11px;">${l}</button>`).join('')}
    </div>
    <div class="card" id="bodyChartCard" style="margin-bottom:20px;"></div>

    <div class="section-title">Metas corporais</div>
    <div style="margin-bottom:20px;">
      ${goals.map(g=>`
        <div class="card" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="list-row-title">${g.label}</span>
            <button class="icon-btn" data-delgoal2="${g.id}" aria-label="Remover meta">${icon('trash-2',{size:15})}</button>
          </div>
          <div class="progress-track" style="margin-bottom:6px;"><div class="progress-fill" style="width:${BodyProgress.goalProgress(g)}%;"></div></div>
          <p style="font-size:12px;color:var(--text-dim);">${BodyProgress.goalProgress(g)}% concluído</p>
        </div>
      `).join('')}
      <button class="btn btn-ghost btn-block" id="newBodyGoalBtn">+ Nova meta corporal</button>
    </div>

    <div class="section-title">Linha do tempo</div>
    <div id="timelineFeed"></div>
  `;

  wireBodyProgressEvents();
  renderBodyChart();
  renderTimelineFeed();
}

function wireBodyProgressEvents(){
  document.querySelectorAll('[data-angle]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ bodyPhotoAngle=btn.dataset.angle; renderBodyProgress(); });
  });

  const uploadInput = document.getElementById('photoUploadInput');
  uploadInput.addEventListener('change', async ()=>{
    const file = uploadInput.files[0];
    if(!file) return;
    let angle = bodyPhotoAngle, customLabel = '';
    if(angle==='custom'){
      customLabel = prompt('Nome dessa foto (ex: "Pose de costas relaxado"):','')||'Personalizada';
    }
    const tile = document.querySelector('.photo-add-tile');
    const tileOriginalHtml = tile ? tile.innerHTML : '';
    if(tile){ tile.innerHTML = `<div class="tile-spinner"></div><span>Processando...</span>`; tile.style.pointerEvents='none'; }
    try{
      const dataUrl = await BodyProgress.compressImage(file, 900, 0.72);
      const photo = {
        id:cryptoId(), date:todayKey(), angle, customLabel,
        weight: state.user.weight, bodyFat: null, notes:'', image:dataUrl, hidden:false,
      };
      state.progressPhotos.push(photo);
      const ok = persist();
      if(!ok){
        state.progressPhotos.pop();
        showToast('Armazenamento cheio', 'Não foi possível salvar — apague fotos antigas ou libere espaço no navegador.', '⚠️');
      } else {
        showToast('Foto salva', 'Adicionada aos seus registros de progresso.', '✅');
      }
    }catch(err){
      showToast('Erro ao processar foto', err.message||'Tente outra imagem.', '⚠️');
      if(tile){ tile.innerHTML = tileOriginalHtml; tile.style.pointerEvents=''; }
    }
    uploadInput.value = '';
    renderBodyProgress();
  });

  document.querySelectorAll('[data-photo]').forEach(tile=>{
    tile.addEventListener('click', ()=>openPhotoDetail(tile.dataset.photo));
  });

  document.getElementById('compareBtn').addEventListener('click', renderCompareResult);

  document.getElementById('bmSaveBtn').addEventListener('click', ()=>{
    const val = id=>{ const v=document.getElementById(id).value; return v===''?null:Number(v); };
    const entry = {
      date: todayKey(),
      weight: val('bmWeight'), bodyFat: val('bmBodyFat'),
      chest: val('bmChest'), waist: val('bmWaist'), hip: val('bmHip'),
      shoulders: val('bmShoulders'), neck: val('bmNeck'),
      armL: val('bmArmL'), armR: val('bmArmR'),
      forearmL: val('bmForearmL'), forearmR: val('bmForearmR'),
      thighL: val('bmThighL'), thighR: val('bmThighR'),
      calfL: val('bmCalfL'), calfR: val('bmCalfR'),
    };
    const hasAny = Object.keys(entry).some(k=>k!=='date' && entry[k]!=null);
    if(!hasAny){ showToast('Nada pra salvar', 'Preencha ao menos uma medida.', '⚠️'); return; }
    state.measurements = state.measurements||[];
    state.measurements.push(entry);
    if(entry.weight){
      state.weightLog.push({date:todayKey(), weight:entry.weight});
      state.user.weight = entry.weight;
      saveSupabaseProfileQuietly();
    }
    persist();
    showToast('Medidas registradas', 'Seu histórico corporal foi atualizado.', '📏');
    renderBodyProgress();
  });

  document.querySelectorAll('[data-metric]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ bodyChartMetric=btn.dataset.metric; renderBodyProgress(); });
  });
  document.querySelectorAll('[data-range]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ bodyChartRange=btn.dataset.range; renderBodyProgress(); });
  });

  document.querySelectorAll('[data-delgoal2]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.bodyGoals = state.bodyGoals.filter(g=>g.id!==btn.dataset.delgoal2);
      persist();
      renderBodyProgress();
    });
  });
  document.getElementById('newBodyGoalBtn').addEventListener('click', openNewBodyGoalModal);
}

function renderBodyChart(){
  const card = document.getElementById('bodyChartCard');
  if(!card) return;
  const series = BodyProgress.metricSeries(bodyChartMetric, bodyChartRange);
  if(series.length<2){
    card.innerHTML = `<div class="empty-state"><span class="emoji">📈</span>Registre medidas em pelo menos 2 datas diferentes pra ver o gráfico.</div>`;
    return;
  }
  renderLineChart(card, series);
}

function renderCompareResult(){
  const dateA = document.getElementById('compareDateA').value;
  const dateB = document.getElementById('compareDateB').value;
  const resultEl = document.getElementById('compareResult');
  if(!dateA || !dateB){ showToast('Escolha as duas datas', 'Selecione data 1 e data 2 pra comparar.', '⚠️'); return; }
  const c = BodyProgress.compare(dateA, dateB);
  function diffRow(label, val, unit){
    if(val==null) return '';
    const sign = val>0?'+':'';
    const color = (label==='Peso'||label==='Cintura') ? (val<0?'var(--green)':val>0?'var(--red)':'var(--text-dim)') : 'var(--text)';
    return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);"><span style="font-size:12.5px;color:var(--text-dim);">${label}</span><span style="font-weight:700;color:${color};">${sign}${val}${unit}</span></div>`;
  }
  resultEl.innerHTML = `
    <div class="compare-photos">
      <div class="compare-photo-col">
        ${c.photoA?`<img src="${c.photoA.image}" alt="Foto de ${fmtDate(dateA)}">`:`<div class="compare-photo-empty">Sem foto</div>`}
        <span>${fmtDate(dateA)}</span>
      </div>
      <div class="compare-photo-col">
        ${c.photoB?`<img src="${c.photoB.image}" alt="Foto de ${fmtDate(dateB)}">`:`<div class="compare-photo-empty">Sem foto</div>`}
        <span>${fmtDate(dateB)}</span>
      </div>
    </div>
    <p style="text-align:center;font-size:12px;color:var(--text-dim);margin:10px 0;">${c.days} dias de diferença</p>
    ${diffRow('Peso', c.weightDiff,'kg')}
    ${diffRow('% Gordura', c.bodyFatDiff,'%')}
    ${diffRow('Cintura', c.waistDiff,'cm')}
    ${diffRow('Peito', c.chestDiff,'cm')}
    ${diffRow('Braço', c.armDiff,'cm')}
    ${diffRow('Coxa', c.thighDiff,'cm')}
  `;
}

function openPhotoDetail(photoId){
  const photo = (state.progressPhotos||[]).find(p=>p.id===photoId);
  if(!photo) return;
  openModal(`
    <img src="${photo.image}" alt="Foto de progresso — ${ANGLE_LABELS[photo.angle]}, ${fmtDate(photo.date)}" style="width:100%;border-radius:var(--radius);margin-bottom:14px;">
    <p style="font-size:13px;color:var(--text-dim);">${ANGLE_LABELS[photo.angle]}${photo.customLabel?' · '+photo.customLabel:''} · ${fmtDate(photo.date)}</p>
    ${photo.weight?`<p style="font-size:13px;margin-top:6px;">Peso na época: <b>${WorkoutProgression.formatKg(photo.weight)}</b></p>`:''}
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button class="btn btn-ghost" id="hidePhotoBtn" style="flex:1;">${photo.hidden?'Reexibir':'Ocultar'}</button>
      <button class="btn btn-danger" id="deletePhotoBtn" style="flex:1;">Excluir</button>
    </div>
  `);
  document.getElementById('hidePhotoBtn').addEventListener('click', ()=>{
    photo.hidden = !photo.hidden;
    persist();
    closeModal();
    renderBodyProgress();
  });
  document.getElementById('deletePhotoBtn').addEventListener('click', ()=>{
    if(!confirm('Excluir essa foto? Essa ação não pode ser desfeita.')) return;
    state.progressPhotos = state.progressPhotos.filter(p=>p.id!==photoId);
    persist();
    closeModal();
    renderBodyProgress();
  });
}

function openNewBodyGoalModal(){
  const metricOptions = Object.keys(BodyProgress.METRIC_LABELS).map(m=>`<option value="${m}">${BodyProgress.METRIC_LABELS[m]}</option>`).join('');
  openModal(`
    <h2 style="margin-bottom:16px;">Nova meta corporal</h2>
    <div class="field"><label>O que você quer acompanhar?</label><select id="goalMetric">${metricOptions}</select></div>
    <div class="field-row">
      <div class="field" id="goalStartField"><label>Valor atual</label><input type="number" step="0.1" id="goalStart"></div>
      <div class="field" id="goalTargetField"><label>Meta</label><input type="number" step="0.1" id="goalTarget"></div>
    </div>
    <button class="btn btn-primary btn-block" id="saveGoalBtn">Criar meta</button>
  `);
  document.getElementById('saveGoalBtn').addEventListener('click', ()=>{
    const metric = document.getElementById('goalMetric').value;
    const startValue = Number(document.getElementById('goalStart').value);
    const targetValue = Number(document.getElementById('goalTarget').value);
    const startField = document.getElementById('goalStartField');
    const targetField = document.getElementById('goalTargetField');
    [startField, targetField].forEach(f=>{ f.classList.remove('invalid'); f.querySelector('.field-error')?.remove(); });
    let hasError = false;
    if(document.getElementById('goalStart').value===''||isNaN(startValue)){
      startField.classList.add('invalid');
      startField.insertAdjacentHTML('beforeend', `<span class="field-error">Obrigatório</span>`);
      hasError = true;
    }
    if(document.getElementById('goalTarget').value===''||isNaN(targetValue)){
      targetField.classList.add('invalid');
      targetField.insertAdjacentHTML('beforeend', `<span class="field-error">Obrigatório</span>`);
      hasError = true;
    }
    if(hasError) return;
    state.bodyGoals = state.bodyGoals||[];
    state.bodyGoals.push({
      id:cryptoId(), metric, label:`${BodyProgress.METRIC_LABELS[metric]}: ${startValue} → ${targetValue}`,
      startValue, targetValue, startDate:todayKey(),
    });
    persist();
    closeModal();
    showToast('Meta criada', 'Acompanhe o progresso na aba Corpo.', '🎯');
    renderBodyProgress();
  });
}

function renderTimelineFeed(){
  const el = document.getElementById('timelineFeed');
  if(!el) return;
  const items = BodyProgress.timelineFeed().slice(0,20);
  if(items.length===0){ el.innerHTML = `<div class="empty-state"><span class="emoji">🕓</span>Sua linha do tempo aparece aqui conforme você registra fotos e medidas.</div>`; return; }
  el.innerHTML = items.map(item=>{
    let icon_, text;
    if(item.type==='photo'){ icon_='📸'; text=`Foto de progresso (${ANGLE_LABELS[item.data.angle]})`; }
    else if(item.type==='measurement'){ icon_='📏'; text='Medidas registradas'; }
    else if(item.type==='milestone'){ icon_=item.data.emoji; text=item.data.label; }
    else if(item.type==='pr'){ icon_='🏆'; text=item.data.label; }
    return `<div class="list-row"><div class="list-row-icon">${icon_}</div><div class="list-row-body"><div class="list-row-title">${text}</div><div class="list-row-sub">${fmtDate(item.date)}</div></div></div>`;
  }).join('');
}

function renderConquistas(){
  const c = document.getElementById('progressoTabContent');
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
      addXp(100);
      pushNotification('Conquista desbloqueada!', a.name, a.emoji);
    }
  });
  persist();
}

/* ======================================================================
   GAMIFICAÇÃO — XP, níveis e missões semanais
   ====================================================================== */
function xpForLevel(level){ return 50 * level * level; }

function levelFromXp(xp){
  let level = 1;
  while(xp >= xpForLevel(level+1)) level++;
  return level;
}

function xpProgress(xp){
  const level = levelFromXp(xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level+1);
  return {level, cur, next, pct: Math.min(100, Math.round((xp-cur)/(next-cur)*100))};
}

function addXp(amount){
  const before = levelFromXp(state.xp||0);
  state.xp = (state.xp||0) + amount;
  persist();
  const after = levelFromXp(state.xp);
  if(after > before){
    launchConfetti();
    pushNotification('Você subiu de nível!', `Agora você é nível ${after}.`, '⭐');
  }
}

function weekKey(d){ return todayKey(startOfWeek(d||new Date())); }

function getWeeklyMissions(){
  const wk = weekKey();
  const claimed = state.missionsClaimed[wk] || [];
  const start = startOfWeek(new Date());
  const end = new Date(start.getTime()+7*86400000);

  const daysThisWeek = Object.keys(state.completedDates).filter(k=>{
    const d = new Date(k+'T00:00:00');
    return d>=start && d<end;
  }).length;

  const newRecordThisWeek = Object.values(state.exerciseLoads).some(logs=>{
    const sorted = [...logs].sort((a,b)=>a.date.localeCompare(b.date));
    return sorted.some((l,i)=>{
      if(i===0) return false;
      const d = new Date(l.date+'T00:00:00');
      if(d<start || d>=end) return false;
      const prevMax = Math.max(0, ...sorted.slice(0,i).map(x=>x.weight));
      return l.weight>prevMax;
    });
  });

  const goalDoneThisWeek = state.goals.some(g=>g.done);

  const defs = [
    {id:'train3', label:'Treine 3 dias essa semana', progress:Math.min(daysThisWeek,3), total:3, done:daysThisWeek>=3, xp:40},
    {id:'record', label:'Bata uma nova carga em algum exercício', progress:newRecordThisWeek?1:0, total:1, done:newRecordThisWeek, xp:40},
    {id:'goal', label:'Conclua uma meta', progress:goalDoneThisWeek?1:0, total:1, done:goalDoneThisWeek, xp:30},
  ];
  return defs.map(m=>({...m, claimed:claimed.includes(m.id)}));
}

function claimMission(missionId){
  const wk = weekKey();
  const missions = getWeeklyMissions();
  const m = missions.find(x=>x.id===missionId);
  if(!m || !m.done || m.claimed) return;
  state.missionsClaimed[wk] = state.missionsClaimed[wk] || [];
  state.missionsClaimed[wk].push(missionId);
  persist();
  addXp(m.xp);
  showToast('Missão concluída!', `+${m.xp} XP`, '🎯');
}

/* ======================================================================
   INSIGHTS DE PROGRESSO — frases geradas a partir dos dados reais,
   em vez de só gráficos.
   ====================================================================== */
function generateInsights(){
  const insights = [];
  const streak = computeStreak(state.completedDates);

  if(streak>=3){
    insights.push({text:`Você está numa sequência de ${streak} dias treinando.`, tone:'default'});
  }

  const log = [...(state.weightLog||[])].sort((a,b)=>a.date.localeCompare(b.date));
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
  const recent = log.filter(l=>new Date(l.date+'T00:00:00')>=cutoff);
  if(recent.length>=2){
    const delta = recent[recent.length-1].weight - recent[0].weight;
    if(Math.abs(delta)>=0.3){
      const dir = delta<0 ? 'caiu' : 'subiu';
      insights.push({text:`Seu peso ${dir} ${WorkoutProgression.formatKg(Math.abs(delta))} no último mês.`, tone:'default'});
    }
  }

  let best = null;
  Object.keys(state.exerciseLoads).forEach(exId=>{
    const logs = [...state.exerciseLoads[exId]].sort((a,b)=>a.date.localeCompare(b.date));
    if(logs.length>=2){
      const first = logs[0].weight, last = logs[logs.length-1].weight;
      if(first>0){
        const pct = ((last-first)/first)*100;
        if(pct>=5 && (!best || pct>best.pct)){
          const e = findExercise(exId);
          best = {pct, name: e?e.name:exId};
        }
      }
    }
  });
  if(best){
    insights.push({text:`Você aumentou ${Math.round(best.pct)}% na carga do ${best.name}.`, tone:'success'});
  }

  const start = startOfWeek(new Date());
  const lastWeekStart = new Date(start.getTime()-7*86400000);
  const thisWeekCount = weekProgress().done;
  const lastWeekCount = Object.keys(state.completedDates).filter(k=>{
    const d = new Date(k+'T00:00:00');
    return d>=lastWeekStart && d<start;
  }).length;
  if(lastWeekCount>0 && thisWeekCount>lastWeekCount){
    insights.push({text:`Essa semana você já treinou ${thisWeekCount-lastWeekCount} vez(es) a mais que a semana passada.`, tone:'default'});
  }

  return insights.slice(0,3);
}

function lastWeekSummary(){
  const start = startOfWeek(new Date());
  const lastStart = new Date(start.getTime()-7*86400000);
  const sessions = state.history.filter(h=>{
    const d = new Date(h.date+'T00:00:00');
    return d>=lastStart && d<start;
  });
  const weightLog = [...(state.weightLog||[])].filter(l=>{
    const d = new Date(l.date+'T00:00:00');
    return d>=lastStart && d<start;
  }).sort((a,b)=>a.date.localeCompare(b.date));
  return {
    count: sessions.length,
    volume: sessions.reduce((a,s)=>a+s.volume,0),
    weightStart: weightLog[0]?.weight,
    weightEnd: weightLog[weightLog.length-1]?.weight,
  };
}

function renderTabConfig(){
  const c = document.getElementById('profileTabContent');
  c.innerHTML = `
    <div class="card" style="margin-bottom:14px;">
      <h4 style="margin-bottom:10px;font-size:13px;">Conta FitTrack</h4>
      <div class="list-row" style="padding:0;border:0;background:transparent;margin-bottom:12px;">
        <div class="list-row-icon">👤</div>
        <div class="list-row-body">
          <div class="list-row-title">${escapeHtml(authUser?.user_metadata?.name || state.user.name || 'Usuária FitTrack')}</div>
          <div class="list-row-sub">${escapeHtml(authUser?.email || 'Sessão Supabase ativa')}</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-block" id="logoutBtn">Sair da conta</button>
      <p style="font-size:11.5px;color:var(--text-faint);line-height:1.5;margin-top:8px;">Sair encerra a sessão, mas mantém seus treinos, medidas e histórico salvos neste aparelho.</p>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <div class="theme-toggle" id="cfgThemeToggle" style="cursor:pointer;">
        <span style="display:inline-flex;align-items:center;gap:8px;">${icon(state.user.theme==='light'?'sun':'moon',{size:16})}${state.user.theme==='light'?'Modo claro':'Modo escuro'}</span><div class="switch"></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <h4 style="margin-bottom:10px;font-size:13px;">Ajuste inicial</h4>
      <button class="btn btn-ghost btn-block" id="openOnboardingBtn">Refazer ajuste do FitTrack</button>
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
  document.getElementById('logoutBtn').addEventListener('click', async ()=>{
    const result = await AUTH.signOut();
    if(!result.ok) showToast('Não foi possível sair', result.message || 'Tente novamente.', '⚠️');
  });
  document.getElementById('cfgThemeToggle').addEventListener('click', ()=>{ toggleTheme(); renderTabConfig(); });
  document.getElementById('openOnboardingBtn').addEventListener('click', ()=>navigate('onboarding'));
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
        state = Object.assign(defaultState(authUser), imported);
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
      localStorage.removeItem(getStorageKey());
      state = defaultState(authUser);
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
  overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div><button class="modal-close" id="modalCloseBtn" aria-label="Fechar">${icon('x',{size:16})}</button><div id="modalBody">${innerHtml}</div></div>`;
  requestAnimationFrame(()=>overlay.classList.add('open'));
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  makeInteractiveElementsAccessible(overlay);
}
function closeModal(){
  const overlay = document.getElementById('modalOverlay');
  if(overlay) overlay.classList.remove('open');
}

/* ======================================================================
   Utils
   ====================================================================== */

document.addEventListener('DOMContentLoaded', boot);
