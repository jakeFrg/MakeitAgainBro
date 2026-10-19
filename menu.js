// Maneja el menú principal, la introducción de historia, los créditos, la configuración y la práctica.
(() => {
  'use strict';

  /* ==========================================================================
     1. CONFIGURACIÓN
     ========================================================================== */

  // Escenas de la introducción del modo historia: se muestran una tras otra.
  const STORY_SCENES = [
    {label:'CAPÍTULO 01',     title:'LA CIUDAD PERDIÓ SU RITMO',        text:'Las luces se apagaron. El escenario quedó en silencio.'},
    {label:'SEÑAL DETECTADA', title:'LA PISTA VUELVE A ENCENDERSE',     text:'Cuatro carriles marcan el camino. Prepárate para seguirlos.'},
    {label:'INICIO INMINENTE', title:'¿LISTO PARA JUGAR?',              text:'La partida comenzará después de esta introducción.'}
  ];
  const SCENE_DURATION_MS  = 1600; // tiempo que se ve cada escena
  const SCENE_ANIMATION_MS = 420;  // duración de la animación de entrada

  /* ==========================================================================
     2. ELEMENTOS DE LA PÁGINA
     ========================================================================== */

  const $ = selector => document.querySelector(selector);

  const startScreen    = $('#startScreen');
  const mainMenu       = $('#mainMenu');
  const creditsPanel   = $('#creditsPanel');
  const settingsScreen = $('#settingsScreen');
  const storyIntro     = $('#storyIntro');

  const storyLabel = $('#storySceneLabel');
  const storyTitle = $('#storySceneTitle');
  const storyText  = $('#storySceneText');

  const backFromSettings = $('#backFromSettings');

  /* ==========================================================================
     3. ESTADO
     ========================================================================== */

  let storyTimer = 0;  // temporizador que avanza a la siguiente escena
  let sceneIndex = 0;  // escena que toca mostrar

  /* ==========================================================================
     4. NAVEGACIÓN ENTRE PANELES
     ========================================================================== */

  // Muestra solo el panel indicado y oculta los demás.
  function showOnly(panel) {
    for (const item of [mainMenu, creditsPanel, settingsScreen, storyIntro]) {
      item.hidden = item !== panel;
    }
  }

  // Vuelve al menú principal y cancela la introducción si estaba en marcha.
  function showMainMenu() {
    clearTimeout(storyTimer);
    startScreen.hidden = false;
    showOnly(mainMenu);
  }

  /* ==========================================================================
     5. MODO HISTORIA
     ========================================================================== */

  // Termina la introducción, oculta el menú y avisa al juego para empezar.
  function beginStoryGame() {
    clearTimeout(storyTimer);
    storyIntro.hidden = true;
    startScreen.hidden = true;
    document.body.classList.remove('practice-mode');
    document.dispatchEvent(new Event('rhythm:start'));
  }

  // Muestra la escena actual con una animación y programa la siguiente; al acabar, inicia el juego.
  function showStoryScene() {
    if (sceneIndex >= STORY_SCENES.length) {
      beginStoryGame();
      return;
    }

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
    storyTimer = setTimeout(showStoryScene, SCENE_DURATION_MS);
  }

  // Empieza la introducción desde la primera escena.
  function startStoryIntro() {
    showOnly(storyIntro);
    sceneIndex = 0;
    showStoryScene();
  }

  /* ==========================================================================
     6. PRÁCTICA
     ========================================================================== */

  // Oculta el menú y avisa al juego para empezar con notas aleatorias.
  function startPractice() {
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
     7. CRÉDITOS Y CONFIGURACIÓN
     ========================================================================== */

  function openCredits() {
    showOnly(creditsPanel);
  }

  // Abre la configuración y pone el foco en el botón de volver.
  function openSettings() {
    showOnly(settingsScreen);
    backFromSettings.focus();
  }

  /* ==========================================================================
     8. TECLA ESCAPE
     ========================================================================== */

  // Escape cierra la configuración o la introducción; en práctica sale al menú.
  function handleEscape(event) {
    if (event.key !== 'Escape') return;

    if (!settingsScreen.hidden || !storyIntro.hidden) {
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
     9. EVENTOS
     ========================================================================== */

  // Botones del menú principal.
  $('#startButton').addEventListener('click', startStoryIntro);
  $('#practiceButton').addEventListener('click', startPractice);
  $('#creditsButton').addEventListener('click', openCredits);
  $('#openSettingsButton').addEventListener('click', openSettings);

  // Botones para saltar la introducción o volver al menú.
  $('#skipStoryIntro').addEventListener('click', beginStoryGame);
  $('#backFromCredits').addEventListener('click', showMainMenu);
  backFromSettings.addEventListener('click', showMainMenu);

  document.addEventListener('keydown', handleEscape);
})();