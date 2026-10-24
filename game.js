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

  // Acierto e impulso.
  const HIT_WINDOW_MS = 150;                // margen máximo de acierto para notas separadas
  const BOOST_COST = 25;                    // energía mínima (%) para activar el impulso
  const BOOST_DURATION_MS = 8000;           // duración máxima del impulso con la barra llena
  const SPECIAL_CHARGE_AMOUNT = 25;         // energía (%) que da una gema especial
  const SPECIAL_CHARGE_DURATION_MS = 1200;  // la energía se suma poco a poco durante este tiempo

  // Dificultades: velocidad de caída, separación mínima entre notas y ajustes del modo práctica.
  const DIFFICULTIES = {
    easy:   {leadMs:2850, minGapMs:550, practiceCount:45,  practiceMinGapMs:900, practiceMaxGapMs:1400},
    normal: {leadMs:2500, minGapMs:300, practiceCount:75,  practiceMinGapMs:650, practiceMaxGapMs:1150},
    hard:   {leadMs:1800, minGapMs:180, practiceCount:100, practiceMinGapMs:350, practiceMaxGapMs:750}
  };

  // Desempeño: barra de vida del jugador (llega a 0 = derrota).
  const MAX_PERFORMANCE = 100;
  const MISS_PERFORMANCE_PENALTY = 10;
  const PERFORMANCE_RECOVERY = {excellent:5, good:3, okay:2, poor:1, hold:5};

  // Claves de guardado en el navegador (localStorage).
  const BEST_SCORE_KEY = 'ritmo-best-score-v1';
  const PLAYER_PROFILE_KEY = 'ritmo-player-profile-v1';
  const PLAYER_LEADERBOARD_KEY = 'ritmo-local-leaderboard-v1';
  const LANE_KEYS_STORAGE_KEY = 'ritmo-lane-keys-v1';
  const DIFFICULTY_STORAGE_KEY = 'ritmo-difficulty-v1';
  const EFFECTS_VOLUME_KEY = 'ritmo-volume';
  const MUSIC_VOLUME_KEY = 'ritmo-music-volume';

  // Perfil inicial del jugador (también define qué campos se leen del guardado).
  const EMPTY_PLAYER_PROFILE = {
    bestScore:0, totalScore:0, popularity:50, levelsCompleted:0, gamesPlayed:0,
    totalHits:0, totalMisses:0, bestCombo:0, lastScore:0, lastAccuracy:0,
    lastPerformance:100, performanceSum:0, performanceRuns:0
  };

  /* ==========================================================================
     2. ELEMENTOS DE LA PÁGINA
     ========================================================================== */

  const $ = selector => document.querySelector(selector);

  // Pista y marcador.
  const stage            = $('#stage');
  const notesBox         = $('#notes');
  const clockEl          = $('#clock');
  const feedback         = $('#feedback');
  const message          = $('#stageMessage');
  const judgementDisplay = $('#judgementDisplay');
  const scoreEl          = $('#score');
  const comboEl          = $('#combo');
  const multiplierEl     = $('#comboMultiplier');
  const bestComboEl      = $('#bestCombo');
  const bestScoreEl      = $('#bestScore');
  const accuracyEl       = $('#accuracy');
  const receptors        = Array.from(document.querySelectorAll('.receptor'));

  // Barras de desempeño e impulso.
  const performanceMeter = $('#performanceMeter');
  const performanceFill  = $('#performanceFill');
  const performanceValue = $('#performanceValue');
  const boostFill        = $('#boostFill');
  const boostStatus      = $('#boostStatus');
  const boostMeter       = $('.boost-meter');

  // Perfil del jugador y ranking.
  const profilePopularity         = $('#profilePopularity');
  const profileLevels             = $('#profileLevels');
  const profileTotalScore         = $('#profileTotalScore');
  const profileAccuracy           = $('#profileAccuracy');
  const profileAveragePerformance = $('#profileAveragePerformance');
  const leaderboardList           = $('#leaderboardList');

  // Opciones, canción y volúmenes.
  const difficultySelect = $('#difficulty');
  const songAudio        = $('#songAudio');
  const songFileInput    = $('#songFile');
  const songName         = $('#songName');
  const musicVolume      = $('#musicVolume');
  const musicVolumeValue = $('#musicVolumeValue');
  const volumeControl    = $('#volumeControl');
  const volumeValue      = $('#volumeValue');
  const levelMusic       = $('#musicaNivel');

  /* ==========================================================================
     3. ESTADO
     ========================================================================== */

  // Mapa
  let chart = DEFAULT_CHART;          // mapa que se está jugando
  let selectedChart = DEFAULT_CHART;  // mapa elegido por el jugador (se restaura al salir de práctica)
  let chartLoadVersion = 0;           // impide que una carga tardía reemplace el mapa más reciente
  let notes = [];
  let notesByLane = [[], [], [], []]; // búsqueda rápida de notas pendientes por carril

  // Teclas
  let laneKeys = [...DEFAULT_LANE_KEYS];
  let bindingLane = null;             // carril esperando una nueva tecla
  const heldLaneKeys = new Set();     // carriles con la tecla mantenida

  // Reloj de la partida
  let running = false;
  let preRoll = false;                // cuenta previa (ya no se activa en esta versión)
  let startedAt = 0;
  let preRollStartedAt = 0;
  let pausedAt = 0;
  let songStarted = false;            // true cuando el MP3 ya empezó y manda el reloj
  let songObjectUrl = '';
  let leadMs = DIFFICULTIES.normal.leadMs; // tiempo de caída según la dificultad elegida

  // Puntuación de la partida
  let score = 0;
  let combo = 0;
  let bestCombo = 0;
  let hits = 0;
  let misses = 0;
  let playerPerformance = MAX_PERFORMANCE;

  // Progreso guardado
  let playerProfile = readPlayerProfile();
  let playerLeaderboard = readLocalLeaderboard();
  let bestScore = playerProfile.bestScore;
  let profileSaveTimer = 0;

  // Impulso
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

  // Tiempo de la partida en ms; si hay MP3 sonando, él manda el reloj.
  function chartTime() {
    if (!running) return pausedAt;
    if (preRoll) return performance.now() - preRollStartedAt - leadMs;
    if (songStarted) return songAudio.currentTime * 1000;
    return performance.now() - startedAt;
  }

  // Tiempo de la canción: reloj de la partida más el desfase del mapa.
  const songClock = () => chartTime() + (chart.offsetMs || 0);

  // Posición horizontal (%) de un carril en la parte baja de la pista.
  const laneBottomX = lane => 2 + (lane + 0.5) * 24;

  // ¿Está activo el modo práctica? (la práctica no guarda estadísticas).
  const isPracticeMode = () => document.body.classList.contains('practice-mode');

  // Detiene la música de fondo del nivel y la regresa al inicio.
  function stopLevelMusic() {
    levelMusic.pause();
    levelMusic.currentTime = 0;
  }

  /* ==========================================================================
     5. PROGRESO GUARDADO (perfil, mejor puntuación y ranking)
     ========================================================================== */

  // Lee el perfil guardado; ignora valores inválidos.
  function readPlayerProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY) || '{}');
      const profile = {...EMPTY_PLAYER_PROFILE};
      for (const key of Object.keys(profile)) {
        const value = Number(saved[key]);
        if (Number.isFinite(value) && value >= 0) profile[key] = value;
      }
      return profile;
    } catch (error) {
      return {...EMPTY_PLAYER_PROFILE};
    }
  }

  // Lee el ranking local guardado.
  function readLocalLeaderboard() {
    try {
      const records = JSON.parse(localStorage.getItem(PLAYER_LEADERBOARD_KEY) || '[]');
      return Array.isArray(records) ? records.filter(record => record && Number.isFinite(Number(record.score))) : [];
    } catch (error) { return []; }
  }

  // Ajusta la popularidad y recupera la mejor puntuación guardada (se llama al arrancar).
  function loadStoredProgress() {
    playerProfile.popularity = Math.min(100, playerProfile.popularity);
    try { bestScore = Math.max(bestScore, Number(localStorage.getItem(BEST_SCORE_KEY)) || 0); } catch (error) {}
    playerProfile.bestScore = bestScore;
  }

  // Guarda perfil, mejor puntuación y ranking; agrupa guardados cercanos para no escribir en cada cuadro.
  function savePlayerProfile(immediate = false) {
    if (profileSaveTimer) clearTimeout(profileSaveTimer);
    const save = () => {
      profileSaveTimer = 0;
      try {
        localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(playerProfile));
        localStorage.setItem(BEST_SCORE_KEY, String(playerProfile.bestScore));
        localStorage.setItem(PLAYER_LEADERBOARD_KEY, JSON.stringify(playerLeaderboard));
      } catch (error) {}
    };
    if (immediate) save();
    else profileSaveTimer = setTimeout(save, 180);
  }

  /* ==========================================================================
     6. INTERFAZ (mensajes, puntos, barras, perfil, teclas)
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

  // Refresca puntos, combo, multiplicador, mejores marcas y precisión.
  function updateScore(time = songClock()) {
    scoreEl.textContent = String(score).padStart(6, '0');
    comboEl.textContent = String(combo);
    multiplierEl.textContent = `x${currentMultiplier(time)}`;
    multiplierEl.dataset.tier = String(comboTier());
    multiplierEl.classList.toggle('boosted', isBoostActive(time));
    bestComboEl.textContent = String(playerProfile.bestCombo);
    bestScoreEl.textContent = String(bestScore).padStart(6, '0');
    const attempts = hits + misses;
    accuracyEl.textContent = `${attempts ? Math.round(hits / attempts * 100) : 100}%`;
    if (score > bestScore) {
      bestScore = score;
      playerProfile.bestScore = bestScore;
      bestScoreEl.textContent = String(bestScore).padStart(6, '0');
    }
    updateProfileUI();
    savePlayerProfile();
  }

  // Muestra el perfil guardado y las 5 mejores partidas del ranking.
  function updateProfileUI() {
    profilePopularity.textContent = `${Math.round(playerProfile.popularity)}%`;
    profileLevels.textContent = String(playerProfile.levelsCompleted);
    profileTotalScore.textContent = String(playerProfile.totalScore).padStart(6, '0');
    const attempts = playerProfile.totalHits + playerProfile.totalMisses;
    profileAccuracy.textContent = `${attempts ? Math.round(playerProfile.totalHits / attempts * 100) : 0}%`;
    const average = playerProfile.performanceRuns
      ? Math.round(playerProfile.performanceSum / playerProfile.performanceRuns)
      : 0;
    profileAveragePerformance.textContent = `${average}%`;

    leaderboardList.replaceChildren();
    if (!playerLeaderboard.length) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'Aún no hay partidas guardadas.';
      leaderboardList.appendChild(empty);
      return;
    }
    playerLeaderboard.slice(0, 5).forEach((record, index) => {
      const item = document.createElement('li');
      item.append(`${record.date || 'Partida'} · `);
      const scoreLabel = document.createElement('strong');
      scoreLabel.textContent = `${Number(record.score).toLocaleString('es-MX')} pts`;
      item.append(scoreLabel, ` · ${Number(record.accuracy) || 0}% precisión · combo ${Number(record.bestCombo) || 0}`);
      item.setAttribute('aria-label', `Puesto ${index + 1}: ${scoreLabel.textContent}, precisión ${Number(record.accuracy) || 0} por ciento`);
      leaderboardList.appendChild(item);
    });
  }

  // Refresca la barra de desempeño (verde, amarilla o roja según el nivel).
  function updatePerformance() {
    const value = Math.max(0, Math.min(MAX_PERFORMANCE, playerPerformance));
    performanceFill.style.width = `${value}%`;
    performanceValue.textContent = `${value}%`;
    performanceMeter.setAttribute('aria-valuenow', String(value));
    performanceMeter.dataset.level = value >= 60 ? 'high' : value >= 30 ? 'medium' : 'low';
  }

  // Refresca el relleno y el porcentaje de la barra de impulso.
  function updateBoostUI() {
    const percent = Math.max(0, Math.min(100, energy));
    boostFill.style.width = `${percent}%`;
    boostMeter.setAttribute('aria-valuenow', String(Math.round(percent)));
    boostStatus.textContent = `${Math.round(percent)}%`;
  }

  // Muestra la tecla de cada carril en los botones de configuración y en los receptores.
  function refreshKeyButtons() {
    document.querySelectorAll('.key-bind').forEach(button => {
      const lane = Number(button.dataset.bindLane);
      button.textContent = keyLabel(laneKeys[lane]);
      button.classList.toggle('waiting', bindingLane === lane);
    });

    receptors.forEach((receptor, lane) => {
      const label = receptor.querySelector('span');
      const changed = laneKeys[lane] !== DEFAULT_LANE_KEYS[lane];
      label.textContent = keyLabel(changed ? laneKeys[lane] : DEFAULT_LANE_KEYS[lane]);
      receptor.classList.toggle('custom-key', changed);
      receptor.setAttribute('aria-label', `${LANE_NAMES[lane]}: tecla ${keyLabel(laneKeys[lane])}`);
    });
  }

  /* ==========================================================================
     7. SONIDO DE ACIERTO Y FALLO
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
     8. NOTAS Y MAPAS
     ========================================================================== */

  // Crea los elementos de las notas a partir del mapa y calcula la ventana de acierto de cada una.
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

    notesByLane = [[], [], [], []];
    for (const note of notes) notesByLane[note.lane].push(note);

    // Ventana propia por nota: si dos notas del mismo carril están cerca, la ventana se reduce.
    for (const laneNotes of notesByLane) {
      for (let index = 0; index < laneNotes.length; index++) {
        const note = laneNotes[index];
        const previousGap = index > 0 ? note.timeMs - laneNotes[index - 1].timeMs : Infinity;
        const nextGap = index + 1 < laneNotes.length ? laneNotes[index + 1].timeMs - note.timeMs : Infinity;
        const nearestGap = Math.min(previousGap, nextGap);
        note.hitWindowMs = Number.isFinite(nearestGap)
          ? Math.max(8, Math.min(HIT_WINDOW_MS, Math.floor(nearestGap / 2) - 5))
          : HIT_WINDOW_MS;
      }
    }
  }

  // Parámetros de la dificultad elegida en el selector (normal si el valor no existe).
  function getDifficultyConfig() {
    return DIFFICULTIES[difficultySelect.value] || DIFFICULTIES.normal;
  }

  // Modo práctica: genera una cantidad y una separación de notas según la dificultad.
  function createPracticeChart() {
    const difficulty = getDifficultyConfig();
    const practiceNotes = [];
    let timeMs = 1200;
    let previousLane = -1;
    for (let index = 0; index < difficulty.practiceCount; index++) {
      timeMs += difficulty.practiceMinGapMs + Math.floor(Math.random() * (difficulty.practiceMaxGapMs - difficulty.practiceMinGapMs + 1));
      let lane = Math.floor(Math.random() * 4);
      if (lane === previousLane) lane = (lane + 1 + Math.floor(Math.random() * 3)) % 4;
      practiceNotes.push({timeMs, lane}); // solo pulsaciones simples, sin notas sostenidas
      previousLane = lane;
    }
    return {offsetMs: 0, notes: practiceNotes};
  }

  // En dificultades menores quita notas muy pegadas (las especiales y sostenidas siempre se conservan).
  function applyDifficulty(sourceChart) {
    const minGapMs = getDifficultyConfig().minGapMs;
    if (!minGapMs) return {...sourceChart, notes: [...sourceChart.notes]};

    let lastKeptTime = -Infinity;
    const notesForLevel = sourceChart.notes.filter(note => {
      const special = note.boost || note.holdMs > 0;
      if (special || note.timeMs - lastKeptTime >= minGapMs) {
        lastKeptTime = note.timeMs;
        return true;
      }
      return false;
    });
    return {...sourceChart, notes: notesForLevel};
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
     9. IMPULSO (energía)
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
     10. ACIERTOS, FALLOS Y DESEMPEÑO
     ========================================================================== */

  // Un acierto recupera desempeño según su precisión, sin superar el máximo.
  function recoverPerformance(amount) {
    playerPerformance = Math.min(MAX_PERFORMANCE, playerPerformance + amount);
    updatePerformance();
  }

  // Cuenta un acierto: sube combo y estadísticas (la práctica no guarda en el perfil).
  function registerHit() {
    combo++;
    bestCombo = Math.max(bestCombo, combo);
    hits++;
    if (!isPracticeMode()) {
      playerProfile.totalHits++;
      playerProfile.bestCombo = Math.max(playerProfile.bestCombo, bestCombo);
    }
  }

  // Fallo (tecla sin nota, nota omitida o sostenida rota): quita combo, puntos y desempeño; con 0 hay derrota.
  function registerMiss(time, feedbackText = 'FALLO') {
    if (!running) return;
    misses++;
    if (!isPracticeMode()) playerProfile.totalMisses++;
    combo = 0;
    score = Math.max(0, score - 25);
    playerPerformance = Math.max(0, playerPerformance - MISS_PERFORMANCE_PENALTY);
    updatePerformance();
    updateScore(time);
    setFeedback(feedbackText, '#ff687e');
    if (playerPerformance <= 0) finishLevel('defeat');
  }

  /* ==========================================================================
     11. CONTROL DE PARTIDA
     ========================================================================== */

  // Si el navegador bloquea la reproducción automática, pide un clic para activar el audio.
  function showAudioStartPrompt() {
    if (!running) return;
    running = false;
    preRoll = false;
    pausedAt = 0;
    songStarted = false;
    songAudio.pause();
    message.classList.remove('results', 'defeat');
    message.classList.add('audio-prompt');
    message.innerHTML = '<span>EL NAVEGADOR ESPERA TU CLIC PARA REPRODUCIR</span><br><button type="button">▶ ESCUCHAR Y EMPEZAR</button>';
    message.hidden = false;
    message.querySelector('button').addEventListener('click', () => {
      message.hidden = true;
      message.classList.remove('audio-prompt');
      start();
    }, {once:true});
    setFeedback('PULSA PARA ACTIVAR LA CANCIÓN', '#ffd65a');
  }

  // Empieza una ronda: reinicia puntos, impulso y notas; en historia arranca la canción.
  function start() {
    if (running) return;
    const musicRound = !isPracticeMode();
    clearBoostState();
    heldLaneKeys.clear();
    songAudio.pause();
    songStarted = false;
    preRoll = false;
    preRollStartedAt = performance.now();
    startedAt = preRollStartedAt;
    pausedAt = 0;
    running = true;
    score = 0;
    combo = 0;
    bestCombo = 0;
    hits = 0;
    misses = 0;
    playerPerformance = MAX_PERFORMANCE;
    updateScore(-leadMs);
    updatePerformance();
    resetNotes();
    updateBoostUI();
    message.classList.remove('results', 'defeat', 'audio-prompt');
    message.hidden = true;
    setFeedback(musicRound ? '¡A JUGAR!' : 'PREPÁRATE');

    // Story Mode usa el audio como reloj maestro desde el inicio de la partida.
    if (musicRound) {
      try { songAudio.currentTime = 0; } catch (error) {}
      const playback = songAudio.play();
      if (playback && typeof playback.then === 'function') {
        playback.then(() => { songStarted = true; }).catch(showAudioStartPrompt);
      } else {
        songStarted = true;
      }
    }
  }

  // Detiene la partida y deja todo en su estado inicial.
  function reset() {
    running = false;
    stopLevelMusic();
    preRoll = false;
    songStarted = false;
    songAudio.pause();
    try { songAudio.currentTime = 0; } catch (error) {}
    pausedAt = 0;
    score = 0;
    combo = 0;
    bestCombo = 0;
    hits = 0;
    misses = 0;
    playerPerformance = MAX_PERFORMANCE;
    clearBoostState();
    heldLaneKeys.clear();
    updateScore(0);
    updatePerformance();
    clockEl.textContent = '00:00';
    resetNotes();
    updateBoostUI();
    message.textContent = '';
    message.classList.remove('results', 'defeat', 'audio-prompt');
    message.hidden = true;
    setFeedback('LISTO');
  }

  // Guarda la partida en el perfil y el ranking, y ajusta la popularidad (no se usa en práctica).
  function saveRunToProfile(outcome, accuracy) {
    playerLeaderboard.push({
      score: Math.max(0, score), accuracy, bestCombo,
      date: new Date().toLocaleDateString('es-MX')
    });
    playerLeaderboard.sort((a, b) => Number(b.score) - Number(a.score));
    playerLeaderboard = playerLeaderboard.slice(0, 10);

    playerProfile.gamesPlayed++;
    playerProfile.totalScore += Math.max(0, score);
    playerProfile.lastScore = score;
    playerProfile.lastAccuracy = accuracy;
    playerProfile.lastPerformance = playerPerformance;
    playerProfile.performanceSum += playerPerformance;
    playerProfile.performanceRuns++;
    playerProfile.bestCombo = Math.max(playerProfile.bestCombo, bestCombo);
    if (outcome !== 'defeat') playerProfile.levelsCompleted++;

    const rating = accuracy * 0.7 + playerPerformance * 0.3;
    const popularityChange = outcome === 'defeat' ? -4 : Math.round((rating - 50) / 10);
    playerProfile.popularity = Math.max(0, Math.min(100, playerProfile.popularity + popularityChange));

    updateProfileUI();
    savePlayerProfile(true);
  }

  // Muestra sobre la pista la pantalla de resultados (victoria o derrota).
  function showResults(outcome, accuracy, grade) {
    message.classList.add('results');
    message.classList.toggle('defeat', outcome === 'defeat');
    const title = outcome === 'defeat' ? 'DERROTA' : 'NIVEL COMPLETADO';
    const reason = outcome === 'defeat' ? '<small>DESEMPEÑO AGOTADO</small><br>' : '';
    message.innerHTML = `${title}<br>${reason}<small>PUNTUACIÓN FINAL: ${score}</small><br><small>RANGO: ${grade} · PRECISIÓN: ${accuracy}%</small><br><small>DESEMPEÑO RESTANTE: ${playerPerformance}%</small><br><small>ACIERTOS: ${hits} · ERRORES: ${misses}</small><br><small>MEJOR COMBO: ${bestCombo}</small><br><small>REINICIA PARA JUGAR OTRA VEZ</small>`;
    message.hidden = false;
    setFeedback(outcome === 'defeat' ? 'DERROTA · DESEMPEÑO AGOTADO' : 'NIVEL COMPLETADO', outcome === 'defeat' ? '#ff687e' : undefined);
  }

  // Termina la partida: detiene todo, calcula precisión y rango, guarda y muestra resultados.
  function finishLevel(outcome = 'victory') {
    if (!running) return;
    pausedAt = chartTime();
    running = false;
    preRoll = false;
    songAudio.pause();
    songStarted = false;
    heldLaneKeys.clear();
    clearBoostState();
    updateBoostUI();

    const attempts = hits + misses;
    const accuracy = attempts ? Math.round(hits / attempts * 100) : 0;
    const grade = accuracy >= 95 ? 'S' : accuracy >= 85 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 50 ? 'C' : 'D';

    updateScore(pausedAt);
    if (!isPracticeMode()) saveRunToProfile(outcome, accuracy);
    showResults(outcome, accuracy, grade);
  }

  /* ==========================================================================
     12. NOTAS SOSTENIDAS
     ========================================================================== */

  // Completa una nota sostenida: suma puntos (y energía si es especial).
  function finishHold(note, time) {
    note.holding = false;
    note.hit = true;
    note.element.remove();
    registerHit();
    score += 200 * currentMultiplier(time);
    recoverPerformance(PERFORMANCE_RECOVERY.hold);
    if (note.boost) pendingEnergy.push({startedAt: time, appliedMs: 0, amount: SPECIAL_CHARGE_AMOUNT});
    updateScore(time);
    updateBoostUI();
    showJudgement('EXCELENTE', '#50e7f2');
    setFeedback('¡NOTA SOSTENIDA!');
    playFeedbackTone(true);
  }

  // Soltar la tecla antes de tiempo rompe la nota y cuenta como fallo.
  function failHold(note, time) {
    note.holding = false;
    note.missed = true;
    note.element.remove();
    registerMiss(time, 'SOLTASTE LA TECLA ANTES DE TIEMPO');
    showJudgement('FALLO', '#ff687e');
    playFeedbackTone(false);
  }

  /* ==========================================================================
     13. GOLPES
     ========================================================================== */

  // Califica el golpe según el error de tiempo (menos error = más puntos y más desempeño).
  function getJudgement(timingError, hitWindowMs = HIT_WINDOW_MS) {
    const normalizedError = timingError * HIT_WINDOW_MS / hitWindowMs;
    if (normalizedError <= 35)  return {label:'EXCELENTE', points:150, recovery:PERFORMANCE_RECOVERY.excellent, color:'#a989ff'};
    if (normalizedError <= 75)  return {label:'BUENO',     points:120, recovery:PERFORMANCE_RECOVERY.good,      color:'#50e7f2'};
    if (normalizedError <= 115) return {label:'BIEN',      points:90,  recovery:PERFORMANCE_RECOVERY.okay,      color:'#ffd65a'};
    return {label:'MALO', points:50, recovery:PERFORMANCE_RECOVERY.poor, color:'#ff687e'};
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

  // Busca (con búsqueda binaria) la nota pendiente más cercana del carril dentro de su ventana de acierto.
  function findHitCandidate(lane, time) {
    let candidate = null;
    let timingError = Infinity;
    const laneNotes = notesByLane[lane];

    let low = 0;
    let high = laneNotes.length;
    const earliest = time - HIT_WINDOW_MS;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (laneNotes[middle].timeMs < earliest) low = middle + 1;
      else high = middle;
    }

    for (let index = low; index < laneNotes.length; index++) {
      const note = laneNotes[index];
      if (note.timeMs > time + HIT_WINDOW_MS) break;
      if (note.hit || note.missed) continue;
      const error = Math.abs(note.timeMs - time);
      const noteWindow = note.hitWindowMs ?? HIT_WINDOW_MS;
      if (error <= noteWindow && error < timingError) {
        candidate = note;
        timingError = error;
      }
    }
    return {candidate, timingError};
  }

  // Evalúa una pulsación: fallo, inicio de nota sostenida o acierto normal.
  function pressLane(lane) {
    if (!running) return;
    const time = songClock();
    const {candidate, timingError} = findHitCandidate(lane, time);

    flashReceptor(lane);

    // Fallo: no había nota al alcance.
    if (!candidate) {
      registerMiss(time);
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

    // Nota normal: suma puntos según precisión y multiplicador de combo.
    candidate.hit = true;
    candidate.element.remove();
    registerHit();
    const multiplier = currentMultiplier(time);
    const judgement = getJudgement(timingError, candidate.hitWindowMs ?? HIT_WINDOW_MS);
    score += judgement.points * multiplier;
    recoverPerformance(judgement.recovery);
    if (candidate.boost) pendingEnergy.push({startedAt: time, appliedMs: 0, amount: SPECIAL_CHARGE_AMOUNT});
    updateScore(time);
    updateBoostUI();
    showJudgement(judgement.label, judgement.color);
    setFeedback(candidate.boost ? '¡GEMA ESPECIAL! +25% DE IMPULSO' : '¡ACIERTO!');
    playFeedbackTone(true);
  }

  /* ==========================================================================
     14. BUCLE DE ANIMACIÓN
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
    if (untilHit < -(note.hitWindowMs ?? HIT_WINDOW_MS)) {
      note.missed = true;
      note.element.remove();
      registerMiss(songTime);
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

  // Se ejecuta en cada cuadro: avanza reloj, energía y notas, y termina el nivel cuando no quedan notas.
  function frame() {
    requestAnimationFrame(frame);
    if (!running) return;

    const time = chartTime();
    const songTime = time + (chart.offsetMs || 0);
    clockEl.textContent = formatTime(time);
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
      if (!running) break; // una derrota pudo terminar la partida a mitad del recorrido
    }

    if (!preRoll && notes.every(note => note.missed || (note.hit && !note.holding))) finishLevel();
  }

  /* ==========================================================================
     15. TECLADO
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
    try { localStorage.setItem(LANE_KEYS_STORAGE_KEY, JSON.stringify(laneKeys)); } catch (error) {}
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
     16. CARGA DE MAPA Y CANCIÓN
     ========================================================================== */

  // Lee el JSON elegido por el jugador y lo usa como mapa.
  async function loadChart(file) {
    const version = ++chartLoadVersion;
    try {
      const parsedChart = parseChart(JSON.parse(await file.text()));
      if (version !== chartLoadVersion) return;
      chart = parsedChart;
      selectedChart = chart;
      reset(); // ya reconstruye las notas
      setFeedback(`MAPA CARGADO: ${chart.notes.length} NOTAS`);
    } catch (error) {
      if (version === chartLoadVersion) {
        setFeedback('NO SE PUDO LEER EL MAPA', '#ff687e');
        console.error(error);
      }
    }
  }

  // Carga automáticamente el mapa JSON incluido para que Story Mode use sus notas.
  async function loadBundledChart() {
    const version = ++chartLoadVersion;
    try {
      const response = await fetch(new URL('./game-over-baby-chart.json', window.location.href));
      if (!response.ok) throw new Error(`No se pudo cargar el mapa (${response.status})`);
      const parsedChart = parseChart(await response.json());
      if (version !== chartLoadVersion) return;
      chart = parsedChart;
      selectedChart = parsedChart;
      resetNotes();
      setFeedback(`MAPA LISTO: ${parsedChart.notes.length} NOTAS`);
    } catch (error) {
      // El mapa de respaldo sigue disponible si se abre la página sin servidor local.
      console.warn('Se usará el mapa integrado de respaldo:', error);
    }
  }

  // Permite sustituir el MP3 incluido por un archivo local del jugador.
  function loadSongFile(file) {
    reset();
    if (songObjectUrl) URL.revokeObjectURL(songObjectUrl);
    songObjectUrl = URL.createObjectURL(file);
    songAudio.src = songObjectUrl;
    songAudio.load();
    songName.textContent = file.name;
    setFeedback(`CANCIÓN CARGADA: ${file.name}`);
  }

  /* ==========================================================================
     17. OPCIONES GUARDADAS, EVENTOS Y ARRANQUE
     ========================================================================== */

  // Lee un volumen guardado (0 a 100); devuelve NaN si no hay ninguno.
  function readSavedVolume(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? NaN : Number(raw);
    } catch (error) { return NaN; }
  }

  // Conecta un deslizador de volumen: restaura su valor guardado y guarda cada cambio.
  function setupVolumeSlider(slider, output, storageKey, apply) {
    const saved = readSavedVolume(storageKey);
    if (Number.isFinite(saved) && saved >= 0 && saved <= 100) slider.value = String(saved);
    apply(Number(slider.value) / 100);
    output.value = `${slider.value}%`;

    slider.addEventListener('input', event => {
      apply(Number(event.target.value) / 100);
      output.value = `${event.target.value}%`;
      try { localStorage.setItem(storageKey, event.target.value); } catch (error) {}
    });
  }

  // Volumen de efectos (tonos de acierto y fallo) y de la música.
  function setupVolume() {
    setupVolumeSlider(volumeControl, volumeValue, EFFECTS_VOLUME_KEY, value => { feedbackVolume = value; });
    setupVolumeSlider(musicVolume, musicVolumeValue, MUSIC_VOLUME_KEY, value => { songAudio.volume = value; });
  }

  // Restaura teclas y dificultad guardadas entre sesiones.
  function loadSavedOptions() {
    try {
      const savedKeys = JSON.parse(localStorage.getItem(LANE_KEYS_STORAGE_KEY) || 'null');
      if (Array.isArray(savedKeys) && savedKeys.length === 4 && savedKeys.every(key => typeof key === 'string') && new Set(savedKeys).size === 4) {
        laneKeys = savedKeys;
      }
      const savedDifficulty = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
      if (savedDifficulty && DIFFICULTIES[savedDifficulty]) difficultySelect.value = savedDifficulty;
    } catch (error) {}
  }

  function bindEvents() {
    window.addEventListener('pagehide', () => savePlayerProfile(true));
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
      try { localStorage.setItem(LANE_KEYS_STORAGE_KEY, JSON.stringify(laneKeys)); } catch (error) {}
      bindingLane = null;
      refreshKeyButtons();
      setFeedback('FLECHAS RESTAURADAS');
    });

    // La dificultad ajusta a la vez la caída, la densidad del mapa y la práctica.
    difficultySelect.addEventListener('change', () => {
      leadMs = getDifficultyConfig().leadMs;
      try { localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficultySelect.value); } catch (error) {}
    });
    $('#resetButton').addEventListener('click', reset);

    // Eventos que dispara el menú: historia, práctica y salir.
    document.addEventListener('rhythm:start', () => {
      leadMs = getDifficultyConfig().leadMs;
      chart = applyDifficulty(selectedChart);
      prepareFeedbackAudio();
      start();
    });
    document.addEventListener('rhythm:practice', () => {
      leadMs = getDifficultyConfig().leadMs;
      chart = createPracticeChart();
      prepareFeedbackAudio();
      start();
    });
    document.addEventListener('rhythm:stop', () => {
      chart = selectedChart;
      reset();
    });

    // Cargar un mapa JSON o una canción propia.
    $('#chartFile').addEventListener('change', event => {
      const file = event.target.files[0];
      if (file) loadChart(file);
    });
    songFileInput.addEventListener('change', event => {
      const file = event.target.files[0];
      if (file) loadSongFile(file);
    });

    // Al terminar la canción, termina el nivel.
    songAudio.addEventListener('ended', () => { if (running) finishLevel(); });
  }

  // Prepara progreso, opciones, mapa, marcadores y bucle al abrir la página.
  function init() {
    levelMusic.volume = 0.6;
    loadStoredProgress();
    loadSavedOptions();
    leadMs = getDifficultyConfig().leadMs;
    setupVolume();
    bindEvents();
    refreshKeyButtons();
    resetNotes();
    updateScore(0);
    updateBoostUI();
    requestAnimationFrame(frame);
    loadBundledChart();
  }

  init();
})();