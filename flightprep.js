/*!
 * flightprep.js — "바이브 항공권 예약" 클라이언트 (전역 window.FlightPrep, 의존성 없음)
 * 원본: 6soo/flight_prep의 web/flightprep.js (ES module) → 이 사이트의 <script src> 방식에 맞춰 전역판.
 *
 *  FlightPrep.parseTrips(text)      : 카톡 텍스트 → 여정 배열(날짜 범위별 자동 분리)  [서버 불필요]
 *  FlightPrep.buildLinks(trip)      : 여정 → 스카이스캐너/트립닷컴 딥링크            [서버 불필요]
 *  FlightPrep.analyzePaste(files, opts) : 여권/화면 이미지 → 서버 OCR → {trips, unassigned_passengers}
 *
 * 여권 OCR은 Gemini 키가 필요해 flight_prep 서버(/api/paste)가 대신 돈다.
 * 파싱 규칙은 파이썬 src/flight_prep/{parser,airports,deeplinks}.py 와 1:1로 맞춘다.
 */
(function (global) {
  "use strict";

  const AIRPORTS = {
    "서울": "ICN", "인천": "ICN", "인": "ICN", "김포": "GMP", "제주": "CJU",
    "부산": "PUS", "김해": "PUS",
    "도쿄": "NRT", "동경": "NRT", "나리타": "NRT", "하네다": "HND",
    "오사카": "KIX", "간사이": "KIX", "후쿠오카": "FUK", "삿포로": "CTS",
    "신치토세": "CTS", "시즈오카": "FSZ", "후지산시즈오카": "FSZ",
    // 일본 지방공항 (감성여행 코스 — 시골/소도시)
    "고마츠": "KMQ", "코마츠": "KMQ", "고마쓰": "KMQ", "코마쓰": "KMQ",
    "가나자와": "KMQ", "니가타": "KIJ",
    "야마가타": "GAJ", "나고야": "NGO", "주부": "NGO", "센트레아": "NGO",
    "센다이": "SDJ", "도야마": "TOY", "아키타": "AXT", "아오모리": "AOJ",
    "하코다테": "HKD", "오키나와": "OKA", "나하": "OKA", "가고시마": "KOJ",
    "구마모토": "KMJ", "나가사키": "NGS", "오이타": "OIT", "미야자키": "KMI",
    "히로시마": "HIJ", "다카마츠": "TAK", "마츠야마": "MYJ", "오카야마": "OKJ",
    "이바라키": "IBR",
    "방콕": "BKK", "다낭": "DAD", "싱가포르": "SIN", "타이베이": "TPE",
    "타이페이": "TPE", "홍콩": "HKG", "괌": "GUM",
  };
  const CODE_TO_CITY = {
    ICN: "인천", GMP: "김포", CJU: "제주", PUS: "부산", NRT: "도쿄(나리타)",
    HND: "도쿄(하네다)", KIX: "오사카(간사이)", FUK: "후쿠오카", CTS: "삿포로",
    FSZ: "시즈오카",
    KMQ: "고마츠(가나자와)", KIJ: "니가타", GAJ: "야마가타", NGO: "나고야",
    SDJ: "센다이", TOY: "도야마", AXT: "아키타", AOJ: "아오모리", HKD: "하코다테",
    OKA: "오키나와(나하)", KOJ: "가고시마", KMJ: "구마모토", NGS: "나가사키",
    OIT: "오이타", KMI: "미야자키", HIJ: "히로시마", TAK: "다카마츠",
    MYJ: "마츠야마", OKJ: "오카야마", IBR: "이바라키",
    BKK: "방콕", DAD: "다낭", SIN: "싱가포르", TPE: "타이베이",
    HKG: "홍콩", GUM: "괌",
  };

  function cityOf(code) { return CODE_TO_CITY[(code || "").toUpperCase()] || code || ""; }
  function isHangul(ch) { return !!ch && ch >= "가" && ch <= "힣"; }

  const DATE_RE = /(\d{1,2})\s*[.\/월\-]\s*(\d{1,2})\s*일?\s*[~∼〜]\s*(?:(\d{1,2})\s*[.\/월\-]\s*)?(\d{1,2})\s*일?/g;
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(y, m, d) { return y + "-" + pad(m) + "-" + pad(d); }

  function resolveYear(month, day, today) {
    const year = today.getFullYear();
    const cand = new Date(year, month - 1, day);
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return cand >= t ? year : year + 1;
  }

  function parseDates(text, today) {
    DATE_RE.lastIndex = 0;
    const m = DATE_RE.exec(text);
    if (!m) return [null, null];
    const sMonth = +m[1], sDay = +m[2];
    const eMonth = m[3] ? +m[3] : sMonth, eDay = +m[4];
    const dYear = resolveYear(sMonth, sDay, today);
    const depart = iso(dYear, sMonth, sDay);
    let ret = iso(dYear, eMonth, eDay);
    if (ret < depart) ret = iso(dYear + 1, eMonth, eDay);
    return [depart, ret];
  }

  function parseAirports(text) {
    const explicit = [];
    let em; const ER = /\(([A-Za-z]{3})\)/g;
    while ((em = ER.exec(text))) explicit.push(em[1].toUpperCase());
    if (explicit.length) return explicit;

    const found = [];
    for (const name of Object.keys(AIRPORTS)) {
      let start = 0;
      while (true) {
        const idx = text.indexOf(name, start);
        if (idx === -1) break;
        if (name.length === 1) {
          const before = idx > 0 ? text[idx - 1] : "";
          const after = idx + 1 < text.length ? text[idx + 1] : "";
          if (isHangul(before) || isHangul(after)) { start = idx + 1; continue; }
        }
        found.push({ idx: idx, len: name.length, code: AIRPORTS[name] });
        start = idx + name.length;
      }
    }
    found.sort((a, b) => a.idx - b.idx || b.len - a.len);
    const out = []; let consumedEnd = -1;
    for (const f of found) {
      if (f.idx < consumedEnd) continue;
      out.push(f.code); consumedEnd = f.idx + f.len;
    }
    return out;
  }

  // 인원수 표기 — 대장의 두 가지 습관 (서버 parser.parse_pax_count와 1:1):
  //  "2명 8.1~5 인~고마츠" → N명 / "2,3,6,7,8,9번 11.4~8" → 번호 나열 개수(6명).
  //  단독 "3번"(버스 번호 등)은 오탐 방지로 무시(2개 이상 나열만 인정).
  function parsePaxCount(text) {
    var m = /(\d+)\s*명/.exec(text || "");
    if (m) return Math.max(1, +m[1]);
    var e = /((?:\d+\s*[,，·]\s*)+\d+)\s*번/.exec(text || "");
    if (e) return e[1].split(/[,，·]/).length;
    return 0;
  }

  // 대장은 국외 목적지만 적는 습관이 있음(예: "9.23~27 후쿠오카"). 우리 여행은 늘 한국 출발이라
  // 공항이 하나만 잡히고 그게 국외 공항이면 출발지를 인천(ICN)으로 보완한다.
  const KOREA_AIRPORTS = { ICN: 1, GMP: 1, CJU: 1, PUS: 1 };

  function parseOneTrip(text, today) {
    let codes = parseAirports(text);
    if (codes.length === 1 && !KOREA_AIRPORTS[codes[0]]) codes = ["ICN", codes[0]];
    const dr = parseDates(text, today);
    const depart = dr[0], ret = dr[1];
    const roundTrip = codes.length >= 4 || ret != null;
    const originCode = codes[0] || "", destCode = codes[1] || "";
    return {
      originCode: originCode, destCode: destCode,
      depart: depart, return: roundTrip ? ret : null, roundTrip: roundTrip,
      paxCount: parsePaxCount(text),
      label: destCode ? cityOf(destCode) : "여정",
      route: destCode ? (cityOf(originCode) + " → " + cityOf(destCode)) : "",
    };
  }

  function parseTrips(text, today) {
    today = today || new Date();
    const matches = [];
    let m; DATE_RE.lastIndex = 0;
    while ((m = DATE_RE.exec(text || ""))) matches.push({ index: m.index });
    if (matches.length <= 1) {
      const t = parseOneTrip(text || "", today);
      return t.depart ? [t] : [];
    }
    const trips = [];
    for (let i = 0; i < matches.length; i++) {
      const startPos = matches[i].index;
      const endPos = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const t = parseOneTrip(text.slice(startPos, endPos), today);
      if (t.depart) trips.push(t);
    }
    // 인원수("2,3,6번"/"2명")는 첫 날짜 앞에 쓰는 습관 → 잘린 앞부분에서 보충
    if (trips.length && !trips[0].paxCount) trips[0].paxCount = parsePaxCount(text.slice(0, matches[0].index));
    return trips;
  }

  function yymmdd(isoStr) {
    const p = isoStr.split("-");
    return p[0].slice(2) + p[1] + p[2];
  }

  function buildLinks(trip, opts) {
    const adults = (opts && opts.adults) || 1;
    const o = (trip.originCode || "").toLowerCase();
    const d = (trip.destCode || "").toLowerCase();
    if (!o || !d || !trip.depart) return { skyscanner: "", tripcom: "" };
    const rt = !!(trip.roundTrip && trip.return);

    let path = "/transport/flights/" + o + "/" + d + "/" + yymmdd(trip.depart) + "/";
    if (rt) path += yymmdd(trip.return) + "/";
    const skyQ = new URLSearchParams({ adultsv2: adults, cabinclass: "economy", rtn: rt ? 1 : 0 });
    const skyscanner = "https://www.skyscanner.co.kr" + path + "?" + skyQ;

    const tripQ = new URLSearchParams({
      dcity: o, acity: d, ddate: trip.depart, triptype: rt ? "rt" : "ow",
      class: "y", quantity: adults, searchboxarg: "t", nonstoponly: "off",
      locale: "ko-KR", curr: "KRW",
    });
    if (rt) tripQ.set("rdate", trip.return);
    const tripcom = "https://kr.trip.com/flights/showfarefirst?" + tripQ;
    return { skyscanner: skyscanner, tripcom: tripcom };
  }

  async function analyzePaste(files, opts) {
    opts = opts || {};
    const baseUrl = opts.baseUrl || "";
    const fd = new FormData();
    fd.append("text", opts.text || "");
    (files || []).forEach((f, i) => fd.append("images", f, f.name || ("paste" + i + ".png")));
    const headers = {};
    if (opts.username != null && opts.password != null) {
      headers.Authorization = "Basic " + btoa(opts.username + ":" + opts.password);
    }
    const res = await fetch(baseUrl + "/api/paste", {
      method: "POST", body: fd, headers: headers,
      credentials: opts.username != null ? "omit" : "include",
    });
    let data;
    try { data = await res.json(); } catch (e) { data = { error: "HTTP " + res.status }; }
    if (data.error) throw new Error(data.error);
    return data;
  }

  // ── 여권 MRZ 로컬 인식 (서버·비밀번호 불필요, 이미지는 폰 밖으로 안 나감) ──────
  var TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error("스크립트 로드 실패")); };
      document.head.appendChild(s);
    });
  }

  // MRZ 결과 → 화면용(한글키) 탑승자 dict. 여권 표시용 키를 서버 응답과 동일하게 맞춘다.
  function mrzToPassenger(m, today) {
    var warn = "";
    if (m.expiryIso) {
      var exp = new Date(m.expiryIso), ref = today || new Date();
      var sixMonths = new Date(ref.getFullYear(), ref.getMonth() + 6, ref.getDate());
      if (exp < ref) warn = "여권 만료됨 — 재발급 필요";
      else if (exp < sixMonths) warn = "여권 만료 6개월 이내 — 확인 필요";
    }
    if (!warn && m.source === "visual") warn = "여권 아래(MRZ)가 안 보여 윗부분에서 읽었어요 — 값 확인하세요";
    else if (!m.valid && !warn) warn = "여권 판독이 불확실해요 — 값 확인 필요";
    return {
      "한글이름": "", "영문성": m.surname, "영문이름": m.given,
      "생년월일": m.birth8, "성별": m.sex, "여권만료일": m.expiryIso,
      "여권번호": m.passportNo || "", "경고": warn, "_valid": !!m.valid,
    };
  }

  // 같은 여권을 두 번 찍어(또는 펼침면 두 장) 넣으면 탑승자가 중복되는 문제 방지.
  // 두 판독본은 서로 다른 칸에서 오독이 나므로(한쪽 이름, 한쪽 생년월일) 단일 키로는 못 잡는다.
  // → 여권번호·이름·생년월일 중 하나라도 같으면 동일인으로 병합. 병합 시 체크디지트가 맞는
  //   (정확한) 판독본을 우선 채택하고, 빈 칸은 다른 판독본으로 보완한다.
  var PAX_FIELDS = ["한글이름", "영문성", "영문이름", "생년월일", "성별", "여권만료일", "여권번호"];
  function paxKeys(p) {
    var keys = [];
    var no = String(p["여권번호"] || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (no.length >= 8) keys.push("no:" + no);
    var s = String(p["영문성"] || "").toUpperCase().trim();
    var g = String(p["영문이름"] || "").toUpperCase().replace(/\s+/g, "").trim();
    var b = p["생년월일"] || "";
    if (s && g) keys.push("nm:" + s + "|" + g);
    if (b && s) keys.push("bd:" + b + "|" + s);
    return keys;
  }
  function paxFullness(p) {
    return ["영문성", "영문이름", "생년월일", "성별", "여권만료일"].reduce(function (n, k) { return n + (p[k] ? 1 : 0); }, 0);
  }
  // 우선순위: 체크디지트 유효(정확) > 채워진 필드 수
  function betterPax(a, b) {
    if (!!a._valid !== !!b._valid) return a._valid ? a : b;
    return paxFullness(a) >= paxFullness(b) ? a : b;
  }
  function dedupPassengers(list) {
    var seen = {}, groups = [];
    list.forEach(function (p) {
      var keys = paxKeys(p), gi = -1;
      for (var i = 0; i < keys.length; i++) { if (seen[keys[i]] != null) { gi = seen[keys[i]]; break; } }
      if (gi >= 0) {
        var ex = groups[gi];
        var keep = betterPax(p, ex), fill = keep === p ? ex : p;
        PAX_FIELDS.forEach(function (f) { keep[f] = keep[f] || fill[f]; });
        // 채택본이 유효(정확)하면 다른 판독본의 경고(예: 'MRZ 안 보임')를 물려받지 않는다
        if (!keep["경고"] && !keep._valid) keep["경고"] = fill["경고"];
        groups[gi] = keep;
      } else {
        gi = groups.length; groups.push(p);
      }
      paxKeys(groups[gi]).forEach(function (k) { seen[k] = gi; }); // 병합 후 키 재등록
    });
    return groups;
  }

  // OCR 전 전처리: 작으면 확대(글자 크게) + 흑백·대비 강화 → MRZ의 '<' 인식률↑.
  // 실패하면 원본 파일 그대로 사용(안전).
  function preprocess(file) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var scale = img.width < 1500 ? Math.min(3, 1500 / img.width) : 1;
          var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
          var cx = cv.getContext("2d");
          cx.drawImage(img, 0, 0, w, h);
          var id = cx.getImageData(0, 0, w, h), d = id.data;
          for (var i = 0; i < d.length; i += 4) {
            var g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            g = (g - 128) * 1.5 + 128;           // 대비 강화
            g = g < 0 ? 0 : g > 255 ? 255 : g;
            d[i] = d[i + 1] = d[i + 2] = g;
          }
          cx.putImageData(id, 0, 0);
          URL.revokeObjectURL(img.src);
          resolve(cv);
        } catch (e) { URL.revokeObjectURL(img.src); resolve(file); }
      };
      img.onerror = function () { resolve(file); };
      img.src = URL.createObjectURL(file);
    });
  }

  // files → { passengers:[dict], nonPassports:[File] }. MRZ 못 읽은 이미지는 nonPassports로.
  async function readPassports(files, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || function () {};
    var today = opts.today || new Date();
    if (!global.MRZ) throw new Error("MRZ 모듈이 없습니다.");
    if (!global.Tesseract) { onProgress("여권 판독기 불러오는 중…", 0.02); await loadScript(TESSERACT_CDN); }
    onProgress("여권 판독기 준비 중… (처음 한 번만)", 0.05);
    var worker = await global.Tesseract.createWorker("eng", 1, {
      logger: function (mm) {
        if (mm.status === "loading language traineddata" || mm.status === "loading tesseract core") {
          onProgress("여권 판독기 준비 중… (처음 한 번만)", 0.05 + (mm.progress || 0) * 0.15);
        }
      },
    });
    // MRZ는 A-Z, 0-9, '<' 뿐 — 화이트리스트로 오독을 줄임
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: "6",
    });
    var MRZ_PARAMS = { tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<", tessedit_pageseg_mode: "6" };
    var VIS_PARAMS = { tessedit_char_whitelist: "", tessedit_pageseg_mode: "3" };
    function okPax(x) { return x && (x.surname || x.given) && x.birth8; }

    var passengers = [], nonPassports = [];
    for (var i = 0; i < files.length; i++) {
      onProgress("여권 읽는 중… (" + (i + 1) + "/" + files.length + ")", 0.25 + (i / files.length) * 0.7);
      var src, m = null;
      try {
        src = await preprocess(files[i]);
        var r = await worker.recognize(src);
        m = global.MRZ.parseMrz((r && r.data && r.data.text) || "", today);
      } catch (e) { m = null; }
      if (okPax(m)) { passengers.push(mrzToPassenger(m, today)); continue; }
      // MRZ가 안 보이거나 못 읽으면 → 여권 윗부분(인쇄 영역)으로 폴백 (화이트리스트 해제, 전체 인식)
      var v = null;
      try {
        await worker.setParameters(VIS_PARAMS);
        var rv = await worker.recognize(src || files[i]);
        v = global.MRZ.parseVisualPassport((rv && rv.data && rv.data.text) || "");
        await worker.setParameters(MRZ_PARAMS); // 다음 이미지를 위해 복원
      } catch (e2) { v = null; try { await worker.setParameters(MRZ_PARAMS); } catch (e3) {} }
      if (okPax(v)) passengers.push(mrzToPassenger(v, today));
      else nonPassports.push(files[i]);
    }
    await worker.terminate();
    return { passengers: dedupPassengers(passengers), nonPassports: nonPassports };
  }

  global.FlightPrep = {
    AIRPORTS: AIRPORTS, cityOf: cityOf, parseTrips: parseTrips, buildLinks: buildLinks,
    analyzePaste: analyzePaste, readPassports: readPassports,
  };
})(window);
