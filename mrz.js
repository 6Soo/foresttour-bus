/*!
 * mrz.js — 여권 MRZ(기계판독영역, 하단 '<<<' 두 줄) 파서. 의존성 없음.
 * 서버·API 없이 폰 브라우저 안에서 여권 정보를 읽기 위한 순수 함수.
 *
 * TD3(여권) 규격: 44자 × 2줄.
 *  줄1: P + 종류 + 발급국(3) + 성<<이름 (나머지 '<' 채움)
 *  줄2: 여권번호(9) 검(1) 국적(3) 생년월일YYMMDD(6) 검(1) 성별(1) 만료YYMMDD(6) 검(1) ...
 *
 * OCR은 흔들리므로 필드 유형별 교정(숫자칸의 O→0 등) 후 체크디지트로 검증한다.
 * 검증 통과 = 신뢰(valid:true). 실패해도 best-effort 값은 돌려주되 valid:false로 표시.
 */
(function (root) {
  "use strict";

  function charVal(c) {
    if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
    if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55; // A=10 … Z=35
    return 0; // '<' 및 기타
  }

  // ICAO 9303 체크디지트: 가중치 7,3,1 반복, 합 mod 10
  function checkDigit(s) {
    var w = [7, 3, 1], sum = 0;
    for (var i = 0; i < s.length; i++) sum += charVal(s[i]) * w[i % 3];
    return sum % 10;
  }

  // 숫자여야 하는 칸의 흔한 OCR 오인식 교정 (글자 → 숫자)
  function toDigits(s) {
    return (s || "").replace(/[OQD]/g, "0").replace(/[I|L]/g, "1").replace(/Z/g, "2")
      .replace(/[B]/g, "8").replace(/S/g, "5").replace(/G/g, "6").replace(/T/g, "7")
      .replace(/[^0-9]/g, "0");
  }
  // 알파여야 하는 칸(국적 등) 교정 (숫자 → 글자)
  function toAlpha(s) {
    return (s || "").replace(/0/g, "O").replace(/1/g, "I").replace(/8/g, "B").replace(/5/g, "S")
      .replace(/[^A-Z<]/g, "");
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  // YYMMDD → {iso, y8} (생년월일이면 과거로, 만료일이면 미래로 해석)
  function toDate(yymmdd, kind, today) {
    if (!/^\d{6}$/.test(yymmdd)) return null;
    var yy = +yymmdd.slice(0, 2), mm = +yymmdd.slice(2, 4), dd = +yymmdd.slice(4, 6);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    var year;
    if (kind === "expiry") {
      year = 2000 + yy;                 // 현행 여권 만료는 모두 20xx
    } else {
      year = 2000 + yy;                 // 생년월일: 미래가 되면 19xx로
      var curY = (today || new Date()).getFullYear();
      if (year > curY) year -= 100;
    }
    return { iso: year + "-" + pad(mm) + "-" + pad(dd), y8: "" + year + pad(mm) + pad(dd) };
  }

  // 원문 텍스트 → MRZ 두 줄 후보 추출 (줄1+줄2 쌍으로 판정)
  function isLine2(s) { return s.length >= 24 && (s.match(/\d/g) || []).length >= 6; }
  function isLine1(s) { return s.length >= 20 && /^P[A-Z0-9<]{4}/.test(s) && s.indexOf("<<") !== -1; }

  function findLines(text) {
    var raw = (text || "").split(/\r?\n/);
    var cand = [];
    for (var i = 0; i < raw.length; i++) {
      var up = raw[i].toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9<]/g, "");
      if (up.length >= 16) cand.push(up);
    }
    // 줄1 패턴 + 바로 다음이 줄2 패턴인 쌍
    for (var j = 0; j + 1 < cand.length; j++) {
      if (isLine1(cand[j]) && isLine2(cand[j + 1])) return [cand[j], cand[j + 1]];
    }
    // 폴백: 이름 구분자('<<') 든 줄 다음에 숫자 많은 줄
    for (var k = 1; k < cand.length; k++) {
      if (isLine2(cand[k]) && cand[k - 1].indexOf("<<") !== -1) return [cand[k - 1], cand[k]];
    }
    return null;
  }

  function fix(str, len) {
    var s = (str || "").slice(0, len);
    while (s.length < len) s += "<";
    return s;
  }

  // 숫자여야 하는 그룹을 숫자로 교정
  function digify(s) {
    return (s || "").replace(/[OQD]/g, "0").replace(/[IL]/g, "1").replace(/Z/g, "2")
      .replace(/B/g, "8").replace(/S/g, "5").replace(/G/g, "6").replace(/T/g, "7");
  }

  // 줄2에서 생년월일·성별·만료일 블록을 '성별(M/F) 기준'으로 탐색.
  // 고정 위치 대신 패턴(6+1 숫자 · 성별 · 6+1 숫자)으로 찾아 OCR의 삽입/삭제 밀림에 견딤.
  // 체크디지트가 맞는 후보를 우선 채택.
  var DIGITISH = "[0-9OQDILZBSGT]";
  function parseLine2(l2) {
    var re = new RegExp("(" + DIGITISH + "{6})(" + DIGITISH + ")([MF<])(" + DIGITISH + "{6})(" + DIGITISH + ")", "g");
    var m, best = null;
    while ((m = re.exec(l2))) {
      var birth = digify(m[1]), bchk = digify(m[2]);
      var sexc = m[3], expiry = digify(m[4]), echk = digify(m[5]);
      var bOk = checkDigit(birth) === +bchk, eOk = checkDigit(expiry) === +echk;
      var cand = {
        birth: birth, sex: sexc === "M" || sexc === "F" ? sexc : "",
        expiry: expiry, bOk: bOk, eOk: eOk, score: (bOk ? 1 : 0) + (eOk ? 1 : 0),
      };
      if (!best || cand.score > best.score) best = cand;
      if (cand.score === 2) break;
      re.lastIndex = m.index + 1; // 겹치는 후보도 탐색
    }
    return best;
  }

  // 이름 조각 정리: '<' → 공백, 다중공백 축소, 그리고 끝에 붙은 채움문자 오독 제거.
  // MRZ 뒷부분은 '<'로 채워지는데 OCR이 이를 같은 글자(LLL·DDD 등)로 읽어 이름 끝에 붙는다.
  // 같은 글자 3연속 이상으로 끝나면(실제 이름엔 거의 없음) 그 덩어리를 제거: MEJALLL→MEJA.
  function cleanNamePart(s) {
    var t = (s || "").replace(/</g, " ").replace(/\s+/g, " ").trim();
    t = t.replace(/([A-Z])\1{2,}$/, "").trim();
    return t;
  }

  function parseName(line1) {
    // 이름 필드 시작점: 발급국(우리 사용자는 항상 KOR) 다음. 못 찾으면 위치 5(P+종류+국가) 폴백.
    // KOR 기준으로 잡으면 앞쪽 잡음(예: 'RCHOI'의 R)을 흡수하지 않는다.
    var kor = line1.indexOf("KOR");
    var nameField = kor >= 0 && kor <= 5 ? line1.slice(kor + 3) : line1.slice(5);
    var parts = nameField.split("<<");
    return { surname: cleanNamePart(parts[0]), given: cleanNamePart(parts[1]) };
  }

  // 메인: 원문 텍스트 → 여권 정보 객체 (못 찾으면 null)
  function parseMrz(text, today) {
    var lines = findLines(text);
    if (!lines) return null;
    var l1 = fix(lines[0], 44);
    var l2 = fix(lines[1], 44);

    var nm = parseName(l1);
    var country = toAlpha(l1.slice(2, 5));

    var passField = l2.slice(0, 9);
    var passChk = toDigits(l2.slice(9, 10));
    // 한국 여권은 보통 영문 1자 + 숫자 8자. 원본 검증 실패 시 뒤 8자를 숫자로 교정해 재검증.
    var passportNo = passField.replace(/</g, "");
    if (checkDigit(passField) !== +passChk) {
      var alt = passField.slice(0, 1) + toDigits(passField.slice(1));
      if (checkDigit(alt) === +passChk) passportNo = alt.replace(/</g, "");
    }
    var nationality = toAlpha(l2.slice(10, 13));

    // 생년월일·성별·만료일: 성별 기준 패턴 탐색(밀림에 견고). 실패 시 고정 위치 폴백.
    var blk = parseLine2(l2);
    var sex, birth, expiry, birthOk, expiryOk;
    if (blk) {
      sex = blk.sex;
      birth = toDate(blk.birth, "birth", today);
      expiry = toDate(blk.expiry, "expiry", today);
      birthOk = birth && blk.bOk;
      expiryOk = expiry && blk.eOk;
    } else {
      var sexRaw = l2.slice(20, 21);
      sex = sexRaw === "M" || sexRaw === "F" ? sexRaw : "";
      var birthRaw = toDigits(l2.slice(13, 19)), expiryRaw = toDigits(l2.slice(21, 27));
      birth = toDate(birthRaw, "birth", today);
      expiry = toDate(expiryRaw, "expiry", today);
      birthOk = birth && checkDigit(birthRaw) === +toDigits(l2.slice(19, 20));
      expiryOk = expiry && checkDigit(expiryRaw) === +toDigits(l2.slice(27, 28));
    }
    var passOk = checkDigit(passportNo.length === 9 ? passportNo : l2.slice(0, 9)) === +passChk;
    var valid = !!(birthOk && expiryOk);

    return {
      surname: nm.surname, given: nm.given,
      passportNo: passportNo, nationality: nationality || country || "KOR",
      birth8: birth ? birth.y8 : "", birthIso: birth ? birth.iso : "",
      sex: sex, expiryIso: expiry ? expiry.iso : "",
      valid: valid, birthOk: !!birthOk, expiryOk: !!expiryOk, passOk: !!passOk,
    };
  }

  var api = { parseMrz: parseMrz, checkDigit: checkDigit, findLines: findLines };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MRZ = api;
})(typeof self !== "undefined" ? self : this);
