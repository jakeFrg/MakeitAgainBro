(() => {
  'use strict';
 
  /* ==========================================================================
     1. CONFIGURACIÓN
     ========================================================================== */
 
  // Mapa de respaldo para jugar sin cargar un JSON. "boost: true" = gema especial.
  const DEFAULT_CHART = {
    offsetMs: 0,
    notes: [
      {timeMs:1000,lane:0},{timeMs:1500,lane:2},{timeMs:2000,lane:1},{timeMs:2500,lane:3},
      {timeMs:3000,lane:0},{timeMs:3250,lane:2,boost:true},{timeMs:3500,lane:1},{timeMs:4000,lane:3},
      {timeMs:4500,lane:2},{timeMs:5000,lane:0},{timeMs:5500,lane:1},{timeMs:5750,lane:3},
      {timeMs:6000,lane:2},{timeMs:6500,lane:0},{timeMs:7000,lane:3,boost:true},{timeMs:7500,lane:1},
      {timeMs:8000,lane:0},{timeMs:8250,lane:1},{timeMs:8500,lane:2},{timeMs:9000,lane:3},
      {timeMs:9500,lane:1},{timeMs:10000,lane:2},{timeMs:10500,lane:0},{timeMs:11000,lane:3},
      {timeMs:11500,lane:2},{timeMs:11750,lane:0,boost:true},{timeMs:12000,lane:1},{timeMs:12500,lane:3},
      {timeMs:13000,lane:0},{timeMs:13500,lane:2},{timeMs:14000,lane:1},{timeMs:14500,lane:3},
      {timeMs:15000,lane:2},{timeMs:15500,lane:1,boost:true},{timeMs:15750,lane:3},{timeMs:16000,lane:0}
    ]
  };
 
  // Teclas por carril (Espacio queda reservado para el impulso), nombres y colores.
  const DEFAULT_LANE_KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
  const LANE_NAMES  = ['Carril 1', 'Carril 2', 'Carril 3', 'Carril 4'];
  const LANE_COLORS = ['#50e7f2', '#ff4db8', '#a989ff', '#ffd65a'];
 
  // Posición horizontal (%) de cada carril arriba de la pista; abajo se calcula con laneBottomX().
  const TOP_LANE_CENTERS = [35, 45, 55, 65];
 
  const HIT_WINDOW_MS = 150;                // margen para acertar una nota
  const BOOST_COST = 25;                    // energía mínima (%) para activar el impulso
  const BOOST_DURATION_MS = 8000;           // duración máxima del impulso con la barra llena
  const SPECIAL_CHARGE_AMOUNT = 25;         // energía (%) que da una gema especial
  const SPECIAL_CHARGE_DURATION_MS = 1200;  // la energía se suma poco a poco durante este tiempo
 
  /* ==========================================================================
     2. ELEMENTOS DE LA PÁGINA
     ========================================================================== */
 
  const $ = selector => document.querySelector(selector);
 
  const stage            = $('#stage');
  const notesBox         = $('#notes');
  const scoreEl          = $('#score');
  const comboEl          = $('#combo');
  const multiplierEl     = $('#comboMultiplier');
  const clockEl          = $('#clock');
  const feedback         = $('#feedback');
  const message          = $('#stageMessage');
  const judgementDisplay = $('#judgementDisplay');
  const boostFill        = $('#boostFill');
  const boostStatus      = $('#boostStatus');
  const boostMeter       = $('.boost-meter');
  const volumeControl    = $('#volumeControl');
  const volumeValue      = $('#volumeValue');
  // Música del nivel
  const musicaNivel = $('#musicaNivel');
  musicaNivel.volume = 0.6;
  function detenerMusicaNivel() {
  musicaNivel.pause();
  musicaNivel.currentTime = 0;
}
  const receptors        = Array.from(document.querySelectorAll('.receptor'));
 
  /* ==========================================================================
     3. ESTADO
     ========================================================================== */
 
  // Mapa
  let chart = DEFAULT_CHART;          // mapa que se está jugando
  let selectedChart = DEFAULT_CHART;  // mapa elegido por el jugador (se restaura al salir de práctica)
  let notes = [];
 
  // Teclas
  let laneKeys = [...DEFAULT_LANE_KEYS];
  let bindingLane = null;             // carril esperando una nueva tecla
  const heldLaneKeys = new Set();     // carriles con la tecla mantenida
 
  // Reloj de la partida
  let running = false;
  let preRoll = false;                // cuenta previa antes de la primera nota
  let startedAt = 0;
  let preRollStartedAt = 0;
  let pausedAt = 0;
  let leadMs = 1800;                  // tiempo que tarda una nota en caer (velocidad)
 
  // Puntuación e impulso
  let score = 0;
  let combo = 0;
  let energy = 0;                     // energía del impulso (0 a 100)
  let pendingEnergy = [];             // cargas de gemas especiales aún sumándose
  let boostActiveUntil = -1;          // momento en que termina el impulso (-1 = inactivo)
  let boostLastTickAt = -1;
 
  // Efectos
  let judgementAnimation = null;
  const receptorFlashTimers = [0, 0, 0, 0];
  let feedbackAudioContext = null;
  let feedbackOscillator = null;
  let feedbackGain = null;
  let feedbackVolume = 0.2;
 
  /* ==========================================================================
     4. UTILIDADES
     ========================================================================== */
 
  // Teclas de un solo carácter se guardan en minúscula.
  const normalizeKey = key => (key.length === 1 ? key.toLowerCase() : key);
 
  // Etiqueta corta de una tecla para los botones de asignación.
  function keyLabel(key) {
    const labels = {ArrowLeft:'←', ArrowDown:'↓', ArrowUp:'↑', ArrowRight:'→'};
    return labels[key] || (key.length === 1 ? key.toUpperCase() : key);
  }
 
  function formatTime(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
 
  // Tiempo de la partida en ms; negativo durante la cuenta previa.
  function chartTime() {
    if (!running) return pausedAt;
    if (preRoll) return performance.now() - preRollStartedAt - leadMs;
    return performance.now() - startedAt;
  }
 
  // Tiempo de la canción: reloj de la partida más el desfase del mapa.
  const songClock = () => chartTime() + (chart.offsetMs || 0);
 
  // Posición horizontal (%) de un carril en la parte baja de la pista.
  const laneBottomX = lane => 2 + (lane + 0.5) * 24;
 
  /* ==========================================================================
     5. INTERFAZ (mensajes, puntos, impulso, teclas)
     ========================================================================== */
 
  // Mensaje de texto del juego (LISTO, FALLO, etc.).
  function setFeedback(text, color = 'var(--cyan)') {
    feedback.textContent = text;
    feedback.style.color = color;
  }
 
  // Muestra un instante la calidad del golpe (EXCELENTE, MALO...) con una animación.
  function showJudgement(label, color) {
    judgementDisplay.textContent = label;
    judgementDisplay.style.color = color;
    if (judgementAnimation) judgementAnimation.cancel();
    judgementAnimation = judgementDisplay.animate([
      {opacity:0, transform:'scale(4) translateY(5px)', offset:0},
      {opacity:1, transform:'scale(3) translateY(0)', offset:.18},
      {opacity:1, transform:'scale(.67) translateY(0)', offset:.35},
      {opacity:0, transform:'scale(1) translateY(-4px)', offset:1}
    ], {duration:950, easing:'ease-out', fill:'forwards'});
  }
 
  // Nivel de combo: x1 antes de 10 aciertos, x2 desde 10, x4 desde 20 y x8 desde 30.
  function comboTier() {
    if (combo >= 30) return 8;
    if (combo >= 20) return 4;
    if (combo >= 10) return 2;
    return 1;
  }
 
  const isBoostActive = time => boostActiveUntil >= 0 && time < boostActiveUntil;
 
  // Multiplicador total: nivel de combo (x2 más si el impulso está activo).
  function currentMultiplier(time = songClock()) {
    return comboTier() * (isBoostActive(time) ? 2 : 1);
  }
 
  // Refresca puntos, combo y multiplicador en pantalla.
  function updateScore(time = songClock()) {
    scoreEl.textContent = String(score).padStart(6, '0');
    comboEl.textContent = String(combo);
    multiplierEl.textContent = `x${currentMultiplier(time)}`;
    multiplierEl.dataset.tier = String(comboTier());
    multiplierEl.classList.toggle('boosted', isBoostActive(time));
  }
 
  // Refresca el relleno y el porcentaje de la barra de impulso.
  function updateBoostUI() {
    const percent = Math.max(0, Math.min(100, energy));
    boostFill.style.width = `${percent}%`;
    boostMeter.setAttribute('aria-valuenow', String(Math.round(percent)));
    boostStatus.textContent = `${Math.round(percent)}%`;
  }
 
  // Muestra en cada botón la tecla asignada a su carril.
  function refreshKeyButtons() {
    document.querySelectorAll('.key-bind').forEach(button => {
      const lane = Number(button.dataset.bindLane);
      button.textContent = keyLabel(laneKeys[lane]);
      button.classList.toggle('waiting', bindingLane === lane);
    });
  }
 
  /* ==========================================================================
     6. SONIDO DE ACIERTO Y FALLO
     ========================================================================== */
 
  // Prepara un único oscilador reutilizable (no reproduce música).
  function prepareFeedbackAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      if (!feedbackAudioContext) {
        feedbackAudioContext = new AudioContextClass();
        feedbackOscillator = feedbackAudioContext.createOscillator();
        feedbackGain = feedbackAudioContext.createGain();
        feedbackOscillator.type = 'sine';
        feedbackGain.gain.value = 0;
        feedbackOscillator.connect(feedbackGain);
        feedbackGain.connect(feedbackAudioContext.destination);
        feedbackOscillator.start();
      }
      if (feedbackAudioContext.state === 'suspended') feedbackAudioContext.resume().catch(() => {});
    } catch (error) {
      feedbackAudioContext = null;
      feedbackOscillator = null;
      feedbackGain = null;
    }
  }
 
  // Tono corto: agudo si aciertas, grave si fallas.
  function playFeedbackTone(success) {
    if (!feedbackAudioContext || !feedbackOscillator || !feedbackGain || feedbackVolume <= 0) return;
    const now = feedbackAudioContext.currentTime;
    const gain = feedbackGain.gain;
    feedbackOscillator.frequency.setValueAtTime(success ? 660 : 190, now);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0.0001, now);
    gain.exponentialRampToValueAtTime(feedbackVolume * 0.035, now + 0.012);
    gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
  }
 
  /* ==========================================================================
     7. NOTAS Y MAPAS
     ========================================================================== */
 
  // Crea los elementos de las notas a partir del mapa (normales, sostenidas y especiales).
  function resetNotes() {
    notesBox.replaceChildren();
    notes = chart.notes.map((note, index) => {
      const element = document.createElement('div');
      const isBoost = Boolean(note.impulso ?? note.boost);
      const holdMs = Math.max(0, Number(note.duracionMs ?? note.holdMs ?? 0));
      element.className = `note${isBoost ? ' boost-note' : ''}${holdMs > 0 ? ' hold-note' : ''}`;
      element.hidden = true;
      element.style.setProperty('--note-color', LANE_COLORS[note.lane]);
      notesBox.appendChild(element);
      return {
        timeMs: Number(note.timeMs),
        lane: Number(note.lane),
        boost: isBoost,
        holdMs,
        holdUntil: 0,
        holding: false,
        element,
        hit: false,
        missed: false,
        id: index
      };
    }).sort((a, b) => a.timeMs - b.timeMs);
  }
 
  // Modo práctica: 90 notas simples en carriles al azar.
  function createPracticeChart() {
    const practiceNotes = [];
    let timeMs = 1200;
    let previousLane = -1;
    for (let index = 0; index < 90; index++) {
      timeMs += 350 + Math.floor(Math.random() * 750);
      let lane = Math.floor(Math.random() * 4);
      if (lane === previousLane) lane = (lane + 1 + Math.floor(Math.random() * 3)) % 4;
      practiceNotes.push({timeMs, lane}); // solo pulsaciones simples, sin notas sostenidas
      previousLane = lane;
    }
    return {offsetMs: 0, notes: practiceNotes};
  }
 
  // Lee un JSON (campos en español o inglés), lo valida y devuelve un mapa listo para usar.
  function parseChart(parsed) {
    const list = parsed.notas ?? parsed.notes;
    const timeOf = note => note.tiempoMs ?? note.timeMs;
    const laneOf = note => note.carril ?? note.lane;
 
    const invalid = !Array.isArray(list) || list.some(note =>
      !Number.isFinite(+timeOf(note)) || !Number.isInteger(+laneOf(note)) ||
      +laneOf(note) < 0 || +laneOf(note) > 3
    );
    if (invalid) throw new Error('Formato de notas incorrecto');
 
    return {
      offsetMs: Number(parsed.desfaseMs ?? parsed.offsetMs ?? DEFAULT_CHART.offsetMs),
      notes: list.map(note => ({
        timeMs: Number(timeOf(note)),
        lane: Number(laneOf(note)),
        boost: Boolean(note.impulso ?? note.boost),
        holdMs: Math.max(0, Number(note.duracionMs ?? note.holdMs ?? 0))
      }))
    };
  }
 
  /* ==========================================================================
     8. IMPULSO (energía)
     ========================================================================== */
 
  // Suma poco a poco la energía de las gemas especiales y, con el impulso activo, la va gastando.
  function advanceEnergy(time) {
    const charging = [];
    for (const charge of pendingEnergy) {
      const elapsed = Math.min(SPECIAL_CHARGE_DURATION_MS, Math.max(0, time - charge.startedAt));
      const addedTime = elapsed - charge.appliedMs;
      if (addedTime > 0) energy = Math.min(100, energy + charge.amount * addedTime / SPECIAL_CHARGE_DURATION_MS);
      charge.appliedMs = elapsed;
      if (elapsed < SPECIAL_CHARGE_DURATION_MS) charging.push(charge);
    }
    pendingEnergy = charging;
 
    if (boostActiveUntil >= 0) {
      const elapsed = Math.max(0, time - boostLastTickAt);
      energy = Math.max(0, energy - elapsed * 100 / BOOST_DURATION_MS);
      if (energy <= 0.001) {
        energy = 0;
        boostActiveUntil = -1;
        boostLastTickAt = -1;
        stage.classList.remove('boost-active');
        setFeedback('IMPULSO TERMINADO');
        updateScore(time);
      } else {
        boostActiveUntil = time + energy / 100 * BOOST_DURATION_MS;
        boostLastTickAt = time;
      }
    }
  }
 
  // Activa el impulso (tecla Espacio): necesita al menos 25% y dura según la energía acumulada.
  function activateBoost() {
    const time = songClock();
    if (!running || time < boostActiveUntil) return;
    if (energy < BOOST_COST) {
      setFeedback('NECESITAS 25% DE IMPULSO', '#ffd65a');
      return;
    }
    boostActiveUntil = time + energy / 100 * BOOST_DURATION_MS;
    boostLastTickAt = time;
    stage.classList.add('boost-active');
    updateBoostUI();
    updateScore(time);
    setFeedback('¡IMPULSO ACTIVADO!', '#ffd65a');
  }
 
  // Resetea todo lo relacionado con el impulso.
  function clearBoostState() {
    energy = 0;
    pendingEnergy = [];
    boostActiveUntil = -1;
    boostLastTickAt = -1;
    stage.classList.remove('boost-active');
  }
 
  /* ==========================================================================
     9. CONTROL DE PARTIDA
     ========================================================================== */
 
  // Empieza una ronda: reinicia puntos, impulso y notas, y arranca la cuenta previa.
  function start() {
    if (running) return;
    detenerMusicaNivel();
    clearBoostState();
    heldLaneKeys.clear();
    preRoll = true;
    preRollStartedAt = performance.now();
    startedAt = preRollStartedAt;
    pausedAt = -leadMs;
    running = true;
    score = 0;
    combo = 0;
    updateScore(-leadMs);
    resetNotes();
    updateBoostUI();
    message.hidden = true;
    setFeedback('PREPÁRATE');
  }
 
  // Detiene la partida y deja todo en su estado inicial.
  function reset() {
    running = false;
    detenerMusicaNivel();
    preRoll = false;
    pausedAt = 0;
    score = 0;
    combo = 0;
    clearBoostState();
    heldLaneKeys.clear();
    updateScore(0);
    clockEl.textContent = '00:00';
    resetNotes();
    updateBoostUI();
    message.textContent = '';
    message.hidden = true;
    setFeedback('LISTO');
  }
 
  /* ==========================================================================
     10. NOTAS SOSTENIDAS
     ========================================================================== */
 
  // Completa una nota sostenida: suma puntos (y energía si es especial).
  function finishHold(note, time) {
    note.holding = false;
    note.hit = true;
    note.element.remove();
    combo++;
    score += 200 * currentMultiplier(time);
    if (note.boost) pendingEnergy.push({startedAt: time, appliedMs: 0, amount: SPECIAL_CHARGE_AMOUNT});
    updateScore(time);
    updateBoostUI();
    showJudgement('EXCELENTE', '#50e7f2');
    setFeedback('¡NOTA SOSTENIDA!');
    playFeedbackTone(true);
  }
 
  // Soltar la tecla antes de tiempo rompe la nota y reinicia el combo.
  function failHold(note, time) {
    note.holding = false;
    note.missed = true;
    note.element.remove();
    combo = 0;
    updateScore(time);
    setFeedback('SOLTASTE LA TECLA ANTES DE TIEMPO', '#ff687e');
    showJudgement('FALLO', '#ff687e');
    playFeedbackTone(false);
  }
 
  /* ==========================================================================
     11. GOLPES
     ========================================================================== */
 
  // Califica el golpe según el error de tiempo (menos error = más puntos).
  function getJudgement(timingError) {
    if (timingError <= 35)  return {label:'EXCELENTE', points:150, color:'#a989ff'};
    if (timingError <= 75)  return {label:'BUENO',     points:120, color:'#50e7f2'};
    if (timingError <= 115) return {label:'BIEN',      points:90,  color:'#ffd65a'};
    return {label:'MALO', points:50, color:'#ff687e'};
  }
 
  // Ilumina un instante el receptor del carril pulsado.
  function flashReceptor(lane) {
    const receptor = receptors[lane];
    receptor.classList.add('active');
    clearTimeout(receptorFlashTimers[lane]);
    receptorFlashTimers[lane] = setTimeout(() => {
      receptor.classList.remove('active');
      receptorFlashTimers[lane] = 0;
    }, 100);
  }
 
  // Busca la nota pendiente más cercana del carril y evalúa si el jugador acertó.
  function pressLane(lane) {
    if (!running) return;
    const time = songClock();
 
    let candidate = null;
    let timingError = Infinity;
    for (const note of notes) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const error = Math.abs(note.timeMs - time);
      if (error < timingError) {
        candidate = note;
        timingError = error;
      }
    }
 
    flashReceptor(lane);
 
    // Fallo: no había nota al alcance.
    if (!candidate || timingError > HIT_WINDOW_MS) {
      combo = 0;
      updateScore(time);
      setFeedback('FALLO', '#ff687e');
      showJudgement('MALO', '#ff687e');
      playFeedbackTone(false);
      return;
    }
 
    // Nota sostenida: empieza a contar mientras mantienes la tecla.
    if (candidate.holdMs > 0) {
      candidate.hit = true;
      candidate.holding = true;
      candidate.holdUntil = time + candidate.holdMs;
      candidate.element.classList.add('being-held');
      setFeedback('MANTÉN PRESIONADA LA TECLA', '#50e7f2');
      showJudgement('MANTÉN', '#50e7f2');
      return;
    }
 
    // Nota normal: suma puntos (con bono cada 10 aciertos) y energía si es especial.
    candidate.hit = true;
    candidate.element.remove();
    combo++;
    const multiplier = currentMultiplier(time);
    const judgement = getJudgement(timingError);
    score += (combo % 10 === 0 ? judgement.points + 50 : judgement.points) * multiplier;
    if (candidate.boost) pendingEnergy.push({startedAt: time, appliedMs: 0, amount: SPECIAL_CHARGE_AMOUNT});
    updateScore(time);
    updateBoostUI();
    showJudgement(judgement.label, judgement.color);
    setFeedback(candidate.boost ? '¡GEMA ESPECIAL! +25% DE IMPULSO' : '¡ACIERTO!');
    playFeedbackTone(true);
  }
 
  /* ==========================================================================
     12. BUCLE DE ANIMACIÓN
     ========================================================================== */
 
  // Nota sostenida en curso: queda en la línea de golpe y su cola se acorta.
  function updateHeldNote(note, songTime, hitY, travel) {
    const remaining = note.holdUntil - songTime;
    if (!heldLaneKeys.has(note.lane)) { failHold(note, songTime); return; }
    if (remaining <= 0) { finishHold(note, songTime); return; }
    note.element.hidden = false;
    note.element.style.left = `${laneBottomX(note.lane)}%`;
    note.element.style.top = `${hitY}px`;
    note.element.style.setProperty('--hold-length', `${Math.max(12, Math.min(travel, remaining / leadMs * travel))}px`);
  }
 
  // Nota que cae: la marca como fallada si pasó, o la coloca en la pista según su tiempo.
  function updateFallingNote(note, time, songTime, hitY, entryY, travel) {
    if (note.hit || note.missed) return;
 
    const untilHit = note.timeMs - (chart.offsetMs || 0) - time;
    if (untilHit < -HIT_WINDOW_MS) {
      note.missed = true;
      note.element.remove();
      combo = 0;
      updateScore(songTime);
      setFeedback('FALLO', '#ff687e');
      showJudgement('MALO', '#ff687e');
      return;
    }
 
    note.element.hidden = untilHit > leadMs;
    if (note.element.hidden) return;
 
    // La nota se estrecha arriba y se alinea con su receptor al llegar abajo.
    const y = hitY - (untilHit / leadMs) * travel;
    const progress = Math.max(0, Math.min(1, (y - entryY) / travel));
    const topX = TOP_LANE_CENTERS[note.lane];
    const bottomX = laneBottomX(note.lane);
    note.element.style.left = `${topX + (bottomX - topX) * progress}%`;
    note.element.style.top = `${y}px`;
    if (note.holdMs > 0) {
      note.element.style.setProperty('--hold-length', `${Math.max(24, Math.min(travel, note.holdMs / leadMs * travel))}px`);
    }
  }
 
  // Se ejecuta en cada cuadro: avanza la cuenta previa, el reloj, la energía y las notas.
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
 
    // Termina la cuenta previa y empieza el tiempo real de la canción.
    if (preRoll && now - preRollStartedAt >= leadMs) {
      preRoll = false;

    // Comenzar la música del nivel
    musicaNivel.currentTime = 0;

    // Sincronizar el reloj con el inicio de la música
    startedAt = performance.now();

    musicaNivel.play().catch(error => {
      console.error('No se pudo reproducir la música:', error);
    });

    setFeedback('¡A JUGAR!');
  }
 
    const time = chartTime();
    const songTime = time + (chart.offsetMs || 0);
    clockEl.textContent = preRoll ? `EN ${Math.ceil((leadMs - (now - preRollStartedAt)) / 1000)}` : formatTime(time);
    advanceEnergy(songTime);
    updateBoostUI();
 
    // Geometría de la pista: las notas entran al 40% de la altura y llegan a la línea de golpe.
    const height = stage.clientHeight;
    const hitY = height - 76;
    const entryY = height * 0.4;
    const travel = hitY - entryY;
 
    for (const note of notes) {
      if (note.holding) updateHeldNote(note, songTime, hitY, travel);
      else updateFallingNote(note, time, songTime, hitY, entryY, travel);
    }
  }
 
  /* ==========================================================================
     13. TECLADO
     ========================================================================== */
 
  // Captura la nueva tecla de un carril; Escape cancela y Espacio está reservado.
  function handleBinding(event) {
    event.preventDefault();
 
    if (event.key === 'Escape') {
      bindingLane = null;
      refreshKeyButtons();
      setFeedback('ASIGNACION CANCELADA');
      return;
    }
    if (event.code === 'Space') {
      setFeedback('ESPACIO ESTA RESERVADO PARA IMPULSO', '#ffd65a');
      return;
    }
 
    const newKey = normalizeKey(event.key);
    if (laneKeys.some((key, index) => key === newKey && index !== bindingLane)) {
      setFeedback('ESA TECLA YA ESTA ASIGNADA', '#ff687e');
      return;
    }
 
    laneKeys[bindingLane] = newKey;
    bindingLane = null;
    refreshKeyButtons();
    setFeedback(`TECLA ASIGNADA: ${keyLabel(newKey)}`);
  }
 
  // Tecla presionada: asignación, impulso (Espacio) o golpe en un carril.
  function handleKeydown(event) {
    // Ignora la repetición automática del sistema al mantener una tecla.
    if (event.repeat) {
      const repeatedKey = normalizeKey(event.key);
      if (bindingLane !== null || event.code === 'Space' || laneKeys.includes(repeatedKey)) event.preventDefault();
      return;
    }
 
    if (bindingLane !== null) { handleBinding(event); return; }
 
    if (event.code === 'Space') {
      event.preventDefault();
      activateBoost();
      return;
    }
 
    const lane = laneKeys.indexOf(normalizeKey(event.key));
    if (lane !== -1) {
      event.preventDefault();
      heldLaneKeys.add(lane);
      pressLane(lane);
    }
  }
 
  // Tecla soltada: si había una nota sostenida, la completa o la rompe según el tiempo.
  function handleKeyup(event) {
    const lane = laneKeys.indexOf(normalizeKey(event.key));
    if (lane === -1) return;
    heldLaneKeys.delete(lane);
 
    const note = notes.find(item => item.holding && item.lane === lane);
    if (!note) return;
 
    const time = songClock();
    if (time >= note.holdUntil) finishHold(note, time);
    else failHold(note, time);
  }
 
  /* ==========================================================================
     14. CARGA DE MAPA
     ========================================================================== */
 
  // Lee el JSON elegido por el jugador y lo usa como mapa.
  async function loadChart(file) {
    try {
      chart = parseChart(JSON.parse(await file.text()));
      selectedChart = chart;
      reset(); // ya reconstruye las notas
      setFeedback(`MAPA CARGADO: ${chart.notes.length} NOTAS`);
    } catch (error) {
      setFeedback('NO SE PUDO LEER EL MAPA', '#ff687e');
      console.error(error);
    }
  }
 
  /* ==========================================================================
     15. EVENTOS Y ARRANQUE
     ========================================================================== */
 
  // Volumen guardado en el navegador (solo afecta a los tonos de acierto y fallo).
  function setupVolume() {
    let savedVolume = NaN;
    try { savedVolume = Number(localStorage.getItem('ritmo-volume')); } catch (error) {}
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 100) {
      volumeControl.value = String(savedVolume);
    }
    feedbackVolume = Number(volumeControl.value) / 100;
    volumeValue.value = `${volumeControl.value}%`;
 
    volumeControl.addEventListener('input', event => {
      feedbackVolume = Number(event.target.value) / 100;
      volumeValue.value = `${event.target.value}%`;
      try { localStorage.setItem('ritmo-volume', event.target.value); } catch (error) {}
    });
  }
 
  function bindEvents() {
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('keyup', handleKeyup);
 
    // Botones de configuración: esperar una tecla o restaurar las flechas.
    document.querySelectorAll('.key-bind').forEach(button => button.addEventListener('click', () => {
      bindingLane = Number(button.dataset.bindLane);
      refreshKeyButtons();
      setFeedback(`PULSA UNA TECLA PARA ${LANE_NAMES[bindingLane].toUpperCase()}`, '#ffd65a');
    }));
    $('#defaultKeys').addEventListener('click', () => {
      laneKeys = [...DEFAULT_LANE_KEYS];
      bindingLane = null;
      refreshKeyButtons();
      setFeedback('FLECHAS RESTAURADAS');
    });
 
    // Velocidad de las notas y reinicio.
    $('#difficulty').addEventListener('change', event => { leadMs = Number(event.target.value); });
    $('#resetButton').addEventListener('click', reset);
 
    // Eventos que dispara el menú: historia, práctica y salir.
    document.addEventListener('rhythm:start', () => {
      chart = selectedChart;
      prepareFeedbackAudio();
      start();
    });
    document.addEventListener('rhythm:practice', () => {
      chart = createPracticeChart();
      prepareFeedbackAudio();
      start();
    });
    document.addEventListener('rhythm:stop', () => {
      chart = selectedChart;
      reset();
    });
 
    // Cargar un mapa JSON.
    $('#chartFile').addEventListener('change', event => {
      const file = event.target.files[0];
      if (file) loadChart(file);
    });
  }
 
  // Prepara el mapa, las teclas y los marcadores al abrir la página.
  function init() {
    setupVolume();
    bindEvents();
    refreshKeyButtons();
    resetNotes();
    updateScore(0);
    updateBoostUI();
    requestAnimationFrame(frame);
  }
 
  init();
})();
 