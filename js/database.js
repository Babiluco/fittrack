/* ==========================================================================
   FitTrack — Camada de banco de dados (abstração sobre o localStorage)
   ==========================================================================
   Responsabilidade: ser o único ponto de leitura/escrita de dados do app,
   com nomes de método que descrevem a AÇÃO (saveWorkout, loadProfile...),
   não a tecnologia por trás. Hoje por baixo dos panos ainda é tudo
   `state` + `persist()` (ver storage.js) como base local. Alguns fluxos ja
   podem acionar Supabase depois que o dado local fica salvo.

   IMPORTANTE: nesta primeira etapa o resto do app (app.js) continua
   também podendo usar `state`/`persist()` direto, como sempre fez — nada
   foi migrado à força pra cá ainda, pra não arriscar quebrar telas que já
   funcionam. Este arquivo é a base pronta pra migração ser feita aos
   poucos, função por função, quando fizer sentido.
   ========================================================================== */

const DB = {
  /* ---- Treinos (sessões concluídas) -------------------------------- */
  saveWorkout(session){
    if(!session) return null;
    if(typeof SYNC !== 'undefined' && typeof SYNC.prepareWorkoutForSync === 'function'){
      SYNC.prepareWorkoutForSync(session);
    }
    state.history.push(session);
    const ok = persist();
    if(!ok) return null;
    if(CONFIG.FEATURES.CLOUD_SYNC && typeof SYNC !== 'undefined' && typeof SYNC.syncWorkout === 'function'){
      SYNC.syncWorkout(session).then(result=>{
        if(result && result.syncedAt){
          session.syncedAt = result.syncedAt;
          persist();
        }
      }).catch(error=>{
        console.error('[FitTrack DB] syncWorkout', error);
      });
    }
    return session;
  },
  deleteWorkout(sessionId){
    state.history = state.history.filter(h=>h.id!==sessionId);
    persist();
  },
  loadWorkouts(){
    return state.history;
  },

  /* ---- Perfil -------------------------------------------------------- */
  loadProfile(){
    return state.user;
  },
  saveProfile(partialUser){
    Object.assign(state.user, partialUser);
    persist();
    if(typeof saveSupabaseProfileQuietly === 'function') saveSupabaseProfileQuietly();
    return state.user;
  },

  /* ---- Peso e medidas corporais --------------------------------------- */
  saveWeight(weight, date){
    state.weightLog.push({date: date || todayKey(), weight});
    state.user.weight = weight;
    persist();
    if(typeof saveSupabaseProfileQuietly === 'function') saveSupabaseProfileQuietly();
  },
  loadWeightHistory(){
    return state.weightLog;
  },
  saveMeasurements(entry){
    state.measurements = state.measurements || [];
    state.measurements.push(entry);
    persist();
    return entry;
  },
  loadMeasurements(){
    return state.measurements || [];
  },

  /* ---- Treinos e Progresso / exercícios ---------------------------- */
  updateExercise(templateId, exercises){
    // reaproveita a função que já existe em app.js pra não duplicar a
    // lógica de override vs. treino próprio
    persistTemplateExercises(templateId, exercises);
  },
  deleteWorkoutTemplate(templateId){
    if(!isCustomTemplate(templateId)) return false;
    delete state.customTemplates[templateId];
    Object.keys(state.weekPlan).forEach(day=>{
      if(state.weekPlan[day]===templateId) state.weekPlan[day]='descanso';
    });
    persist();
    return true;
  },

  /* ---- Estatísticas ---------------------------------------------------- */
  getStatistics(){
    return {
      streak: computeStreak(state.completedDates),
      bestStreak: state.bestStreak||0,
      totalWorkouts: state.history.length,
      xp: state.xp||0,
      level: levelFromXp(state.xp||0),
    };
  },
}; 
