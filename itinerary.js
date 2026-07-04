/* ============================================
   숲길따라 감성여행 · 여행 일정 페이지
   ============================================ */

// 카카오 개발자 JavaScript 키를 입력하면 카카오톡 네이티브 공유가 활성화됩니다.
// (없으면 기기 공유 시트 → 카카오톡 선택 방식으로 동작)
const KAKAO_JS_KEY = '';

const STORAGE_KEY = 'foresttour-itinerary-v1';

// 카테고리 정의(CATS)와 공유 링크 인코딩은 parse-rules.js에서 로드됩니다.

const DAY_NAMES = ['첫째 날', '둘째 날', '셋째 날', '넷째 날', '다섯째 날', '여섯째 날', '일곱째 날', '여덟째 날', '아홉째 날', '열째 날'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ---------- 기본 예시 데이터 ----------
function defaultData() {
    return {
        title: '화순 · 담양 · 지리산 힐링여행',
        startDate: '2025-11-05',
        note: '숙소 사정에 따라 일정 순서는 일부 변경될 수 있습니다.\n편한 트레킹화와 따뜻한 겉옷을 준비해 주세요.',
        days: [
            {
                items: [
                    { cat: 'tour', text: '화순적벽 투어 (예약)' },
                ],
                stay: '화순온천리조트 + 조식',
            },
            {
                items: [
                    { cat: 'walk', text: '가사문학길 (소쇄원~취가정~환벽당~식영정)' },
                    { cat: 'spot', text: '날씨 더우면 광주호 호숫길' },
                    { cat: 'tour', text: '명옥헌원림 배롱나무' },
                    { cat: 'tour', text: '창평 슬로시티마을길' },
                    { cat: 'walk', text: '담양 죽녹원 / 메타세콰이어길' },
                ],
                stay: '지리산운봉고원 O호텔 + 조식',
            },
            {
                items: [
                    { cat: 'tour', text: '지리산허브밸리 / 박초월생가마을' },
                    { cat: 'walk', text: '장수 방화동생태길' },
                    { cat: 'walk', text: '산림치유원 힐링산책 (1)' },
                ],
                stay: '진안고원 산림치유원 + 석식 + 조식 (2025.11.6 정식 개원!)',
            },
            {
                items: [
                    { cat: 'walk', text: '산림치유원 힐링산책 (2)' },
                    { cat: 'trek', text: '마이산 남부~북부 트레킹 (A/B)' },
                ],
                stay: '',
            },
        ],
    };
}

// ---------- 상태 ----------
let state;
let editing = false;
let sheetTarget = null; // { d, i }

function loadInitial() {
    // 1) 공유 링크의 데이터 우선
    const hash = window.location.hash;
    if (hash.startsWith('#d=')) {
        try {
            const data = decodeData(hash.slice(3));
            if (data && Array.isArray(data.days)) {
                document.getElementById('shared-banner').hidden = false;
                return data;
            }
        } catch (e) { /* 잘못된 링크면 무시 */ }
    }
    // 2) 저장된 데이터
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved && Array.isArray(saved.days)) return saved;
    } catch (e) { /* 손상된 데이터면 무시 */ }
    // 3) 예시 데이터
    return defaultData();
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* 저장 공간 부족 등은 무시 */ }
    // 공유 링크로 열었다가 수정한 경우, 해시의 옛 데이터가
    // 새로고침 시 수정 내용을 덮어쓰지 않도록 해시를 제거
    if (window.location.hash.startsWith('#d=')) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
        document.getElementById('shared-banner').hidden = true;
    }
}

// ---------- 날짜 유틸 ----------
function dayDate(index) {
    if (!state.startDate) return null;
    const [y, m, d] = state.startDate.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d + index);
}

function fmtShort(date) {
    return `${date.getMonth() + 1}.${date.getDate()}(${WEEKDAYS[date.getDay()]})`;
}

function tripDurationLabel() {
    const n = state.days.length;
    if (n <= 1) return '당일 여행';
    return `${n - 1}박 ${n}일`;
}

function tripDatesLabel() {
    const start = dayDate(0);
    if (!start) return '';
    const end = dayDate(state.days.length - 1);
    return `${start.getFullYear()}.${fmtShort(start)} ~ ${fmtShort(end)}`;
}

// ---------- 렌더링 ----------
function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderHero() {
    const titleEl = document.getElementById('trip-title');
    if (titleEl.textContent !== state.title) titleEl.textContent = state.title;

    document.getElementById('trip-dates').textContent = tripDatesLabel() || '날짜 미정';
    document.getElementById('start-date').value = state.startDate || '';

    const itemCount = state.days.reduce((n, d) => n + d.items.length, 0);
    const stayCount = state.days.filter((d) => d.stay && d.stay.trim()).length;
    const badges = [`🗓️ ${tripDurationLabel()}`, `📍 일정 ${itemCount}개`];
    if (stayCount) badges.push(`🏨 숙박 ${stayCount}곳`);
    document.getElementById('trip-badges').innerHTML =
        badges.map((b) => `<span class="hero-badge">${escapeHtml(b)}</span>`).join('');
}

function renderDays() {
    const wrap = document.getElementById('days');
    wrap.innerHTML = state.days.map((day, d) => {
        const date = dayDate(d);
        const dateLabel = date ? `${fmtShort(date)} · ${DAY_NAMES[d] || `${d + 1}일차`}`
                               : (DAY_NAMES[d] || `${d + 1}일차`);

        const itemsHtml = day.items.map((item, i) => {
            const cat = CATS[item.cat] || CATS.spot;
            return `
            <div class="item-row" data-d="${d}" data-i="${i}">
                <button class="cat-badge" type="button" style="background:${cat.bg}" data-act="cat" ${editing ? '' : 'tabindex="-1"'} aria-label="일정 종류 변경">${cat.emoji}</button>
                <div class="item-body">
                    <div class="item-cat-label" style="color:${cat.color}">${cat.label}</div>
                    <div class="item-text" data-field="item-text" ${editing ? 'contenteditable="plaintext-only"' : ''} data-placeholder="일정을 입력하세요">${escapeHtml(item.text)}</div>
                </div>
                <div class="row-actions">
                    <button type="button" data-act="up" aria-label="위로">↑</button>
                    <button type="button" data-act="down" aria-label="아래로">↓</button>
                    <button type="button" class="row-del" data-act="del" aria-label="삭제">✕</button>
                </div>
            </div>`;
        }).join('');

        const hasStay = day.stay !== undefined && day.stay !== null && (editing ? day.stay !== null : day.stay.trim() !== '');
        const stayHtml = (day.stay && day.stay.trim()) || (editing && day.stay !== '')
            ? `
            <div class="stay-block" data-d="${d}">
                <div class="stay-icon">🏨</div>
                <div class="stay-body">
                    <div class="stay-label">숙박</div>
                    <div class="stay-text" data-field="stay-text" ${editing ? 'contenteditable="plaintext-only"' : ''} data-placeholder="숙소를 입력하세요">${escapeHtml(day.stay)}</div>
                </div>
                <button type="button" class="stay-del" data-act="stay-del" aria-label="숙박 삭제">✕</button>
            </div>`
            : (editing ? `<button type="button" class="add-stay edit-only" data-d="${d}" data-act="add-stay">＋ 숙박 추가</button>` : '');

        return `
        <article class="day-card" data-d="${d}">
            <div class="day-head">
                <span class="day-chip">DAY ${d + 1}</span>
                <span class="day-date">${escapeHtml(dateLabel)}</span>
                ${editing ? `<button type="button" class="day-del" data-act="day-del" data-d="${d}">삭제</button>` : ''}
            </div>
            <div class="timeline">${itemsHtml || (editing ? '' : '<p style="color:var(--text-weak);font-size:14px;">일정이 없습니다</p>')}</div>
            ${editing ? `<button type="button" class="add-item edit-only" data-d="${d}" data-act="add-item">＋ 일정 추가</button>` : ''}
            ${stayHtml}
        </article>`;
    }).join('');
}

function renderNote() {
    const noteEl = document.getElementById('trip-note');
    if (noteEl.textContent !== state.note) noteEl.textContent = state.note;
    noteEl.setAttribute('contenteditable', editing ? 'plaintext-only' : 'false');
    document.getElementById('note-card').classList.toggle(
        'hidden-view', !editing && !(state.note && state.note.trim())
    );
}

function render() {
    renderHero();
    renderDays();
    renderNote();
    document.getElementById('trip-title').setAttribute('contenteditable', editing ? 'plaintext-only' : 'false');
}

// ---------- 편집 모드 ----------
const editToggle = document.getElementById('edit-toggle');
editToggle.addEventListener('click', () => {
    editing = !editing;
    document.body.classList.toggle('editing', editing);
    editToggle.textContent = editing ? '완료' : '편집';
    if (!editing) {
        // 완료 시 빈 항목 정리
        state.days.forEach((day) => {
            day.items = day.items.filter((it) => it.text.trim() !== '');
        });
        save();
        toast('저장되었습니다 ✅');
    }
    render();
});

// ---------- 이벤트 위임 ----------
document.getElementById('main').addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'trip-title') { state.title = t.textContent.trim(); save(); return; }
    if (t.id === 'trip-note') { state.note = t.textContent; save(); return; }

    const field = t.getAttribute('data-field');
    if (!field) return;
    if (field === 'item-text') {
        const row = t.closest('.item-row');
        state.days[+row.dataset.d].items[+row.dataset.i].text = t.textContent;
        save();
    } else if (field === 'stay-text') {
        const block = t.closest('.stay-block');
        state.days[+block.dataset.d].stay = t.textContent;
        save();
    }
});

document.getElementById('start-date').addEventListener('change', (e) => {
    state.startDate = e.target.value;
    save();
    render();
});

// Enter 키 → 다음 일정 추가 (편집 모드)
document.getElementById('main').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (t.getAttribute('data-field') === 'item-text') {
        e.preventDefault();
        const row = t.closest('.item-row');
        const d = +row.dataset.d;
        const i = +row.dataset.i;
        const prevCat = state.days[d].items[i]?.cat || 'tour';
        state.days[d].items.splice(i + 1, 0, { cat: prevCat, text: '' });
        save();
        render();
        focusItem(d, i + 1);
    } else if (t.getAttribute('data-field') === 'stay-text' || t.id === 'trip-title') {
        e.preventDefault();
        t.blur();
    }
});

document.getElementById('main').addEventListener('click', (e) => {
    if (!editing) return;
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'cat') {
        const row = btn.closest('.item-row');
        openSheet(+row.dataset.d, +row.dataset.i);
        return;
    }
    if (act === 'add-item') {
        const d = +btn.dataset.d;
        state.days[d].items.push({ cat: 'tour', text: '' });
        save(); render();
        focusItem(d, state.days[d].items.length - 1);
        return;
    }
    if (act === 'add-stay') {
        const d = +btn.dataset.d;
        state.days[d].stay = ' ';
        save(); render();
        const block = document.querySelector(`.stay-block[data-d="${d}"] .stay-text`);
        if (block) { block.textContent = ''; state.days[d].stay = ''; block.focus(); }
        return;
    }
    if (act === 'stay-del') {
        const block = btn.closest('.stay-block');
        state.days[+block.dataset.d].stay = '';
        save(); render();
        return;
    }
    if (act === 'day-del') {
        const d = +btn.dataset.d;
        if (!confirm(`DAY ${d + 1} 전체를 삭제할까요?`)) return;
        state.days.splice(d, 1);
        if (state.days.length === 0) state.days.push({ items: [], stay: '' });
        save(); render();
        return;
    }

    const row = btn.closest('.item-row');
    if (!row) return;
    const d = +row.dataset.d;
    const i = +row.dataset.i;
    const items = state.days[d].items;

    if (act === 'del') {
        items.splice(i, 1);
    } else if (act === 'up' && i > 0) {
        [items[i - 1], items[i]] = [items[i], items[i - 1]];
    } else if (act === 'down' && i < items.length - 1) {
        [items[i + 1], items[i]] = [items[i], items[i + 1]];
    } else {
        return;
    }
    save(); render();
});

document.getElementById('add-day').addEventListener('click', () => {
    state.days.push({ items: [], stay: '' });
    save(); render();
    const cards = document.querySelectorAll('.day-card');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

function focusItem(d, i) {
    const el = document.querySelector(`.item-row[data-d="${d}"][data-i="${i}"] .item-text`);
    if (el) el.focus();
}

// ---------- 카테고리 바텀시트 ----------
const sheet = document.getElementById('cat-sheet');
const backdrop = document.getElementById('sheet-backdrop');

function openSheet(d, i) {
    sheetTarget = { d, i };
    const current = state.days[d].items[i].cat;
    document.getElementById('cat-list').innerHTML = Object.entries(CATS).map(([key, c]) => `
        <button type="button" class="cat-option ${key === current ? 'selected' : ''}" data-cat="${key}">
            <span class="emoji">${c.emoji}</span>
            <span class="label">${c.label}</span>
        </button>`).join('');
    sheet.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(() => {
        sheet.classList.add('show');
        backdrop.classList.add('show');
    });
}

function closeSheet() {
    sheet.classList.remove('show');
    backdrop.classList.remove('show');
    setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; }, 250);
}

backdrop.addEventListener('click', closeSheet);
document.getElementById('cat-list').addEventListener('click', (e) => {
    const opt = e.target.closest('.cat-option');
    if (!opt || !sheetTarget) return;
    state.days[sheetTarget.d].items[sheetTarget.i].cat = opt.dataset.cat;
    save(); render();
    closeSheet();
});

// ---------- 공유용 텍스트 생성 ----------
function buildShareText() {
    const lines = [];
    lines.push(`🌲 ${state.title || '여행 일정'}`);
    const dates = tripDatesLabel();
    if (dates) lines.push(`🗓️ ${dates} · ${tripDurationLabel()}`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━');

    state.days.forEach((day, d) => {
        const date = dayDate(d);
        const head = date
            ? `<${DAY_NAMES[d] || `${d + 1}일차`}> ${fmtShort(date)}`
            : `<${DAY_NAMES[d] || `${d + 1}일차`}>`;
        lines.push('');
        lines.push(`📅 ${head}`);
        day.items.forEach((item) => {
            const cat = CATS[item.cat] || CATS.spot;
            lines.push(`  ${cat.emoji} ${item.text}`);
        });
        if (day.stay && day.stay.trim()) {
            lines.push(`  🏨 [숙박] ${day.stay.trim()}`);
        }
    });

    if (state.note && state.note.trim()) {
        lines.push('');
        lines.push('━━━━━━━━━━━━━━');
        lines.push('');
        lines.push(`📌 ${state.note.trim()}`);
    }
    lines.push('');
    lines.push('🌲 숲길따라 감성여행');
    return lines.join('\n');
}

function buildShareUrl() {
    return `${window.location.origin}${window.location.pathname}#d=${encodeData(state)}`;
}

// ---------- 클립보드 복사 ----------
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { /* noop */ }
        document.body.removeChild(ta);
        return ok;
    }
}

document.getElementById('copy-btn').addEventListener('click', async () => {
    const ok = await copyText(buildShareText());
    toast(ok ? '일정이 복사되었습니다 📋' : '복사에 실패했습니다 😢');
});

// ---------- 카카오톡 공유 ----------
document.getElementById('kakao-btn').addEventListener('click', async () => {
    const url = buildShareUrl();
    const title = state.title || '여행 일정';

    // 1) 카카오 SDK (키가 설정된 경우)
    if (KAKAO_JS_KEY && window.Kakao && window.Kakao.isInitialized()) {
        window.Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
                title: `🌲 ${title}`,
                description: `${tripDatesLabel()} · ${tripDurationLabel()} 일정을 확인해 보세요!`,
                imageUrl: '',
                link: { mobileWebUrl: url, webUrl: url },
            },
            buttons: [{ title: '일정 보기', link: { mobileWebUrl: url, webUrl: url } }],
        });
        return;
    }

    // 2) 기기 공유 시트 (카카오톡 선택 가능)
    if (navigator.share) {
        try {
            await navigator.share({
                title: `🌲 ${title}`,
                text: buildShareText(),
                url,
            });
            return;
        } catch (e) {
            if (e.name === 'AbortError') return; // 사용자가 취소
        }
    }

    // 3) 폴백: 링크 복사
    const ok = await copyText(`${buildShareText()}\n\n👉 일정 보기: ${url}`);
    toast(ok ? '일정과 링크를 복사했어요! 카카오톡에 붙여넣어 주세요 💬' : '공유에 실패했습니다 😢');
});

// 카카오 SDK 로드 (키가 있을 때만)
if (KAKAO_JS_KEY) {
    const s = document.createElement('script');
    s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
    s.onload = () => { window.Kakao.init(KAKAO_JS_KEY); };
    document.head.appendChild(s);
}

// ---------- 토스트 ----------
let toastTimer;
function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

// ---------- 시작 ----------
state = loadInitial();
render();
