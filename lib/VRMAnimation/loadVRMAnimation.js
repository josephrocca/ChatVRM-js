import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.149.0/examples/jsm/loaders/GLTFLoader.js';
import { VRMAnimation } from './VRMAnimation.js';
import { VRMAnimationLoaderPlugin } from './VRMAnimationLoaderPlugin.js';

const loader = new GLTFLoader();
loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

export async function loadVRMAnimation(url) {
  const gltf = await loader.loadAsync(url);

  const vrmAnimations = gltf.userData.vrmAnimations;
  const vrmAnimation = vrmAnimations[0];

  return vrmAnimation ?? null;
}
