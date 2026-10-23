# 재현 절차

## 환경

Windows, PowerShell, Node.js 24.11 이상이 필요하다. 실제 실행은 Node 24.14.0, REA 6.7.0, 공식 Joplin Desktop 3.7.21로 검증했다. 두 앱은 파일 시스템 동기화 대상 하나를 공유한다. A/B 프로필과 HOME/APPDATA/Chromium 데이터는 각각 독립된 work 하위 경로다. 개인 Joplin 경로를 인자로 전달하는 기능은 없다.

재실험은 **이 보고서 디렉터리의 새 복사본**에서 한다. 기존 evidence는 먼저 보관한다. 하네스가 같은 위치에 새 결과를 쓰므로 역사 증거를 덮어쓰지 않도록 주의한다. 기존 프로필 위에 반복 실행하지 않는다. setup은 기존 work/conflict-lab이 있으면 중단한다.

공식 portable 다운로드와 npm 의존성은 프로젝트 안에만 저장한다. 전역 설치, 사용자 MCP 설정 변경, 기존 Joplin 설정 변경은 없다. REA는 SDK가 stdio MCP 서버를 직접 실행하므로 Codex 설정 재연결을 요구하지 않는다.

```powershell
# 이 보고서 디렉터리에서
.\scripts\setup.ps1
node scripts/conflict-extract.mjs
node scripts/conflict-breakpoints.mjs
node scripts/conflict-rea.mjs
node scripts/conflict-predicate-slice.mjs
node scripts/conflict-rea-slice.mjs
```

setup은 공식 v3.7.21 portable 아카이브의 SHA-256과 Joplin 서명을 검사하고 work/joplin-portable에 추출한다. 배포물 해시가 달라지면 진행하지 않는다. 도구는 잠금 파일로 고정된다. 추출한 원본 코드와 REA 원시 evidence는 work에만 생성한다. **패키징한 setup 전체를 새 사용자 환경에서 다시 실행한 것은 아니다.** 이 명령에 해당하는 다운로드·서명 확인·추출·REA 분석 단계는 실제 조사 중 개별 실행했고, 배포용 하네스는 경로를 정리한 뒤 구문 검사했다.

## 실제 Desktop 두 개 시작

서로 다른 터미널에서 실행하고 런처를 유지한다.

```powershell
# 터미널 A
node scripts/conflict-launch.mjs a
```

```powershell
# 터미널 B
node scripts/conflict-launch.mjs b
```

클라이언트는 각각 CDP 9241/9243, Clipper 41184/41185를 사용한다. 포트가 다른 앱에 점유됐다면 그 앱을 종료하지 말고 별도 실험 포트로 하네스를 맞춘다. 특히 기존 Clipper를 실험 인스턴스로 오인하면 안 된다. 테스트 창 초기화와 첫 실행 화면이 끝난 뒤 설정에서 파일 시스템 대상이 work/conflict-lab/target이고, 자동 동기화 간격이 비활성이고, 웹 수집기 서비스가 실행 중인지 확인한다. 첫 실행에서 언어/기본 설정이 정규화될 수 있다. 테스트 프로필의 API 토큰은 work 밖으로 복사하지 않는다.

각 테스트 Clipper의 `/ping`은 JoplinClipperServer를 응답해야 한다. 개인 앱의 포트가 응답한다고 진행하지 않는다. 런처의 테스트 경로와 열린 renderer URL이 일치하는지 확인한다. 하네스 CDP 연결은 `/app.asar/index.html`인 테스트 renderer를 선택한다.

```powershell
# 세 번째 터미널; 원본 두 앱이 준비된 후
node scripts/conflict-experiments.mjs
node scripts/conflict-experiments.mjs --natural
node scripts/conflict-runtime-identity.mjs
node scripts/conflict-visibility.mjs
node scripts/conflict-source-verification.mjs
node scripts/conflict-code-witnesses.mjs
node scripts/conflict-verify.mjs
```

기존 증거를 변경하지 않고 검사하려면 `node scripts/conflict-verify.mjs --check`만 실행한다. Desktop, REA, npm 설치는 필요하지 않다. CI에서는 이 기록 검증만 자동 실행하며 실제 Desktop 실험을 재실행하지 않는다.

첫 실행이 17개 통제 사례를 만들고, --natural은 기존 통제 결과를 유지하며 API 시각만 사용하는 7개를 추가한다. verify는 저장된 실제 결과와 스택에서 27개 불변 조건을 검사하고 24개 사례의 런타임 기록 100개를 합친다. 자체 엔진의 모의 실험 결과를 검증하는 것이 아니다. runtime-identity는 실행 중인 원본 번들이 분석한 배포 번들과 같은지 SHA-256으로 확인한다. source-verification은 실험 후에만 실행해 원본 태그 소스를 교차검증한다.

실험은 로그의 Synchronisation finished를 확인하고 오류/타임아웃이면 중단한다. 오류 난 실행을 통과 기록과 섞지 않는다. 초기 조사 중 API PUT에 updated_time을 전달해도 원하는 값이 유지되지 않는 실패한 시도를 확인했으며, 이를 최종 성공 사례에 포함하지 않았다.

## 각 사례의 기본 절차

1. A에서 새 ID, 본문 BASE인 노트를 만들고 A와 B를 동기화한다. 양쪽 BASE와 sync_time 일치를 확인한다.
2. 양쪽에서 동기화 없이 서로 다른 본문을 수정하거나, A 삭제/B 편집을 수행한다. 이때 입력과 양쪽 상태를 저장한다.
3. 지정 순서 첫 클라이언트를 완전히 동기화한다. 경계값 사례는 그 뒤 테스트 원격 파일의 updated_time 또는 mtime을 바꾼다.
4. 두 번째 클라이언트 동기화에서 원격 비교·액션·내용 함수의 인자와 스택을 기록한다.
5. 첫 클라이언트를 다시 동기화하고 양쪽 원본, 충돌 사본, deleted_time, 원격 파일 유무를 확인한다.

충돌 사본을 셀 때 API include_conflicts=1과 include_deleted=1을 모두 사용한다. 휴지통 사본이 일반 충돌 목록에 안 보이는 경우도 별도 확인한다.

## 통제와 계측의 의미

- sync.interval=0만으로는 수정 후 자동 업로드 예약이 꺼지지 않았다. 원본 start 진입에서 얻은 reg 객체의 syncAsYouTypeInterval을 테스트 동안 24시간으로 바꿨다. 이후 동기화는 원본 synchronize 메뉴를 누른다. 충돌 함수/원격 비교/복사 함수는 교체하지 않는다. 앱을 종료하면 이 런타임 변경은 사라진다.
- 시각 통제는 원본 Note.save(..., {autoTimestamp:false})를 통해 updated_time/user_updated_time만 바꾸고 API로 재조회하여 확인한다. sync_items를 쓰거나 직접 수정하지 않는다. force_sync=0을 확인한다.
- 17개 통제 사례에는 직접적인 시각/파일 메타데이터 주입이 포함된다. 7개 natural 사례에는 그런 주입이 없다. 두 그룹 모두 자동 예약 지연과 debugger 계측은 공유한다.
- “오프라인”은 B에서 동기화를 보류한 상태다. 실제 네트워크 단절이 아니다. 파일 시스템 대상이므로 네트워크 재연결·서버 동시성은 이 실험으로 검증하지 않는다.
- 본문 비교 중단점에서 원래 조건식을 평가한 값과 최종 사본 결과를 함께 확인한다. 반환값 자체를 후킹한 것으로 표시하지 않는다.
- 중단점 주소와 축약 변수는 이 배포물에 종속적이다. 다른 버전에서 주소를 재사용하지 않는다.

## 종료와 원시 증거

실험용 A/B 창을 파일 → 종료로 닫는다. 또는 다음으로 원본 앱의 quit을 호출한다.

```powershell
node scripts/cdp.mjs 9241 'setTimeout(()=>require("@electron/remote").app.quit(),100);true'
node scripts/cdp.mjs 9243 'setTimeout(()=>require("@electron/remote").app.quit(),100);true'
```

work에는 프로필, 토큰, 원본 배포 코드가 있으므로 공개하지 않는다. REA 원시 bundle은 work/conflict-rea에, 비실행 정적 probe는 work/conflict-static에 있다. 공개용 evidence는 경로를 정리한 요약과 합성 노트/동기화 로그다. 기존 사용자의 Joplin 프로세스를 이름만으로 일괄 종료하지 않는다.
