/* ==========================================================================
   FitTrack — Persistência (LocalStorage)
   ========================================================================== */

const STORAGE_KEY = 'fittrack_state_v1';

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
    templateOverrides:{},      // { templateId: { exercises:[...] } } — treinos personalizados pelo usuário
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
    unlockedAchievements:[],
    fullWeeksCompleted:0,
    exerciseLoads:{},            // { exerciseId: [{date, weight, reps, notes}] }
    notifications:[],
    lastSeenNotif:0,
  };
}

function cryptoId(){
  return 'id_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
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

function todayKey(d){
  const date = d || new Date();
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
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
