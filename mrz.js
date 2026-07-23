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
    // 폴백1: 이름 구분자('<<') 든 줄 다음에 숫자 많은 줄
    for (var k = 1; k < cand.length; k++) {
      if (isLine2(cand[k]) && cand[k - 1].indexOf("<<") !== -1) return [cand[k - 1], cand[k]];
    }
    // 폴백2: '<<'가 글자로 완전 오독돼도 — 숫자 많은 줄(line2) 앞의 '대체로 알파벳' 줄을 line1로
    for (var j2 = 1; j2 < cand.length; j2++) {
      var prev = cand[j2 - 1];
      if (isLine2(cand[j2]) && prev.length >= 20 && (prev.match(/[A-Z]/g) || []).length >= prev.length * 0.6) {
        return [prev, cand[j2]];
      }
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

  // 이름 조각 정리: '<' → 공백, 다중공백 축소, 그리고 채움문자 오독 제거.
  // MRZ 뒷부분은 '<'로 채워지는데 OCR이 이를 같은 글자(LLL·KKK 등)로 읽어 이름에 붙는다.
  // 같은 글자가 3연속 이상 나오면 그 지점부터 끝까지를 채움문자로 보고 잘라낸다: MEJALLL→MEJA,
  // INSUNKLLLL...RL→INSUNK. (실제 로마자 이름엔 같은 글자 3연속이 거의 없음)
  function cleanNamePart(s) {
    var t = (s || "").replace(/</g, " ").replace(/\s+/g, " ").trim();
    t = t.replace(/([A-Z])\1{2,}.*$/, "").trim();
    return t;
  }
  // 이름이 채움문자 오독으로 오염됐는지(원본 이름 필드에 같은 글자 4연속 이상) — 비주얼 교정 트리거
  function nameCorrupt(raw) { return /([A-Z])\1{3,}/.test(String(raw || "")); }

  function parseName(line1) {
    // 이름 필드 시작점: 발급국(우리 사용자는 항상 KOR) 다음. 못 찾으면 위치 5(P+종류+국가) 폴백.
    // KOR 기준으로 잡으면 앞쪽 잡음(예: 'RCHOI'의 R)을 흡수하지 않는다.
    var kor = line1.indexOf("KOR");
    var nameField = kor >= 0 && kor <= 5 ? line1.slice(kor + 3) : line1.slice(5);
    var parts = nameField.split("<<");
    return {
      surname: cleanNamePart(parts[0]), given: cleanNamePart(parts[1]),
      surnameSuspect: nameCorrupt(parts[0]), givenSuspect: nameCorrupt(parts[1] || ""),
      suspect: nameCorrupt(nameField),
    };
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
      surname: nm.surname, given: nm.given, nameSuspect: !!nm.suspect,
      surnameSuspect: !!nm.surnameSuspect, givenSuspect: !!nm.givenSuspect,
      passportNo: passportNo, nationality: nationality || country || "KOR",
      birth8: birth ? birth.y8 : "", birthIso: birth ? birth.iso : "",
      sex: sex, expiryIso: expiry ? expiry.iso : "",
      valid: valid, birthOk: !!birthOk, expiryOk: !!expiryOk, passOk: !!passOk,
    };
  }

  // ── 여권 윗부분(인쇄 영역) 파서 — MRZ가 안 보일 때(사진에서 잘림) 폴백 ──────────
  // 여권 데이터면의 영문 라벨(Surname/Given names/Date of birth/Sex/Date of expiry/Passport No.)을
  // 기준으로 값을 읽는다. 한국 여권은 라벨이 한/영 병기라 영문 라벨로 앵커링.
  var MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  function parseVisualDate(s) {
    // "10 1월/JAN 1961" 같은 표기 — 한국월(N월) 제거 후 일/영문월/연도를 각각 추출
    var u = String(s || "").toUpperCase().replace(/[0-9]+\s*월/g, " ");
    var mon = u.match(/JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC/);
    var year = u.match(/(?:19|20)\d{2}/);
    var day = u.match(/(^|[^0-9])(\d{1,2})(?![0-9])/);
    if (!mon || !year || !day) return null;
    var mm = MONTHS[mon[0]], dd = +day[2];
    if (dd < 1 || dd > 31) return null;
    return { iso: year[0] + "-" + pad(mm) + "-" + pad(dd), y8: year[0] + pad(mm) + pad(dd) };
  }

  function parseVisualPassport(text) {
    var lines = String(text || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    function valAfter(labelRe) {
      for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(labelRe);
        if (!m) continue;
        // 라벨 뒤 나머지 — 앞쪽 구분자/한글 병기라벨을 지운다(라틴/숫자만 값으로).
        // 한국 여권은 라벨이 한/영 병기라, 나머지에 라틴·숫자가 없으면 진짜 값은 다음 줄에 있다.
        var rest = lines[i].slice(m.index + m[0].length).replace(/^[^0-9A-Za-z]+/, "").trim();
        if (/[0-9A-Za-z]/.test(rest)) return rest;
        if (i + 1 < lines.length) return lines[i + 1].trim();
      }
      return "";
    }
    // 이름은 라틴 대문자+공백만 남긴다(한글 라벨·잡음 제거) → cleanNamePart로 채움문자 정리.
    function latinName(s) { return cleanNamePart(String(s || "").toUpperCase().replace(/[^A-Z< ]/g, " ")); }
    var surname = latinName(valAfter(/SURNAME/i));
    var given = latinName(valAfter(/GIVEN\s*NAMES?/i));
    var sexRaw = valAfter(/\bSEX\b/i).toUpperCase();
    var sm = sexRaw.match(/[MF]/);
    var sex = sm ? sm[0] : "";
    var birth = parseVisualDate(valAfter(/DATE\s*OF\s*BIRTH/i));
    var expiry = parseVisualDate(valAfter(/DATE\s*OF\s*EXPIRY/i));
    // 여권번호는 '영문1 + 숫자1 + 영숫자6~7' 패턴만 인정(오추출 방지 — 틀린 번호는 잘못된 중복병합 유발)
    var pmatch = valAfter(/PASSPORT\s*NO/i).toUpperCase().match(/[A-Z][0-9][A-Z0-9]{6,7}/);
    var passportNo = pmatch ? pmatch[0] : "";
    // 최소 조건: 이름(성 또는 이름) + 생년월일이 있어야 탑승자로 인정
    if (!(surname || given) || !birth) return null;
    return {
      surname: surname, given: given, passportNo: passportNo, nationality: "KOR",
      birth8: birth.y8, birthIso: birth.iso, sex: sex, expiryIso: expiry ? expiry.iso : "",
      valid: false, source: "visual",
    };
  }

  var api = { parseMrz: parseMrz, parseVisualPassport: parseVisualPassport, checkDigit: checkDigit, findLines: findLines };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MRZ = api;
})(typeof self !== "undefined" ? self : this);
