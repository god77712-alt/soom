import type { Metadata } from "next";
import { Bullets, DocPage, Out, Section } from "@/components/DocPage";

export const metadata: Metadata = {
  title: "이용약관 — 숨",
  description: "숨(SOOM) 이용약관.",
};

export default function TermsPage() {
  return (
    <DocPage title="이용약관" updated="2026-08-12">
      <Section title="1. 서비스의 성격">
        <p>
          숨은 2026 관광데이터 활용 공모전 출품을 목적으로 만든 비영리 서비스입니다. 공개된
          공공데이터와 영상 통계를 집계해 촬영지 후보를 제시합니다. 회원가입·결제·광고가 없습니다.
        </p>
      </Section>

      <Section title="2. 제공하는 수치는 추정입니다">
        <Bullets
          items={[
            "표시되는 배수·예상 도달 범위는 과거 공개 영상의 통계를 근거로 한 추정치입니다.",
            "특정 성과를 보장하지 않으며, 결과는 콘텐츠 완성도·시기·채널 상황에 따라 달라집니다.",
            "표본이 부족한 소재는 점수를 만들지 않고 '표본 부족'으로 표시합니다.",
            "폐교·간이역 등 현장 상태가 자주 바뀌는 장소는 공공데이터 기준이므로 방문 전 확인이 필요합니다.",
          ]}
        />
        <p>
          촬영 가능 여부, 출입 허가, 초상권·재산권 처리는 이용자 책임입니다. 숨은 장소의 촬영
          허가를 대행하거나 보증하지 않습니다.
        </p>
      </Section>

      <Section title="3. 데이터 출처와 권리">
        <p>
          장소 정보의 저작권은 각 제공기관에 있으며, 공공누리 등 각 데이터의 이용조건을 따릅니다.
          영상 통계의 권리는 YouTube 및 각 채널 운영자에게 있습니다. 개별 출처는{" "}
          <strong className="text-ink">데이터 출처</strong> 페이지에 정리해 두었습니다.
        </p>
      </Section>

      <Section title="4. YouTube 관련">
        <p>
          이 서비스는 YouTube API Services 를 이용합니다. 이용자는{" "}
          <Out href="https://www.youtube.com/t/terms">YouTube 서비스 약관</Out>의 적용을 받습니다.
          숨은 영상 파일을 저장·재배포하지 않으며, 표시되는 영상은 모두 YouTube 원본 페이지로
          연결됩니다.
        </p>
      </Section>

      <Section title="5. 금지 사항">
        <Bullets
          items={[
            "자동화된 수단으로 서비스에 과도한 부하를 주는 행위",
            "제공된 데이터를 원 제공기관의 이용조건에 어긋나게 재배포하는 행위",
            "서비스의 수치를 사실 확정 정보인 것처럼 표시해 제3자를 오인하게 하는 행위",
          ]}
        />
      </Section>

      <Section title="6. 면책">
        <p>
          숨은 제공되는 정보의 정확성·완전성을 보증하지 않으며, 이용 결과로 발생한 손해에 대해
          책임지지 않습니다. 공모전 진행 상황에 따라 서비스가 사전 통지 없이 중단될 수 있습니다.
        </p>
      </Section>

      <Section title="7. 문의">
        <p>
          <Out href="mailto:god77712@gmail.com">god77712@gmail.com</Out>
        </p>
      </Section>
    </DocPage>
  );
}
