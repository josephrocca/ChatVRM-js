let [
  Viewer,
  prompt2,
] = await Promise.all([
  import("https://cdn.jsdelivr.net/gh/josephrocca/ChatVRM-js@v0.0.27/features/vrmViewer/viewer.js").then(m => m.Viewer),
  import("https://cdn.jsdelivr.net/gh/josephrocca/prompt2@v0.0.8/mod.js").then(m => m.default),
]);

window.onerror = async function(errorMsg, url, lineNumber, columnNumber, errorObj) {
  let result = await prompt2({
    blah: {type:"none", html:`An error occurred:<br><pre>${errorMsg}\n\nstack: ${errorObj?.stack}\n\nline: ${lineNumber}</pre>`},
  }, {cancelButtonText:"okay"});
  return false;
}

window.viewer = new Viewer();

document.body.style.cssText = "margin:0; padding:0;";

oc.window.show();

await new Promise(r => {
  setTimeout(r, 1000);
  //window.addEventListener("DOMContentLoaded", r);
});

const canvas = document.createElement("canvas");
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;
canvas.style.cssText = "width:100vw; height:100vh; display:block;";
document.body.appendChild(canvas);

let defaultVrmUrl = "https://raw.githubusercontent.com/josephrocca/ChatVRM-js/main/avatars/AvatarSample_B.vrm";

viewer.setup(canvas);
await viewer.loadVrm(oc.character.customData.vrmUrl || defaultVrmUrl);

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

async function pluginSettings() {
  let originalVrmUrl = oc.character.customData.vrmUrl;
  let result = await prompt2({
    vrmUrl: {type:"textLine", label: "Upload a VRM file to <a href='https://catbox.moe/'>catbox.moe</a> and put the URL here (url should end in <b>.vrm</b>). You can <b>make</b> a VRM character <a href='https://vroid.com/en/studio'>here</a>, or you can download one <a href='https://hub.vroid.com/en/models?is_other_users_available=1&is_downloadable=1'>here</a>.", defaultValue:oc.character.customData.vrmUrl || defaultVrmUrl},
    voiceAudioEnabled: {type:"select", label: "Voice audio enabled? (requires ElevenLabs API key)", options:[{value:"no"}, {value:"yes"}], defaultValue:oc.character.customData.voiceAudioEnabled || "no"},
    elevenLabsVoiceId: {show:d=>d.voiceAudioEnabled=="yes", type:"textLine", label: "Enter an ElevenLabs voice ID:", defaultValue:oc.character.customData.elevenLabsVoiceId || "21m00Tcm4TlvDq8ikWAM"},
    elevenLabsApiKey: {show:d=>d.voiceAudioEnabled=="yes", type:"textLine", label: "Enter your ElevenLabs API key (see <a href='https://beta.elevenlabs.io/speech-synthesis'>user settings</a>):", defaultValue:oc.character.customData.elevenLabsApiKey || ""},
  }, {cancelButtonText:null});
  
  oc.character.customData.vrmUrl = result.vrmUrl;
  oc.character.customData.voiceAudioEnabled = result.voiceAudioEnabled;
  oc.character.customData.elevenLabsVoiceId = result.elevenLabsVoiceId;
  oc.character.customData.elevenLabsApiKey = result.elevenLabsApiKey;

  if(oc.character.customData.vrmUrl !== originalVrmUrl) {
    viewer.loadVrm(oc.character.customData.vrmUrl);
  }
}

// button that hovers in bottom right:
let settingsButton = document.createElement("button");
settingsButton.style.cssText = `
  position: fixed;
  bottom: 0.5rem;
  right: 0.5rem;
  z-index: 100;
`;
settingsButton.textContent = "⚙️ settings";
settingsButton.onclick = pluginSettings;
document.body.appendChild(settingsButton);

// polyfill for navigator.userActivation
if(!navigator.userActivation) {
  navigator.userActivation = {hasBeenActive:false};
  let pageActivationClickHandler = (e) => {
    if(e.isTrusted) {
      navigator.userActivation.hasBeenActive = true;
      window.removeEventListener("click", pageActivationClickHandler);
    }
  }
  window.addEventListener("click", pageActivationClickHandler);
}

if(oc.character.customData.voiceAudioEnabled === undefined) {
  await pluginSettings();
}

if(!navigator.userActivation.hasBeenActive) {
  let result = await prompt2({
    blah: {type:"none", html:"Click start to initialize character (this is needed for technical reasons)."},
  }, {cancelButtonText:null, submitButtonText:"start"});
}

let sentence = "";
oc.thread.on("MessageAdded", async function () {
  let lastMessage = oc.thread.messages.at(-1);
  if(lastMessage.author !== "ai") return;
  await textToSpeechAndActions(lastMessage.content);
});

function parseSpeechActionText(text) {
  const regex = /(\[@(?:expression|action)=[^\]]+\])/g;
  const matches = text.split(regex);

  const chunks = [];

  matches.forEach(match => {
    if (match.startsWith("[@")) {
      const [property, value] = match.slice(2, -1).split("=");

      const chunk = {};
      chunk[property] = value;
      chunks.push(chunk);
    } else {
      chunks.push({ text: match });
    }
  });

  return chunks;
}

async function textToSpeechAndActions(text) {
  let chunks = parseSpeechActionText(text);
  
  let volume = oc.character.customData.voiceAudioEnabled === "yes" ? 1 : 0;
  let lastExpression = "neutral";
  let speechActionChunks = [];
  for(let chunk of chunks) {
    if(chunk.expression) {
      lastExpression = chunk.expression;
      continue;
    }
    if(chunk.text) {
      let bufferPromise;
      if(oc.character.customData.voiceAudioEnabled === "yes") {
        bufferPromise = fetch(`https://api.elevenlabs.io/v1/text-to-speech/${oc.character.customData.elevenLabsVoiceId}?optimize_streaming_latency=0`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "accept": "audio/mpeg",
            "xi-api-key": oc.character.customData.elevenLabsApiKey,
          },
          body: JSON.stringify({
            text: chunk.text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              "stability": 0,
              "similarity_boost": 0,
            },
          }),
        }).then(res => res.arrayBuffer()); 
      } else {
        let numWords = chunk.text.split(" ").length / 2;
        let filename = roundToNearestOfSet(numWords, [3, 6, 12, 24]) + ".mp3";
        bufferPromise = fetch(`https://cdn.jsdelivr.net/gh/josephrocca/ChatVRM-js@v0.0.22/OpenCharacters/dummy-audio/${filename}`).then(r => r.arrayBuffer());
      }
      speechActionChunks.push({bufferPromise, expression:lastExpression, text:chunk.text, volume});
    }
  }
  let buffers = await Promise.all(speechActionChunks.map(c => c.bufferPromise));
  for(let i = 0; i < speechActionChunks.length; i++) {
    let chunk = speechActionChunks[i];
    let buffer = buffers[i];
    await viewer.model.speak(buffer, {expression:chunk.expression, volume:chunk.volume});
  }

  // viewer.model.emoteController.playEmotion("neutral");
}

function roundToNearestOfSet(num, options) {
  return options.reduce((a, b) => Math.abs(num - a) < Math.abs(num - b) ? a : b);
}


oc.messageRenderingPipeline.push(function({message, reader}) {
  if(reader === "user") message.content = message.content.replace(/(\[@(?:expression|action)=[^\]]+\])/g, "");
});
