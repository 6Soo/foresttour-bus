(() => {
    'use strict';

    const API_BASE = 'https://reserve.foresttour.kr';
    const GEMINI_BRIDGE = 'http://127.0.0.1:8765';
    const KEY_STORAGE = 'foresttour-todo-admin-key-v1';
    const STATUS_LABELS = { todo: '할 일', doing: '진행중', done: '완료' };
    const STATUS_EMOJIS = { todo: '📝', doing: '🏃', done: '🎉' };

    const state = {
        key: readStoredKey(),
        tours: [],
        selectedTourFldid: '',
        todos: [],
        selectedFile: null,
        selectedDataUrl: '',
        capturePending: null,
        activeStatus: 'todo',
        toastTimer: null,
    };

    const $ = id => document.getElementById(id);
    const elements = {
        keyButton: $('keyButton'),
        keyIcon: $('keyIcon'),
        keyLabel: $('keyLabel'),
        keyModal: $('keyModal'),
        keyForm: $('keyForm'),
        keyInput: $('keyInput'),
        keyError: $('keyError'),
        tourSelect: $('tourSelect'),
        tourMeta: $('tourMeta'),
        authNotice: $('authNotice'),
        openKeyFromNotice: $('openKeyFromNotice'),
        captureFeedback: $('captureFeedback'),
        closeCaptureFeedback: $('closeCaptureFeedback'),
        captureStatus: $('captureStatus'),
        capturePreview: $('capturePreview'),
        addTaskButton: $('addTaskButton'),
        taskComposer: $('taskComposer'),
        closeComposer: $('closeComposer'),
        taskForm: $('taskForm'),
        taskTitle: $('taskTitle'),
        board: $('board'),
        emptyBoard: $('emptyBoard'),
        toast: $('toast'),
    };

    function readStoredKey() {
        try {
            return sessionStorage.getItem(KEY_STORAGE) || '';
        } catch {
            return '';
        }
    }

    function storeKey(value) {
        try {
            if (value) sessionStorage.setItem(KEY_STORAGE, value);
            else sessionStorage.removeItem(KEY_STORAGE);
        } catch {
            // 개인정보를 장기 저장하지 않는 것이 우선입니다.
        }
    }

    function setKey(value) {
        state.key = value.trim();
        storeKey(state.key);
        elements.keyButton.classList.toggle('is-ready', Boolean(state.key));
        elements.keyIcon.textContent = state.key ? '🔓' : '🔐';
        elements.keyLabel.textContent = state.key ? '키 확인됨' : '운영 키';
        elements.authNotice.hidden = Boolean(state.key);
    }

    function showKeyModal() {
        elements.keyError.textContent = '';
        elements.keyInput.value = state.key;
        elements.keyModal.hidden = false;
        window.setTimeout(() => elements.keyInput.focus(), 30);
    }

    function hideKeyModal() {
        elements.keyModal.hidden = true;
    }

    function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.classList.add('is-visible');
        window.clearTimeout(state.toastTimer);
        state.toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 3000);
    }

    function setCaptureStatus(message, tone = '') {
        elements.captureStatus.textContent = message;
        elements.captureStatus.className = `capture-status${tone ? ` is-${tone}` : ''}`;
    }

    function todayKst() {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(new Date());
        const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}`;
    }

    function formatDate(value) {
        if (!value) return '날짜 미정';
        const parts = value.split('-');
        return parts.length === 3 ? `${parts[0]}년 ${Number(parts[1])}월 ${Number(parts[2])}일` : value;
    }

    function compactDateLabel(value) {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
        const [, month, day] = value.split('-').map(Number);
        const date = new Date(`${value}T00:00:00+09:00`);
        if (Number.isNaN(date.getTime())) return '';
        const weekday = new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul', weekday: 'short',
        }).format(date);
        return `${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}(${weekday})`;
    }

    function compactTripDate(tour) {
        const depart = compactDateLabel(tour?.date);
        if (!depart) return '';
        const returned = compactDateLabel(tour.returnDate);
        return returned && returned !== depart ? `${depart}_${returned}` : depart;
    }

    function stripLeadingTourDate(title) {
        if (typeof title !== 'string') return '';
        const datePart = String.raw`(?:20\d{2}\s*년\s*)?\d{1,2}\s*(?:월\s*\d{1,2}|[./-]\s*\d{1,2})(?:\s*일)?(?:\s*\([^)]*\))?`;
        const shortPart = String.raw`\d{1,2}(?:\s*일)?(?:\s*\([^)]*\))?`;
        const rangePart = String.raw`(?:\s*(?:~|〜|～|–|—|-)\s*(?:${datePart}|${shortPart})|\s*,\s*${shortPart})*`;
        const match = title.match(new RegExp(`^\\s*${datePart}${rangePart}`));
        if (!match) return title.trim();
        return title.slice(match[0].length).replace(/^\s+/, ' ');
    }

    function tourDisplayTitle(tour) {
        if (!tour) return '여행 정보 없음';
        const compactDate = compactTripDate(tour);
        const rest = stripLeadingTourDate(tour.title);
        const normalized = compactDate
            ? `${compactDate}${rest}`
            : tour.title;
        const leader = typeof tour.leader === 'string' ? tour.leader.trim() : '';
        return leader ? `[${leader}] ${normalized}` : normalized;
    }

    function daysUntil(value) {
        if (!value) return null;
        const parse = date => {
            const [year, month, day] = date.split('-').map(Number);
            return Date.UTC(year, month - 1, day);
        };
        return Math.round((parse(value) - parse(todayKst())) / 86400000);
    }

    function formatDDay(value) {
        const difference = daysUntil(value);
        if (difference === null) return '기한 없음';
        if (difference === 0) return 'D-DAY';
        return difference > 0 ? `D-${difference}` : `D+${Math.abs(difference)}`;
    }

    function formatDateTime(value) {
        if (!value) return '등록 시각 미상';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '등록 시각 미상';
        return new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(date);
    }

    function formatTaskDate(value) {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
        const [, month, day] = value.split('-').map(Number);
        const date = new Date(`${value}T00:00:00+09:00`);
        if (Number.isNaN(date.getTime())) return '';
        const weekday = new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul', weekday: 'short',
        }).format(date);
        return `${month}월${day}일(${weekday})`;
    }

    function selectedTour() {
        return state.tours.find(tour => tour.fldid === state.selectedTourFldid) || null;
    }

    function handleAuthError(error) {
        if (error?.status !== 401) return false;
        setKey('');
        state.todos = [];
        renderAll();
        showKeyModal();
        elements.keyError.textContent = '운영 키가 맞지 않거나 reserve 서버에 아직 등록되지 않았습니다.';
        return true;
    }

    async function request(path, options = {}) {
        const headers = new Headers(options.headers || {});
        if (state.key) headers.set('x-todo-key', state.key);
        if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        let response;
        try {
            response = await fetch(`${API_BASE}${path}`, { ...options, headers });
        } catch {
            throw new Error('reserve 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
        let data = null;
        try { data = await response.json(); } catch { /* empty response */ }
        if (!response.ok) {
            const error = new Error(data?.error || `요청에 실패했습니다 (${response.status})`);
            error.status = response.status;
            error.data = data;
            throw error;
        }
        return data;
    }

    async function loadTours() {
        try {
            const data = await request('/api/public/todo-tours');
            state.tours = Array.isArray(data?.tours) ? data.tours : [];
            renderTours();
            if (state.tours.length) {
                const exists = state.tours.some(tour => tour.fldid === state.selectedTourFldid);
                if (!exists) state.selectedTourFldid = state.tours[0].fldid;
                elements.tourSelect.value = state.selectedTourFldid;
                renderTourMeta();
                if (state.key) await loadTodos();
            } else {
                elements.tourMeta.textContent = 'reserve에 표시할 예정 여행이 없습니다.';
                renderAll();
            }
        } catch (error) {
            elements.tourSelect.replaceChildren(new Option('여행 목록을 불러오지 못했습니다', ''));
            elements.tourMeta.textContent = error.message;
            showToast(error.message);
        }
    }

    function renderTours() {
        elements.tourSelect.replaceChildren();
        if (!state.tours.length) {
            elements.tourSelect.append(new Option('예정 여행이 없습니다', ''));
            elements.tourSelect.disabled = true;
            return;
        }
        elements.tourSelect.disabled = false;
        state.tours.forEach(tour => {
            elements.tourSelect.append(new Option(tourDisplayTitle(tour), tour.fldid));
        });
    }

    function renderTourMeta() {
        const tour = selectedTour();
        if (!tour) {
            elements.tourMeta.textContent = '여행을 선택하면 업무를 등록할 수 있습니다.';
            return;
        }
        elements.tourMeta.replaceChildren();
        const meta = [];
        const compactDate = compactTripDate(tour);
        if (compactDate) meta.push(compactDate);
        meta.push(tour.nights ? `${tour.nights}박` : '여행');
        elements.tourMeta.textContent = meta.join(' · ');
    }

    async function loadTodos() {
        if (!state.key) {
            state.todos = [];
            renderAll();
            return;
        }
        elements.board.classList.add('is-loading');
        try {
            const data = await request('/api/public/todos');
            state.todos = Array.isArray(data?.todos) ? data.todos : [];
            renderAll();
        } catch (error) {
            if (!handleAuthError(error)) showToast(error.message);
            state.todos = [];
            renderAll();
        } finally {
            elements.board.classList.remove('is-loading');
        }
    }

    function renderAll() {
        renderAuth();
        renderStats();
        renderBoard();
    }

    function renderAuth() {
        elements.authNotice.hidden = Boolean(state.key);
        elements.addTaskButton.disabled = !state.key;
    }

    function openTaskComposer() {
        if (!state.key) return showKeyModal();
        if (!state.tours.length) return showToast('reserve 여행을 불러오는 중입니다. 잠시 후 다시 눌러 주세요.');
        const tour = selectedTour() || state.tours[0];
        state.selectedTourFldid = tour.fldid;
        elements.tourSelect.value = tour.fldid;
        renderTourMeta();
        elements.taskComposer.hidden = false;
        elements.taskTitle.focus();
    }

    function renderStats() {
        const counts = { todo: 0, doing: 0, done: 0 };
        state.todos.forEach(todo => { if (counts[todo.status] !== undefined) counts[todo.status] += 1; });
        $('tabCountTodo').textContent = counts.todo;
        $('tabCountDoing').textContent = counts.doing;
        $('tabCountDone').textContent = counts.done;
    }

    function renderBoard() {
        elements.board.dataset.activeStatus = state.activeStatus;
        elements.board.hidden = !state.key;
        elements.board.replaceChildren();
        ['todo', 'doing', 'done'].forEach(status => {
            const column = document.createElement('article');
            column.className = `board-column column-${status}`;
            column.dataset.columnStatus = status;
            const heading = document.createElement('div');
            heading.className = 'column-heading';
            const headingLabel = document.createElement('div');
            headingLabel.innerHTML = `<span class="column-dot"></span><h3>${STATUS_LABELS[status]}</h3>`;
            const count = document.createElement('span');
            count.className = 'column-count';
            const todos = state.todos.filter(todo => todo.status === status);
            count.textContent = todos.length;
            heading.append(headingLabel, count);
            const list = document.createElement('div');
            list.className = 'column-list';
            if (!todos.length) {
                const empty = document.createElement('div');
                empty.className = 'empty-column';
                empty.textContent = status === 'done' ? '완료한 업무가 여기에 모입니다.' : '아직 등록된 업무가 없습니다.';
                list.append(empty);
            } else {
                const groups = new Map();
                todos.forEach(todo => {
                    const key = todo.tourFldid || 'unknown';
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(todo);
                });
                groups.forEach((groupTodos, tourFldid) => {
                    const tripGroup = document.createElement('section');
                    tripGroup.className = 'column-trip-group';
                    const tripHeading = document.createElement('strong');
                    tripHeading.className = 'column-trip-heading';
                    const tour = state.tours.find(item => item.fldid === tourFldid);
                    tripHeading.textContent = `🧳 ${tour ? tourDisplayTitle(tour) : `여행 ${tourFldid}`}`;
                    const tripList = document.createElement('div');
                    tripList.className = 'column-trip-list';
                    groupTodos.forEach(todo => tripList.append(createTodoCard(todo)));
                    tripGroup.append(tripHeading, tripList);
                    list.append(tripGroup);
                });
            }
            column.append(heading, list);
            elements.board.append(column);
        });
        elements.emptyBoard.hidden = Boolean(state.key && state.todos.length);
        $('emptyBoardTitle').textContent = state.key ? '아직 업무가 없습니다' : '운영 키를 입력해 주세요';
        $('emptyBoardCopy').textContent = state.key
            ? '＋ 일정 등록을 눌러 여행을 선택한 뒤 업무를 적어 주세요.'
            : '상단 운영 키를 입력하면 저장된 업무를 불러옵니다.';
    }

    function createTodoCard(todo) {
        const card = document.createElement('article');
        card.className = `todo-card${todo.status === 'done' ? ' is-done' : ''}`;
        card.dataset.id = todo.id;

        const topline = document.createElement('div');
        topline.className = 'card-topline';
        const statusIcon = document.createElement('span');
        statusIcon.className = 'card-status-icon';
        statusIcon.textContent = STATUS_EMOJIS[todo.status] || '📝';
        const isStructured = Boolean(todo.taskDate || todo.taskTarget || todo.headcount || todo.taskAction);
        let title;
        if (isStructured) {
            title = document.createElement('div');
            title.className = 'task-action';
            const actionLabel = document.createElement('span');
            actionLabel.className = 'task-action-label';
            actionLabel.textContent = '할 일';
            const actionValue = document.createElement('strong');
            actionValue.className = 'task-action-value';
            actionValue.textContent = todo.taskAction || todo.title;
            title.append(actionLabel, actionValue);
        } else {
            title = document.createElement('input');
            title.className = 'todo-title-input';
            title.type = 'text';
            title.maxLength = 160;
            title.value = todo.title;
            title.setAttribute('aria-label', '업무 제목 수정');
            title.addEventListener('change', () => {
                const next = title.value.trim();
                if (next && next !== todo.title) patchTodo(todo, { title: next });
                else title.value = todo.title;
            });
        }
        const dday = document.createElement('span');
        dday.className = `dday-badge card-dday${daysUntil(todo.dueDate) < 0 ? ' is-overdue' : ''}`;
        dday.textContent = formatDDay(todo.dueDate);
        topline.append(statusIcon, title, dday);

        const details = document.createElement('div');
        details.className = 'card-details';

        if (isStructured) {
            const facts = document.createElement('div');
            facts.className = 'task-facts';
            const factValues = [
                ['날짜', formatTaskDate(todo.taskDate)],
                ['대상', todo.taskTarget || ''],
                ['인원', todo.headcount ? `${todo.headcount}명` : ''],
            ];
            factValues.filter(([, value]) => value).forEach(([label, value]) => {
                const fact = document.createElement('div');
                fact.className = 'task-fact';
                const factLabel = document.createElement('span');
                factLabel.className = 'task-fact-label';
                factLabel.textContent = label;
                const factValue = document.createElement('span');
                factValue.className = 'task-fact-value';
                factValue.textContent = value;
                fact.append(factLabel, factValue);
                facts.append(fact);
            });
            details.append(facts);
        }

        const actions = document.createElement('div');
        actions.className = 'card-actions';
        ['todo', 'doing', 'done'].forEach(status => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `move-button${status === todo.status ? ' current' : ''}`;
            button.textContent = status === todo.status ? `✓ ${STATUS_LABELS[status]}` : STATUS_LABELS[status];
            button.disabled = status === todo.status;
            button.addEventListener('click', () => patchTodo(todo, { status }));
            actions.append(button);
        });

        card.append(topline);
        if (details.children.length) card.append(details);
        card.append(actions);
        return card;
    }

    async function patchTodo(todo, patch) {
        if (!state.key) return showKeyModal();
        try {
            const data = await request('/api/public/todos', {
                method: 'PATCH',
                body: JSON.stringify({ id: todo.id, updatedAt: todo.updatedAt, ...patch }),
            });
            if (data?.todo) replaceTodo(data.todo);
            showToast('업무를 수정했습니다.');
        } catch (error) {
            if (error.status === 409 && error.data?.todo) {
                replaceTodo(error.data.todo);
                showToast('다른 화면의 최신 내용을 반영했습니다. 다시 수정해 주세요.');
            } else if (!handleAuthError(error)) {
                showToast(error.message);
                renderBoard();
            }
        }
    }

    function replaceTodo(next) {
        const index = state.todos.findIndex(todo => todo.id === next.id);
        if (index >= 0) state.todos[index] = next;
        else state.todos.push(next);
        renderAll();
    }

    async function createTodo(event) {
        event.preventDefault();
        const tour = selectedTour();
        const title = elements.taskTitle.value.trim();
        if (!state.key) return showKeyModal();
        if (!tour) {
            showToast('등록할 여행을 먼저 선택해 주세요.');
            elements.tourSelect.focus();
            return;
        }
        if (!title) {
            elements.taskTitle.focus();
            return;
        }
        try {
            await request('/api/public/todos', {
                method: 'POST',
                body: JSON.stringify({
                    tourFldid: tour.fldid,
                    title,
                }),
            });
            elements.taskForm.reset();
            elements.taskComposer.hidden = true;
            await loadTodos();
            showToast('새 업무를 등록했습니다. 기한은 D+3으로 잡았습니다.');
        } catch (error) {
            if (!handleAuthError(error)) showToast(error.message);
        }
    }

    function setActiveStatus(status) {
        state.activeStatus = status;
        document.querySelectorAll('[data-tab-status]').forEach(button => {
            const active = button.dataset.tabStatus === status;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-selected', String(active));
        });
        renderBoard();
    }

    function renderPreview(result) {
        elements.capturePreview.replaceChildren();
        elements.capturePreview.hidden = false;
        const tour = state.tours.find(item => item.fldid === result.tourFldid);
        const top = document.createElement('div');
        top.className = 'preview-topline';
        const title = document.createElement('strong');
        title.textContent = tour ? '여행별 분류가 끝났습니다' : '분류할 여행을 골라 주세요';
        const dates = document.createElement('span');
        dates.textContent = `${formatDate(result.messageDate)}${result.tripDate ? ` · 여행 ${formatDate(result.tripDate)}` : ''}`;
        top.append(title, dates);
        const matched = document.createElement('div');
        matched.className = 'capture-group';
        const matchedTitle = document.createElement('strong');
        matchedTitle.className = 'capture-group-title';
        matchedTitle.textContent = tour ? `🧳 ${tour.title}` : '🧳 reserve 여행과 자동 매칭되지 않았습니다';
        matched.append(matchedTitle);
        const list = document.createElement('ul');
        list.className = 'preview-list';
        result.items.slice(0, 8).forEach(item => {
            const li = document.createElement('li');
            const facts = [formatTaskDate(item.taskDate), item.target, item.headcount ? `${item.headcount}명` : '', item.action || item.title]
                .filter(Boolean)
                .join(' · ');
            li.textContent = `${item.sentAt ? formatDateTime(item.sentAt) : '시각 미상'} · ${facts}`;
            list.append(li);
        });
        if (result.items.length > 8) {
            const more = document.createElement('li');
            more.textContent = `외 ${result.items.length - 8}개 업무`;
            list.append(more);
        }
        matched.append(list);
        elements.capturePreview.append(top, matched);

        const actions = document.createElement('div');
        actions.className = 'preview-actions';
        if (!result.tourFldid && result.items.length) {
            const select = document.createElement('select');
            select.className = 'select-control';
            select.append(new Option('분류할 여행을 선택해 주세요', ''));
            state.tours.forEach(item => select.append(new Option(`${formatDate(item.date)} · ${item.title}`, item.fldid)));
            select.value = selectedTour()?.fldid || '';
            const register = document.createElement('button');
            register.type = 'button';
            register.className = 'small-button';
            register.textContent = '이 여행에 등록';
            register.addEventListener('click', () => {
                if (!select.value) return showToast('분류할 여행을 먼저 선택해 주세요.');
                registerCapture(result, select.value);
            });
            actions.append(select, register);
        } else if (tour && result.items.length) {
            const register = document.createElement('button');
            register.type = 'button';
            register.className = 'small-button';
            register.textContent = `${result.items.length}개 일정 등록`;
            register.disabled = !result.messageDate || !result.items.some(item => item.sentAt);
            register.title = register.disabled ? '캡처 날짜와 메시지 전송 시각을 확인할 수 있어야 등록할 수 있습니다.' : '';
            register.addEventListener('click', () => registerCapture(result, result.tourFldid));
            actions.append(register);
        }
        if (actions.children.length) elements.capturePreview.append(actions);
    }

    async function registerCapture(result, tourFldid) {
        if (!state.key) return showKeyModal();
        if (!result.messageDate) return showToast('캡처 날짜를 읽지 못해 자동 등록하지 않았습니다. 날짜를 확인한 뒤 직접 업무로 추가해 주세요.');
        const registrableItems = result.items.filter(item => item.sentAt);
        const missingTime = result.items.length - registrableItems.length;
        if (!registrableItems.length) return showToast('메시지 전송 시각을 읽은 업무가 없어 자동 등록하지 않았습니다.');
        setCaptureStatus('찾은 업무를 reserve에 등록하고 있습니다…', 'loading');
        let created = 0;
        let duplicate = 0;
        try {
            for (const item of registrableItems) {
                const createdAt = item.sentAt;
                const data = await request('/api/public/todos', {
                    method: 'POST',
                    body: JSON.stringify({
                        tourFldid,
                        title: item.title,
                        createdAt,
                        sourceKey: item.sourceKey,
                        taskDate: item.taskDate || null,
                        taskTarget: item.target || null,
                        headcount: item.headcount || null,
                        taskAction: item.action || null,
                    }),
                });
                if (data?.duplicate) duplicate += 1;
                else created += 1;
            }
            state.selectedTourFldid = tourFldid;
            elements.tourSelect.value = tourFldid;
            renderTourMeta();
            await loadTodos();
            const skipped = missingTime ? ` · 시각 확인 필요 ${missingTime}개` : '';
            setCaptureStatus(`✅ ${created}개 업무를 등록했습니다${duplicate ? ` · 중복 ${duplicate}개는 건너뛰었습니다` : ''}${skipped}.`, 'success');
            showToast('캡처 업무를 여행별로 분류했습니다.');
        } catch (error) {
            if (!handleAuthError(error)) setCaptureStatus(error.message, 'error');
        }
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('캡처 파일을 읽지 못했습니다.'));
            reader.readAsDataURL(file);
        });
    }

    async function analyzeViaLocalBridge() {
        return fetch(`${GEMINI_BRIDGE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mimeType: state.selectedFile.type,
                data: state.selectedDataUrl,
                tours: state.tours.map(tour => ({
                    fldid: tour.fldid, title: tour.title, date: tour.date, returnDate: tour.returnDate,
                })),
            }),
        }).then(async response => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || `Gemini 브리지 오류 (${response.status})`);
            return data;
        });
    }

    async function analyzeCapture() {
        if (!state.selectedFile) return;
        if (!state.key) return showKeyModal();
        if (!state.tours.length) return showToast('reserve 여행 목록이 아직 없습니다.');
        setCaptureStatus('Gemini가 캡처의 날짜와 메시지 시각을 읽고 있습니다…', 'loading');
        elements.capturePreview.hidden = true;
        try {
            if (!state.selectedDataUrl) {
                state.selectedDataUrl = await readFileAsDataUrl(state.selectedFile);
            }
            let result;
            try {
                // 휴대폰에서도 동작하는 HTTPS 경로를 우선 사용한다.
                result = await request('/api/public/todos/analyze', {
                    method: 'POST',
                    body: JSON.stringify({ mimeType: state.selectedFile.type, data: state.selectedDataUrl }),
                });
            } catch (serverError) {
                // 서버에 Gemini 키가 아직 없는 개발 환경에서는 PC의 로컬 브리지를 보조로 사용한다.
                if (![404, 502, 503, 504].includes(serverError.status)) throw serverError;
                setCaptureStatus('reserve Gemini를 사용할 수 없어 로컬 Gemini를 시도하고 있습니다…', 'loading');
                result = await analyzeViaLocalBridge();
            }
            state.capturePending = result;
            renderPreview(result);
            if (!result.items?.length) {
                setCaptureStatus('업무로 만들 수 있는 메시지를 찾지 못했습니다. 캡처를 확인해 주세요.', 'error');
            } else if (result.tourFldid && result.messageDate && result.items.some(item => item.sentAt)) {
                setCaptureStatus(`여행별 분류를 확인했습니다. 아래의 작은 등록 버튼을 눌러 ${result.items.length}개 업무를 저장해 주세요.`, 'success');
            } else if (result.tourFldid) {
                setCaptureStatus('여행은 찾았지만 캡처 날짜·메시지 전송 시각을 모두 확인하지 못했습니다. 자동 등록하지 않았습니다.', 'error');
            } else {
                setCaptureStatus('여행 날짜와 일치하는 reserve 일정이 없습니다. 아래에서 분류할 여행을 골라 주세요.');
            }
        } catch (error) {
            const message = error.message === 'Failed to fetch'
                ? 'Gemini 서버와 로컬 브리지에 연결하지 못했습니다. 로컬 사용 시 안내된 명령으로 브리지를 먼저 실행해 주세요.'
                : error.message;
            setCaptureStatus(message, 'error');
        }
    }

    function setSelectedFile(file) {
        state.selectedFile = null;
        state.selectedDataUrl = '';
        elements.captureFeedback.hidden = false;
        elements.capturePreview.hidden = true;
        if (!file) {
            elements.captureFeedback.hidden = true;
            return;
        }
        if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
            setCaptureStatus('PNG, JPG, WEBP, GIF 이미지만 올려 주세요.', 'error');
            return;
        }
        if (file.size > 12 * 1024 * 1024) {
            setCaptureStatus('캡처 파일은 12MB 이하로 올려 주세요.', 'error');
            return;
        }
        state.selectedFile = file;
        setCaptureStatus(state.key ? '캡처를 붙여넣었습니다. 여행별 분류를 시작합니다…' : '운영 키를 확인한 뒤 자동 분석합니다.');
        readFileAsDataUrl(file).then(dataUrl => {
            if (state.selectedFile === file) state.selectedDataUrl = dataUrl;
        }).catch(error => setCaptureStatus(error.message, 'error'));
        if (state.key) window.setTimeout(() => analyzeCapture(), 0);
        if (!state.key) showKeyModal();
    }

    function handlePaste(event) {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(item => item.kind === 'file' && /^image\//.test(item.type));
        if (!imageItem) return;
        event.preventDefault();
        const file = imageItem.getAsFile();
        if (file) setSelectedFile(file);
    }

    function bindEvents() {
        setKey(state.key);
        elements.keyButton.addEventListener('click', showKeyModal);
        elements.openKeyFromNotice.addEventListener('click', showKeyModal);
        $('closeKeyModal').addEventListener('click', hideKeyModal);
        elements.keyModal.addEventListener('click', event => {
            if (event.target === elements.keyModal) hideKeyModal();
        });
        elements.keyForm.addEventListener('submit', async event => {
            event.preventDefault();
            const value = elements.keyInput.value.trim();
            if (!value) {
                elements.keyError.textContent = '운영 키를 입력해 주세요.';
                return;
            }
            const previousKey = state.key;
            setKey(value);
            try {
                await request('/api/public/todos');
                hideKeyModal();
                await loadTodos();
                if (state.selectedFile) await analyzeCapture();
            } catch (error) {
                setKey(previousKey);
                if (error.status === 401) {
                    elements.keyError.textContent = '운영 키가 맞지 않거나 reserve 서버에 TODO_ADMIN_KEY가 아직 등록되지 않았습니다.';
                } else {
                    elements.keyError.textContent = error.message;
                }
            }
        });
        elements.tourSelect.addEventListener('change', async () => {
            state.selectedTourFldid = elements.tourSelect.value;
            renderTourMeta();
        });
        elements.addTaskButton.addEventListener('click', openTaskComposer);
        elements.closeComposer.addEventListener('click', () => { elements.taskComposer.hidden = true; });
        elements.taskForm.addEventListener('submit', createTodo);
        elements.closeCaptureFeedback.addEventListener('click', () => {
            elements.captureFeedback.hidden = true;
            elements.capturePreview.hidden = true;
        });
        document.querySelectorAll('[data-tab-status]').forEach(button => {
            button.addEventListener('click', () => setActiveStatus(button.dataset.tabStatus));
        });
        document.addEventListener('paste', handlePaste);
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bindEvents();
        renderAll();
        await loadTours();
    });
})();
