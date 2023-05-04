import { ExpressionController } from "./expressionController.js";

/**
 * 感情表現としてExpressionとMotionを操作する為のクラス
 * デモにはExpressionのみが含まれています
 */
export class EmoteController {
  // private _expressionController: ExpressionController;

  constructor(vrm, camera) {
    this._expressionController = new ExpressionController(vrm, camera);
  }

  playEmotion(preset) {
    this._expressionController.playEmotion(preset);
  }

  lipSync(preset, value) {
    this._expressionController.lipSync(preset, value);
  }

  update(delta) {
    this._expressionController.update(delta);
  }
}
