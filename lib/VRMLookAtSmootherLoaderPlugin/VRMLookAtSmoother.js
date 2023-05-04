import { VRMLookAt } from "https://unpkg.com/@pixiv/three-vrm@1.0.9";
import * as THREE from "https://unpkg.com/three@0.149.0/build/three.module.js";

/** サッケードが発生するまでの最小間隔 */
const SACCADE_MIN_INTERVAL = 0.5;

/**
 * サッケードが発生する確率
 */
const SACCADE_PROC = 0.05;

/** サッケードの範囲半径。lookAtに渡される値で、実際の眼球の移動半径ではないので、若干大きめに。 in degrees */
const SACCADE_RADIUS = 5.0;

const _v3A = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _eulerA = new THREE.Euler();

/**
 * `VRMLookAt` に以下の機能を追加する:
 *
 * - `userTarget` がアサインされている場合、ユーザ方向にスムージングしながら向く
 * - 目だけでなく、頭の回転でも向く
 * - 眼球のサッケード運動を追加する
 */
export class VRMLookAtSmoother extends VRMLookAt {
  // /** スムージング用の係数 */
  smoothFactor = 4.0;

  // /** ユーザ向きに向く限界の角度 in degree */
  userLimitAngle = 90.0;

  // /** ユーザへの向き。もともと存在する `target` はアニメーションに使う */
  userTarget;

  // /** `false` にするとサッケードを無効にできます */
  enableSaccade;

  // /** サッケードの移動方向を格納しておく */
  #_saccadeYaw = 0.0;

  // /** サッケードの移動方向を格納しておく */
  #_saccadePitch = 0.0;

  // /** このタイマーが SACCADE_MIN_INTERVAL を超えたら SACCADE_PROC の確率でサッケードを発生させる */
  #_saccadeTimer = 0.0;

  // /** スムージングするyaw */
  #_yawDamped = 0.0;

  // /** スムージングするpitch */
  #_pitchDamped = 0.0;

  // /** firstPersonBoneの回転を一時的にしまっておくやつ */
  #_tempFirstPersonBoneQuat = new THREE.Quaternion();

  constructor(humanoid, applier) {
    super(humanoid, applier);

    this.enableSaccade = true;
  }

  update(delta) {
    if (this.target && this.autoUpdate) {
      // アニメーションの視線
      // `_yaw` と `_pitch` のアップデート
      this.lookAt(this.target.getWorldPosition(_v3A));

      // アニメーションによって指定されたyaw / pitch。この関数内で不変
      const yawAnimation = this._yaw;
      const pitchAnimation = this._pitch;

      // このフレームで最終的に使うことになるyaw / pitch
      let yawFrame = yawAnimation;
      let pitchFrame = pitchAnimation;

      // ユーザ向き
      if (this.userTarget) {
        // `_yaw` と `_pitch` のアップデート
        this.lookAt(this.userTarget.getWorldPosition(_v3A));

        // 角度の制限。 `userLimitAngle` を超えていた場合はアニメーションで指定された方向を向く
        if (
          this.userLimitAngle < Math.abs(this._yaw) ||
          this.userLimitAngle < Math.abs(this._pitch)
        ) {
          this._yaw = yawAnimation;
          this._pitch = pitchAnimation;
        }

        // yawDamped / pitchDampedをスムージングする
        const k = 1.0 - Math.exp(-this.smoothFactor * delta);
        this.#_yawDamped += (this._yaw - this.#_yawDamped) * k;
        this.#_pitchDamped += (this._pitch - this.#_pitchDamped) * k;

        // アニメーションとブレンディングする
        // アニメーションが横とかを向いている場合はそっちを尊重する
        const userRatio =
          1.0 -
          THREE.MathUtils.smoothstep(
            Math.sqrt(
              yawAnimation * yawAnimation + pitchAnimation * pitchAnimation
            ),
            30.0,
            90.0
          );

        // yawFrame / pitchFrame に結果を代入
        yawFrame = THREE.MathUtils.lerp(
          yawAnimation,
          0.6 * this.#_yawDamped,
          userRatio
        );
        pitchFrame = THREE.MathUtils.lerp(
          pitchAnimation,
          0.6 * this.#_pitchDamped,
          userRatio
        );

        // 頭も回す
        _eulerA.set(
          -this.#_pitchDamped * THREE.MathUtils.DEG2RAD,
          this.#_yawDamped * THREE.MathUtils.DEG2RAD,
          0.0,
          VRMLookAt.EULER_ORDER
        );
        _quatA.setFromEuler(_eulerA);

        const head = this.humanoid.getRawBoneNode("head");
        this.#_tempFirstPersonBoneQuat.copy(head.quaternion);
        head.quaternion.slerp(_quatA, 0.4);
        head.updateMatrixWorld();
      }

      if (this.enableSaccade) {
        // サッケードの移動方向を計算
        if (
          SACCADE_MIN_INTERVAL < this.#_saccadeTimer &&
          Math.random() < SACCADE_PROC
        ) {
          this.#_saccadeYaw = (2.0 * Math.random() - 1.0) * SACCADE_RADIUS;
          this.#_saccadePitch = (2.0 * Math.random() - 1.0) * SACCADE_RADIUS;
          this.#_saccadeTimer = 0.0;
        }

        this.#_saccadeTimer += delta;

        // サッケードの移動分を加算
        yawFrame += this.#_saccadeYaw;
        pitchFrame += this.#_saccadePitch;

        // applierにわたす
        this.applier.applyYawPitch(yawFrame, pitchFrame);
      }

      // applyはもうしたので、このフレーム内でアップデートする必要はない
      this._needsUpdate = false;
    }

    // targetでlookAtを制御しない場合
    if (this._needsUpdate) {
      this._needsUpdate = false;
      this.applier.applyYawPitch(this._yaw, this._pitch);
    }
  }

  /** renderしたあとに叩いて頭の回転をもとに戻す */
  revertFirstPersonBoneQuat() {
    if (this.userTarget) {
      const head = this.humanoid.getNormalizedBoneNode("head");
      head.quaternion.copy(this.#_tempFirstPersonBoneQuat);
    }
  }
}
