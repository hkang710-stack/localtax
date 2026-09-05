/**
 * 로컬링크 지역 탐색 서버 (의존성 0개 — Node 18+ 만 있으면 실행됩니다)
 *
 * 실행:  node server.js  →  http://localhost:3000
 * 키 설정: .env 파일에 API 키를 넣으면 해당 지표가 예시값→실데이터로 바뀝니다. (README 참고)
 *
 * 라우트:
 *   GET /api/regions  지역별 지표+판정+점수 (24시간 캐시)
 *   GET /api/health   어떤 지표가 실데이터(live)인지 확인
 *   GET /             지역 탐색 화면 (public/index.html)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const CURATED = require("./config/regions");
const COORDS = require("./config/coords");
const judgeModule = require("./judge");
const { judge } = judgeModule;
const { getStoreCount } = require("./collectors/sbiz");
const { getYouthPolicies } = require("./collectors/youth");
const { getYouthRatio } = require("./collectors/kosis");

/* ── 지역 목록 생성: 인구감소지역 89곳 전체 + 큐레이션 8곳 병합 ──
   큐레이션에 없는 지역의 지표는 이름 기반 시드로 만든 결정적 예시값(항상 mock 표시).
   행정코드(sggCd)를 config/regions.js에 채우면 그 지역만 실데이터 수집 대상이 됩니다. */
function seeded(name, min, max, salt) {
  let h = 2166136261 >>> 0;
  const s = name + (salt || "");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return min + ((h >>> 0) % 1000) / 1000 * (max - min);
}
const GLYPHS = ["field", "castle", "river", "sea"];

function buildRegionList() {
  const curatedByName = {};
  for (const c of CURATED) curatedByName[c.sido + " " + c.name] = c;

  const list = [];
  const seen = new Set();
  const pd = judgeModule.POP_DECLINE || {};
  for (const sido of Object.keys(pd)) {
    for (const name of pd[sido]) {
      const key = sido + " " + name;
      seen.add(key);
      const cur = curatedByName[key];
      const coord = COORDS[key] || [36.5, 127.8];
      if (cur) { list.push(cur); continue; }
      list.push({
        id: key.replace(" ", "-"), name, sido,
        sggCd: null, // code.go.kr에서 확인해 채우면 실데이터 수집 대상이 됨
        lat: coord[0], lng: coord[1],
        glyph: GLYPHS[Math.floor(seeded(key, 0, 4, "g"))],
        story: null,
        mock: {
          storeCount: Math.round(seeded(key, 300, 2500, "s")),
          youthRatio: Math.round(seeded(key, 9, 19, "y")),
          policyCount: Math.round(seeded(key, 3, 11, "p")),
          rent: Math.round(seeded(key, 3.0, 7.5, "r") * 10) / 10,
        },
      });
    }
  }
  // 큐레이션 중 인구감소지역이 아닌 비교용 지역(전주, 강릉 등) 추가
  for (const c of CURATED) {
    if (!seen.has(c.sido + " " + c.name)) list.push(c);
  }
  return list;
}
const REGIONS = buildRegionList();

/* ── .env 로더 (외부 패키지 없이) ── */
(function loadEnv() {
  const p = path.join(__dirname, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
})();

const KEYS = {
  sbiz: process.env.SBIZ_API_KEY || "",
  youth: process.env.YOUTH_API_KEY || "",
  kosis: process.env.KOSIS_API_KEY || "",
};

/* ── 캐시 ── */
const CACHE_FILE = path.join(__dirname, "data", "cache.json");
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

function readCache() {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (Date.now() - c.at < CACHE_TTL && c.keysUsed === JSON.stringify(Boolean(KEYS.sbiz) + Boolean(KEYS.youth) + Boolean(KEYS.kosis))) return c.data;
  } catch (_) {}
  return null;
}
function writeCache(data) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify({
    at: Date.now(),
    keysUsed: JSON.stringify(Boolean(KEYS.sbiz) + Boolean(KEYS.youth) + Boolean(KEYS.kosis)),
    data,
  }));
}

/* ── 점수화: 임대료↓ 경쟁↓ 청년비율↑ 정책수↑ 혜택가점 → 5점 만점 ── */
function scoreRegions(rows) {
  const nums = (k) => rows.map((r) => r[k]);
  const lo = (k) => Math.min(...nums(k)), hi = (k) => Math.max(...nums(k));
  const norm = (v, k) => (hi(k) === lo(k) ? 0.5 : (v - lo(k)) / (hi(k) - lo(k)));
  for (const r of rows) {
    const rent = 1 - norm(r.rent, "rent");            // 낮을수록 좋음
    const compete = 1 - norm(r.competeIdx, "competeIdx");
    const youth = norm(r.youthRatio, "youthRatio");
    const policy = norm(r.policyCount, "policyCount");
    const benefit = (r.benefit.rate === 1 ? 1 : 0.3) + (r.benefit.ozRound ? 0.15 : 0);
    const raw = rent * 0.25 + compete * 0.25 + youth * 0.2 + policy * 0.15 + Math.min(benefit, 1.15) * 0.15;
    r.score = Math.round((4.2 + raw * 0.8) * 100) / 100; // 4.2~5.0 구간으로 표현
  }
  return rows.sort((a, b) => b.score - a.score);
}

/* ── 수집 + 조합 ── */
async function buildRegions() {
  const cached = readCache();
  if (cached) return cached;

  const rows = await Promise.all(REGIONS.map(async (region) => {
    const liveOk = !!region.sggCd; // 행정코드 미확인 지역은 예시값만 사용
    const [store, youthPol, youthRatio] = await Promise.all([
      getStoreCount(region, liveOk ? KEYS.sbiz : ""),
      getYouthPolicies(region, liveOk ? KEYS.youth : ""),
      getYouthRatio(region, liveOk ? KEYS.kosis : ""),
    ]);
    const b = judge(region.sido, region.name);
    // 경쟁지수: 음식점 수를 만 단위 상대값으로 (실서비스에선 인구수로 나눠 천명당 업소수로 교체)
    const competeIdx = Math.round((store.value / 100)) / 10;
    const story = region.story ||
      (b.flags?.기회발전특구
        ? "인구감소지역이면서 기회발전특구까지 겹치는 지역이에요. 취득세·재산세 혜택 여지도 확인해 보세요."
        : "소득세 100% 감면 대상 인구감소지역이에요. 지자체 청년 지원사업을 함께 살펴보세요.");
    return {
      id: region.id, name: region.name, sido: region.sido,
      lat: region.lat, lng: region.lng, glyph: region.glyph, story,
      storeCount: store.value, competeIdx,
      youthRatio: youthRatio.value,
      policyCount: youthPol.count, policyTop: youthPol.top,
      rent: region.mock.rent, // 임대료 API 미연동 — 항상 예시값
      benefit: {
        rate: b.incomeTaxReliefRate, tier: b.tier,
        popDecline: !!b.flags?.인구감소지역,
        ozRound: b.flags?.기회발전특구?.round ?? null,
      },
      sources: { storeCount: store.source, youthRatio: youthRatio.source, policyCount: youthPol.source, rent: "mock" },
    };
  }));

  const scored = scoreRegions(rows);
  writeCache(scored);
  return scored;
}

/* ── HTTP 서버 ── */
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname === "/api/regions") {
      const data = await buildRegions();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ updatedAt: new Date().toISOString(), regions: data }));
    }
    if (url.pathname === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({
        ok: true,
        keys: { 상권정보: !!KEYS.sbiz, 온통청년: !!KEYS.youth, KOSIS: !!KEYS.kosis },
        안내: "키가 false인 지표는 예시값으로 표시됩니다. .env에 키를 넣고 서버를 재시작하세요.",
      }));
    }
    // 정적 파일
    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    const fp = path.join(__dirname, "public", path.normalize(file).replace(/^(\.\.[/\\])+/, ""));
    if (fp.startsWith(path.join(__dirname, "public")) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
      return res.end(fs.readFileSync(fp));
    }
    res.writeHead(404); res.end("Not found");
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: e.message }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`로컬링크 지역 탐색: http://localhost:${PORT}`);
  console.log(`API 키 상태 — 상권정보: ${KEYS.sbiz ? "설정됨" : "없음(예시값)"}, 온통청년: ${KEYS.youth ? "설정됨" : "없음(예시값)"}, KOSIS: ${KEYS.kosis ? "설정됨" : "없음(예시값)"}`);
});
