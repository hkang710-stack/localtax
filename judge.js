/**
 * region_judge.js
 * 지역 기반 창업 세제혜택 판정 모듈 (로컬링크)
 *
 * 판정 근거 3대 목록:
 *  1) 수도권과밀억제권역  — 수도권정비계획법 시행령 별표1
 *  2) 인구감소지역 89곳   — 행정안전부 고시 (2021.10, 군위군은 대구 편입 반영)
 *  3) 기회발전특구        — 산업통상자원부 지정 (1차 2024.6 / 2차 2024.11)
 *
 * 감면율 로직 (조세특례제한법 제6조, 2026.1.1 이후 창업 기준):
 *  - 비수도권 전체                → 소득세·법인세 100% (5년)
 *  - 수도권 내 인구감소지역      → 100% (5년)
 *  - 수도권 (과밀억제권역 제외)  → 75%
 *  - 수도권과밀억제권역          → 50%
 *
 * 주의: 기회발전특구는 시군구 전체가 아니라 '지구' 단위 지정.
 *       여기서는 "해당 시군구에 특구 지구가 있다"는 플래그로만 제공하며,
 *       실제 특구 혜택은 지구 내 입주 시에만 적용된다.
 */

"use strict";

/* ───────────────────────── 1. 데이터 ───────────────────────── */

// 비수도권 시·도 (수도권 = 서울·인천·경기)
const NON_CAPITAL_SIDO = new Set([
  "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
]);

// 인구감소지역 89곳 (행안부 고시)
const POP_DECLINE = {
  부산: ["동구", "서구", "영도구"],
  대구: ["남구", "서구", "군위군"],
  인천: ["강화군", "옹진군"],
  경기: ["가평군", "연천군"],
  강원: ["고성군", "삼척시", "양구군", "양양군", "영월군", "정선군",
         "철원군", "태백시", "홍천군", "화천군", "횡성군", "평창군"],
  충북: ["괴산군", "단양군", "보은군", "영동군", "옥천군", "제천시"],
  충남: ["공주시", "금산군", "논산시", "보령시", "부여군", "서천군",
         "예산군", "청양군", "태안군"],
  전북: ["고창군", "김제시", "남원시", "무주군", "부안군", "순창군",
         "임실군", "장수군", "정읍시", "진안군"],
  전남: ["강진군", "고흥군", "곡성군", "구례군", "담양군", "보성군",
         "신안군", "영광군", "영암군", "완도군", "장성군", "장흥군",
         "진도군", "함평군", "해남군", "화순군"],
  경북: ["고령군", "문경시", "봉화군", "상주시", "성주군", "안동시",
         "영덕군", "영양군", "영주시", "영천시", "울릉군", "울진군",
         "의성군", "청도군", "청송군"],
  경남: ["거창군", "고성군", "남해군", "밀양시", "산청군", "의령군",
         "창녕군", "하동군", "함안군", "함양군", "합천군"],
};

// 수도권과밀억제권역 (수도권정비계획법 시행령 별표1)
// partial: 법령상 일부 지역만 해당(동·지구 단위 제외 규정 존재)
const OVERCROWDED = {
  서울: { all: true },
  인천: {
    all: true,
    except: ["강화군", "옹진군"],
    partialNote: "서구 일부(대곡동 등)와 경제자유구역·남동국가산단은 과밀억제권역에서 제외",
  },
  경기: {
    list: ["의정부시", "구리시", "하남시", "고양시", "수원시", "성남시",
           "안양시", "부천시", "광명시", "과천시", "의왕시", "군포시"],
    partial: {
      남양주시: "호평·평내·금곡·도농동 등 일부만 과밀억제권역",
      시흥시: "반월특수지역 제외한 지역만 과밀억제권역",
    },
  },
};

// 기회발전특구 (지구 단위 지정이므로 참고 플래그. 1차 2024.6 / 2차 2024.11 지정분)
// 이후 추가 지정분은 산업부 '기회발전특구 지정 통합고시'(고시 2025-131 등)로 갱신 필요
const OPP_ZONE = {
  부산: { 동구: 1, 남구: 1 },                 // 금융 (북항·문현금융단지)
  대구: { 수성구: 1, 달성군: 1, 북구: 1 },     // 디지털·이차전지·전기차부품
  대전: { 유성구: 1 },                         // 바이오·방산 (유성구 등 2개 지역 중 확인분)
  전남: { 광양시: 1, 여수시: 1, 목포시: 1, 해남군: 1, 순천시: 1 }, // 이차전지·해상풍력·수소·데이터센터
  전북: { 전주시: 1, 익산시: 1, 정읍시: 1, 김제시: 1 },           // 탄소섬유·동물의약품·특장차
  경북: { 포항시: 1, 구미시: 1, 안동시: 1, 상주시: 1 },           // 이차전지·바이오·반도체
  경남: { 고성군: 1 },                         // 해상풍력 하부구조물
  제주: { 서귀포시: 1 },                       // 우주항공
  울산: { 남구: 2, 북구: 2, 울주군: 2 },
  세종: { 세종시: 2 }, // 집현동·연서면·전동면 지구
  광주: { 광산구: 2, 북구: 2 },
  충남: { 예산군: 2, 보령시: 2, 서산시: 2, 논산시: 2, 부여군: 2 },
  충북: { 제천시: 2, 보은군: 2, 음성군: 2, 진천군: 2 },
  강원: { 홍천군: 2, 원주시: 2, 강릉시: 2, 동해시: 2, 삼척시: 2, 영월군: 2 },
};

/* ───────────────────────── 2. 유틸 ───────────────────────── */

const SIDO_ALIAS = {
  서울특별시: "서울", 인천광역시: "인천", 경기도: "경기",
  부산광역시: "부산", 대구광역시: "대구", 광주광역시: "광주",
  대전광역시: "대전", 울산광역시: "울산", 세종특별자치시: "세종",
  강원특별자치도: "강원", 강원도: "강원",
  충청북도: "충북", 충청남도: "충남",
  전북특별자치도: "전북", 전라북도: "전북", 전라남도: "전남",
  경상북도: "경북", 경상남도: "경남",
  제주특별자치도: "제주", 제주도: "제주",
};

function normSido(s) {
  const t = (s || "").trim();
  return SIDO_ALIAS[t] || t;
}

// "강화" → "강화군" 처럼 접미사 없는 입력도 매칭
function matchInList(sigungu, list) {
  const t = (sigungu || "").trim();
  if (!t) return null;
  if (list.includes(t)) return t;
  for (const suffix of ["시", "군", "구"]) {
    if (list.includes(t + suffix)) return t + suffix;
  }
  return null;
}

/* ───────────────────────── 3. 판정 함수 ───────────────────────── */

/**
 * @param {string} sidoInput   시·도 (예: "인천", "인천광역시")
 * @param {string} sigunguInput 시·군·구 (예: "강화군", "강화") — 서울/세종 등은 생략 가능
 * @returns 판정 객체
 */
function judge(sidoInput, sigunguInput = "") {
  const sido = normSido(sidoInput);
  let sigungu = (sigunguInput || "").trim();
  if (sido === "세종" && !sigungu) sigungu = "세종시"; // 단층제 예외
  const notes = [];

  /* ── 플래그 1: 인구감소지역 ── */
  const pdList = POP_DECLINE[sido] || [];
  const pdMatch = matchInList(sigungu, pdList);
  const isPopDecline = !!pdMatch;

  /* ── 플래그 2: 과밀억제권역 ── */
  let isOvercrowded = false;
  let overcrowdedPartial = null;
  const oc = OVERCROWDED[sido];
  if (oc) {
    if (oc.all) {
      const exceptMatch = oc.except ? matchInList(sigungu, oc.except) : null;
      isOvercrowded = !exceptMatch;
      if (isOvercrowded && oc.partialNote && sigungu.startsWith("서구")) {
        overcrowdedPartial = oc.partialNote;
      }
    } else {
      if (matchInList(sigungu, oc.list || [])) isOvercrowded = true;
      const partialKeys = Object.keys(oc.partial || {});
      const partialMatch = matchInList(sigungu, partialKeys);
      if (partialMatch) {
        isOvercrowded = true; // 보수적으로 과밀 처리
        overcrowdedPartial = oc.partial[partialMatch];
      }
    }
  }

  /* ── 플래그 3: 기회발전특구 ── */
  let oppZone = null;
  const ozMap = OPP_ZONE[sido];
  if (ozMap) {
    const ozMatch = matchInList(sigungu, Object.keys(ozMap));
    if (ozMatch) {
      oppZone = { level: "sigungu", round: ozMap[ozMatch], name: ozMatch };
      notes.push("기회발전특구는 지구 단위 지정이므로, 특구 혜택(취득세·재산세 등)은 지정 지구 내 입주 시에만 적용됩니다.");
    }
  }
  if (!oppZone && sido === "대전") {
    notes.push("대전은 1차 지정 지역이 '유성구 등 2개 지역'으로 발표되어, 유성구 외 1곳은 세부 확인이 필요합니다.");
  }

  /* ── 감면율 판정 ── */
  let tier, rate;
  if (NON_CAPITAL_SIDO.has(sido)) {
    tier = "비수도권";
    rate = 1.0;
  } else if (isPopDecline) {
    tier = "수도권 내 인구감소지역";
    rate = 1.0;
    notes.push("수도권이지만 인구감소지역이므로 비수도권과 동일한 100% 감면이 적용됩니다.");
  } else if (isOvercrowded) {
    tier = "수도권과밀억제권역";
    rate = 0.5;
    if (overcrowdedPartial) notes.push("일부 지역 예외: " + overcrowdedPartial);
  } else if (["서울", "인천", "경기"].includes(sido)) {
    tier = "수도권(과밀억제권역 외)";
    rate = 0.75;
  } else {
    return { ok: false, error: `알 수 없는 시·도: "${sidoInput}"`, notes: [] };
  }

  notes.push("감면 기간: 최초 소득 발생 과세연도부터 5년. 감면 대상 업종 창업 및 2026.1.1 이후 창업 가정.");

  return {
    ok: true,
    input: { sido, sigungu: sigungu || "(전체)" },
    tier,
    incomeTaxReliefRate: rate,
    flags: {
      인구감소지역: isPopDecline,
      과밀억제권역: isOvercrowded,
      기회발전특구: oppZone,
    },
    notes,
  };
}

/* ── 통계 헬퍼: 데이터 무결성 확인용 ── */
function popDeclineCount() {
  return Object.values(POP_DECLINE).reduce((n, arr) => n + arr.length, 0);
}

/* ───────────────────────── 4. export ───────────────────────── */

const RegionJudge = { judge, popDeclineCount, POP_DECLINE, OVERCROWDED, OPP_ZONE };

if (typeof module !== "undefined" && module.exports) module.exports = RegionJudge;
if (typeof window !== "undefined") window.RegionJudge = RegionJudge;
