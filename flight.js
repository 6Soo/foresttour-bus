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
  var $ = function (id) { return document.getElementById(id); };

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

  // 클립보드 붙여넣기
  window.addEventListener("paste", function (e) {
    var items = (e.clipboardData || {}).items || [];
    var got = false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind === "file" && it.type.indexOf("image/") === 0) { addImage(it.getAsFile()); got = true; }
    }
    if (got) e.preventDefault();
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

  var PAX_ORDER = ["한글이름", "영문성", "영문이름", "생년월일", "성별", "여권만료일"];

  function paxHtml(p) {
    var rows = PAX_ORDER.map(function (k) {
      return '<span class="k">' + k + "</span><span>" + (esc(p[k]) || "—") + "</span>";
    }).join("");
    var flag = p["경고"] ? '<div class="flag">⚠️ ' + esc(p["경고"]) + "</div>" : "";
    var nm = esc(p["한글이름"] || ((p["영문성"] || "") + " " + (p["영문이름"] || "")).trim()) || "탑승자";
    return '<div class="pax"><div class="nm">' + nm + '</div><div class="kv">' + rows + "</div>" + flag + "</div>";
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
      var dates = t.depart ? '<span class="t-dates">' + esc(t.depart) + " ~ " + esc(t.return) + "</span>" : "";
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
      var note = trips.length ? "어느 여정인지 자동으로 못 붙인 여권이에요" : "여권 정보예요. 날짜·노선 메시지도 붙여넣으면 링크가 나와요";
      card2.innerHTML = '<div class="pax-head">📋 여권 정보</div><div class="section-note">' + note + ".</div>" + unassigned.map(paxHtml).join("");
      out.appendChild(card2);
    }
  }

  // 입력/결과 화면 전환 (정리하기 → 결과만 보이게)
  function showResult() { $("step-input").hidden = true; $("step-result").hidden = false; window.scrollTo(0, 0); }
  function showInput() { $("step-result").hidden = true; $("step-input").hidden = false; }

  // 날짜·노선 텍스트 → 여정+링크 (서버 불필요, 클라이언트에서 파싱)
  function tripsFromText(text) {
    if (!text) return [];
    return FlightPrep.parseTrips(text).map(function (t) {
      var links = FlightPrep.buildLinks(t);
      var ready = !!(links && links.skyscanner);
      return {
        label: t.label, depart: t.depart, "return": t.return || "", links: links,
        comparison: { ready: ready, missing: ready ? [] : ["출발·도착 공항 / 가는 날"] }, passengers: [],
      };
    });
  }

  $("go").addEventListener("click", async function () {
    var text = (($("flight-text") && $("flight-text").value) || "").trim();
    if (!images.length && !text) { toast("여권 사진이나 날짜·노선을 넣어주세요."); return; }

    var trips = tripsFromText(text);   // 링크(여정)는 서버 없이 바로
    var passengers = [];               // 여권 정보는 서버 OCR로

    if (images.length) {
      var pw = ensurePassword();
      if (pw == null) { toast("비밀번호를 입력해야 여권을 읽어요."); return; }
      var base = serverBase();
      $("go").disabled = true; $("hint").textContent = "여권 읽는 중… (몇 초 걸려요)";
      try {
        var blobs = images.map(function (im) { return im.blob; });
        // 비밀번호를 Basic 인증 헤더로 명시 전송(크로스도메인 확실)
        var data = await FlightPrep.analyzePaste(blobs, { baseUrl: base, username: "admin", password: pw });
        passengers = (data.unassigned_passengers || []).slice();
        (data.trips || []).forEach(function (t) { if (t.passengers && t.passengers.length) passengers = passengers.concat(t.passengers); });
        if (!trips.length && data.trips && data.trips.length) trips = data.trips; // 이미지에 노선이 있었던 경우
      } catch (e) {
        $("hint").textContent = ""; $("go").disabled = false;
        var msg = String((e && e.message) || e || "");
        render({ trips: trips, unassigned_passengers: [] }); // 링크(텍스트 여정)는 있으면 함께
        var note = /401|403|인증|auth/i.test(msg)
          ? '비밀번호가 맞지 않아요. "새로 정리하기"로 돌아가 다시 눌러 비밀번호를 새로 입력해 주세요.' + (function () { lsDel(LS_PW); return ""; })()
          : '여권 인식 서버에 연결하지 못했어요: ' + esc(msg) + '<br>서버(' + esc(base) + ')가 켜져 있는지 확인해 주세요. (⚙️ 서버 설정 변경에서 주소 변경)';
        $("flight-out").insertAdjacentHTML("afterbegin", '<div class="trip-card"><div class="link-miss">' + note + '</div></div>');
        showResult();
        return;
      }
      $("hint").textContent = ""; $("go").disabled = false;
    }

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
