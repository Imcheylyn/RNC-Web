// Shared pointer position for Find the Labuu flashlight and game behavior.
let mx = window.innerWidth / 2;
let my = window.innerHeight / 2;

const flashlight = document.getElementById("flashlight");

document.getElementById("startLabuuButton").addEventListener("click", startLabuuGame);
if (new URLSearchParams(location.search).get("play") === "1") startLabuuGame();

function moveLabuuFlashlight(event) {
  mx = event.clientX;
  my = event.clientY;
  flashlight.style.setProperty("--beam-x", mx + "px");
  flashlight.style.setProperty("--beam-y", my + "px");
}
document.addEventListener("pointermove", moveLabuuFlashlight, { passive: true });
document.addEventListener("pointerdown", moveLabuuFlashlight, { passive: true });
