# ChatVRM Viewer (JS)
A JS conversion/adaptation of parts of the [ChatVRM](https://github.com/pixiv/ChatVRM) (TypeScript) code for use in [OpenCharacters](https://github.com/josephrocca/OpenCharacters). I've extracted just the VRM "speaking character" viewer from the web app.

```js
let viewer = await import("https://cdn.jsdelivr.net/gh/josephrocca/ChatVRM-js@v0.0.19/features/vrmViewer/viewer.js").then(m => m.Viewer);

const canvas = document.createElement("canvas");
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;
document.body.appendChild(canvas);

viewer.setup(canvas);
await viewer.loadVrm("https://cdn.jsdelivr.net/gh/josephrocca/ChatVRM-js@v0.0.19/AvatarSample_B.vrm");

// Emotion / facial expression:
viewer.model.emoteController.playEmotion("happy"); // Valid expressions: neutral, happy, angry, sad, relaxed

// Speak:
let arrayBuffer = await fetch("https://example.com/foo.mp3").then(r => r.arrayBuffer());
await viewer.model.speak(arrayBuffer, {expression:"happy"});

// Animations:
await viewer.model.loadAnimation("https://cdn.jsdelivr.net/gh/josephrocca/ChatVRM-js@v0.0.28/OpenCharacters/animations/silly_dancing.fbx");

// Example of loading a new VRM file when drag-and-dropped:
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
