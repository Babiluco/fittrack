/* ==========================================================================
   FitTrack — Camada de banco de dados (abstração sobre o localStorage)
   ==========================================================================
   Responsabilidade: ser o único ponto de leitura/escrita de dados do app,
   com nomes de método que descrevem a AÇÃO (saveWorkout, loadProfile...),
   não a tecnologia por trás. Hoje por baixo dos panos ainda é tudo
   `state` + `persist()` (ver storage.js) — funcional de verdade, não é
   simulação. O objetivo é que, no futuro, só esse arquivo precise mudar
   pra trocar o localStorage por um backend real (ex: Supabase); as telas
   não vão precisar saber a diferença.

   IMPORTANTE: nesta primeira etapa o resto do app (app.js) continua
   também podendo usar `state`/`persist()` direto, como sempre fez — nada
   foi migrado à força pra cá ainda, pra não arriscar quebrar telas que já
   funcionam. Este arquivo é a base pronta pra migração ser feita aos
   poucos, função por função, quando fizer sentido.
   ========================================================================== */

const DB = {
  /* ---- Treinos (sessões concluídas) -------------------------------- */
  saveWorkout(session){
    state.history.push(session);
    persist();
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
