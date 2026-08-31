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
    return this.importWorkoutsFromSupabase();
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
    state.syncQueue.goals = Array.isArray(state.syncQueue.goals) ? state.syncQueue.goals : [];
    state.syncQueue.deletedGoals = Array.isArray(state.syncQueue.deletedGoals) ? state.syncQueue.deletedGoals : [];
    if(!('lastError' in state.syncQueue)) state.syncQueue.lastError = null;
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
  queueUnsyncedWorkouts(){
    const localWorkouts = (state.history||[]).filter(session=>session && !session.syncedAt);
    localWorkouts.forEach(session=>this.queueWorkout(session));
    return localWorkouts.length;
  },
  prepareGoalForSync(goal){
    if(!goal) return goal;
    goal.supabaseId = ensureUuid(goal.supabaseId);
    return goal;
  },
  queueGoal(goal){
    if(!goal) return false;
    this.prepareGoalForSync(goal);
    const queue = this.ensureQueue();
    const key = goal.supabaseId || goal.id;
    if(!key) return false;
    if(!queue.goals.includes(key)){
      queue.goals.push(key);
      persist();
    }
    return true;
  },
  unqueueGoal(goal){
    if(!goal || !state.syncQueue) return;
    const keys = [goal.supabaseId, goal.id].filter(Boolean);
    state.syncQueue.goals = (state.syncQueue.goals||[]).filter(key=>!keys.includes(key));
    persist();
  },
  queueDeletedGoal(goal){
    if(!goal) return false;
    const queue = this.ensureQueue();
    const key = goal.supabaseId || (isUuid(goal.id) ? goal.id : null);
    if(!key) return false;
    queue.goals = queue.goals.filter(item=>item!==key);
    if(!queue.deletedGoals.includes(key)) queue.deletedGoals.push(key);
    persist();
    return true;
  },
  pendingGoalItems(){
    const queue = this.ensureQueue();
    return queue.goals
      .map(key=>(state.goals||[]).find(goal=>goal && (goal.supabaseId===key || goal.id===key)))
      .filter(Boolean);
  },
  queueUnsyncedGoals(){
    const goals = state.goals || [];
    goals.forEach(goal=>{
      if(!goal.syncedAt) this.queueGoal(goal);
    });
    return goals.filter(goal=>goal && !goal.syncedAt).length;
  },
  async syncGoal(goal){
    const supabase = SupabaseClient.getClient();
    if(!supabase || !goal) return {ok:false, synced:false, skipped:true, message:'Cliente Supabase indisponível.'};

    const user = await currentAuthUser();
    if(!user) return {ok:false, synced:false, skipped:true, message:'Usuário não autenticado.'};

    this.prepareGoalForSync(goal);
    const status = goal.done ? 'completed' : 'active';
    const payloads = goalPayloadVariants(goal, user.id, status);

    for(const payload of payloads){
      const {error} = await supabase
        .from('goals')
        .upsert(payload, {onConflict:'id'});
      if(!error){
        return {ok:true, synced:true, syncedAt:new Date().toISOString()};
      }
      if(!isColumnShapeError(error)){
        const queue = this.ensureQueue();
        queue.lastError = error.message || 'Erro ao enviar meta ao Supabase.';
        persist();
        return {ok:false, synced:false, message:queue.lastError};
      }
    }

    const queue = this.ensureQueue();
    queue.lastError = 'A tabela goals não aceitou os campos esperados pelo app.';
    persist();
    return {ok:false, synced:false, message:queue.lastError};
  },
  async deleteRemoteGoal(goalId){
    const supabase = SupabaseClient.getClient();
    if(!supabase || !goalId) return {ok:false, deleted:false, skipped:true};
    const user = await currentAuthUser();
    if(!user) return {ok:false, deleted:false, skipped:true};
    const {error} = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId)
      .eq('user_id', user.id);
    if(error){
      const queue = this.ensureQueue();
      queue.lastError = error.message || 'Erro ao excluir meta no Supabase.';
      persist();
      return {ok:false, deleted:false, message:queue.lastError};
    }
    return {ok:true, deleted:true};
  },
  async flushGoalQueue(){
    if(!CONFIG.FEATURES.CLOUD_SYNC) return {ok:false, synced:false, skipped:true};
    if(typeof navigator !== 'undefined' && navigator.onLine === false) return {ok:false, synced:false, offline:true};

    const queue = this.ensureQueue();
    queue.lastAttemptAt = new Date().toISOString();
    queue.lastError = null;
    persist();

    let synced = 0;
    let failed = 0;
    for(const goalId of [...queue.deletedGoals]){
      const result = await this.deleteRemoteGoal(goalId);
      if(result.ok){
        queue.deletedGoals = queue.deletedGoals.filter(id=>id!==goalId);
        synced++;
      } else {
        failed++;
      }
    }

    for(const goal of this.pendingGoalItems()){
      const result = await this.syncGoal(goal);
      if(result && result.syncedAt){
        goal.syncedAt = result.syncedAt;
        this.unqueueGoal(goal);
        synced++;
      } else {
        failed++;
      }
    }

    persist();
    return {ok:failed===0, synced:synced>0, syncedCount:synced, failedCount:failed};
  },
  async importGoalsFromSupabase(){
    const supabase = SupabaseClient.getClient();
    if(!supabase) return {ok:false, imported:false, skipped:true, message:'Cliente Supabase indisponível.'};

    const user = await currentAuthUser();
    if(!user) return {ok:false, imported:false, skipped:true, message:'Usuário não autenticado.'};

    try{
      const {data, error} = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id);
      if(error) throw error;
      if(!data || !data.length) return {ok:true, imported:false, importedCount:0};

      state.goals = state.goals || [];
      let importedCount = 0;
      data.forEach(row=>{
        const text = row.title || row.text || row.name || row.description || 'Meta';
        const done = row.status === 'completed' || row.status === 'done' || row.completed === true;
        const existing = state.goals.find(goal=>goal && (goal.supabaseId === row.id || goal.id === row.id));
        if(existing){
          existing.supabaseId = row.id;
          existing.text = text;
          existing.done = done;
          existing.category = row.category || existing.category || 'geral';
          existing.syncedAt = new Date().toISOString();
          return;
        }
        state.goals.push({
          id: row.id,
          supabaseId: row.id,
          text,
          done,
          category: row.category || 'geral',
          syncedAt: new Date().toISOString(),
        });
        importedCount++;
      });
      if(!importedCount) return {ok:true, imported:false, importedCount:0};

      persist();
      return {ok:true, imported:true, importedCount};
    }catch(error){
      console.error('[FitTrack Sync] importGoalsFromSupabase', error);
      const queue = this.ensureQueue();
      queue.lastError = error?.message || 'Erro ao importar metas do Supabase.';
      persist();
      return {ok:false, imported:false, message:queue.lastError};
    }
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
    queue.lastError = null;
    for(const session of pending){
      const result = await this.syncWorkout(session, {fromQueue:true});
      if(result && result.syncedAt){
        session.syncedAt = result.syncedAt;
        this.unqueueWorkout(session);
        synced++;
      } else {
        queue.lastError = result?.message || 'Não foi possível enviar um treino pendente.';
        failed++;
      }
    }
    persist();
    return {ok:failed===0, synced:synced>0, syncedCount:synced, failedCount:failed};
  },
  async importWorkoutsFromSupabase(){
    const supabase = SupabaseClient.getClient();
    if(!supabase) return {ok:false, imported:false, skipped:true, message:'Cliente Supabase indisponível.'};

    const user = await currentAuthUser();
    if(!user) return {ok:false, imported:false, skipped:true, message:'Usuário não autenticado.'};

    try{
      const {data: workouts, error: workoutsError} = await supabase
        .from('workouts')
        .select('id,user_id,name,started_at,completed_at,duration_seconds,total_load,total_reps,training_volume,calories')
        .eq('user_id', user.id)
        .order('completed_at', {ascending:false});
      if(workoutsError) throw workoutsError;
      if(!workouts || !workouts.length) return {ok:true, imported:false, importedCount:0};

      const workoutIds = workouts.map(row=>row.id).filter(Boolean);
      const {data: workoutExercises, error: exercisesError} = await supabase
        .from('workout_exercises')
        .select('id,workout_id,exercise_id,exercise_name,muscle_group,exercise_order')
        .in('workout_id', workoutIds)
        .order('exercise_order', {ascending:true});
      if(exercisesError) throw exercisesError;

      const workoutExerciseIds = (workoutExercises||[]).map(row=>row.id).filter(Boolean);
      let workoutSets = [];
      if(workoutExerciseIds.length){
        const {data: sets, error: setsError} = await supabase
          .from('workout_sets')
          .select('id,workout_exercise_id,set_number,weight,reps,completed')
          .in('workout_exercise_id', workoutExerciseIds)
          .order('set_number', {ascending:true});
        if(setsError) throw setsError;
        workoutSets = sets || [];
      }

      const existingKeys = new Set((state.history||[]).flatMap(session=>[session.id, session.supabaseId].filter(Boolean)));
      const imported = [];
      workouts.forEach(workout=>{
        if(existingKeys.has(workout.id)) return;
        const exerciseRows = (workoutExercises||[])
          .filter(row=>row.workout_id === workout.id)
          .sort((a,b)=>(Number(a.exercise_order)||0) - (Number(b.exercise_order)||0));
        const exercisesLog = exerciseRows.map(exerciseRow=>{
          const matchedExercise = matchExerciseFromRemote(exerciseRow);
          const setRows = workoutSets
            .filter(row=>row.workout_exercise_id === exerciseRow.id)
            .sort((a,b)=>(Number(a.set_number)||0) - (Number(b.set_number)||0));
          return {
            exerciseId: exerciseRow.exercise_id || matchedExercise?.id || `remote_${exerciseRow.id}`,
            exerciseName: exerciseRow.exercise_name || matchedExercise?.name || 'Exercício',
            muscle: exerciseRow.muscle_group || matchedExercise?.muscle || null,
            supabaseId: exerciseRow.id,
            sets: setRows.map(set=>({
              supabaseId: set.id,
              weight: numberOrNull(set.weight) || 0,
              reps: Number.isFinite(Number(set.reps)) ? Math.max(0, Math.round(Number(set.reps))) : 0,
              notes:'',
              done: set.completed !== false,
              skipped: false,
            })),
          };
        });
        imported.push({
          id: workout.id,
          supabaseId: workout.id,
          templateId: 'remote_workout',
          name: workout.name || 'Treino',
          date: dateKeyFromIso(workout.completed_at || workout.started_at),
          startedAt: workout.started_at || workout.completed_at || null,
          completedAt: workout.completed_at || workout.started_at || null,
          duration: Math.max(1, Math.round((Number(workout.duration_seconds)||0) / 60)),
          volume: Number(workout.training_volume)||0,
          calories: Number(workout.calories)||0,
          exercisesLog,
          syncedAt: new Date().toISOString(),
        });
      });

      if(!imported.length) return {ok:true, imported:false, importedCount:0};

      state.history = (state.history||[]).concat(imported)
        .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      imported.forEach(session=>{
        if(session.date && !state.completedDates[session.date]){
          state.completedDates[session.date] = session.templateId;
        }
      });
      persist();
      return {ok:true, imported:true, importedCount:imported.length};
    }catch(error){
      console.error('[FitTrack Sync] importWorkoutsFromSupabase', error);
      const queue = this.ensureQueue();
      queue.lastError = error?.message || 'Erro ao importar treinos do Supabase.';
      persist();
      return {ok:false, imported:false, message:queue.lastError};
    }
  },
  async syncWorkout(session, options){
    const supabase = SupabaseClient.getClient();
    if(!supabase || !session) return {ok:false, synced:false, skipped:true, message:'Cliente Supabase indisponível.'};

    const user = await currentAuthUser();
    if(!user) return {ok:false, synced:false, skipped:true, message:'Usuário não autenticado.'};

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
      const queue = this.ensureQueue();
      queue.lastError = error?.message || 'Erro ao enviar treino ao Supabase.';
      if(!options?.fromQueue) this.queueWorkout(session);
      return {ok:false, synced:false, message:queue.lastError};
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
  async syncGoals(){
    this.queueUnsyncedGoals();
    const queueResult = await this.flushGoalQueue();
    const importResult = await this.importGoalsFromSupabase();
    return Object.assign({}, queueResult||{}, importResult||{});
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

function dateKeyFromIso(value){
  if(!value) return todayKey();
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return todayKey();
  const year = date.getFullYear();
  const month = String(date.getMonth()+1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function matchExerciseFromRemote(row){
  if(row?.exercise_id && typeof findExercise === 'function'){
    const byId = findExercise(row.exercise_id);
    if(byId) return byId;
  }
  const remoteName = normalizeText(row?.exercise_name || '');
  if(!remoteName || typeof EXERCISE_LIBRARY === 'undefined') return null;
  return EXERCISE_LIBRARY.find(ex=>normalizeText(ex.name) === remoteName) || null;
}

function normalizeText(value){
  return String(value||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function goalPayloadVariants(goal, userId, status){
  const base = {
    id: goal.supabaseId,
    user_id: userId,
    status,
    category: goal.category || 'geral',
  };
  const text = goal.text || goal.label || 'Meta';
  return [
    Object.assign({}, base, {title:text}),
    Object.assign({}, base, {text}),
    {id:base.id, user_id:base.user_id, status:base.status, title:text},
    {id:base.id, user_id:base.user_id, status:base.status, text},
  ];
}

function isColumnShapeError(error){
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return code === 'PGRST204' ||
    code === '42703' ||
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('could not find');
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
