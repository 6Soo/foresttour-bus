"use strict";

const assert = require("node:assert/strict");
const { parseVisualPassport } = require("../mrz.js");

const croppedSecondLine = parseVisualPassport(`
  PASSPORT REPUBLIC OF KOREA
  PP KOR M123A4567
  15 JAN 1960 F
  20 JUN 2035
  P<KORKIM<<MINA<<<<<<<<<<<<<<<<<<<<<<<<
`);

assert.ok(croppedSecondLine, "MRZ 둘째 줄 없이도 여권으로 인식해야 한다");
assert.equal(croppedSecondLine.surname, "KIM");
assert.equal(croppedSecondLine.given, "MINA");
assert.equal(croppedSecondLine.passportNo, "M123A4567");
assert.equal(croppedSecondLine.birth8, "19600115");
assert.equal(croppedSecondLine.sex, "F");
assert.equal(croppedSecondLine.expiryIso, "2035-06-20");

const noisyOldPassport = parseVisualPassport(`
  OHH PASSPORT HYIR REPUBLIC OF KOREA
  PP KOR M8ITW36TL
  SOJA
  3 120/01C 1945 F
  04 6W/IUN 2026
  PPKORONCCSOJALLLLLLLLLLLLLLLLLLLLLLLL
`);

assert.ok(noisyOldPassport, "작은 구형 여권 OCR도 수정 가능한 결과로 넘겨야 한다");
assert.equal(noisyOldPassport.surname, "ON");
assert.equal(noisyOldPassport.given, "SOJA");
assert.equal(noisyOldPassport.passportNo, "M8ITW36TL");
assert.match(noisyOldPassport.birth8, /^194512/);
assert.equal(noisyOldPassport.sex, "F");

assert.equal(
  parseVisualPassport("ICN FUK 8/1 3 passengers"),
  null,
  "항공 화면을 여권으로 오인하면 안 된다"
);

console.log("mrz visual fallback: ok");
