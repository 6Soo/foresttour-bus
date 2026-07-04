/* ============================================
   숲길따라 감성여행 · 이미지로 일정 만들기
   - 이미지(OCR) 또는 텍스트 → parse-rules.js 규칙으로 분류
   - 미리보기에서 고친 분류는 localStorage에 저장되어 재사용(학습)
   ============================================ */

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

let files = [];
let parsed = null;
let sheetTarget = null; // { d, i }

const $ = (id) => document.getElementById(id);

// ---------- 탭 전환 ----------
document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
        $('pane-image').hidden = tab.dataset.tab !== 'image';
        $('pane-text').hidden = tab.dataset.tab !== 'text';
    });
});

// ---------- 이미지 선택 ----------
$('file-input').addEventListener('change', (e) => {
    files = files.concat([...e.target.files]);
    e.target.value = '';
    renderThumbs();
});

function renderThumbs() {
    $('thumbs').innerHTML = files.map((f, i) => `
        <div class="thumb">
            <img src="${URL.createObjectURL(f)}" alt="일정 이미지 ${i + 1}">
            <button type="button" data-i="${i}" aria-label="삭제">✕</button>
        </div>`).join('');
    $('analyze-image').disabled = files.length === 0;
}

$('thumbs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-i]');
    if (!btn) return;
    files.splice(+btn.dataset.i, 1);
    renderThumbs();
});

// ---------- 단계 전환 ----------
function showStep(step) {
    $('step-input').hidden = step !== 'input';
    $('step-progress').hidden = step !== 'progress';
    $('step-preview').hidden = step !== 'preview';
    $('preview-actions').hidden = step !== 'preview';
}

function setProgress(status, ratio) {
    $('progress-status').textContent = status;
    $('progress-fill').style.width = `${Math.round((ratio || 0) * 100)}%`;
}

// ---------- 이미지 분석 (OCR) ----------
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error('스크립트 로드 실패'));
        document.head.appendChild(s);
    });
}

$('analyze-image').addEventListener('click', async () => {
    if (!files.length) return;
    showStep('progress');
    try {
        if (!window.Tesseract) {
            setProgress('글자 인식 도구를 불러오는 중...', 0.02);
            await loadScript(TESSERACT_CDN);
        }
        // kor+eng+jpn: 일정에 섞인 영문 상호명과 일본어 지명(玉川寺, 村上店 등)을
        // 한글 모델이 숫자 쓰레기로 읽는 것을 방지
        const worker = await window.Tesseract.createWorker(['kor', 'eng', 'jpn'], 1, {
            logger: (m) => {
                if (m.status === 'loading language traineddata' || m.status === 'loading tesseract core') {
                    setProgress('한글 인식 데이터를 내려받는 중... (처음 한 번만)', 0.05 + (m.progress || 0) * 0.15);
                }
            },
        });
        let fullText = '';
        for (let i = 0; i < files.length; i++) {
            setProgress(`이미지 글자 인식 중... (${i + 1}/${files.length})`, 0.2 + (i / files.length) * 0.75);
            const { data } = await worker.recognize(files[i]);
            fullText += data.text + '\n';
        }
        await worker.terminate();
        setProgress('일정 분류 중...', 0.98);
        finishAnalyze(fullText, { ocr: true });
    } catch (err) {
        showStep('input');
        toast('이미지 인식에 실패했어요. 텍스트 붙여넣기를 이용해 보세요 🙏');
    }
});

// ---------- 텍스트 분석 ----------
$('analyze-text').addEventListener('click', () => {
    const text = $('text-input').value.trim();
    if (!text) { toast('일정 텍스트를 붙여넣어 주세요'); return; }
    finishAnalyze(text);
});

function finishAnalyze(text, opts) {
    parsed = parseScheduleText(text, opts);
    const total = parsed.days.reduce((n, d) => n + d.items.length, 0) + parsed.days.filter((d) => d.stay).length;
    if (total === 0) {
        showStep('input');
        toast('일정을 찾지 못했어요. 이미지가 선명한지 확인해 주세요 🥲');
        return;
    }
    renderPreview();
    showStep('preview');
    toast(`일정 ${total}개를 찾았어요 ✨`);
}

// ---------- 미리보기 렌더링 ----------
function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderPreview() {
    $('p-title').textContent = parsed.title;
    $('p-date-hint').textContent = parsed.startDate ? `🗓️ 출발일 인식: ${parsed.startDate}` : '';
    $('p-note').textContent = parsed.note || '';

    $('p-days').innerHTML = parsed.days.map((day, d) => {
        const itemsHtml = day.items.map((item, i) => {
            const cat = CATS[item.cat] || CATS.spot;
            return `
            <div class="item-row" data-d="${d}" data-i="${i}">
                <button class="cat-badge" type="button" style="background:${cat.bg}" data-act="cat" aria-label="일정 종류 변경">${cat.emoji}</button>
                <div class="item-body">
                    <div class="item-cat-label" style="color:${cat.color}">${cat.label}</div>
                    <div class="item-text" data-field="item-text" contenteditable="plaintext-only" data-placeholder="일정 내용">${escapeHtml(item.text)}</div>
                </div>
                <div class="row-actions">
                    <button type="button" data-act="up" aria-label="위로">↑</button>
                    <button type="button" data-act="down" aria-label="아래로">↓</button>
                    <button type="button" class="row-del" data-act="del" aria-label="삭제">✕</button>
                </div>
            </div>`;
        }).join('');

        const stayHtml = day.stay
            ? `
            <div class="stay-block" data-d="${d}">
                <div class="stay-icon">🏨</div>
                <div class="stay-body">
                    <div class="stay-label">숙박</div>
                    <div class="stay-text" data-field="stay-text" contenteditable="plaintext-only" data-placeholder="숙소">${escapeHtml(day.stay)}</div>
                </div>
                <button type="button" class="stay-del" data-act="stay-del" aria-label="숙박 삭제">✕</button>
            </div>`
            : '';

        return `
        <article class="day-card" data-d="${d}">
            <div class="day-head">
                <span class="day-chip">DAY ${d + 1}</span>
                <button type="button" class="day-del" data-act="day-del" data-d="${d}">삭제</button>
            </div>
            <div class="timeline">${itemsHtml}</div>
            ${stayHtml}
        </article>`;
    }).join('');
}

// ---------- 미리보기 편집 ----------
$('step-preview').addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'p-title') { parsed.title = t.textContent.trim(); return; }
    if (t.id === 'p-note') { parsed.note = t.textContent; return; }
    const field = t.getAttribute('data-field');
    if (field === 'item-text') {
        const row = t.closest('.item-row');
        parsed.days[+row.dataset.d].items[+row.dataset.i].text = t.textContent;
    } else if (field === 'stay-text') {
        const block = t.closest('.stay-block');
        parsed.days[+block.dataset.d].stay = t.textContent;
    }
});

$('step-preview').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'cat') {
        const row = btn.closest('.item-row');
        openSheet(+row.dataset.d, +row.dataset.i);
        return;
    }
    if (act === 'stay-del') {
        const block = btn.closest('.stay-block');
        parsed.days[+block.dataset.d].stay = '';
        renderPreview();
        return;
    }
    if (act === 'day-del') {
        const d = +btn.dataset.d;
        if (!confirm(`DAY ${d + 1} 전체를 삭제할까요?`)) return;
        parsed.days.splice(d, 1);
        renderPreview();
        return;
    }

    const row = btn.closest('.item-row');
    if (!row) return;
    const d = +row.dataset.d;
    const i = +row.dataset.i;
    const items = parsed.days[d].items;

    if (act === 'del') {
        items.splice(i, 1);
    } else if (act === 'up' && i > 0) {
        [items[i - 1], items[i]] = [items[i], items[i - 1]];
    } else if (act === 'down' && i < items.length - 1) {
        [items[i + 1], items[i]] = [items[i], items[i + 1]];
    } else {
        return;
    }
    renderPreview();
});

// ---------- 카테고리 바텀시트 (교정 → 학습) ----------
const sheet = $('cat-sheet');
const backdrop = $('sheet-backdrop');

function openSheet(d, i) {
    sheetTarget = { d, i };
    const current = parsed.days[d].items[i].cat;
    $('cat-list').innerHTML = Object.entries(CATS).map(([key, c]) => `
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
$('cat-list').addEventListener('click', (e) => {
    const opt = e.target.closest('.cat-option');
    if (!opt || !sheetTarget) return;
    const item = parsed.days[sheetTarget.d].items[sheetTarget.i];
    item.cat = opt.dataset.cat;
    addLearnedRule(item.text, item.cat); // 교정 내용을 기억해서 다음 분석에 반영
    renderPreview();
    closeSheet();
    toast(`'${CATS[item.cat].label}'(으)로 기억해 둘게요 🧠`);
});

// ---------- 완료 / 다시 ----------
$('open-btn').addEventListener('click', () => {
    if (!parsed) return;
    parsed.days.forEach((day) => {
        day.items = day.items.filter((it) => it.text.trim() !== '');
    });
    window.location.href = `itinerary.html#d=${encodeData(parsed)}`;
});

$('retry-btn').addEventListener('click', () => {
    showStep('input');
});

// ---------- 토스트 ----------
let toastTimer;
function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}
