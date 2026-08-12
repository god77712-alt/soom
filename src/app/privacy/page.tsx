import type { Metadata } from "next";
import { Bullets, DocPage, Out, Section } from "@/components/DocPage";

export const metadata: Metadata = {
  title: "개인정보처리방침 — 숨",
  description: "숨(SOOM)이 수집하는 정보와 처리 방침.",
};

/** YouTube API 감사에서 방침 미비가 대표 탈락 사유다. 아래 고지는 빼면 안 된다. */
export default function PrivacyPage() {
  return (
    <DocPage title="개인정보처리방침" updated="2026-08-12">
      <Section title="1. 수집하지 않는 정보">
        <p>
          숨은 회원가입이 없습니다. 이름·연락처·결제수단 등 개인을 식별할 수 있는 정보를
          수집하지 않으며, 로그인·인증 절차도 두지 않습니다.
        </p>
      </Section>

      <Section title="2. 입력한 채널 정보의 처리">
        <Bullets
          items={[
            <>
              분석을 위해 입력한 <strong className="text-ink">YouTube 채널명 또는 채널 URL</strong>은
              공개된 채널 정보를 조회하는 데에만 쓰입니다.
            </>,
            "입력값은 화면 주소(URL)에 담겨 처리되며, 서버에 별도로 저장하거나 다른 입력값과 연결하지 않습니다.",
            "이용자를 식별하거나 이용 이력을 추적하지 않습니다.",
          ]}
        />
      </Section>

      <Section title="3. 쿠키 및 추적">
        <p>
          쿠키, 로컬 저장소, 광고 식별자, 접속 분석 도구를 사용하지 않습니다. 이용자 행동을
          기록하는 제3자 스크립트를 넣지 않습니다.
        </p>
      </Section>

      <Section title="4. 제3자 제공">
        <p>
          수집하는 개인정보가 없으므로 제3자에게 제공하거나 판매하는 정보도 없습니다.
          국외 이전 역시 발생하지 않습니다.
        </p>
      </Section>

      <Section title="5. YouTube API Services 이용 고지">
        <p>
          숨은 <strong className="text-ink">YouTube API Services</strong>를 이용해 공개된 영상의
          통계(제목·조회수·재생시간·설명·공개일)와 채널의 공개 정보를 조회합니다. 이 조회는
          서버에서 일괄 수행되며, 이용자의 YouTube 계정에 접근하거나 로그인을 요구하지 않습니다.
        </p>
        <Bullets
          items={[
            <>
              이용자는 <Out href="https://www.youtube.com/t/terms">YouTube 서비스 약관</Out>의
              적용을 받습니다.
            </>,
            <>
              Google 의 정보 처리에 관해서는{" "}
              <Out href="https://policies.google.com/privacy">Google 개인정보처리방침</Out>을
              확인하실 수 있습니다.
            </>,
            <>
              숨은 이용자 계정 접근 권한을 요청하지 않으므로 철회할 권한이 없습니다. Google 계정에
              연결된 앱 권한은{" "}
              <Out href="https://myaccount.google.com/permissions">Google 보안 설정</Out>에서
              언제든 확인·해제할 수 있습니다.
            </>,
            "영상 파일이나 썸네일을 내려받아 보관하지 않으며, 표시되는 모든 영상은 YouTube 원본 페이지로 연결됩니다.",
          ]}
        />
        <p>
          수집한 통계는 소재별 성과를 계산하기 위한 집계 용도로만 쓰고, 주기적으로 갱신합니다.
          영구 사본으로 보관하지 않습니다.
        </p>
      </Section>

      <Section title="6. 공공데이터 이용">
        <p>
          장소 정보는 한국관광공사 TourAPI 등 공공데이터를 사전에 수집해 자체 데이터베이스에
          보관한 것입니다. 이용자 요청이 곧바로 외부 API 호출로 이어지지 않습니다. 자세한 출처는{" "}
          <strong className="text-ink">데이터 출처</strong> 페이지에 있습니다.
        </p>
      </Section>

      <Section title="7. 보관 및 파기">
        <p>
          개인정보를 저장하지 않으므로 별도의 보관 기간이나 파기 절차가 없습니다. 수집한 공개
          데이터는 서비스 종료 시 함께 삭제됩니다.
        </p>
      </Section>

      <Section title="8. 문의">
        <p>
          방침에 관한 문의는 <Out href="mailto:god77712@gmail.com">god77712@gmail.com</Out> 으로
          받습니다.
        </p>
      </Section>

      <Section title="9. 변경">
        <p>
          방침이 바뀌면 이 페이지의 최종 갱신일을 고쳐 알립니다.
        </p>
      </Section>
    </DocPage>
  );
}
