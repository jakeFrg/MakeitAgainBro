// Maneja el menú principal, la introducción de historia, los créditos, las opciones, el leaderboard y la práctica.
(() => {
  'use strict';

  /* ==========================================================================
     1. CONFIGURACIÓN
     ========================================================================== */

  // Escenas de la introducción del modo historia: se muestran una tras otra.
  const STORY_SCENES = [
    {label:'CAPÍTULO 01', title:'¿DÓNDE ESTOY?',          text:'Acabas de despertar en tu habitación pero no se siente igual...'},
    {label:'CAPÍTULO 01', title:'1986!!',                 text:'Ves el calendario y ves que dice 1986, abres la ventana y ves luces de neón y música de Federico Mercurio...'},
    {label:'CAPÍTULO 01', title:'NO TIENES NADA',         text:'Te das cuenta de que no tienes un centavo y decides salir a volverte a ganar el público.'},
    {label:'CAPÍTULO 01', title:'¿LISTO PARA VOLVER?',    text:'Vuelves a cantar pero ahora debes ganarte a cada uno del público.'}
  ];
  const SCENE_DURATION_MS  = 5000; // tiempo que se ve cada escena
  const SCENE_ANIMATION_MS = 500;  // duración de la animación de cambio de escena

  // Texto del botón de la introducción: saltar mientras corre, empezar al llegar a la última escena.
  const SKIP_LABEL  = 'SALTAR INTRO ▶';
  const START_LABEL = 'EMPEZAR CANCIÓN ▶';

  const MENU_MUSIC_VOLUME = 0.4;

  // Secciones del menú de opciones: id de su página y título que se muestra.
  const OPTION_PAGES = {
    audio:      {id:'optionAudio',      label:'AUDIO'},
    difficulty: {id:'optionDifficulty', label:'DIFICULTAD'},
    song:       {id:'optionSong',       label:'CANCIÓN Y MAPA'},
    controls:   {id:'optionControls',   label:'CONTROLES'}
  };

  /* ==========================================================================
     2. ELEMENTOS DE LA PÁGINA
     ========================================================================== */

  const $ = selector => document.querySelector(selector);

  // Pantalla de inicio y sus paneles.
  const startScreen       = $('#startScreen');
  const mainMenu          = $('#mainMenu');
  const creditsPanel      = $('#creditsPanel');
  const settingsScreen    = $('#settingsScreen');
  const leaderboardScreen = $('#leaderboardScreen');
  const storyIntro        = $('#storyIntro');
  const panels = [mainMenu, creditsPanel, settingsScreen, leaderboardScreen, storyIntro];

  // Introducción de historia.
  const storyLabel     = $('#storySceneLabel');
  const storyTitle     = $('#storySceneTitle');
  const storyText      = $('#storySceneText');
  const skipStoryIntro = $('#skipStoryIntro');

  // Opciones.
  const backFromSettings = $('#backFromSettings');
  const optionsMenu      = $('#optionsMenu');
  const backToOptions    = $('#backToOptions');
  const optionsTitle     = $('#optionsTitle');
  const optionPages      = Array.from(document.querySelectorAll('.option-page'));

  // Música del menú.
  const menuMusic = $('#musicaMenu');

  /* ==========================================================================
     3. ESTADO
     ========================================================================== */

  let storyTimer = 0;  // temporizador que avanza a la siguiente escena
  let sceneIndex = 0;  // escena que toca mostrar

  /* ==========================================================================
     4. MÚSICA DEL MENÚ
     ========================================================================== */

  // Reproduce la música del menú (el navegador puede bloquearla hasta que haya un clic).
  function playMenuMusic() {
    menuMusic.play().catch(error => {
      console.log('No se pudo reproducir la música:', error);
    });
  }

  // Detiene la música del menú y la regresa al inicio.
  function stopMenuMusic() {
    menuMusic.pause();
    menuMusic.currentTime = 0;
  }

  /* ==========================================================================
     5. NAVEGACIÓN ENTRE PANELES
     ========================================================================== */

  // Muestra solo el panel indicado y oculta los demás.
  function showOnly(panel) {
    for (const item of panels) item.hidden = item !== panel;
  }

  // Vuelve al menú principal, cancela la introducción si estaba en marcha y pone la música.
  function showMainMenu() {
    clearTimeout(storyTimer);
    startScreen.hidden = false;
    showOnly(mainMenu);
    playMenuMusic();
  }

  /* ==========================================================================
     6. MODO HISTORIA
     ========================================================================== */

  // Cierra la introducción y el menú, y avisa al juego para empezar.
  function beginStoryGame() {
    clearTimeout(storyTimer);
    stopMenuMusic();
    storyIntro.hidden = true;
    startScreen.hidden = true;
    document.body.classList.remove('practice-mode');
    document.dispatchEvent(new Event('rhythm:start'));
  }

  // Muestra la escena actual con una animación; en la última, el botón cambia a "EMPEZAR CANCIÓN".
  function showStoryScene() {
    const scene = STORY_SCENES[sceneIndex];
    storyIntro.dataset.scene = String(sceneIndex); // el CSS cambia el color según la escena
    storyLabel.textContent = scene.label;
    storyTitle.textContent = scene.title;
    storyText.textContent  = scene.text;

    storyIntro.animate([
      {opacity:0, transform:'translateY(10px) scale(.98)'},
      {opacity:1, transform:'translateY(0) scale(1)'}
    ], {duration:SCENE_ANIMATION_MS, easing:'ease-out'});

    sceneIndex++;
    if (sceneIndex < STORY_SCENES.length) {
      storyTimer = setTimeout(showStoryScene, SCENE_DURATION_MS);
    } else {
      // La partida no empieza sola: el clic inicia el audio, como exigen los navegadores.
      skipStoryIntro.textContent = START_LABEL;
    }
  }

  // Empieza la introducción desde la primera escena.
  function startStoryIntro() {
    stopMenuMusic();
    showOnly(storyIntro);
    sceneIndex = 0;
    skipStoryIntro.textContent = SKIP_LABEL;
    showStoryScene();
  }

  /* ==========================================================================
     7. PRÁCTICA
     ========================================================================== */

  // Oculta el menú y avisa al juego para empezar con notas aleatorias.
  function startPractice() {
    stopMenuMusic();
    startScreen.hidden = true;
    document.body.classList.add('practice-mode'); // el CSS oculta la barra de impulso
    document.dispatchEvent(new Event('rhythm:practice'));
  }

  // Sale de la práctica: detiene el juego y vuelve al menú.
  function exitPractice() {
    document.body.classList.remove('practice-mode');
    document.dispatchEvent(new Event('rhythm:stop'));
    showMainMenu();
  }

  /* ==========================================================================
     8. CRÉDITOS, OPCIONES Y LEADERBOARD
     ========================================================================== */

  function openCredits() {
    showOnly(creditsPanel);
  }

  function openLeaderboard() {
    showOnly(leaderboardScreen);
  }

  // Muestra el menú de secciones de opciones y oculta todas las páginas.
  function showOptionsHome() {
    optionsMenu.hidden = false;
    backToOptions.hidden = true;
    optionPages.forEach(page => { page.hidden = true; });
    optionsTitle.textContent = 'OPCIONES';
  }

  // Abre las opciones (siempre en el menú de secciones) y pone el foco en el botón de volver.
  function openSettings() {
    showOptionsHome();
    showOnly(settingsScreen);
    backFromSettings.focus();
  }

  // Abre una sección de opciones (audio, dificultad, canción o controles).
  function openOptionPage(name) {
    const page = OPTION_PAGES[name];
    optionsMenu.hidden = true;
    optionPages.forEach(item => { item.hidden = item.id !== page.id; });
    backToOptions.hidden = false;
    optionsTitle.textContent = page.label;
  }

  /* ==========================================================================
     9. TECLA ESCAPE
     ========================================================================== */

  // Escape retrocede un paso: dentro de una sección de opciones vuelve a las opciones;
  // en opciones, leaderboard o introducción vuelve al menú; en práctica sale al menú.
  function handleEscape(event) {
    if (event.key !== 'Escape') return;

    if (!settingsScreen.hidden) {
      event.preventDefault();
      if (backToOptions.hidden) showMainMenu();
      else showOptionsHome();
      return;
    }

    if (!leaderboardScreen.hidden || !storyIntro.hidden) {
      event.preventDefault();
      showMainMenu();
      return;
    }

    if (document.body.classList.contains('practice-mode')) {
      event.preventDefault();
      exitPractice();
    }
  }

  /* ==========================================================================
     10. EVENTOS Y ARRANQUE
     ========================================================================== */

  function bindEvents() {
    // La música del menú empieza con el primer clic (los navegadores no permiten audio sin interacción).
    document.addEventListener('click', function startMenuMusicOnFirstClick() {
      if (!startScreen.hidden && menuMusic.paused) playMenuMusic();
    }, {once:true});

    // Botones del menú principal.
    $('#startButton').addEventListener('click', startStoryIntro);
    $('#practiceButton').addEventListener('click', startPractice);
    $('#openLeaderboardButton').addEventListener('click', openLeaderboard);
    $('#creditsButton').addEventListener('click', openCredits);
    $('#openSettingsButton').addEventListener('click', openSettings);

    // Botón de reiniciar: sale de la práctica y vuelve al menú (game.js también reinicia la partida).
    $('#resetButton').addEventListener('click', () => {
      document.body.classList.remove('practice-mode');
      showMainMenu();
    });

    // Secciones de opciones y su botón de volver.
    document.querySelectorAll('[data-option-page]').forEach(button => {
      button.addEventListener('click', () => openOptionPage(button.dataset.optionPage));
    });
    backToOptions.addEventListener('click', showOptionsHome);

    // Botones para saltar la introducción o volver al menú.
    skipStoryIntro.addEventListener('click', beginStoryGame);
    $('#backFromCredits').addEventListener('click', showMainMenu);
    backFromSettings.addEventListener('click', showMainMenu);
    $('#backFromLeaderboard').addEventListener('click', showMainMenu);

    document.addEventListener('keydown', handleEscape);
  }

  function init() {
    menuMusic.volume = MENU_MUSIC_VOLUME;
    bindEvents();
  }

  init();
})();