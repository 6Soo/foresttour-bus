(() => {
    'use strict';

    const API_BASE = 'https://reserve.foresttour.kr';
    const GEMINI_BRIDGE = 'http://127.0.0.1:8765';
    const KEY_STORAGE = 'foresttour-todo-admin-key-v1';
    const STATUS_LABELS = { todo: '할 일', doing: '진행중', done: '완료' };
    const STATUS_EMOJIS = { todo: '📝', doing: '🏃', done: '🎉' };
    const ASSIGNEE_LABELS = { none: '담당 없음', owner: '운영이사님', director: '대표님' };

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
        captureInput: $('captureInput'),
        captureFile: $('captureFile'),
        analyzeButton: $('analyzeButton'),
        captureStatus: $('captureStatus'),
        capturePreview: $('capturePreview'),
        addTaskButton: $('addTaskButton'),
        taskComposer: $('taskComposer'),
        closeComposer: $('closeComposer'),
        taskForm: $('taskForm'),
        taskTitle: $('taskTitle'),
        taskAssignee: $('taskAssignee'),
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
        elements.keyLabel.textContent = state.key ? '연결됨' : '운영 키';
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

    function formatDateRange(tour) {
        if (!tour?.date) return '출발일 미정';
        if (!tour.returnDate || tour.returnDate === tour.date) return formatDate(tour.date);
        return `${formatDate(tour.date)} — ${formatDate(tour.returnDate)}`;
    }

    function formatDateTime(value) {
        if (!value) return '등록 시각 미상';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '등록 시각 미상';
        return new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(date);
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
        elements.keyError.textContent = '운영 키를 확인해 주세요.';
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
            const label = tour.date ? `${formatDate(tour.date)} · ${tour.title}` : tour.title;
            elements.tourSelect.append(new Option(label, tour.fldid));
        });
    }

    function renderTourMeta() {
        const tour = selectedTour();
        if (!tour) {
            elements.tourMeta.textContent = '일정을 선택하면 기본 업무가 준비됩니다.';
            return;
        }
        elements.tourMeta.replaceChildren();
        const range = document.createElement('strong');
        range.textContent = formatDateRange(tour);
        elements.tourMeta.append(range, ` · ${tour.nights ? `${tour.nights}박` : '여행'}${tour.leader ? ` · ${tour.leader} 대장` : ''}`);
    }

    async function loadTodos() {
        const tour = selectedTour();
        if (!state.key || !tour) {
            state.todos = [];
            renderAll();
            return;
        }
        elements.board.classList.add('is-loading');
        try {
            await request('/api/public/todos/initialize', {
                method: 'POST',
                body: JSON.stringify({ tourFldid: tour.fldid }),
            });
            const data = await request(`/api/public/todos?tourFldid=${encodeURIComponent(tour.fldid)}`);
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
        elements.addTaskButton.disabled = !state.key || !selectedTour();
    }

    function renderStats() {
        const counts = { todo: 0, doing: 0, done: 0 };
        state.todos.forEach(todo => { if (counts[todo.status] !== undefined) counts[todo.status] += 1; });
        $('statAll').textContent = state.key ? String(state.todos.length) : '–';
        $('statTodo').textContent = state.key ? String(counts.todo) : '–';
        $('statDoing').textContent = state.key ? String(counts.doing) : '–';
        $('statDone').textContent = state.key ? String(counts.done) : '–';
        $('countTodo').textContent = counts.todo;
        $('countDoing').textContent = counts.doing;
        $('countDone').textContent = counts.done;
        $('tabCountTodo').textContent = counts.todo;
        $('tabCountDoing').textContent = counts.doing;
        $('tabCountDone').textContent = counts.done;
    }

    function renderBoard() {
        elements.board.dataset.activeStatus = state.activeStatus;
        ['todo', 'doing', 'done'].forEach(status => {
            const list = $(`list${status[0].toUpperCase()}${status.slice(1)}`);
            list.replaceChildren();
            const todos = state.todos.filter(todo => todo.status === status);
            if (!todos.length) {
                const empty = document.createElement('div');
                empty.className = 'empty-column';
                empty.textContent = status === 'done' ? '완료한 업무가 여기에 모입니다.' : '아직 등록된 업무가 없습니다.';
                list.append(empty);
            } else {
                todos.forEach(todo => list.append(createTodoCard(todo)));
            }
        });
        elements.emptyBoard.hidden = !state.key || !selectedTour() || state.todos.length > 0;
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
        const title = document.createElement('input');
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
        const remove = document.createElement('button');
        remove.className = 'delete-todo';
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', '업무 삭제');
        remove.addEventListener('click', () => deleteTodo(todo));
        topline.append(statusIcon, title, remove);

        const details = document.createElement('div');
        details.className = 'card-details';
        const dueRow = document.createElement('div');
        dueRow.className = 'detail-row';
        const dueLabel = document.createElement('span');
        dueLabel.className = 'detail-label';
        dueLabel.textContent = '📅 기한';
        const due = document.createElement('input');
        due.className = `due-input${todo.status !== 'done' && todo.dueDate && todo.dueDate < todayKst() ? ' is-overdue' : ''}`;
        due.type = 'date';
        due.value = todo.dueDate || '';
        due.setAttribute('aria-label', '업무 기한 수정');
        due.addEventListener('change', () => patchTodo(todo, { dueDate: due.value || null }));
        dueRow.append(dueLabel, due);

        const assigneeRow = document.createElement('div');
        assigneeRow.className = 'detail-row';
        const assigneeLabel = document.createElement('span');
        assigneeLabel.className = 'detail-label';
        assigneeLabel.textContent = '🙋 담당';
        const assignee = document.createElement('select');
        assignee.className = 'select-control assignee-select';
        Object.entries(ASSIGNEE_LABELS).forEach(([value, label]) => assignee.append(new Option(label, value)));
        assignee.value = todo.assignee || 'none';
        assignee.setAttribute('aria-label', '업무 담당자 수정');
        assignee.addEventListener('change', () => patchTodo(todo, { assignee: assignee.value }));
        assigneeRow.append(assigneeLabel, assignee);

        const created = document.createElement('div');
        created.className = 'created-at';
        created.textContent = `등록 ${formatDateTime(todo.createdAt)}`;
        details.append(dueRow, assigneeRow, created);

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

        card.append(topline, details, actions);
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

    async function deleteTodo(todo) {
        if (!window.confirm(`“${todo.title}” 업무를 삭제할까요?`)) return;
        try {
            await request('/api/public/todos', {
                method: 'DELETE',
                body: JSON.stringify({ id: todo.id, updatedAt: todo.updatedAt }),
            });
            state.todos = state.todos.filter(item => item.id !== todo.id);
            renderAll();
            showToast('업무를 삭제했습니다.');
        } catch (error) {
            if (error.status === 409 && error.data?.todo) {
                replaceTodo(error.data.todo);
                showToast('다른 화면의 최신 내용을 반영했습니다.');
            } else if (!handleAuthError(error)) showToast(error.message);
        }
    }

    async function createTodo(event) {
        event.preventDefault();
        const tour = selectedTour();
        const title = elements.taskTitle.value.trim();
        if (!tour || !title || !state.key) return;
        try {
            await request('/api/public/todos', {
                method: 'POST',
                body: JSON.stringify({
                    tourFldid: tour.fldid,
                    title,
                    assignee: elements.taskAssignee.value,
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
        title.textContent = `${result.items.length}개 업무를 찾았습니다`;
        const dates = document.createElement('span');
        dates.textContent = `${formatDate(result.messageDate)}${result.tripDate ? ` · 여행 ${formatDate(result.tripDate)}` : ''}`;
        top.append(title, dates);
        const list = document.createElement('ul');
        list.className = 'preview-list';
        result.items.slice(0, 8).forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item.sentAt ? formatDateTime(item.sentAt) : '시각 미상'} · ${item.title}`;
            list.append(li);
        });
        if (result.items.length > 8) {
            const more = document.createElement('li');
            more.textContent = `외 ${result.items.length - 8}개 업무`;
            list.append(more);
        }
        elements.capturePreview.append(top, list);

        if (!result.tourFldid && result.items.length) {
            const actions = document.createElement('div');
            actions.className = 'preview-actions';
            const select = document.createElement('select');
            select.className = 'select-control';
            select.append(new Option('분류할 여행을 선택해 주세요', ''));
            state.tours.forEach(item => select.append(new Option(`${formatDate(item.date)} · ${item.title}`, item.fldid)));
            select.value = selectedTour()?.fldid || '';
            const register = document.createElement('button');
            register.type = 'button';
            register.className = 'small-button';
            register.textContent = '선택한 여행에 등록';
            register.addEventListener('click', () => {
                if (!select.value) return showToast('분류할 여행을 먼저 선택해 주세요.');
                registerCapture(result, select.value);
            });
            actions.append(select, register);
            elements.capturePreview.append(actions);
        } else if (tour) {
            const matched = document.createElement('p');
            matched.className = 'trip-meta';
            matched.textContent = `분류된 여행: ${tour.title}`;
            elements.capturePreview.append(matched);
        }
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
                    body: JSON.stringify({ tourFldid, title: item.title, createdAt, sourceKey: item.sourceKey }),
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
        elements.analyzeButton.disabled = true;
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
                setCaptureStatus('날짜가 맞는 여행을 찾았습니다. 곧 업무로 등록합니다…', 'success');
                await registerCapture(result, result.tourFldid);
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
        } finally {
            elements.analyzeButton.disabled = false;
        }
    }

    function setSelectedFile(file) {
        state.selectedFile = null;
        state.selectedDataUrl = '';
        elements.captureInput.value = '';
        elements.analyzeButton.disabled = true;
        elements.capturePreview.hidden = true;
        if (!file) {
            elements.captureFile.textContent = '선택된 캡처 없음';
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
        elements.captureFile.textContent = file.name;
        elements.analyzeButton.disabled = !state.key;
        setCaptureStatus(state.key ? '캡처를 선택했습니다. Gemini로 읽어 보세요.' : '운영 키를 입력하면 Gemini 판독을 시작할 수 있습니다.');
        readFileAsDataUrl(file).then(dataUrl => {
            if (state.selectedFile === file) state.selectedDataUrl = dataUrl;
        }).catch(error => setCaptureStatus(error.message, 'error'));
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
            setKey(value);
            hideKeyModal();
            elements.analyzeButton.disabled = !state.selectedFile;
            await loadTodos();
        });
        elements.tourSelect.addEventListener('change', async () => {
            state.selectedTourFldid = elements.tourSelect.value;
            renderTourMeta();
            await loadTodos();
        });
        elements.addTaskButton.addEventListener('click', () => {
            if (!state.key) return showKeyModal();
            if (!selectedTour()) return showToast('여행을 먼저 선택해 주세요.');
            elements.taskComposer.hidden = false;
            elements.taskTitle.focus();
        });
        elements.closeComposer.addEventListener('click', () => { elements.taskComposer.hidden = true; });
        elements.taskForm.addEventListener('submit', createTodo);
        elements.captureInput.addEventListener('change', event => setSelectedFile(event.target.files?.[0] || null));
        elements.analyzeButton.addEventListener('click', analyzeCapture);
        document.querySelectorAll('[data-tab-status]').forEach(button => {
            button.addEventListener('click', () => setActiveStatus(button.dataset.tabStatus));
        });
        const drop = document.querySelector('.upload-drop');
        ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, event => {
            event.preventDefault();
            drop.classList.add('is-dragging');
        }));
        ['dragleave', 'drop'].forEach(name => drop.addEventListener(name, event => {
            event.preventDefault();
            drop.classList.remove('is-dragging');
        }));
        drop.addEventListener('drop', event => setSelectedFile(event.dataTransfer.files?.[0] || null));
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bindEvents();
        renderAll();
        await loadTours();
    });
})();
