/* ==========================================================================
   FitTrack — Progressão e recordes durante o treino
   ========================================================================== */

const WorkoutProgression = (function(){
  function doneSets(sets){
    return (sets||[]).filter(s=>s && s.done && !s.skipped && Number(s.weight)>=0 && Number(s.reps)>0);
  }

  function setVolume(set){
    return Number(set.weight||0) * Number(set.reps||0);
  }

  function estimatedOneRepMax(set){
    const weight = Number(set.weight)||0;
    const reps = Number(set.reps)||0;
    if(weight<=0 || reps<=0) return 0;
    return weight * (1 + reps / 30);
  }

  function exerciseSessions(history, exerciseId, beforeDate){
    return (history||[])
      .filter(session=>!beforeDate || session.date < beforeDate)
      .map(session=>{
        const exerciseLog = (session.exercisesLog||[]).find(el=>el.exerciseId===exerciseId);
        if(!exerciseLog) return null;
        const sets = doneSets(exerciseLog.sets);
        if(!sets.length) return null;
        return {
          date: session.date,
          sets,
          volume: sets.reduce((sum,set)=>sum+setVolume(set),0),
        };
      })
      .filter(Boolean)
      .sort((a,b)=>a.date.localeCompare(b.date));
  }

  function previousPerformance(history, exerciseId, beforeDate){
    const sessions = exerciseSessions(history, exerciseId, beforeDate);
    return sessions.length ? sessions[sessions.length-1] : null;
  }

  function mostRecentValidSet(history, exerciseId, beforeDate){
    const previous = previousPerformance(history, exerciseId, beforeDate);
    if(!previous) return null;
    return previous.sets[previous.sets.length-1] || null;
  }

  function inferWeightStep(exerciseDef, previous){
    const samples = [];
    if(exerciseDef && Number(exerciseDef.load)>0) samples.push(Number(exerciseDef.load));
    if(previous) previous.sets.forEach(set=>samples.push(Number(set.weight)||0));
    return samples.some(value=>Math.abs(value*2 - Math.round(value*2)) < 0.001 && Math.abs(value - Math.round(value)) > 0.001) ? 0.5 : 1;
  }

  function progressionIncrement(exercise){
    if(!exercise) return 1;
    if(exercise.muscle==='biceps' || exercise.muscle==='triceps' || exercise.muscle==='ombros') return 1;
    if(exercise.muscle==='cardio' || exercise.muscle==='abdomen') return 0;
    return 2.5;
  }

  function detectSetPR(history, exerciseId, completedSet, currentSets, beforeDate){
    const previous = exerciseSessions(history, exerciseId, beforeDate);
    const previousSets = previous.flatMap(session=>session.sets);
    const currentDone = doneSets(currentSets);
    const weight = Number(completedSet.weight)||0;
    const reps = Number(completedSet.reps)||0;
    if(weight<=0 || reps<=0) return null;

    const prs = [];
    const maxWeight = Math.max(0, ...previousSets.map(s=>Number(s.weight)||0));
    if(maxWeight>0 && weight>maxWeight) prs.push({type:'weight', label:'Maior carga', value:`${formatNumber(weight)} kg`});

    const sameWeightReps = Math.max(0, ...previousSets.filter(s=>Number(s.weight)===weight).map(s=>Number(s.reps)||0));
    if(sameWeightReps>0 && reps>sameWeightReps) prs.push({type:'repsAtWeight', label:'Mais reps nessa carga', value:`${reps} reps com ${formatNumber(weight)} kg`});

    const previousOneRm = Math.max(0, ...previousSets.map(estimatedOneRepMax));
    const currentOneRm = estimatedOneRepMax(completedSet);
    if(previousOneRm>0 && currentOneRm>previousOneRm) prs.push({type:'oneRm', label:'1RM estimado', value:`${formatNumber(currentOneRm)} kg`});

    const previousSessionVolume = Math.max(0, ...previous.map(session=>session.volume));
    const currentVolume = currentDone.reduce((sum,set)=>sum+setVolume(set),0);
    if(previousSessionVolume>0 && currentVolume>previousSessionVolume) prs.push({type:'sessionVolume', label:'Volume da sessão', value:`${formatNumber(currentVolume)} kg`});

    return prs.length ? prs[0] : null;
  }

  function progressionSuggestion({history, exerciseId, exercise, exerciseDef, currentSets, beforeDate}){
    const completed = doneSets(currentSets);
    const targetSets = Number(exerciseDef?.sets)||completed.length;
    const targetReps = Number(exerciseDef?.reps)||0;
    if(!targetSets || !targetReps || completed.length < targetSets) return null;
    if(!completed.slice(0,targetSets).every(set=>Number(set.reps)>=targetReps)) return null;

    const previous = exerciseSessions(history, exerciseId, beforeDate).slice(-2);
    if(previous.length<2) return null;
    const comparable = previous.every(session=>
      session.sets.length>=targetSets &&
      session.sets.slice(0,targetSets).every(set=>Number(set.reps)>=targetReps)
    );
    if(!comparable) return null;

    const baseWeight = Math.min(...completed.slice(0,targetSets).map(set=>Number(set.weight)||0));
    const increment = progressionIncrement(exercise);
    if(baseWeight<=0 || increment<=0) return null;
    return {
      message:'Você completou todas as séries.',
      next:`Próximo treino: considere ${formatNumber(baseWeight + increment)} kg.`,
      suggestedWeight: baseWeight + increment,
    };
  }

  function exerciseSummary(history, exerciseId, currentSets, beforeDate){
    const completed = doneSets(currentSets);
    const currentVolume = completed.reduce((sum,set)=>sum+setVolume(set),0);
    const currentReps = completed.reduce((sum,set)=>sum+(Number(set.reps)||0),0);
    const previous = previousPerformance(history, exerciseId, beforeDate);
    const previousVolume = previous ? previous.volume : 0;
    const deltaPct = previousVolume>0 ? ((currentVolume - previousVolume) / previousVolume) * 100 : null;
    return {
      setsCompleted: completed.length,
      totalReps: currentReps,
      currentVolume,
      previousVolume,
      deltaPct,
    };
  }

  function formatNumber(value){
    return Number(value||0).toLocaleString('pt-BR', {maximumFractionDigits:1});
  }

  return {
    previousPerformance,
    mostRecentValidSet,
    inferWeightStep,
    detectSetPR,
    progressionSuggestion,
    exerciseSummary,
    formatNumber,
  };
})();
