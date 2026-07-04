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
    walk: { label: '산책',   emoji: '🚶', color: '#65a30d', bg: '#f3f9e4' },
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
    // 줄 중간에 있어도 찾아내는 숙소 대괄호 (OCR이 줄을 붙여버린 경우 대비)
    stayAnywhere: /[\[【]([^\]】\[【]*(?:호텔|리조트|산장|펜션|료칸|민박|게스트하우스|콘도|글램핑|캠핑|모텔|여관|연박)[^\]】\[【]*)[\]】]/,
    // 여는 대괄호가 OCR에서 유실/오인식(ㅣ 등)된 숙소 줄
    stayBrokenOpen: /^[ㅣl|I]?\s*([^\[\]【】]*(?:호텔|리조트|산장|펜션|료칸|민박|게스트하우스|콘도|온천지구|연박)[^\[\]【】]*)[\]】]\s*$/,
    stayKeyword: /^숙박\s*[-–—:：]\s*(.+)$/,                                          // 숙박: OO호텔
    // 여러 줄 병합을 허용할 대괄호인지 판별 (숙박류일 때만 병합)
    stayHint: /숙박|호텔|리조트|산장|펜션|료칸|민박|게스트하우스|콘도|글램핑|캠핑|모텔|여관|연박/,

    // 안내문 시작 패턴 (* 로 시작하는 줄 → 이후 줄도 안내문으로 이어짐)
    noteStart: /^[*＊✱]+\s*(.*)$/,

    // 식사 표기 규칙 (사용자 작성 습관): '점심'/'저녁' 뒤에 메뉴·상호명을 붙여 쓴다
    // (예: "점심Kappa Sushi", "점심..Nikaho Tourist Base Center")
    // → 다른 일정과 한 줄에 붙어 있으면 식사 표기부터 별도 항목으로 분리
    mealSplit: /^(.*?\S)\s+((?:점심|저녁|조식|석식)\s*[.·:~-]*\s*\S.*)$/,
    mealGlued: /(점심|저녁|조식|석식)(?=[A-Za-z0-9぀-ヿ一-鿿])/g,

    // 제목/본문 속 날짜 힌트 (예: "7월4(토)~9/야마가타", "2025.11.5 출발")
    dateHints: [
        { re: /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/, y: (m) => +m[1], mo: (m) => +m[2], d: (m) => +m[3] },
        { re: /(\d{1,2})\s*월\s*(\d{1,2})\s*일?/, y: () => null, mo: (m) => +m[1], d: (m) => +m[2] },
    ],

    // 카테고리 분류 키워드 — 앞선 항목이 우선 적용됨
    // 순서 주의: 이동(공항 도착+호텔 체크인 등 복합문)이 가장 먼저,
    // 트레킹(본격 산행)이 산책(가벼운 걷기)보다 먼저 ('야생화길 트레킹'은 트레킹),
    // 트레킹이 휴식보다 먼저 ('트레킹(자유 선택)' 같은 문구 때문)
    categoryKeywords: [
        ['move', ['공항', '도착', '출발', '이동', '버스', '기차', '페리', '체크인', '픽업', '탑승', '항구']],
        ['spa',  ['온천', '찜질', '스파', '족욕', '노천탕', '온천욕']],
        // '한상'은 넣지 말 것: '16나한상'(十六羅漢岩, 바위 불상군)이 식사로 오분류됨 (검색으로 확인)
        ['food', ['점심', '저녁', '조식', '석식', '중식', '식사', '맛집', '스시', 'sushi', '뷔페', '밥집']],
        ['shop', ['쇼핑', '장보기', '마트', '시장', '아울렛', '기념품']],
        ['trek', ['트레킹', '등산', '하이킹', '트레일', '종주', '산행']],
        ['walk', ['산책', '숲길', '호숫길', '둘레길', '올레', '생태길', '야생화길', '꽃길', '습원', '습지', '마을길']],
        ['rest', ['자유', '휴식', '여유']],
        ['tour', ['투어', '관광', '성터', '정원', '미술관', '박물관', '원림', '마을', '유적', '전망대', '사찰', '절', '신사']],
    ],

    // '~길'로 끝나는 코스명은 산책으로 분류 (본격 산행은 '트레킹' 키워드가 먼저 잡음)
    walkSuffix: /길\s*(?:$|\/|~|\()/,

    // 검색으로 확인한 복합 지명 — 인접 항목이 이 순서로 나오면 한 항목으로 병합
    // (애매한 지명 경계는 웹 검색으로 실제 관계를 확인한 뒤 여기에 기록 — CLAUDE.md 참고)
    compoundPlaces: [
        // 야마가타 유자마치: 丸池様와 十六羅漢岩은 ~2km 거리의 세트 코스 (원문에서 한 줄)
        ['마루이케', '16나한상'],
    ],
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
    if (PARSE_RULES.walkSuffix.test(t)) return 'walk';
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

// ---------- OCR 노이즈 정리 ----------
// 의미 문자: 완성형 한글, 라틴 문자, 한자, 가나 (자모 ㅅㅇㅣ 등은 제외 — OCR 오인식이 많음)
const MEANINGFUL_RE = /[가-힣a-zA-Z一-鿿぀-ヿ]/g;

function meaningfulCount(s) {
    return (String(s).match(MEANINGFUL_RE) || []).length;
}

// 숫자/기호 위주의 OCR 쓰레기 토큰 제거 (예: "53501001234", "0따하<307[")
// minRatio: 토큰 내 의미 문자 비율 하한 (제목처럼 날짜·기호가 많은 텍스트는 낮춰서 사용)
function cleanNoise(text, minRatio = 0.5) {
    return String(text || '')
        // 식사 표기가 쓰레기와 붙어 있으면 표기만 살림 (예: "점심..비310" → "점심" + 쓰레기)
        .replace(/(점심|저녁|조식|석식)(?=[^\s가-힣])/g, '$1 ')
        .split(/\s+/)
        .filter((tok) => {
            // 완성형 한글 1~2자 토큰(반, 그, 후, 성 등)은 실제 단어일 가능성이 높으므로 보존
            // (자모 ㅅ·ㅣ 등 OCR 잔여물은 완성형이 아니라서 여기 해당 없음)
            if (/^[가-힣]{1,2}$/.test(tok)) return true;
            const m = meaningfulCount(tok);
            if (m < 1) return false;
            if (tok.length <= 2 && m < 2) return false;
            if (/^[a-zA-Z]{1,2}$/.test(tok)) return false; // "Il", "uo" 같은 OCR 잔여물
            return m / tok.length >= minRatio;
        })
        .join(' ')
        .trim();
}

function isDayHeaderLine(line) {
    return PARSE_RULES.dayHeaders.some((h) => h.re.test(line));
}

// 모바일 화면 폭 때문에 꺾인 줄인지 문맥으로 판단 (OCR 입력 전용)
// 예: "트레킹(1시간/2" + "시간)" / "Sashimaki" + "shitsugen marsh" / "…환벽" + "당~식영정)"
function isContinuationLine(prev, cur) {
    if (!prev || !cur) return false;
    if (isDayHeaderLine(cur)) return false;
    if (/^[\[【]/.test(cur) || /^[*＊✱]/.test(cur)) return false; // 숙박/안내문 시작은 별개
    // 1) 닫는 괄호나 연결 기호로 시작하면 앞 줄의 연속
    if (/^[)\]〉>~+/&,.·-]/.test(cur)) return true;
    // 2) 앞 줄의 여는 괄호가 안 닫혔고, 이번 줄이 곧 닫으면 연속 (예: "트레킹(1시간/2" + "시간)")
    //    ※ 닫지 않는 줄까지 병합하면 OCR 쓰레기 '(' 하나에 일차 전체가 붙는 사고가 남
    const opens = (prev.match(/\(/g) || []).length;
    const closes = (prev.match(/\)/g) || []).length;
    if (opens > closes && /^[^()]{0,20}\)/.test(cur)) return true;
    // 3) 영문 단어가 줄 끝/줄 시작으로 이어지면 연속 (예: "Tourist Base" + "Center")
    if (/[A-Za-z]$/.test(prev) && /^[A-Za-z]/.test(cur)) return true;
    return false;
}

// ---------- 일정 텍스트 파싱 ----------
// opts.ocr: true 면 OCR 결과로 간주하고 숫자/기호 쓰레기 토큰 필터를 적용
//           (직접 붙여넣은 텍스트는 필터 없이 그대로 보존)
function parseScheduleText(raw, opts = {}) {
    const noisy = !!opts.ocr;
    const denoise = (s, r) => (noisy ? cleanNoise(s, r) : String(s || '').trim());

    // 0) OCR이 줄을 붙여버려도 일차 구분(<제N일> 등)은 새 줄에서 시작하도록 분리
    const pre = String(raw || '')
        .replace(/<\s*제\s*(\d{1,2})\s*일\s*차?\s*>/g, '\n<제$1일> ')
        .replace(/(\s)([Dd][Aa][Yy]\s*\.?\s*\d{1,2}\s*[.·:~\-])/g, '$1\n$2');

    // 1) 줄 정리 + 여러 줄에 걸친 [숙박 ...] 대괄호 병합
    //    - 숙박류 대괄호일 때만, 최대 3줄까지만 병합 (OCR 쓰레기 '['에 전체가 붙는 사고 방지)
    //    - 병합 중 일차 시작 줄을 만나면 즉시 중단
    const rawLines = pre.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const lines = [];
    let buf = '';
    let bufCount = 0;
    const flush = () => {
        if (buf) lines.push(buf);
        buf = '';
        bufCount = 0;
    };
    rawLines.forEach((l) => {
        if (buf) {
            if (isDayHeaderLine(l) || bufCount >= 3) {
                flush();
            } else {
                buf += ' ' + l;
                bufCount++;
                const opens = (buf.match(/[\[【]/g) || []).length;
                const closes = (buf.match(/[\]】]/g) || []).length;
                if (closes >= opens) flush();
                return;
            }
        }
        const opens = (l.match(/[\[【]/g) || []).length;
        const closes = (l.match(/[\]】]/g) || []).length;
        const tail = l.slice(Math.max(l.lastIndexOf('['), l.lastIndexOf('【')));
        if (opens > closes && PARSE_RULES.stayHint.test(tail)) {
            buf = l;
            bufCount = 1;
        } else if (noisy && lines.length && isContinuationLine(lines[lines.length - 1], l)) {
            // 모바일 화면 폭 때문에 꺾인 줄은 앞 줄에 이어붙임 (문맥 판단)
            lines[lines.length - 1] += ' ' + l;
        } else {
            lines.push(l);
        }
    });
    flush();

    const data = { title: '', startDate: '', note: '', days: [] };
    let currentDay = null;
    let noteMode = false;
    const noteLines = [];

    function addItem(text) {
        const clean = denoise(text.replace(/^[•·\-–—▪◦☐✔]+\s*/, ''))
            .replace(/[\s&+~·,/-]+$/, ''); // 끝에 매달린 연결 기호(&, + 등) 제거
        if (!clean || (noisy && meaningfulCount(clean) < 2)) return; // OCR 쓰레기만 남은 줄은 버림
        currentDay.items.push({ cat: classifyText(clean), text: clean });
    }

    function addLine(line) {
        // 1) [숙박- ...] 명시 표기
        const s1 = line.match(PARSE_RULES.stayInline);
        if (s1) {
            currentDay.stay = denoise(s1[1]) || s1[1].trim();
            const before = line.slice(0, s1.index).trim();
            if (before) addItem(before);
            return;
        }
        // 2) 줄 어디에 있어도 [OO호텔] 류 대괄호는 숙박으로 (앞뒤 나머지는 항목으로)
        const s2 = line.match(PARSE_RULES.stayAnywhere);
        if (s2) {
            currentDay.stay = denoise(s2[1]) || s2[1].trim();
            const before = line.slice(0, s2.index).trim();
            const after = line.slice(s2.index + s2[0].length).trim();
            if (before) addItem(before);
            if (after) addItem(after);
            return;
        }
        // 3) 여는 대괄호가 유실된 숙소 줄, '숙박:' 표기
        const s3 = line.match(PARSE_RULES.stayBrokenOpen) || line.match(PARSE_RULES.stayKeyword);
        if (s3) { currentDay.stay = denoise(s3[1]) || s3[1].trim(); return; }

        // 식사 표기 규칙: '점심 OOO'가 다른 일정과 한 줄에 붙어 있으면 별도 항목으로 분리
        const glued = line.replace(PARSE_RULES.mealGlued, '$1 ');
        const meal = glued.match(PARSE_RULES.mealSplit);
        if (meal && !/^(점심|저녁|조식|석식)/.test(meal[1])) {
            addItem(meal[1]);
            addItem(meal[2]);
            return;
        }
        addItem(glued);
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
                const t = denoise(line.replace(/^[<\[【]+|[>\]】]+$/g, ''), 0.3);
                if (t) data.title = t;
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

    // 검색으로 확인된 복합 지명 병합 (예: '마루이케' + '16나한상' → 한 항목)
    data.days.forEach((day) => {
        for (let i = 0; i < day.items.length - 1; i++) {
            for (const [a, b] of PARSE_RULES.compoundPlaces) {
                if (day.items[i].text.trim() === a && day.items[i + 1].text.trim().startsWith(b)) {
                    const merged = `${day.items[i].text.trim()} ${day.items[i + 1].text.trim()}`;
                    day.items.splice(i, 2, { cat: classifyText(merged), text: merged });
                    break;
                }
            }
        }
        // 식사 마커만 남은 항목('점심')은 뒤따르는 메뉴·상호명 항목과 병합
        for (let i = 0; i < day.items.length - 1; i++) {
            if (/^(점심|저녁|조식|석식)$/.test(day.items[i].text.trim())) {
                const merged = `${day.items[i].text.trim()} ${day.items[i + 1].text.trim()}`;
                day.items.splice(i, 2, { cat: 'food', text: merged });
            }
        }
    });

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
