/**
 * 소상공인시장진흥공단 상가(상권)정보 — 시군구별 음식점(I2) 업소 수
 *
 * 발급: data.go.kr에서 "소상공인시장진흥공단_상가(상권)정보" 활용신청 → 일반 인증키(Encoding)
 * 문서: 활용신청 후 상세페이지의 참고문서(오픈API 활용가이드)에서
 *       storeListInDong 파라미터를 확인하세요. 스펙이 바뀌면 아래 BASE/params만 고치면 됩니다.
 *
 * 원리: 업소 목록을 1건만 요청하고 totalCount(총 업소 수)만 읽습니다.
 */
const BASE = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong";

async function fetchLive(sggCd, apiKey) {
  const url = `${BASE}?serviceKey=${apiKey}&divId=signguCd&key=${sggCd}&indsLclsCd=I2&numOfRows=1&pageNo=1&type=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`상권정보 API HTTP ${res.status}`);
  const json = await res.json();
  const total = json?.body?.totalCount ?? json?.response?.body?.totalCount;
  if (typeof total !== "number") throw new Error("상권정보 응답에서 totalCount를 찾지 못함: " + JSON.stringify(json).slice(0, 200));
  return total;
}

/** @returns {Promise<{value:number, source:"live"|"mock"}>} */
async function getStoreCount(region, apiKey) {
  if (!apiKey) return { value: region.mock.storeCount, source: "mock" };
  try {
    const value = await fetchLive(region.sggCd, apiKey);
    return { value, source: "live" };
  } catch (e) {
    console.warn(`[sbiz] ${region.name} 실패 → 예시값 사용:`, e.message);
    return { value: region.mock.storeCount, source: "mock" };
  }
}

module.exports = { getStoreCount };
