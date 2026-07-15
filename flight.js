/* 바이브 항공권 예약 — 붙여넣기 UI 글루 (flightprep.js의 window.FlightPrep 사용) */
(function () {
  "use strict";

  // OCR 백엔드(flight_prep) 주소 — 기본값. 서버 env FLIGHT_PREP_CORS_ORIGINS 에
  // 이 사이트(https://bus.foresttour.kr)가 등록돼 있어야 cross-origin 호출이 된다.
  // 도메인 연결 없이도 쓰도록, 서버 주소는 localStorage로 덮어쓸 수 있다(Render 기본주소 등).
  var OCR_BASE_DEFAULT = "https://flight.foresttour.kr";
  var LS_BASE = "flight_ocr_base";   // 서버 주소 (예: https://flight-prep-xxxx.onrender.com)
  var LS_PW = "flight_ocr_pw";       // 서버 접속 비밀번호(APP_PASSWORD) — 이 기기에만 저장, 소스엔 없음

  function lsGet(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* noop */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } }

  function serverBase() { return lsGet(LS_BASE) || OCR_BASE_DEFAULT; }

  // 서버 비밀번호는 사장님께 받아 한 번만 입력 → 이 기기에 저장(코드/소스엔 없음). 취소하면 null.
  function ensurePassword() {
    var pw = lsGet(LS_PW);
    if (pw) return pw;
    var input = window.prompt("항공권 인식 서버 비밀번호를 입력하세요.\n(사장님께 받은 접속 비번 — 한 번만 넣으면 이 폰이 기억해요)");
    if (input == null) return null;
    input = input.trim();
    if (!input) return null;
    lsSet(LS_PW, input);
    return input;
  }

  // 서버 주소 바꾸기(도메인 대신 Render 기본주소를 쓰거나 이전할 때)
  function changeServer() {
    var url = window.prompt(
      "항공권 인식 서버 주소를 입력하세요.\n예) https://flight-prep-xxxx.onrender.com\n또는 https://flight.foresttour.kr",
      serverBase());
    if (url == null) return;
    url = url.trim().replace(/\/+$/, "");
    if (url) { lsSet(LS_BASE, url); toast("서버 주소 저장: " + url); }
  }

  var images = []; // {blob, url}
  var pastedText = ""; // 붙여넣은 텍스트(카톡 노선·날짜 메시지 등) — 자동 수집, 손입력 아님
  var $ = function (id) { return document.getElementById(id); };

  function renderPastedNote() {
    var el = $("pasted-note");
    if (!el) return;
    if (pastedText.trim()) {
      el.hidden = false;
      el.innerHTML = '<span class="pn-label">📝 붙여넣은 노선·날짜</span>' +
        '<span class="pn-text"></span><button type="button" class="pn-clear" aria-label="지우기">✕</button>';
      el.querySelector(".pn-text").textContent = pastedText.trim();
      el.querySelector(".pn-clear").onclick = function () { pastedText = ""; renderPastedNote(); };
    } else {
      el.hidden = true; el.innerHTML = "";
    }
  }

  function toast(msg) {
    var t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function renderThumbs() {
    var t = $("thumbs"); t.innerHTML = "";
    images.forEach(function (im, i) {
      var d = document.createElement("div"); d.className = "thumb";
      var img = document.createElement("img"); img.src = im.url; d.appendChild(img);
      var x = document.createElement("button"); x.type = "button"; x.textContent = "×";
      x.onclick = function (e) { e.preventDefault(); e.stopPropagation(); URL.revokeObjectURL(im.url); images.splice(i, 1); renderThumbs(); };
      d.appendChild(x); t.appendChild(d);
    });
  }

  function addImage(blob) {
    if (!blob || !blob.type || blob.type.indexOf("image/") !== 0) return;
    images.push({ blob: blob, url: URL.createObjectURL(blob) });
    renderThumbs();
  }

  // 클립보드 붙여넣기 — 이미지(여권·항공편 화면)와 텍스트(카톡 노선·날짜) 모두 자동 수집
  window.addEventListener("paste", function (e) {
    var cd = e.clipboardData || {};
    var items = cd.items || [];
    var gotImg = false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind === "file" && it.type.indexOf("image/") === 0) { addImage(it.getAsFile()); gotImg = true; }
    }
    // 입력창에 포커스가 없을 때만 텍스트를 노선 메모로 수집(다른 입력 방해 안 함)
    var tag = (document.activeElement && document.activeElement.tagName) || "";
    if (!gotImg && tag !== "TEXTAREA" && tag !== "INPUT") {
      var txt = cd.getData ? cd.getData("text/plain") : "";
      if (txt && txt.trim()) { pastedText = (pastedText ? pastedText + "\n" : "") + txt.trim(); renderPastedNote(); }
    }
    if (gotImg) e.preventDefault();
  });

  // 드래그&드롭
  var dz = document.querySelector(".dropzone");
  ["dragover", "dragenter"].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("dragover"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    dz.addEventListener(ev, function () { dz.classList.remove("dragover"); });
  });
  dz.addEventListener("drop", function (e) {
    e.preventDefault();
    var files = (e.dataTransfer || {}).files || [];
    for (var i = 0; i < files.length; i++) addImage(files[i]);
  });
  // 파일 선택
  $("file-input").addEventListener("change", function (e) {
    var files = e.target.files || [];
    for (var i = 0; i < files.length; i++) addImage(files[i]);
    e.target.value = "";
  });

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[<>&]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c];
    });
  }

  // 생년월일 8자리(YYYYMMDD) → 1960.03.15 (예약 폼에 그대로 붙여넣기 좋은 표기)
  function fmtBirth(v) {
    var s = String(v || "").replace(/\D/g, "");
    if (s.length !== 8) return String(v || "");
    return s.slice(0, 4) + "." + s.slice(4, 6) + "." + s.slice(6, 8);
  }
  function sexKo(v) {
    var s = String(v || "").toUpperCase().charAt(0);
    if (s === "M") return "남성";
    if (s === "F") return "여성";
    return String(v || "");
  }

  // 예약 사이트 탑승객 폼 칸(성/이름/생년월일/성별)에 맞춘 "눌러서 복사" 칩.
  // 대장님(연세 있는 사용자)이 손으로 영문 철자를 안 틀리게 — 칩을 누르면 값이 복사돼
  // 폼 칸에 붙여넣기만 하면 됨. 사이트가 바뀌어도 안 깨지는 방식(자동입력 스크립트 대신).
  function copyChip(label, value) {
    var v = String(value == null ? "" : value).trim();
    if (!v) return "";
    return '<button type="button" class="cchip" data-copy="' + esc(v) + '">' +
      '<span class="cc-k">' + esc(label) + "</span>" +
      '<span class="cc-v">' + esc(v) + "</span></button>";
  }

  function paxHtml(p) {
    var nm = esc(p["한글이름"] || ((p["영문성"] || "") + " " + (p["영문이름"] || "")).trim()) || "탑승자";
    var chips = [
      copyChip("성 (영문)", p["영문성"]),
      copyChip("이름 (영문)", p["영문이름"]),
      copyChip("생년월일", fmtBirth(p["생년월일"])),
      copyChip("성별", sexKo(p["성별"])),
    ].filter(Boolean).join("");
    var grid = chips
      ? '<div class="copy-hint">👇 칸을 눌러 복사 → 예약 폼에 붙여넣기</div><div class="copy-grid">' + chips + "</div>"
      : "";
    // 여권만료일은 확인용으로만(복사 대상 아님). 국적은 예약 폼 기본값 '대한민국' 그대로 두면 됨.
    var exp = p["여권만료일"] ? '<div class="pax-exp">여권만료 ' + esc(p["여권만료일"]) + "</div>" : "";
    var flag = p["경고"] ? '<div class="flag">⚠️ ' + esc(p["경고"]) + "</div>" : "";
    return '<div class="pax"><div class="nm">' + nm + "</div>" + grid + exp + flag + "</div>";
  }

  // 눌러서 복사 (칩 위임 처리) — 클립보드 API 실패 시 textarea 폴백
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.top = "-1000px";
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function render(data) {
    var out = $("flight-out"); out.innerHTML = "";
    var trips = data.trips || [];
    var unassigned = data.unassigned_passengers || [];

    if (!trips.length && !unassigned.length) {
      out.innerHTML = '<div class="trip-card"><div class="section-note">여권도 항공편 정보도 인식되지 않았어요. 여권 사진이나 날짜·노선 메시지를 붙여넣어 보세요.</div></div>';
      return;
    }

    trips.forEach(function (t, i) {
      var card = document.createElement("div"); card.className = "trip-card";
      var num = trips.length > 1 ? " " + (i + 1) : "";
      var pax = (t.passengers && t.passengers.length) || t.pax_count || 0;
      var dates = t.depart ? '<span class="t-dates">' + esc(t.depart) + " ~ " + esc(t.return) + (pax ? " · " + pax + "명" : "") + "</span>" : "";
      var html = '<div class="trip-head"><span class="t-label">✈️ 여정' + num + " — " + esc(t.label) + "</span>" + dates + "</div>";

      var ready = t.comparison ? t.comparison.ready : !!(t.links && t.links.skyscanner);
      if (ready) {
        html += '<a class="link-btn sky" href="' + t.links.skyscanner + '" target="_blank" rel="noopener">🔎 스카이스캐너 비교창 열기 (트립닷컴 포함)</a>';
        if (t.links.tripcom) html += '<a class="link-btn trip" href="' + t.links.tripcom + '" target="_blank" rel="noopener">🛫 트립닷컴 바로 열기</a>';
      } else {
        var miss = (t.comparison && t.comparison.missing) ? t.comparison.missing.join(", ") : "출발/도착·가는 날";
        html += '<div class="link-miss">이 여정의 링크를 만들려면 필요: <b>' + esc(miss) + "</b></div>";
      }

      if (t.passengers && t.passengers.length) {
        html += '<div class="pax-head">📋 탑승자</div>' + t.passengers.map(paxHtml).join("");
      }
      card.innerHTML = html;
      out.appendChild(card);
    });

    if (unassigned.length) {
      var card2 = document.createElement("div"); card2.className = "trip-card";
      var note = trips.length ? "어느 여정인지 자동으로 못 붙인 여권이에요" : "여권은 읽었어요. 링크가 나오려면 날짜·노선이 필요해요 — 가격 비교 화면엔 날짜가 없어요. '8.6~11 인~시즈오카' 같은 날짜·노선 메시지를 복사해 붙여넣거나 캡처해 함께 넣어주세요";
      card2.innerHTML = '<div class="pax-head">📋 여권 정보</div><div class="section-note">' + note + ".</div>" + unassigned.map(paxHtml).join("");
      out.appendChild(card2);
    }
  }

  // 탑승자 카드의 "눌러서 복사" 칩 — 결과 영역에 위임 처리
  var outEl = $("flight-out");
  if (outEl) {
    outEl.addEventListener("click", function (e) {
      var chip = e.target.closest ? e.target.closest(".cchip") : null;
      if (!chip) return;
      var val = chip.getAttribute("data-copy") || "";
      copyText(val).then(function (ok) {
        if (ok) {
          chip.classList.add("copied");
          setTimeout(function () { chip.classList.remove("copied"); }, 1200);
          toast("복사됐어요: " + val + " — 예약 폼 칸에 붙여넣으세요");
        } else {
          toast("복사에 실패했어요. 값을 길게 눌러 직접 복사해 주세요.");
        }
      });
    });
  }

  // 입력/결과 화면 전환 (정리하기 → 결과만 보이게)
  function showResult() { $("step-input").hidden = true; $("step-result").hidden = false; window.scrollTo(0, 0); }
  function showInput() { $("step-result").hidden = true; $("step-input").hidden = false; }

  // 날짜·노선 텍스트 → 여정+링크 (서버 불필요, 클라이언트에서 파싱)
  function tripsFromText(text) {
    if (!text) return [];
    return FlightPrep.parseTrips(text).map(function (t) {
      var links = FlightPrep.buildLinks(t, { adults: t.paxCount || 1 });
      var ready = !!(links && links.skyscanner);
      return {
        label: t.label, depart: t.depart, "return": t.return || "", links: links,
        pax_count: t.paxCount || 0,
        comparison: { ready: ready, missing: ready ? [] : ["출발·도착 공항 / 가는 날"] }, passengers: [],
      };
    });
  }

  // 링크가 안 나온 여정을 붙여넣은 텍스트(클라이언트 최신 사전)로 보완.
  // 같은 출발일의 텍스트 여정에서 공항을 찾으면 그 링크를 채운다 (인원수는 여정의 탑승자 수).
  function fillMissingLinks(trips, text) {
    if (!text || !trips.length) return;
    var raw = FlightPrep.parseTrips(text);
    trips.forEach(function (t) {
      var ready = t.comparison ? t.comparison.ready : !!(t.links && t.links.skyscanner);
      if (ready) return;
      for (var i = 0; i < raw.length; i++) {
        var r = raw[i];
        if (!r.depart || !r.destCode) continue;
        if (t.depart && r.depart !== t.depart) continue;
        var adults = (t.passengers && t.passengers.length) || t.pax_count || r.paxCount || 1;
        var links = FlightPrep.buildLinks(r, { adults: adults });
        if (!links.skyscanner) continue;
        t.links = links;
        if (!t.pax_count) t.pax_count = adults;
        if (!t.label || t.label === "여정") t.label = r.label;
        t.comparison = { ready: true, missing: [] };
        raw.splice(i, 1);
        break;
      }
    });
  }

  $("go").addEventListener("click", async function () {
    var text = pastedText.trim(); // 자동 수집된 붙여넣기 텍스트(있으면). 손입력칸 없음.
    if (!images.length && !text) { toast("여권·항공편 화면을 붙여넣어 주세요."); return; }

    var trips = [];        // 여정(→링크): 서버가 이미지·텍스트에서 자동 추출
    var passengers = [];   // 여권 정보: 서버 OCR

    if (images.length) {
      var pw = ensurePassword();
      if (pw == null) { toast("비밀번호를 입력해야 여권을 읽어요."); return; }
      var base = serverBase();
      $("go").disabled = true; $("hint").textContent = "읽는 중… (사진 인식은 몇 초 걸려요)";
      try {
        var blobs = images.map(function (im) { return im.blob; });
        // 이미지(여권·항공편 화면) + 텍스트를 함께 서버로 → 여권=탑승자, 항공편 화면·메시지=여정 자동 추출
        // 비밀번호는 Basic 인증 헤더로 명시 전송(크로스도메인 확실)
        var data = await FlightPrep.analyzePaste(blobs, { baseUrl: base, username: "admin", password: pw, text: text });
        // 여정에 붙은 탑승자는 여정 카드에 표시되고, 못 붙은 여권만 '여권 정보'로 (중복 방지)
        passengers = (data.unassigned_passengers || []).slice();
        trips = (data.trips || []);
      } catch (e) {
        $("hint").textContent = ""; $("go").disabled = false;
        var msg = String((e && e.message) || e || "");
        var fallback = text ? tripsFromText(text) : []; // 서버 실패해도 붙여넣은 텍스트로 링크는 만든다
        render({ trips: fallback, unassigned_passengers: [] });
        var note = /401|403|인증|auth/i.test(msg)
          ? '비밀번호가 맞지 않아요. "새로 정리하기"로 돌아가 다시 눌러 비밀번호를 새로 입력해 주세요.' + (function () { lsDel(LS_PW); return ""; })()
          : '여권 인식 서버에 연결하지 못했어요: ' + esc(msg) + '<br>서버(' + esc(base) + ')가 켜져 있는지 확인해 주세요. (⚙️ 서버 설정 변경에서 주소 변경)';
        $("flight-out").insertAdjacentHTML("afterbegin", '<div class="trip-card"><div class="link-miss">' + note + '</div></div>');
        showResult();
        return;
      }
      $("hint").textContent = ""; $("go").disabled = false;
    }

    // 서버가 여정을 못 뽑았는데 붙여넣은 텍스트가 있으면 클라이언트로 링크 생성(안전망)
    if (!trips.length && text) trips = tripsFromText(text);
    // 서버가 여정은 뽑았지만 링크를 못 만든 경우(서버 공항 사전이 옛 버전 등)도
    // 붙여넣은 텍스트를 이 화면의 최신 사전으로 다시 읽어 링크를 보완한다.
    fillMissingLinks(trips, text);

    render({ trips: trips, unassigned_passengers: passengers });
    showResult();
  });

  $("back-btn").addEventListener("click", showInput);

  // 서버 설정 변경(주소·비밀번호) — 하단 링크
  var cfgBtn = $("server-config");
  if (cfgBtn) {
    cfgBtn.addEventListener("click", function (e) {
      e.preventDefault();
      changeServer();
      if (window.confirm("서버 비밀번호도 다시 설정할까요?")) { lsDel(LS_PW); ensurePassword(); }
    });
  }
})();
