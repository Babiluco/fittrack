/* ==========================================================================
   FitTrack — Persistência (LocalStorage)
   ========================================================================== */

const STORAGE_KEY = CONFIG.STORAGE_KEY;
const LEGACY_STORAGE_KEY = CONFIG.STORAGE_KEY;
const LEGACY_OWNER_KEY = `${CONFIG.STORAGE_KEY}:legacy_owner`;
let activeStorageKey = LEGACY_STORAGE_KEY;

function defaultUser(authUser){
  const meta = authUser?.user_metadata || {};
  const emailName = authUser?.email ? authUser.email.split('@')[0] : '';
  return {
    name: meta.name || meta.display_name || emailName || 'Usuária FitTrack',
    height:'',
    weight:'',
    startWeight:'',
    goal:'hipertrofia',
    availableDays:3,
    avgWorkoutTime:45,
    level:'iniciante',
    focusAreas:[],
    limitations:[],
    theme:'dark',
  };
}

function defaultState(authUser){
  return {
    version:1,
    user: defaultUser(authUser),
    weekPlan: JSON.parse(JSON.stringify(DEFAULT_WEEK_PLAN)),
    templateOverrides:{},      // { templateId: { exercises:[...] } } — Treinos e Progresso pelo usuário
    customTemplates:{},        // { templateId: {...} } — treinos criados do zero (ex: duplicados)
    customExercises:[],        // exercícios criados pelo usuário, no mesmo formato de EXERCISE_LIBRARY
    favoriteExercises:[],      // ids de exercícios favoritos
    favoriteWorkouts:[],       // ids de treinos favoritos
    onboarding:{
      completed:false,
      completedAt:null,
    },
    completedDates:{},        // { 'YYYY-MM-DD': workoutTemplateId }
    history:[],                // sessões completas
    goals:[
      {id:cryptoId(), text:'Treinar 5 dias essa semana', done:false, category:'treino'},
      {id:cryptoId(), text:'Beber 2L de água por dia', done:false, category:'saude'},
      {id:cryptoId(), text:'Dormir 8 horas', done:false, category:'saude'},
      {id:cryptoId(), text:'Fazer cardio 2x na semana', done:false, category:'treino'},
    ],
    checkins:{},                // { 'YYYY-MM-DD': moodId }
    weightLog:[],                // [{date, weight}]
    measurements:[],             // [{date, weight, bodyFat, chest, waist, hip, shoulders, neck, armL, armR, forearmL, forearmR, thighL, thighR, calfL, calfR}] — medidas corporais (campos antigos arm/hips/thigh mantidos como legado)
    progressPhotos:[],           // [{id, date, angle:'front'|'side'|'back'|'custom', customLabel, weight, bodyFat, notes, image(dataURL já comprimida), hidden}]
    bodyGoals:[],                 // [{id, type, label, startValue, targetValue, unit, startDate, done}]
    unlockedMilestones:[],        // ids de marcos de transformação já desbloqueados (ver photos.js)
    scheduleOverrides:{},        // { 'YYYY-MM-DD': {type:'workout',templateId} | {type:'rest'} | {type:'cardio'} | {type:'mobility'} | {type:'custom',label} }
    rescheduleDismissed:{},      // { 'YYYY-MM-DD': true } — dias perdidos que a pessoa já dispensou a sugestão de remarcar
    activeWorkoutSession:null,   // treino em andamento (sobrevive a fechar o app/navegador) — ver openRunner/persistRunnerSession em app.js
    unlockedAchievements:[],
    fullWeeksCompleted:0,
    xp:0,                        // pontos de experiência (gamificação)
    bestStreak:0,                // maior sequência de dias já alcançada
    missionsClaimed:{},          // { 'YYYY-MM-DD' (início da semana): [missionId,...] }
    exerciseLoads:{},            // { exerciseId: [{date, weight, reps, notes}] }
    syncQueue:{
      workouts:[],               // ids/supabaseIds de treinos salvos localmente e ainda pendentes de envio
      goals:[],                  // ids/supabaseIds de metas pendentes de envio
      deletedGoals:[],           // ids/supabaseIds de metas removidas localmente e pendentes de exclusão remota
      lastAttemptAt:null,
    },
    notifications:[],
    lastSeenNotif:0,
  };
}

function storageKeyForUser(userId){
  if(!userId) return LEGACY_STORAGE_KEY;
  return `${LEGACY_STORAGE_KEY}:user:${userId}`;
}

function getStorageKey(){
  return activeStorageKey;
}

function mergeStoredState(parsed, authUser){
  return Object.assign(defaultState(authUser), parsed, {
    user: Object.assign(defaultState(authUser).user, parsed.user||{}),
  });
}

function loadStateFromKey(key, authUser){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return defaultState(authUser);
    const parsed = JSON.parse(raw);
    return mergeStoredState(parsed, authUser);
  }catch(e){
    console.error('Erro ao carregar dados', e);
    return defaultState(authUser);
  }
}

function loadState(){
  return loadStateFromKey(activeStorageKey, null);
}

function legacyStateLooksLikeBarbara(legacyState, authUser){
  const legacyUserName = String(legacyState?.user?.name || '').toLowerCase();
  const authName = String(authUser?.user_metadata?.name || authUser?.user_metadata?.display_name || '').toLowerCase();
  const emailName = String(authUser?.email || '').split('@')[0].toLowerCase();
  if(authName && legacyUserName && authName === legacyUserName) return true;
  return authName.includes('barbara') || emailName.includes('barbara');
}

function shouldUseLegacyStateForUser(authUser, legacyState){
  if(!authUser || !legacyState) return false;
  const ownerId = localStorage.getItem(LEGACY_OWNER_KEY);
  if(ownerId) return ownerId === authUser.id;
  return legacyStateLooksLikeBarbara(legacyState, authUser);
}

function activateUserStorage(authUser){
  if(!authUser){
    activeStorageKey = LEGACY_STORAGE_KEY;
    return loadStateFromKey(activeStorageKey, null);
  }

  const userKey = storageKeyForUser(authUser.id);
  activeStorageKey = userKey;
  const userRaw = localStorage.getItem(userKey);
  if(userRaw) return loadStateFromKey(userKey, authUser);

  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if(legacyRaw){
    try{
      const legacyParsed = JSON.parse(legacyRaw);
      if(shouldUseLegacyStateForUser(authUser, legacyParsed)){
        localStorage.setItem(LEGACY_OWNER_KEY, authUser.id);
        localStorage.setItem(userKey, legacyRaw);
        return mergeStoredState(legacyParsed, authUser);
      }
    }catch(e){
      console.error('Erro ao avaliar dados locais legados', e);
    }
  }

  return defaultState(authUser);
}

function saveState(state){
  try{
    localStorage.setItem(activeStorageKey, JSON.stringify(state));
    return true;
  }catch(e){
    console.error('Erro ao salvar dados', e);
    return false;
  }
}


function computeStreak(completedDates){
  let streak = 0;
  let d = new Date();
  // if today not done yet, start counting from yesterday
  if(!completedDates[todayKey(d)]){
    d.setDate(d.getDate()-1);
  }
  while(true){
    const key = todayKey(d);
    const wasRestDay = getTemplate(state.weekPlan[d.getDay()])?.id === 'descanso';
    if(completedDates[key]){
      streak++;
      d.setDate(d.getDate()-1);
    } else if(wasRestDay){
      d.setDate(d.getDate()-1);
    } else {
      break;
    }
  }
  return streak;
}
