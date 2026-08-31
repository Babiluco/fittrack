/* ==========================================================================
   FitTrack — Camada de sincronização (preparação para nuvem futura)
   ==========================================================================
   Responsabilidade: enviar ao Supabase somente os dados que ja foram
   explicitamente habilitados para nuvem. Nesta etapa, apenas novos treinos
   concluidos usam workouts, workout_exercises e workout_sets.
   ========================================================================== */

const SYNC = {
  async syncProfile(){
    log('[Sync mock] syncProfile — app ainda é 100% offline');
    return {ok:true, synced:false, mock:true};
  },
  async syncWorkouts(){
    log('[Sync mock] syncWorkouts');
    return {ok:true, synced:false, mock:true};
  },
  prepareWorkoutForSync(session){
    if(!session) return session;
    session.supabaseId = ensureUuid(session.supabaseId);
    (session.exercisesLog||[]).forEach(exLog=>{
      exLog.supabaseId = ensureUuid(exLog.supabaseId);
      (exLog.sets||[]).forEach(set=>{
        set.supabaseId = ensureUuid(set.supabaseId);
      });
    });
    return session;
  },
  ensureQueue(){
    state.syncQueue = state.syncQueue && typeof state.syncQueue === 'object'
      ? state.syncQueue
      : {workouts:[], lastAttemptAt:null};
    state.syncQueue.workouts = Array.isArray(state.syncQueue.workouts) ? state.syncQueue.workouts : [];
    return state.syncQueue;
  },
  queueWorkout(session){
    if(!session) return false;
    this.prepareWorkoutForSync(session);
    const queue = this.ensureQueue();
    const key = session.supabaseId || session.id;
    if(!key) return false;
    if(!queue.workouts.includes(key)){
      queue.workouts.push(key);
      persist();
    }
    return true;
  },
  unqueueWorkout(session){
    if(!session || !state.syncQueue) return;
    const keys = [session.supabaseId, session.id].filter(Boolean);
    state.syncQueue.workouts = (state.syncQueue.workouts||[]).filter(key=>!keys.includes(key));
    persist();
  },
  pendingWorkoutSessions(){
    const queue = this.ensureQueue();
    return queue.workouts
      .map(key=>(state.history||[]).find(session=>session && (session.supabaseId===key || session.id===key)))
      .filter(Boolean);
  },
  async flushWorkoutQueue(){
    if(!CONFIG.FEATURES.CLOUD_SYNC) return {ok:false, synced:false, skipped:true};
    if(typeof navigator !== 'undefined' && navigator.onLine === false) return {ok:false, synced:false, offline:true};

    const queue = this.ensureQueue();
    const pending = this.pendingWorkoutSessions();
    if(!pending.length) return {ok:true, synced:false, empty:true};

    queue.lastAttemptAt = new Date().toISOString();
    persist();

    let synced = 0;
    let failed = 0;
    for(const session of pending){
      const result = await this.syncWorkout(session, {fromQueue:true});
      if(result && result.syncedAt){
        session.syncedAt = result.syncedAt;
        this.unqueueWorkout(session);
        synced++;
      } else {
        failed++;
      }
    }
    persist();
    return {ok:failed===0, synced:synced>0, syncedCount:synced, failedCount:failed};
  },
  async syncWorkout(session, options){
    const supabase = SupabaseClient.getClient();
    if(!supabase || !session) return {ok:false, synced:false, skipped:true};

    const user = await currentAuthUser();
    if(!user) return {ok:false, synced:false, skipped:true};

    this.prepareWorkoutForSync(session);
    const metrics = workoutMetrics(session);
    const completedAt = isoFromSessionDate(session.date);
    const startedAt = session.startedAt || completedAt;

    try{
      const {error: workoutError} = await supabase
        .from('workouts')
        .upsert({
          id: session.supabaseId,
          user_id: user.id,
          name: session.name || 'Treino',
          started_at: startedAt,
          completed_at: session.completedAt || completedAt,
          duration_seconds: Math.max(0, Math.round(Number(session.duration||0) * 60)),
          total_load: metrics.totalLoad,
          total_reps: metrics.totalReps,
          training_volume: metrics.trainingVolume,
          calories: Number(session.calories)||0,
        }, {onConflict:'id'});
      if(workoutError) throw workoutError;

      for(const [exerciseIndex, exerciseLog] of (session.exercisesLog||[]).entries()){
        const exercise = typeof findExercise === 'function' ? findExercise(exerciseLog.exerciseId) : null;
        const {error: exerciseError} = await supabase
          .from('workout_exercises')
          .upsert({
            id: exerciseLog.supabaseId,
            workout_id: session.supabaseId,
            exercise_id: null,
            exercise_name: exercise?.name || exerciseLog.exerciseName || exerciseLog.exerciseId || 'Exercicio',
            muscle_group: exercise?.muscle || exerciseLog.muscle || null,
            exercise_order: exerciseIndex,
          }, {onConflict:'id'});
        if(exerciseError) throw exerciseError;

        const setRows = (exerciseLog.sets||[]).map((set, setIndex)=>({
          id: set.supabaseId,
          workout_exercise_id: exerciseLog.supabaseId,
          set_number: setIndex + 1,
          weight: numberOrNull(set.weight),
          reps: Number.isFinite(Number(set.reps)) ? Math.max(0, Math.round(Number(set.reps))) : null,
          completed: !!set.done && !set.skipped,
        }));
        if(setRows.length){
          const {error: setsError} = await supabase
            .from('workout_sets')
            .upsert(setRows, {onConflict:'id'});
          if(setsError) throw setsError;
        }
      }

      return {ok:true, synced:true, syncedAt:new Date().toISOString()};
    }catch(error){
      console.error('[FitTrack Sync] syncWorkout', error);
      if(!options?.fromQueue) this.queueWorkout(session);
      return {ok:false, synced:false, message:'Treino salvo neste aparelho, mas nao enviado ao Supabase.'};
    }
  },
  async syncStatistics(){
    log('[Sync mock] syncStatistics');
    return {ok:true, synced:false, mock:true};
  },
  async syncMeasurements(){
    log('[Sync mock] syncMeasurements');
    return {ok:true, synced:false, mock:true};
  },
}; 

function ensureUuid(value){
  if(isUuid(value)) return value;
  if(typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0;
    const v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

function isUuid(value){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''));
}

function numberOrNull(value){
  if(value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function currentAuthUser(){
  if(typeof authUser !== 'undefined' && authUser) return Promise.resolve(authUser);
  if(typeof AUTH !== 'undefined' && typeof AUTH.getCurrentUser === 'function') return AUTH.getCurrentUser();
  return Promise.resolve(null);
}

function isoFromSessionDate(dateKey){
  if(!dateKey) return new Date().toISOString();
  return new Date(`${dateKey}T12:00:00`).toISOString();
}

function workoutMetrics(session){
  const sets = (session.exercisesLog||[])
    .flatMap(ex=>ex.sets||[])
    .filter(set=>set && set.done && !set.skipped);
  return {
    totalLoad: sets.reduce((sum,set)=>sum+(Number(set.weight)||0),0),
    totalReps: sets.reduce((sum,set)=>sum+(Number(set.reps)||0),0),
    trainingVolume: sets.reduce((sum,set)=>sum+((Number(set.weight)||0)*(Number(set.reps)||0)),0),
  };
}
