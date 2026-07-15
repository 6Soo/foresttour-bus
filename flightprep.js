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
    "고마츠": "KMQ", "코마츠": "KMQ", "가나자와": "KMQ", "니가타": "KIJ",
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

  function parseOneTrip(text, today) {
    const codes = parseAirports(text);
    const dr = parseDates(text, today);
    const depart = dr[0], ret = dr[1];
    const roundTrip = codes.length >= 4 || ret != null;
    const originCode = codes[0] || "", destCode = codes[1] || "";
    return {
      originCode: originCode, destCode: destCode,
      depart: depart, return: roundTrip ? ret : null, roundTrip: roundTrip,
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

  global.FlightPrep = { AIRPORTS: AIRPORTS, cityOf: cityOf, parseTrips: parseTrips, buildLinks: buildLinks, analyzePaste: analyzePaste };
})(window);
