// Scene selection is presentation only. Keep a conversation's theme stable as
// speakers and expressions change, and let an active battle own its soundtrack.
export function getMusicScene(state, { modal = null, modalData = {} } = {}) {
  const base = state?.time === 'night' ? 'night' : state?.map === 'forest' ? 'forest' : 'village';
  if (state?.battle) return 'battle';

  if (modal === 'battle-result') {
    const outcome = modalData.progression?.outcome;
    if (outcome === 'victory' || outcome === 'bond') return 'celebration';
    if (outcome === 'defeat') return 'rest';
    if (outcome === 'escape') return base;
    // Result screens from older callers still carry these two outcome flags.
    return modalData.won || modalData.recruited ? 'celebration' : base;
  }

  if (modal === 'complete' || modal === 'report-complete') return 'celebration';
  if (modal === 'sanctuary' || modal === 'camp') return 'rest';

  const conversation = modal === 'dialogue' ? modalData.conversationId : modal;
  const mastered = modalData.mastered === true || state?.dex?.concepts?.concept_sampling_bias === 'mastered';
  if (conversation === 'mastery' || conversation === 'inferra-mastery-feedback') {
    return mastered ? 'celebration' : 'mystery';
  }

  const investigationComplete = state?.quests?.nocturnal?.status === 'complete';
  if (modal === 'tower' || conversation === 'inferra-hint' || conversation === 'inferra-finding-feedback') return 'mystery';
  if (modal === 'investigation' && !investigationComplete) return 'mystery';
  if (modal === 'inferra' && ['locked', 'ready'].includes(state?.quests?.nocturnal?.status)) return 'mystery';
  return base;
}
