import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.149.0/+esm";
import { VRM, VRMLoaderPlugin, VRMUtils } from "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@1.0.9/+esm";
import { GLTFLoader } from "../../GLTFLoader/GLTFLoader.js";
import { loadMixamoAnimation } from '../../mixamo/loadMixamoAnimation.js';
import { VRMLookAtSmootherLoaderPlugin } from "../../lib/VRMLookAtSmootherLoaderPlugin/VRMLookAtSmootherLoaderPlugin.js";
import { LipSync } from "../lipSync/lipSync.js";
import { EmoteController } from "../emoteController/emoteController.js";
import { loadVRMAnimation } from "../../lib/VRMAnimation/loadVRMAnimation.js";


/**
 * 3Dキャラクターを管理するクラス
 */
export class Model {
  // public vrm?: VRM | null;
  // public mixer?: THREE.AnimationMixer;
  // public emoteController?: EmoteController;

  // private _lookAtTargetParent: THREE.Object3D;
  // private _lipSync?: LipSync;

  constructor(lookAtTargetParent) {
    this._lookAtTargetParent = lookAtTargetParent;
    this._lipSync = new LipSync(new AudioContext());
  }

  async loadVRM(url) {
    const loader = new GLTFLoader();
    loader.register(
      (parser) =>
        new VRMLoaderPlugin(parser, {
          lookAtPlugin: new VRMLookAtSmootherLoaderPlugin(parser),
        })
    );

    const gltf = await loader.loadAsync(url);

    const vrm = (this.vrm = gltf.userData.vrm);
    vrm.scene.name = "VRMRoot";

    VRMUtils.rotateVRM0(vrm);
    this.mixer = new THREE.AnimationMixer(vrm.scene);

    this.emoteController = new EmoteController(vrm, this._lookAtTargetParent);
  }

  unLoadVrm() {
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
  }

  /**
   * VRMアニメーションを読み込む
   *
   * https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm_animation-1.0/README.ja.md
   */
  async loadAnimation(input) {
    const { vrm, mixer } = this;
    if (vrm == null || mixer == null) {
      throw new Error("You have to load VRM first");
    }

    let clip;
    if(input.expressionTracks) { // <-- crudely detect if it's a VRMAnimation object
      clip = input.createAnimationClip(vrm);
    } else if(typeof input === "string") { // <-- it's a URL
      if(input.endsWith(".vrma")) {
        const vrma = await loadVRMAnimation(input);
        if (vrma) {
          this.loadAnimation(vrma);
          return;
        }
      } else {
        // assume it's an fbx file
        clip = await loadMixamoAnimation(input, vrm);
      }
    }
    const action = mixer.clipAction(clip);
    action.play();
  }

  /**
   * 音声を再生し、リップシンクを行う
   */
  async speak(buffer, opts={}) { // opts={expression, volume}
    this.emoteController?.playEmotion(opts.expression);
    await new Promise((resolve) => {
      this._lipSync?.playFromArrayBuffer(buffer, () => {
        resolve(true);
      }, opts);
    });
  }

  update(delta) {
    if (this._lipSync) {
      const { volume } = this._lipSync.update();
      this.emoteController?.lipSync("aa", volume);
    }

    this.emoteController?.update(delta);
    this.mixer?.update(delta);
    this.vrm?.update(delta);
  }
}
