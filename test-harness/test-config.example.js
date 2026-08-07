// Local harness only. Never load the production config.js in test HTML.
// This mirrors the app's emulator guard contract; actual values stay test-only.
window.WORK_BOARD_TEST = Object.freeze({ emulator: true, host: '127.0.0.1', port: 9000 });
window.WORK_BOARD_TEST_CONFIG = Object.freeze({
  databaseURL: 'http://127.0.0.1:9000/?ns=work-board-test',
  roomId: 'test-delete-protocol'
});
