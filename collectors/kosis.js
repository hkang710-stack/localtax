/**
 * KOSIS 공유서비스 — 시군구 청년(20~39세) 인구 비율
 *
 * 발급: kosis.kr/openapi 회원가입 → 활용신청 → 인증키
 * 주의: KOSIS는 통계표마다 orgId/tblId/itmId/objL 조합이 달라 가장 손이 많이 가는 API입니다.
 *   1) kosis.kr에서 "주민등록인구현황" 표를 열고
 *   2) 오른쪽 '공유서비스(OpenAPI)' 버튼 → 지금 보는 표 그대로의 호출 URL을 복사한 뒤
 *   3) 아래 buildUrl()을 그 URL 구조에 맞게 수정하는 순서를 권합니다.
 * 아래 기본값은 행정안전부 주민등록인구(연령별) 표 기준의 골격 예시입니다.
 */
const BASE = "https://kosis.kr/openapi/Param/statisticsParameterData.do";

function buildUrl(sggCd, apiKey) {
  const params = new URLSearchParams({
    method: "getList",
    apiKey,
    format: "json",
    jsonVD: "Y",
    orgId: "101",            // 통계청 (표에 따라 110=행안부 등으로 변경)
    tblId: "DT_1B040A3",     // 주민등록인구 (활용신청한 표의 tblId로 교체)
    objL1: sggCd,            // 지역 분류값 — 표에 따라 코드 체계가 다름 (확인 필수)
    itmId: "T20",            // 항목 — 확인 필수
    prdSe: "M",
    newEstPrdCnt: "1",
  });
  return `${BASE}?${params}`;
}

async function fetchLive(sggCd, apiKey) {
  const res = await fetch(buildUrl(sggCd, apiKey), { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`KOSIS HTTP ${res.status}`);
  const json = await res.json();
  if (json?.err) throw new Error(`KOSIS 오류 ${json.err}: ${json.errMsg}`);
  if (!Array.isArray(json) || !json.length) throw new Error("KOSIS 빈 응답 — tblId/objL/itmId 조합 확인 필요");
  // 연령 구간별 응답에서 20~39세 합 / 전체 합을 계산하는 부분은
  // 선택한 표의 분류 구조에 따라 달라지므로, 표 확정 후 여기서 집계하세요.
  throw new Error("표 구조 확인 후 집계 로직을 완성하세요 (README의 KOSIS 절 참고)");
}

/** @returns {Promise<{value:number, source:"live"|"mock"}>} 청년비율 % */
async function getYouthRatio(region, apiKey) {
  if (!apiKey) return { value: region.mock.youthRatio, source: "mock" };
  try {
    const value = await fetchLive(region.sggCd, apiKey);
    return { value, source: "live" };
  } catch (e) {
    console.warn(`[kosis] ${region.name} 실패 → 예시값 사용:`, e.message);
    return { value: region.mock.youthRatio, source: "mock" };
  }
}

module.exports = { getYouthRatio };
