/* ==========================================================================
   FitTrack — Perfil no Supabase
   ==========================================================================
   Mantem o LocalStorage como fonte local imediata e usa public.profiles apenas
   para os dados de perfil do usuario autenticado.
   ========================================================================== */

const PROFILE = (function(){
  const SELECT_FIELDS = [
    'id',
    'display_name',
    'height_cm',
    'weight_kg',
    'start_weight_kg',
    'goal',
    'available_days',
    'avg_workout_time',
    'theme',
  ].join(',');

  function client(){
    return SupabaseClient.getClient();
  }

  function toNumberOrNull(value){
    if(value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function toIntOrNull(value){
    const number = toNumberOrNull(value);
    return number == null ? null : Math.round(number);
  }

  function rowFromUser(authUser, user){
    return {
      id: authUser.id,
      display_name: String(user.name || '').trim() || null,
      height_cm: toNumberOrNull(user.height),
      weight_kg: toNumberOrNull(user.weight),
      start_weight_kg: toNumberOrNull(user.startWeight),
      goal: user.goal || null,
      available_days: toIntOrNull(user.availableDays),
      avg_workout_time: toIntOrNull(user.avgWorkoutTime),
      theme: ['dark','light'].includes(user.theme) ? user.theme : null,
    };
  }

  function applyRowToUser(user, row){
    if(!row) return user;
    const next = Object.assign({}, user);
    if(row.display_name) next.name = row.display_name;
    if(row.height_cm != null) next.height = Number(row.height_cm);
    if(row.weight_kg != null) next.weight = Number(row.weight_kg);
    if(row.start_weight_kg != null) next.startWeight = Number(row.start_weight_kg);
    if(row.goal) next.goal = row.goal;
    if(row.available_days != null) next.availableDays = Number(row.available_days);
    if(row.avg_workout_time != null) next.avgWorkoutTime = Number(row.avg_workout_time);
    if(row.theme) next.theme = row.theme;
    return next;
  }

  async function load(authUser){
    const supabase = client();
    if(!supabase || !authUser) return {ok:false, skipped:true};
    try{
      const {data, error} = await supabase
        .from('profiles')
        .select(SELECT_FIELDS)
        .eq('id', authUser.id)
        .maybeSingle();
      if(error) throw error;
      return {ok:true, profile:data || null};
    }catch(error){
      console.error('[FitTrack Profile] load', error);
      return {ok:false, message:'Nao foi possivel carregar o perfil do Supabase.'};
    }
  }

  async function save(authUser, user){
    const supabase = client();
    if(!supabase || !authUser) return {ok:false, skipped:true};
    try{
      const {data, error} = await supabase
        .from('profiles')
        .upsert(rowFromUser(authUser, user), {onConflict:'id'})
        .select(SELECT_FIELDS)
        .single();
      if(error) throw error;
      return {ok:true, profile:data || null};
    }catch(error){
      console.error('[FitTrack Profile] save', error);
      return {ok:false, message:'Perfil salvo neste aparelho, mas nao foi possivel enviar ao Supabase.'};
    }
  }

  return {load, save, applyRowToUser, rowFromUser};
})();
