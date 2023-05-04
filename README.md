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

canvas.addEventListener("dragover", function (event) {
  event.preventDefault();
});

canvas.addEventListener("drop", function (event) {
  event.preventDefault();

  const files = event.dataTransfer?.files;
  if(!files) {
    return;
  }

  const file = files[0];
  if(!file) {
    return;
  }

  const file_type = file.name.split(".").pop();
  if(file_type === "vrm") {
    const blob = new Blob([file], { type: "application/octet-stream" });
    const url = window.URL.createObjectURL(blob);
    viewer.loadVrm(url);
  }
});

viewer.model.emoteController.playEmotion("happy");
await new Promise(r => setTimeout(r, 1000));
viewer.model.emoteController.playEmotion("neutral");

// Valid expressions: neutral, happy, angry, sad, relaxed

let arrayBuffer = await fetch("https://example.com/foo.mp3").then(r => r.arrayBuffer());
await viewer.model.speak(arrayBuffer, {expression:"happy"});
```
