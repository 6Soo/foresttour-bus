/* ============================================
   숲길따라 감성여행 · 공유 규칙 파일
   - 카테고리 정의(CATS): itinerary / import 두 페이지가 함께 사용
   - 일정 텍스트 파싱 규칙(PARSE_RULES): 이미지 OCR·텍스트 → 일정 변환
   ⚠️ 새로운 일정 이미지 양식을 학습하면 이 파일의 패턴/키워드를
      확장하세요. 자세한 워크플로는 CLAUDE.md 참고.
   ============================================ */

// ---------- 카테고리 정의 ----------
const CATS = {
    tour: { label: '관광',   emoji: '🌸', color: '#d6549b', bg: '#fdeef6' },
    trek: { label: '트레킹', emoji: '🥾', color: '#0d9463', bg: '#e7f6ef' },
    move: { label: '이동',   emoji: '🚌', color: '#3182f6', bg: '#eaf2fe' },
    food: { label: '식사',   emoji: '🍚', color: '#e8830c', bg: '#fef3e2' },
    spa:  { label: '온천',   emoji: '♨️', color: '#e05b4b', bg: '#fdeeec' },
    shop: { label: '쇼핑',   emoji: '🛍️', color: '#8b5cf6', bg: '#f3eefe' },
    rest: { label: '휴식',   emoji: '☕', color: '#64748b', bg: '#eef1f4' },
    spot: { label: '포인트', emoji: '📍', color: '#0ea5b7', bg: '#e6f7fa' },
};

const KOR_ORDINAL = { '첫': 1, '둘': 2, '셋': 3, '넷': 4, '다섯': 5, '여섯': 6, '일곱': 7, '여덟': 8, '아홉': 9, '열': 10 };

// ---------- 파싱 규칙 ----------
const PARSE_RULES = {
    // 통째로 무시할 줄
    skipLines: [
        /^[\[【]?\s*기본\s*여행\s*일정\s*[\]】]?$/,
        /^[-=━─_~·.]{3,}$/,
    ],

    // 일차 시작 패턴 — 매칭되면 새 일차 시작, rest(m)는 같은 줄의 나머지 내용
    // OCR 오인식 변형도 포함할 것 (예: '둘쨋날' → '둘짤')
    dayHeaders: [
        // <제1일>, 제 1일차
        { re: /^<?\s*제\s*(\d{1,2})\s*일\s*차?\s*>?\s*[.·:~\-]*\s*(.*)$/, num: (m) => +m[1], rest: (m) => m[2] },
        // 첫날.., 둘쨋날.., 둘짤..(OCR 변형), 셋째 날
        { re: /^(첫|둘|셋|넷|다섯|여섯|일곱|여덟|아홉|열)(?:(?:째|쨋|짤|쩃|채)\s*날?|\s*날)\s*[.·:~\-]*\s*(.*)$/, num: (m) => KOR_ORDINAL[m[1]], rest: (m) => m[2] },
        // DAY 1, Day1.
        { re: /^[Dd][Aa][Yy]\s*\.?\s*(\d{1,2})\s*[.·:~\-]*\s*(.*)$/, num: (m) => +m[1], rest: (m) => m[2] },
        // 1일차, 3 일차:
        { re: /^(\d{1,2})\s*일\s*차\s*[.·:~\-]*\s*(.*)$/, num: (m) => +m[1], rest: (m) => m[2] },
    ],

    // 숙박 패턴
    stayInline: /[\[【]\s*숙박\s*[-–—:：]?\s*([^\]】]+)[\]】]?/,                       // [숙박- 화순온천리조트+조식]
    stayBracket: /^[\[【]([^\]】]*(?:호텔|리조트|산장|펜션|료칸|민박|게스트하우스|콘도|글램핑|캠핑|모텔|여관)[^\]】]*)[\]】]$/, // [반 시게루의 그 온천호텔]
    stayKeyword: /^숙박\s*[-–—:：]\s*(.+)$/,                                          // 숙박: OO호텔

    // 안내문 시작 패턴 (* 로 시작하는 줄 → 이후 줄도 안내문으로 이어짐)
    noteStart: /^[*＊✱]+\s*(.*)$/,

    // 제목/본문 속 날짜 힌트 (예: "7월4(토)~9/야마가타", "2025.11.5 출발")
    dateHints: [
        { re: /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/, y: (m) => +m[1], mo: (m) => +m[2], d: (m) => +m[3] },
        { re: /(\d{1,2})\s*월\s*(\d{1,2})\s*일?/, y: () => null, mo: (m) => +m[1], d: (m) => +m[2] },
    ],

    // 카테고리 분류 키워드 — 앞선 항목이 우선 적용됨
    // 순서 주의: 이동(공항 도착+호텔 체크인 등 복합문)이 가장 먼저,
    // 트레킹이 휴식보다 먼저 ('트레킹(자유 선택)' 같은 문구 때문)
    categoryKeywords: [
        ['move', ['공항', '도착', '출발', '이동', '버스', '기차', '페리', '체크인', '픽업', '탑승', '항구']],
        ['spa',  ['온천', '찜질', '스파', '족욕', '노천탕', '온천욕']],
        ['food', ['점심', '저녁', '조식', '석식', '중식', '식사', '맛집', '스시', 'sushi', '한상', '뷔페', '밥집']],
        ['shop', ['쇼핑', '장보기', '마트', '시장', '아울렛', '기념품']],
        ['trek', ['트레킹', '산책', '등산', '하이킹', '올레', '둘레길', '숲길', '호숫길', '생태길', '습원', '습지', '계곡', '고원', '야생화', '트레일']],
        ['rest', ['자유', '휴식', '여유']],
        ['tour', ['투어', '관광', '성터', '정원', '미술관', '박물관', '원림', '마을', '유적', '전망대', '사찰', '절', '신사']],
    ],

    // '~길'로 끝나는 코스명은 트레킹으로 분류
    trekSuffix: /길\s*(?:$|\/|~|\()/,
};

// ---------- 사용자 교정 학습 (localStorage) ----------
const LEARNED_KEY = 'foresttour-learned-cats-v1';

function getLearnedRules() {
    if (typeof localStorage === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(LEARNED_KEY)) || [];
    } catch (e) { return []; }
}

function addLearnedRule(text, cat) {
    if (typeof localStorage === 'undefined') return;
    const kw = String(text || '').trim();
    if (!kw || !CATS[cat]) return;
    const rules = getLearnedRules().filter((r) => r.kw !== kw);
    rules.push({ kw, cat });
    try {
        localStorage.setItem(LEARNED_KEY, JSON.stringify(rules.slice(-200)));
    } catch (e) { /* noop */ }
}

// ---------- 카테고리 분류 ----------
function classifyText(text) {
    const t = String(text || '').trim();
    // 1) 사용자가 교정했던 항목 우선
    for (const r of getLearnedRules()) {
        if (r.kw && CATS[r.cat] && (t === r.kw || (r.kw.length >= 4 && t.includes(r.kw)))) return r.cat;
    }
    // 2) 키워드 규칙
    const low = t.toLowerCase();
    for (const [cat, kws] of PARSE_RULES.categoryKeywords) {
        if (kws.some((k) => low.includes(k))) return cat;
    }
    // 3) '~길' 코스명
    if (PARSE_RULES.trekSuffix.test(t)) return 'trek';
    return 'tour';
}

// ---------- 날짜 힌트 추출 ----------
function extractStartDate(text) {
    for (const h of PARSE_RULES.dateHints) {
        const m = String(text || '').match(h.re);
        if (!m) continue;
        let y = h.y(m);
        const mo = h.mo(m);
        const d = h.d(m);
        if (!mo || !d || mo > 12 || d > 31) continue;
        if (!y) {
            // 연도가 없으면 가장 가까운 미래(6개월 이내 과거 허용)로 추정
            const now = new Date();
            y = now.getFullYear();
            const guess = new Date(y, mo - 1, d);
            if (guess < new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())) y += 1;
        }
        const pad = (n) => String(n).padStart(2, '0');
        return `${y}-${pad(mo)}-${pad(d)}`;
    }
    return '';
}

// ---------- 일정 텍스트 파싱 ----------
function parseScheduleText(raw) {
    // 줄 정리 + 여러 줄에 걸친 [숙박 ...] 대괄호 병합
    const rawLines = String(raw || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const lines = [];
    let buf = '';
    rawLines.forEach((l) => {
        buf = buf ? buf + ' ' + l : l;
        const opens = (buf.match(/[\[【]/g) || []).length;
        const closes = (buf.match(/[\]】]/g) || []).length;
        if (opens > closes) return; // 대괄호가 닫힐 때까지 다음 줄과 병합
        lines.push(buf);
        buf = '';
    });
    if (buf) lines.push(buf);

    const data = { title: '', startDate: '', note: '', days: [] };
    let currentDay = null;
    let noteMode = false;
    const noteLines = [];

    function addItem(text) {
        const clean = text.replace(/^[•·\-–—▪◦☐✔]+\s*/, '').trim();
        if (!clean) return;
        currentDay.items.push({ cat: classifyText(clean), text: clean });
    }

    function addLine(line) {
        const s1 = line.match(PARSE_RULES.stayInline);
        if (s1) {
            currentDay.stay = s1[1].trim();
            const before = line.slice(0, s1.index).trim();
            if (before) addItem(before);
            return;
        }
        const s2 = line.match(PARSE_RULES.stayBracket) || line.match(PARSE_RULES.stayKeyword);
        if (s2) { currentDay.stay = s2[1].trim(); return; }
        addItem(line);
    }

    for (const line of lines) {
        if (PARSE_RULES.skipLines.some((re) => re.test(line))) continue;

        // 일차 시작?
        let isDay = false;
        for (const h of PARSE_RULES.dayHeaders) {
            const m = line.match(h.re);
            if (!m) continue;
            currentDay = { items: [], stay: '' };
            data.days.push(currentDay);
            noteMode = false;
            const rest = h.rest(m).trim();
            if (rest) addLine(rest);
            isDay = true;
            break;
        }
        if (isDay) continue;

        if (noteMode) {
            noteLines.push(line.replace(/[*＊✱]+\s*$/, '').trim());
            continue;
        }
        const noteM = line.match(PARSE_RULES.noteStart);
        if (noteM) {
            noteMode = true;
            noteLines.push(noteM[1].replace(/[*＊✱]+\s*$/, '').trim());
            continue;
        }

        if (!currentDay) {
            // 첫 일차 이전의 줄 → 여행 제목 후보 (날짜가 들어 있으면 출발일도 추출)
            if (!data.title) {
                data.title = line.replace(/^[\[【]|[\]】]$/g, '').trim();
                if (!data.startDate) data.startDate = extractStartDate(line);
            }
            continue;
        }
        addLine(line);
    }

    // 일차 구분을 하나도 못 찾았으면 전체를 1일차로
    if (data.days.length === 0) {
        currentDay = { items: [], stay: '' };
        data.days.push(currentDay);
        lines.forEach((l) => {
            if (PARSE_RULES.skipLines.some((re) => re.test(l))) return;
            if (data.title && l.replace(/^[\[【]|[\]】]$/g, '').trim() === data.title) return;
            addLine(l);
        });
    }

    data.note = noteLines.filter(Boolean).join('\n');
    if (!data.title) data.title = '새 여행 일정';
    return data;
}

// ---------- 공유 링크 인코딩 ----------
function encodeData(data) {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeData(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
}

// node 테스트용 (브라우저에서는 무시됨)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CATS, PARSE_RULES, classifyText, parseScheduleText, extractStartDate, encodeData, decodeData };
}
