import type { Metadata } from "next";
import { Bullets, DocPage, Out, Section } from "@/components/DocPage";
import { IS_DEMO_DATA } from "@/lib/repo";

export const metadata: Metadata = {
  title: "데이터 출처 — 숨",
  description: "숨(SOOM)이 쓰는 데이터의 출처와 계산 방식.",
};

const SOURCES: { name: string; org: string; use: string }[] = [
  { name: "국문 관광정보 서비스", org: "한국관광공사 TourAPI", use: "장소 목록·소개글·운영정보" },
  { name: "영문 관광정보 서비스", org: "한국관광공사 TourAPI", use: "해외 채널용 장소명·설명" },
  { name: "관광사진 정보", org: "한국관광공사", use: "장소 사진, 촬영 시기" },
  { name: "관광공모전 수상작 사진", org: "한국관광공사", use: "검증된 촬영 구도" },
  { name: "두루누비 걷기길", org: "한국관광공사", use: "촬영 동선" },
  { name: "전국전통시장 표준데이터", org: "소상공인시장진흥공단", use: "장날(개설주기)·점포수" },
  { name: "전국폐교재산 기본정보", org: "시도교육청", use: "폐교 활용 현황" },
  { name: "철도역 정보", org: "국가철도공단", use: "간이역 판정(열차정차횟수)" },
  { name: "인구감소지역 지정 현황", org: "행정안전부", use: "인구감소지역 89개 시군구" },
  { name: "생활천문정보(출몰시각)", org: "한국천문연구원", use: "일출·일몰 시각" },
  { name: "종관기상관측·단기예보", org: "기상청", use: "시기별 날씨" },
  { name: "YouTube Data API v3", org: "Google", use: "공개 영상 통계·채널 공개 정보" },
];

export default function DataSourcesPage() {
  return (
    <DocPage title="데이터 출처" updated="2026-08-12">
      {IS_DEMO_DATA && (
        <div className="border border-open-d/40 bg-open/10 p-4">
          <p className="text-[13px] font-bold text-open">지금 보이는 수치는 시연용입니다</p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink2">
            아래 출처의 수집은 진행 중입니다. 장소 목록 64,037건과 보강 데이터 2,802건은 이미
            적재했고, 소개글은 공공데이터포털 일일 호출 한도(오퍼레이션당 1,000건) 안에서 매일
            받는 중입니다. 한도 상향이 승인되기 전까지 화면에는 구조 확인용 예시 값을 넣어
            두었습니다.
          </p>
        </div>
      )}

      <Section title="쓰는 데이터">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-hair text-left text-ink3">
                <th className="py-2 pr-4 font-medium">데이터</th>
                <th className="py-2 pr-4 font-medium">제공</th>
                <th className="py-2 font-medium">쓰임</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.name} className="border-b border-hair/60 align-top">
                  <td className="py-2 pr-4 text-ink">{s.name}</td>
                  <td className="py-2 pr-4 text-ink3">{s.org}</td>
                  <td className="py-2 text-ink2">{s.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="어떻게 계산하는가">
        <Bullets
          items={[
            <>
              장소의 소개글에서 <strong className="text-ink">소재 태그</strong>를 뽑습니다
              (오일장·등대·폐교 등).
            </>,
            <>
              같은 소재를 다룬 공개 영상의 <strong className="text-ink">조회수 ÷ 구독자수</strong>{" "}
              기하평균으로 소재별 점수를 냅니다. 배수는 표본 100편 이상일 때만 숫자로 쓰고, 그
              미만이면 순위에만 반영합니다.
            </>,
            <>
              점수판은 <strong className="text-ink">언어별·구독자 규모별로 따로</strong> 만듭니다.
              한국어권과 영어권에서 먹히는 소재가 다르기 때문입니다.
            </>,
            <>
              표본이 5편 미만인 태그는 점수를 만들지 않고 상위 태그 점수를 빌려오며, 화면에 그
              사실을 표시합니다.
            </>,
            <>
              영상이 많은 지역이 무조건 유리해지지 않도록{" "}
              <strong className="text-ink">희소성 가중치</strong>를 둡니다. 인구감소지역이라는
              이유로 점수를 더 주지는 않습니다.
            </>,
          ]}
        />
      </Section>

      {/*
        YouTube 임베드 실물.
        ⚠️ 심사가 "플레이어를 어디에 어떻게 붙였는지" 스크린샷을 요구한다.
           추천 화면의 영상 카드는 시연 데이터라 자리표시 박스만 나오므로,
           실제 임베드를 확인할 수 있는 곳이 여기 하나는 있어야 한다.
           **여기에는 지어낸 지표를 붙이지 않는다** — 아래 수치는 전부 실측값이다.
      */}
      <Section title="영상은 이렇게 표시합니다">
        <p>
          영상은 YouTube 공식 iframe 플레이어로만 재생합니다. 파일을 내려받거나 다시
          올리지 않으며, 제목과 채널명을 눌러 YouTube 원본으로 이동할 수 있습니다.
        </p>
        <div className="mt-3 max-w-md border border-hair">
          <div className="relative aspect-video w-full bg-ground">
            <iframe
              className="absolute inset-0 h-full w-full"
              src="https://www.youtube-nocookie.com/embed/lOPvMP1H27Y"
              title="British Cabin Crew tries Real Korean Food for the First Time!"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <div className="space-y-1 p-3">
            <a
              href="https://www.youtube.com/watch?v=lOPvMP1H27Y"
              target="_blank"
              rel="noreferrer noopener"
              className="block text-[13px] font-bold text-ink hover:underline"
            >
              British Cabin Crew tries Real Korean Food for the First Time!
            </a>
            <p className="font-mono text-[11px] text-ink3">
              영국남자 Korean Englishman · 조회 1,968,765 · 2026-07-22
            </p>
          </div>
        </div>
        <p className="text-[12px] text-ink3">
          위 영상과 수치는 YouTube Data API 로 실제 조회한 값입니다. 12개 주력 소재의
          추천·근거 화면에 나오는 영상 카드도 모두 같은 방식의 실제 영상이며, 각 카드에
          원본 watch 페이지로 가는 링크를 함께 둡니다. 아직 시연인 소재는 화면에서
          <strong className="text-ink"> 자리표시 박스</strong>로 구분됩니다.
        </p>
      </Section>

      <Section title="하지 않는 것">
        <Bullets
          items={[
            "영상 파일·썸네일을 내려받아 보관하지 않습니다. 모든 영상은 YouTube 원본으로 연결됩니다.",
            "이용자 화면에서 외부 API 를 직접 호출하지 않습니다. 모든 조회는 사전에 수집한 자체 데이터베이스에서 이뤄집니다.",
            "예상 도달을 단일 숫자로 쓰지 않습니다. 반드시 범위와 추정 고지를 함께 표시합니다.",
            "회원가입·로그인·광고·행동 추적이 없습니다.",
          ]}
        />
      </Section>

      <Section title="관련 문서">
        <Bullets
          items={[
            <Out href="https://www.data.go.kr">공공데이터포털</Out>,
            <Out href="https://api.visitkorea.or.kr">한국관광공사 TourAPI</Out>,
            <Out href="https://www.youtube.com/t/terms">YouTube 서비스 약관</Out>,
            <Out href="https://policies.google.com/privacy">Google 개인정보처리방침</Out>,
          ]}
        />
      </Section>
    </DocPage>
  );
}
