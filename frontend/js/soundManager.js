const sounds = {
  spin: new Audio('sounds/spin.mp3'),
  win: new Audio('sounds/win.mp3'),
  bigwin: new Audio('sounds/bigwin.mp3'),
};

function playSound(name) {
  const sound = sounds[name];
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(e => {
    // В браузере звук может быть заблокирован до первого взаимодействия
    console.warn(`Sound '${name}' couldn't play:`, e.message);
  });
}