#!/usr/bin/env node

// bus.foresttour.kr의 카카오톡 캡처를 로컬 Gemini API 호출로 판독하는 브리지입니다.
//
// 브라우저에 API 키를 넣지 않습니다. 이 파일은 사용자의 PC에서만 127.0.0.1에
// 바인딩되고, ../foresttour/tools/gemini.mjs의 기존 키 로딩·호출 코드를 재사용합니다.
// 실행:
//   node tools/todo/gemini-capture-bridge.mjs
//
// foresttour가 다른 위치에 있으면:
//   FORESTTOUR_ROOT=/path/to/foresttour node tools/todo/gemini-capture-bridge.mjs

import crypto from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUS_ROOT = path.resolve(__dirname, '../..');
const FORESTTOUR_ROOT = process.env.FORESTTOUR_ROOT || path.resolve(BUS_ROOT, '../foresttour');
const GEMINI_CONFIG_PATH = path.join(FORESTTOUR_ROOT, 'tools', 'gemini-config.mjs');
const HOST = process.env.GEMINI_CAPTURE_HOST || '127.0.0.1';
const PORT = Number(process.env.GEMINI_CAPTURE_PORT || 8765);
// 12MB 원본이 base64로 약 16MB가 되므로 JSON 포장 여유를 둔다.
const MAX_BODY_BYTES = 19 * 1024 * 1024;
const MAX_ITEMS = 40;
const ALLOWED_ORIGINS = new Set([
  'https://bus.foresttour.kr',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:8080',
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FLDID_RE = /^[A-Za-z0-9_-]{1,64}$/;

let geminiPromise;

function allowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function applyCors(res, origin) {
  if (origin && ALLOWED_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  res.setHeader('Vary', 'Origin');
}

function sendJson(res, origin, status, body) {
  applyCors(res, origin);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    req.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        req.resume();
        reject(new Error('캡처 파일은 12MB 이하로 올려 주세요'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', error => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function readImage(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('요청 형식이 올바르지 않습니다');
  }
  const input = body.data;
  if (typeof input !== 'string' || !input) throw new Error('캡처 이미지가 필요합니다');

  const dataUrl = input.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([\s\S]+)$/i);
  const mimeType = (dataUrl?.[1] || body.mimeType || 'image/png').toLowerCase() === 'image/jpg'
    ? 'image/jpeg'
    : (dataUrl?.[1] || body.mimeType || 'image/png').toLowerCase();
  if (!/^image\/(png|jpeg|webp|gif)$/.test(mimeType)) {
    throw new Error('PNG, JPG, WEBP, GIF 이미지로 올려 주세요');
  }

  const base64 = (dataUrl?.[2] || input).replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('이미지 데이터가 올바르지 않습니다');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length < 100) throw new Error('이미지 데이터가 비어 있습니다');
  if (buffer.length > 12 * 1024 * 1024) throw new Error('캡처 파일은 12MB 이하로 올려 주세요');

  return { mimeType, data: buffer.toString('base64'), hash: crypto.createHash('sha256').update(buffer).digest('hex') };
}

function safeTours(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(tour => tour && typeof tour === 'object')
    .map(tour => ({
      fldid: typeof tour.fldid === 'string' && FLDID_RE.test(tour.fldid) ? tour.fldid : '',
      title: cleanText(tour.title, 120),
      date: normalizeDate(tour.date),
      returnDate: normalizeDate(tour.returnDate),
    }))
    .filter(tour => tour.fldid && tour.title)
    .slice(0, 200);
}

function cleanText(value, maxLength = 160) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\s+/g, ' ')
    .replace(/01[016789][ -]?\d{3,4}[ -]?\d{4}/g, '[연락처]')
    .replace(/\b\d{10,14}\b/g, '[개인정보]')
    .trim()
    .slice(0, maxLength);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeDate(value) {
  if (typeof value !== 'string') return null;
  const iso = value.match(/\b(20\d{2})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/);
  if (!iso) return null;
  const result = `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
  if (!DATE_RE.test(result)) return null;
  const parsed = new Date(`${result}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result ? result : null;
}

function kstToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeSentAt(value, fallbackDate) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  const date = normalizeDate(raw) || fallbackDate;
  if (!date) return null;

  const time = raw.match(/(?:T|\s|^)(오전|오후)?\s*(\d{1,2})(?::|시)(\d{1,2})?/i);
  if (!time) return null;
  let hour = Number(time[2]);
  const minute = Number(time[3] || 0);
  if (time[1] === '오후' && hour < 12) hour += 12;
  if (time[1] === '오전' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${date}T${pad(hour)}:${pad(minute)}:00+09:00`;
}

function matchTour(tours, tourFldid, tripDate) {
  if (typeof tourFldid === 'string' && FLDID_RE.test(tourFldid)) {
    const direct = tours.find(tour => tour.fldid === tourFldid);
    if (direct) return direct.fldid;
  }
  if (!tripDate) return null;
  const matched = tours.find(tour => {
    if (!tour.date) return false;
    if (tour.date === tripDate) return true;
    return Boolean(tour.returnDate && tour.date <= tripDate && tripDate <= tour.returnDate);
  });
  return matched?.fldid || null;
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Gemini가 JSON 형식으로 답하지 않았습니다');
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new Error('Gemini JSON 응답을 읽지 못했습니다');
  }
}

function normalizeResult(raw, tours, captureId) {
  const messageDate = normalizeDate(raw?.messageDate || raw?.chatDate || raw?.date);
  const tripDate = normalizeDate(raw?.tripDate || raw?.travelDate || raw?.scheduleDate);
  const tourFldid = matchTour(tours, raw?.tourFldid, tripDate);
  const inputItems = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.tasks) ? raw.tasks : [];
  const seen = new Set();
  const items = inputItems
    .slice(0, MAX_ITEMS)
    .map((item, index) => {
      const title = cleanText(
        typeof item === 'string' ? item : item?.title || item?.task || item?.summary,
      );
      const sentAt = normalizeSentAt(
        typeof item === 'object' ? item?.sentAt || item?.time || item?.messageTime : null,
        messageDate,
      );
      const key = `${title}\u0000${sentAt || ''}`;
      if (!title || seen.has(key)) return null;
      seen.add(key);
      // Gemini의 m1/m2 순서와 표현이 달라져도 같은 캡처·같은 전송 시각이면 중복 처리한다.
      // 같은 분에 여러 업무가 있으면 하나로 합쳐질 수 있으므로 화면에서 시각 확인을 유도한다.
      const stableKey = sentAt
        ? sentAt.replace(/\D/g, '')
        : crypto.createHash('sha256').update(title).digest('hex').slice(0, 20);
      return {
        title,
        sentAt,
        sourceKey: `${captureId.slice(0, 16)}:${stableKey}`,
      };
    })
    .filter(Boolean);

  return { messageDate, tripDate, tourFldid, items };
}

function promptFor(tours) {
  return `
당신은 숲길여행 운영팀의 카카오톡 캡처 정리 담당자입니다.
첨부된 카카오톡 대화 캡처를 읽고, 여행 운영에 필요한 '업무'만 추려 주세요.

반드시 지켜 주세요.
1. 답변은 설명·마크다운 없이 JSON 객체 하나만 출력합니다.
2. 캡처 상단의 대화 날짜를 messageDate에 YYYY-MM-DD로 기록합니다. 연도가 없으면 현재 연도(${kstToday().slice(0, 4)})를 사용하고, 날짜가 보이지 않으면 null입니다.
3. 대화 안의 여행 출발일 또는 일정 날짜를 tripDate에 YYYY-MM-DD로 기록합니다. 여러 날짜가 있으면 여행 출발일을 우선합니다.
4. 각 업무의 sentAt에는 해당 메시지에 표시된 전송 시각을 messageDate 기준 한국시간 ISO 형식(예: 2026-08-13T14:20:00+09:00)으로 기록합니다. 시각이 없으면 null입니다.
5. 업무 제목에는 사람 이름, 전화번호, 계좌번호, 여권번호를 넣지 말고 행동 중심으로 160자 이내로 씁니다. 단순 인사·감탄·반복 대화는 제외합니다.
6. 아래 reserve 여행 목록 중 날짜가 정확히 일치하거나 출발일~귀국일 범위에 들어가는 여행의 fldid를 tourFldid에 넣습니다. 확신이 없으면 null입니다.
7. items는 실제로 처리할 업무만 배열로 만들고, sourceKey는 메시지 순서에 따른 m1, m2처럼 안정적인 짧은 키를 사용합니다.

JSON 스키마:
{
  "messageDate": "YYYY-MM-DD|null",
  "tripDate": "YYYY-MM-DD|null",
  "tourFldid": "reserve의 fldid|null",
  "items": [
    {"title": "업무 제목", "sentAt": "YYYY-MM-DDTHH:mm:ss+09:00|null", "sourceKey": "m1"}
  ]
}

reserve 여행 목록:
${JSON.stringify(tours)}
`.trim();
}

async function loadGemini() {
  if (!geminiPromise) {
    geminiPromise = import(pathToFileURL(GEMINI_CONFIG_PATH).href).catch(error => {
      geminiPromise = null;
      throw new Error(`저장소의 Gemini 브리지를 불러오지 못했습니다: ${error.message}`);
    });
  }
  return geminiPromise;
}

async function analyze(body) {
  const image = readImage(body);
  const tours = safeTours(body.tours);
  const configModule = await loadGemini();
  const config = configModule.loadGeminiConfig();
  const answer = await askGeminiVision(promptFor(tours), {
    model: process.env.GEMINI_CAPTURE_MODEL || config.model,
    apiKey: config.key,
    image,
  });
  const captureId = image.hash.slice(0, 24);
  const result = normalizeResult(extractJson(answer), tours, captureId);
  return { ok: true, provider: 'gemini-local', captureId, ...result };
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (!allowedOrigin(origin)) {
    sendJson(res, origin, 403, { error: '허용되지 않은 출처입니다' });
    return;
  }

  if (req.method === 'OPTIONS') {
    applyCors(res, origin);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    let configured = false;
    try {
      const configModule = await loadGemini();
      configured = Boolean(configModule.loadGeminiConfig().key);
    } catch {
      configured = false;
    }
    sendJson(res, origin, 200, { ok: true, provider: 'gemini-local', configured });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/analyze') {
    sendJson(res, origin, 404, { error: '지원하지 않는 경로입니다' });
    return;
  }

  try {
    const raw = await readRequestBody(req);
    const body = JSON.parse(raw);
    sendJson(res, origin, 200, await analyze(body));
  } catch (error) {
    console.error('[gemini-capture]', error instanceof Error ? error.message : error);
    sendJson(res, origin, 500, {
      error: error instanceof Error ? error.message : '캡처를 분석하지 못했습니다',
    });
  }
});

async function askGeminiVision(prompt, { model, apiKey, image }) {
  if (!apiKey) throw new Error('Gemini API 키가 없습니다. 기존 저장소의 키 설정을 확인해 주세요.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: image.mimeType, data: image.data } },
        ] }],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Gemini 호출이 120초 안에 끝나지 않았습니다.');
    throw new Error(`Gemini 호출 중 네트워크 오류: ${error?.message || '알 수 없는 오류'}`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gemini 호출 실패 (HTTP ${response.status}): ${detail.slice(0, 260)}`);
  }
  const payload = await response.json();
  const parts = payload.candidates?.[0]?.content?.parts || [];
  const answer = parts.map(part => part.text || '').join('');
  if (!answer) throw new Error('Gemini 응답에 텍스트가 없습니다.');
  return answer;
}

server.listen(PORT, HOST, () => {
  console.log(`Gemini 캡처 브리지 실행: http://${HOST}:${PORT}`);
  console.log(`Gemini 저장소: ${FORESTTOUR_ROOT}`);
});
