# YouTube API Services 재제출 — 답장 메일 문안

**보내는 법**: 반려 메일에 **그대로 회신(Reply)** 한다. 새 메일로 보내면 심사 스레드가 갈린다.
**첨부**: `SOOM-API-Client-Walkthrough.pdf` (2.5MB · 12쪽)
**기한**: 반려 메일 기준 영업일 7일 이내

---

## 제목

```
Re: YouTube API Services — additional information for API compliance review (SOOM, project 507307814114)
```

> ⚠️ 회신하면 제목은 자동으로 붙는다. 위 제목으로 **덮어쓰지 말 것** —
> 원본 스레드의 제목을 그대로 두는 편이 심사자가 찾기 쉽다.

---

## 본문

```
Hello,

Thank you for the review. Attached is the step-by-step visual reference you asked
for: "SOOM-API-Client-Walkthrough.pdf" (12 pages).

The document follows a single creator session from beginning to end, one numbered
step per screen, and states for every screen which YouTube API call produced what
the reader is looking at. It also covers the end results, the parts of the product
that use no YouTube data at all, and how collection runs.

A note that may explain why the earlier submission was hard to evaluate: our user
interface is in Korean. Every screen in the attached document is translated and
annotated in English, and each screenshot shows the browser address bar so the
screen can be reached directly on the live site.

Contents of the attachment:

  Section 1     What the client does
  Section 2     Where each YouTube API call is used, mapped to the steps below
  Steps 1-9     The full walkthrough, screen by screen, with the resulting output
  Section 4     How collection runs server-side, with our current database contents
  Section 5     Why the requested quota is 300,000 units/day
  Section 6     Compliance summary

The three points most relevant to the review:

1. No end user ever triggers a YouTube API call. Collection runs in scheduled
   server-side batch scripts into our own database; the web front end reads a
   snapshot baked at build time, so visitor traffic consumes zero quota. The API
   key is never exposed to the browser.

2. We store public metadata only. No video files or thumbnails are downloaded or
   re-hosted. Every video is played through the official youtube-nocookie.com
   iframe player and every card links back to its watch page. Where an uploader
   has disabled off-site embedding, the player's own message is shown as-is and
   the video is still credited and linked (visible in Step 3).

3. The quota increase is needed for search.list alone. Everywhere a cheaper call
   exists we use it: fetching a channel's recent uploads through
   channels.list -> playlistItems.list costs 3 units instead of 100. Under the
   default 10,000 units/day, search.list allows 100 searches per day, and the
   initial corpus needs roughly 700 queries at 3 pages each.

The client is live and can be exercised directly:

  Home                https://gwanjetap.netlify.app
  Channel analysis    https://gwanjetap.netlify.app/?q=하이갱스%20higaengs
  Evidence detail     https://gwanjetap.netlify.app/place/m2600?channel=UC86GzuZXRb7aZnhnnUA3IAg&tag=t_oil_market
  Data sources        https://gwanjetap.netlify.app/data-sources
  Privacy policy      https://gwanjetap.netlify.app/privacy
  Terms of service    https://gwanjetap.netlify.app/terms

GCP project number: 507307814114 (project travel-505308)

If a screen recording would still be preferable to the annotated screenshots, or if
any step needs more detail, please tell me which part and I will send it.

Thank you,
```

---

## 보내기 전에 확인할 것

- [ ] 첨부 파일이 실제로 붙었는가 (2.5MB — Gmail 한도에 여유 있음)
- [ ] 위 URL 6개를 **직접 눌러서** 열리는지 확인. 심사자가 그대로 따라간다
- [ ] 원본 스레드에 회신했는가 (새 메일 아님)
- [ ] 서명에 이름·연락처가 들어가는가

## 왜 반려됐는가 (다음에 같은 실수를 안 하려고)

지난번에 낸 건 **정적 스크린샷 7장 + 다이어그램 2장**이었다. 각각은 요구 항목을
채웠지만, **"이걸 쓰면 무슨 일이 일어나는가"를 순서대로 보여주는 자료가 없었다.**
게다가 화면이 전부 한국어라 심사자가 무엇을 보고 있는지 알 방법이 없었다.

→ 이번 자료는 **한 세션을 처음부터 끝까지** 따라가고, 화면마다 어느 API 호출이
  어느 픽셀을 만들었는지 영문으로 적었다.
