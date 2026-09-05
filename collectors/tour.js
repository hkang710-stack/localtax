/**
 * 한국관광공사 TourAPI — 지역 대표 사진
 *
 * 발급: data.go.kr에서 "한국관광공사_국문 관광정보 서비스" 검색 → 활용신청(자동승인)
 *       → 일반 인증키(Encoding)를 .env의 TOUR_API_KEY에 입력
 * 참고: TourAPI는 버전 개편이 있었던 API입니다(KorService → KorService1 → KorService2).
 *       호출 실패 시 활용가이드 문서에서 현재 서비스명을 확인해 BASE만 수정하세요.
 *
 * 원리: 지역명 키워드 검색 → 대표이미지(firstimage)가 있는 관광지 상위 3곳의 사진 URL 반환.
 *       행정코드가 필요 없어서(이름 기반) 91곳 전체에 바로 적용됩니다.
 */
const BASE = "https://apis.data.go.kr/B551011/KorService2/searchKeyword2";

async function fetchLive(regionName, apiKey) {
  const params = new URLSearchParams({
    MobileOS: "ETC", MobileApp: "locallink",
    _type: "json", keyword: regionName.replace(/(시|군|구)$/, ""), // "정읍시" → "정읍"
    arrange: "O", numOfRows: "10", pageNo: "1",
  });
  // 키 이중 인코딩 방지: 이미 %가 들어간 Encoding 키는 그대로, Decoding 키는 인코딩해서 사용
  const keyPart = /%[0-9A-Fa-f]{2}/.test(apiKey) ? apiKey : encodeURIComponent(apiKey);
  const res = await fetch(`${BASE}?serviceKey=${keyPart}&${params}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`TourAPI HTTP ${res.status}`);
  const json = await res.json();
  const items = json?.response?.body?.items?.item ?? [];
  const photos = (Array.isArray(items) ? items : [items])
    .map((it) => it?.firstimage)
    .filter((u) => typeof u === "string" && u.startsWith("http"))
    .slice(0, 3);
  return photos;
}

/** @returns {Promise<{photos:string[], source:"live"|"none"}>} */
async function getPhotos(region, apiKey) {
  if (!apiKey) return { photos: [], source: "none" };
  try {
    const photos = await fetchLive(region.name, apiKey);
    return { photos, source: photos.length ? "live" : "none" };
  } catch (e) {
    console.warn(`[tour] ${region.name} 사진 실패 → 글리프 사용:`, e.message);
    return { photos: [], source: "none" };
  }
}

module.exports = { getPhotos };
