import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.149.0/+esm";
import { VRMHumanBoneName, VRMHumanBoneParentMap } from "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@1.0.9/+esm";
import { VRMAnimation } from "./VRMAnimation.js";
import { arrayChunk } from "./utils/arrayChunk.js";

const MAT4_IDENTITY = new THREE.Matrix4();

const _v3A = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _quatB = new THREE.Quaternion();
const _quatC = new THREE.Quaternion();

// interface VRMAnimationLoaderPluginNodeMap {
//   humanoidIndexToName: Map<number, VRMHumanBoneName>;
//   expressionsIndexToName: Map<number, string>;
//   lookAtIndex: number | null;
// }

// type VRMAnimationLoaderPluginWorldMatrixMap = Map<
//   VRMHumanBoneName | "hipsParent",
//   THREE.Matrix4
// >;

export class VRMAnimationLoaderPlugin {
  // public readonly parser: GLTFParser;

  constructor(
    parser,
    options
  ) {
    this.parser = parser;
  }

  get name() {
    return "VRMC_vrm_animation";
  }

  async afterRoot(gltf) {
    const defGltf = gltf.parser.json;
    const defExtensionsUsed = defGltf.extensionsUsed;

    if (
      defExtensionsUsed == null ||
      defExtensionsUsed.indexOf(this.name) == -1
    ) {
      return;
    }

    const defExtension = defGltf.extensions?.[this.name];

    if (defExtension == null) {
      return;
    }

    const nodeMap = this._createNodeMap(defExtension);
    const worldMatrixMap = await this._createBoneWorldMatrixMap(
      gltf,
      defExtension
    );

    const hipsNode = defExtension.humanoid.humanBones["hips"].node;
    const hips = (await gltf.parser.getDependency(
      "node",
      hipsNode
    ));
    const restHipsPosition = hips.getWorldPosition(new THREE.Vector3());

    const clips = gltf.animations;
    const animations = clips.map((clip, iAnimation) => {
      const defAnimation = defGltf.animations[iAnimation];

      const animation = this._parseAnimation(
        clip,
        defAnimation,
        nodeMap,
        worldMatrixMap
      );
      animation.restHipsPosition = restHipsPosition;

      return animation;
    });

    gltf.userData.vrmAnimations = animations;
  }

  _createNodeMap(defExtension) {
    const humanoidIndexToName = new Map();
    const expressionsIndexToName = new Map();
    let lookAtIndex;

    // humanoid
    const humanBones = defExtension.humanoid?.humanBones;

    if (humanBones) {
      Object.entries(humanBones).forEach(([name, bone]) => {
        const { node } = bone;
        humanoidIndexToName.set(node, name);
      });
    }

    // expressions
    const preset = defExtension.expressions?.preset;

    if (preset) {
      Object.entries(preset).forEach(([name, expression]) => {
        const { node } = expression;
        expressionsIndexToName.set(node, name);
      });
    }

    const custom = defExtension.expressions?.custom;

    if (custom) {
      Object.entries(custom).forEach(([name, expression]) => {
        const { node } = expression;
        expressionsIndexToName.set(node, name);
      });
    }

    // lookAt
    lookAtIndex = defExtension.lookAt?.node ?? null;

    return { humanoidIndexToName, expressionsIndexToName, lookAtIndex };
  }

  async _createBoneWorldMatrixMap(gltf, defExtension) {
    // update the entire hierarchy first
    gltf.scene.updateWorldMatrix(false, true);

    const threeNodes = (await gltf.parser.getDependencies(
      "node"
    ));

    const worldMatrixMap = new Map();

    for (const [boneName, { node }] of Object.entries(
      defExtension.humanoid.humanBones
    )) {
      const threeNode = threeNodes[node];
      worldMatrixMap.set(boneName, threeNode.matrixWorld);

      if (boneName === "hips") {
        worldMatrixMap.set(
          "hipsParent",
          threeNode.parent?.matrixWorld ?? MAT4_IDENTITY
        );
      }
    }

    return worldMatrixMap;
  }

  _parseAnimation(
    animationClip,
    defAnimation,
    nodeMap,
    worldMatrixMap
  ) {
    const tracks = animationClip.tracks;
    const defChannels = defAnimation.channels;

    const result = new VRMAnimation();

    result.duration = animationClip.duration;

    defChannels.forEach((channel, iChannel) => {
      const { node, path } = channel.target;
      const origTrack = tracks[iChannel];

      if (node == null) {
        return;
      }

      // humanoid
      const boneName = nodeMap.humanoidIndexToName.get(node);
      if (boneName != null) {
        let parentBoneName = VRMHumanBoneParentMap[boneName];
        while (
          parentBoneName != null &&
          worldMatrixMap.get(parentBoneName) == null
        ) {
          parentBoneName = VRMHumanBoneParentMap[parentBoneName];
        }
        parentBoneName ??= "hipsParent";

        if (path === "translation") {
          const hipsParentWorldMatrix = worldMatrixMap.get("hipsParent");

          const trackValues = arrayChunk(origTrack.values, 3).flatMap((v) =>
            _v3A.fromArray(v).applyMatrix4(hipsParentWorldMatrix).toArray()
          );

          const track = origTrack.clone();
          track.values = new Float32Array(trackValues);

          result.humanoidTracks.translation.set(boneName, track);
        } else if (path === "rotation") {
          // a  = p^-1 * a' * p * c
          // a' = p * p^-1 * a' * p * c * c^-1 * p^-1
          //    = p * a * c^-1 * p^-1

          const worldMatrix = worldMatrixMap.get(boneName);
          const parentWorldMatrix = worldMatrixMap.get(parentBoneName);

          _quatA.setFromRotationMatrix(worldMatrix).normalize().invert();
          _quatB.setFromRotationMatrix(parentWorldMatrix).normalize();

          const trackValues = arrayChunk(origTrack.values, 4).flatMap((q) =>
            _quatC.fromArray(q).premultiply(_quatB).multiply(_quatA).toArray()
          );

          const track = origTrack.clone();
          track.values = new Float32Array(trackValues);

          result.humanoidTracks.rotation.set(boneName, track);
        } else {
          throw new Error(`Invalid path "${path}"`);
        }
        return;
      }

      // expressions
      const expressionName = nodeMap.expressionsIndexToName.get(node);
      if (expressionName != null) {
        if (path === "translation") {
          const times = origTrack.times;
          const values = new Float32Array(origTrack.values.length / 3);
          for (let i = 0; i < values.length; i++) {
            values[i] = origTrack.values[3 * i];
          }

          const newTrack = new THREE.NumberKeyframeTrack(
            `${expressionName}.weight`,
            times,
            values
          );
          result.expressionTracks.set(expressionName, newTrack);
        } else {
          throw new Error(`Invalid path "${path}"`);
        }
        return;
      }

      // lookAt
      if (node === nodeMap.lookAtIndex) {
        if (path === "rotation") {
          result.lookAtTrack = origTrack;
        } else {
          throw new Error(`Invalid path "${path}"`);
        }
      }
    });

    return result;
  }
}
