import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.149.0/+esm";

/**
 * 目線を制御するクラス
 *
 * サッケードはVRMLookAtSmootherの中でやっているので、
 * より目線を大きく動かしたい場合はここに実装する。
 */
export class AutoLookAt {
  // private _lookAtTarget: THREE.Object3D;
  constructor(vrm, camera) {
    this._lookAtTarget = new THREE.Object3D();
    camera.add(this._lookAtTarget);

    if (vrm.lookAt) vrm.lookAt.target = this._lookAtTarget;
  }
}
