/**
 * 비교 대상 지역 설정.
 * sggCd: 행정표준 시군구코드 5자리 (법정동코드 앞 5자리).
 *   ⚠ 강원(42→51, 2023)·전북(45→52, 2024) 특별자치도 출범으로 코드가 바뀌었습니다.
 *   실데이터 연동 전에 code.go.kr(행정표준코드관리시스템)에서 최신 코드를 확인하세요.
 * mock: API 키가 없을 때 쓰는 예시값 (rent: 3.3㎡당 월 임대료 만원 — 현재 수집 API 없음, 항상 예시값)
 */
module.exports = [
  { id: "jeongeup",  name: "정읍시", sido: "전북", sggCd: "52180", lat: 35.57, lng: 126.85, glyph: "field",
    story: "동학이 시작된 땅. 만석보에서 걸어본 그 거리에 빈 점포가 기다려요.",
    mock: { storeCount: 1180, youthRatio: 14, policyCount: 7, rent: 4.2 } },
  { id: "buyeo",     name: "부여군", sido: "충남", sggCd: "44760", lat: 36.28, lng: 126.90, glyph: "castle",
    story: "사비의 고도. 백제문화단지 관광객이 늘고, 임대료는 아직 그대로예요.",
    mock: { storeCount: 640, youthRatio: 12, policyCount: 5, rent: 3.8 } },
  { id: "gongju",    name: "공주시", sido: "충남", sggCd: "44150", lat: 36.45, lng: 127.10, glyph: "river",
    story: "제민천 카페거리가 이미 증명했어요. 청년 상권이 자라는 중이에요.",
    mock: { storeCount: 1050, youthRatio: 17, policyCount: 6, rent: 5.1 } },
  { id: "andong",    name: "안동시", sido: "경북", sggCd: "47170", lat: 36.57, lng: 128.70, glyph: "castle",
    story: "고택과 종가의 도시. 구시장 곳곳에 청년 가게가 들어서고 있어요.",
    mock: { storeCount: 1420, youthRatio: 16, policyCount: 8, rent: 4.9 } },
  { id: "ganghwa",   name: "강화군", sido: "인천", sggCd: "28710", lat: 37.70, lng: 126.50, glyph: "sea",
    story: "서울에서 1시간, 지붕 없는 박물관. 수도권인데 감면은 지방과 같아요.",
    mock: { storeCount: 890, youthRatio: 13, policyCount: 9, rent: 7.1 } },
  { id: "namhae",    name: "남해군", sido: "경남", sggCd: "48840", lat: 34.84, lng: 127.90, glyph: "sea",
    story: "독일마을과 바래길의 섬. 이번 비교에서 임대료가 가장 낮아요.",
    mock: { storeCount: 520, youthRatio: 11, policyCount: 4, rent: 3.5 } },
  { id: "jeonju",    name: "전주시", sido: "전북", sggCd: "52110", lat: 35.82, lng: 127.15, glyph: "castle",
    story: "한옥마을의 검증된 유동인구. 대신 경쟁도 이 목록에서 두 번째로 세요.",
    mock: { storeCount: 9800, youthRatio: 24, policyCount: 11, rent: 7.8 } },
  { id: "gangneung", name: "강릉시", sido: "강원", sggCd: "51150", lat: 37.75, lng: 128.90, glyph: "sea",
    story: "커피의 도시라는 명성만큼 카페 밀도도 전국 최상위. 각오가 필요해요.",
    mock: { storeCount: 3900, youthRatio: 19, policyCount: 6, rent: 8.9 } },
];
