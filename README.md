# ChatVRM Viewer (JS)
A JS conversion/adaptation of parts of the [ChatVRM](https://github.com/pixiv/ChatVRM) (TypeScript) code for use in [OpenCharacters](https://github.com/josephrocca/OpenCharacters). I've extracted just the VRM "speaking character" viewer from the web app.

```js
// setup viewer:
const Viewer = await import("https://cdn.jsdelivr.net/gh/josephrocca/ChatVRM-js@v0.0.28/features/vrmViewer/viewer.js").then(m => m.Viewer);
window.viewer = new Viewer();

// add canvas
const canvas = document.createElement("canvas");
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;
document.body.appendChild(canvas);
canvas.style.cssText = "width:100vw; height:100vh; display:block;";
document.body.style.cssText = "margin:0; padding:0;";

// link viewer to canvas:
viewer.setup(canvas);

// load VRM character file:
await viewer.loadVrm("https://raw.githubusercontent.com/josephrocca/ChatVRM-js/main/avatars/AvatarSample_B.vrm");

// Change emotion / facial expression:
viewer.model.emoteController.playEmotion("happy"); // Valid expressions: neutral, happy, angry, sad, relaxed

// Play animation:
await viewer.model.loadAnimation("https://cdn.jsdelivr.net/gh/josephrocca/ChatVRM-js@v0.0.28/OpenCharacters/animations/silly_dancing.fbx");

// Wait for user to interact with the page before trying to play audio
if(!navigator.userActivation?.hasBeenActive) {
  await new Promise(resolve => window.addEventListener("click", resolve, {once:true}));
}

// Speak:
let arrayBuffer = await fetch("https://cdn.jsdelivr.net/gh/josephrocca/ChatVRM-js@v0.0.22/OpenCharacters/dummy-audio/12.mp3").then(r => r.arrayBuffer());
await viewer.model.speak(arrayBuffer, {expression:"happy", volume:0}); // here i set volume to zero because this is just dummy audio - but you can e.g. use elevenlabs, or whatever, of course
```

Example of loading a new VRM file when dragged-and-dropped on the page:
```js
canvas.addEventListener("dragover", function (event) {
  event.preventDefault();
});
canvas.addEventListener("drop", awync function (event) {
  event.preventDefault();
  const file = event.dataTransfer?.files?[0];
  
  const file_type = file.name.split(".").pop();
  if(file_type === "vrm") {
    const blob = new Blob([file], { type: "application/octet-stream" });
    const url = window.URL.createObjectURL(blob);
    await viewer.loadVrm(url);
  }
});
```
