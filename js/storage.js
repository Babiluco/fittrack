/* ==========================================================================
   FitTrack — Persistência (LocalStorage)
   ========================================================================== */

const STORAGE_KEY = CONFIG.STORAGE_KEY;

function defaultState(){
  return {
    version:1,
    user:{
      name:'Barbara',
      height:165,
      weight:64,
      startWeight:68,
      goal:'hipertrofia',
      availableDays:5,
      avgWorkoutTime:50,
      theme:'dark',
    },
    weekPlan: JSON.parse(JSON.stringify(DEFAULT_WEEK_PLAN)),
    templateOverrides:{},      // { templateId: { exercises:[...] } } — Treinos e Progresso pelo usuário
    customTemplates:{},        // { templateId: {...} } — treinos criados do zero (ex: duplicados)
    customExercises:[],        // exercícios criados pelo usuário, no mesmo formato de EXERCISE_LIBRARY
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
    notifications:[],
    lastSeenNotif:0,
  };
}



function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // merge defaults for forward-compat
    return Object.assign(defaultState(), parsed, {
      user: Object.assign(defaultState().user, parsed.user||{}),
    });
  }catch(e){
    console.error('Erro ao carregar dados', e);
    return defaultState();
  }
}

function saveState(state){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
