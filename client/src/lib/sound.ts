let gameplayAudio: HTMLAudioElement | null = null;
let isMuted = false;

export const toggleMute = () => {
  isMuted = !isMuted;

  if (gameplayAudio) {
    gameplayAudio.muted = isMuted;
  }

  return isMuted;
};

export const getMuteState = () => isMuted;

export const playGameplaySound = () => {
  if (isMuted) return;

  if (!gameplayAudio) {
    gameplayAudio = new Audio("/sounds/gameplay.mp3");
    gameplayAudio.volume = 0.12;

    const loopStart = 5;
    const loopEnd = 15;

    gameplayAudio.currentTime = loopStart;

    gameplayAudio.addEventListener("timeupdate", () => {
      if (!gameplayAudio) return;

      if (gameplayAudio.currentTime >= loopEnd) {
        gameplayAudio.currentTime = loopStart;
        gameplayAudio.play();
      }
    });
  }

  gameplayAudio.muted = isMuted;
  gameplayAudio.play().catch(() => {});
};

export const stopGameplaySound = () => {
  if (gameplayAudio) {
    gameplayAudio.pause();
    gameplayAudio.currentTime = 0;
  }
};
