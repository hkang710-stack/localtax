/**
 * 온통청년(청년정책) — 지역별 청년정책 수 + 상위 정책명
 *
 * 발급: youthcenter.go.kr 회원가입 → 마이페이지 → Open API 인증키 신청(심사 후 발급)
 *       또는 data.go.kr의 국무조정실 청년정책 API.
 * 문서: 온통청년 Open API 가이드에서 정책 목록 조회 엔드포인트/파라미터를 확인하세요.
 *       (서비스 개편이 잦은 API라, 아래 BASE와 파라미터명이 다르면 가이드 기준으로 수정)
 * 참고: 응답이 JSON이 아닌 XML로 오는 버전도 있어 둘 다 처리합니다.
 */
const BASE = "https://www.youthcenter.go.kr/go/ythip/getPlcy";

async function fetchLive(sggCd, apiKey) {
  const url = `${BASE}?apiKeyNm=${apiKey}&pageNum=1&pageSize=5&rtnType=json&zipCd=${sggCd}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`온통청년 API HTTP ${res.status}`);
  const text = await res.text();

  // JSON 응답
  try {
    const json = JSON.parse(text);
    const total = json?.result?.pagging?.totCount ?? json?.totalCnt;
    const list = (json?.result?.youthPolicyList ?? json?.youthPolicyList ?? [])
      .slice(0, 3).map((p) => p.plcyNm ?? p.polyBizSjnm).filter(Boolean);
    if (typeof total === "number") return { count: total, top: list };
  } catch (_) { /* XML로 재시도 */ }

  // XML 응답 (totalCnt / polyBizSjnm 단순 추출)
  const totalMatch = text.match(/<totalCnt>(\d+)<\/totalCnt>/);
  if (totalMatch) {
    const top = [...text.matchAll(/<polyBizSjnm>([^<]+)<\/polyBizSjnm>/g)].slice(0, 3).map((m) => m[1]);
    return { count: Number(totalMatch[1]), top };
  }
  throw new Error("온통청년 응답 해석 실패: " + text.slice(0, 150));
}

/** @returns {Promise<{count:number, top:string[], source:"live"|"mock"}>} */
async function getYouthPolicies(region, apiKey) {
  if (!apiKey) return { count: region.mock.policyCount, top: [], source: "mock" };
  try {
    const { count, top } = await fetchLive(region.sggCd, apiKey);
    return { count, top, source: "live" };
  } catch (e) {
    console.warn(`[youth] ${region.name} 실패 → 예시값 사용:`, e.message);
    return { count: region.mock.policyCount, top: [], source: "mock" };
  }
}

module.exports = { getYouthPolicies };
