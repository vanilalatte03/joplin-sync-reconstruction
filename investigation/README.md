# 원본 실험 재현 절차

이 디렉터리의 스크립트는 독립 재구축 서버와 분리되어 있다. 원본 Joplin 바이너리, 프로필, npm 도구는 모두 프로젝트 `work/`에 저장한다. **개인 Joplin 실행 파일이나 프로필 경로를 인자로 전달하지 않는다.**

## 준비

필수: Windows, PowerShell, Node.js 24.11 이상(호스트 24.14에서 검증). 기존 Joplin을 사용하지 않는다. 이 프로젝트 루트에서:

```powershell
.\scripts\setup-investigation.ps1
codex mcp get rea --json
```

공식 Joplin 3.7.21 portable 파일 약 361 MB와 잠금 파일에 고정된 npm 패키지를 작업 폴더에 다운로드한다. 실행 파일 digest와 Joplin 서명을 검사한다. REA 소스는 수정하지 않는다. 전역 프로그램 설치나 사용자 전역 Codex 설정 변경은 없다. 새 `.codex/config.toml`은 프로젝트 범위다. 기존 파일이 있으면 그대로 보존한다. Codex의 프로젝트 신뢰 정책에 따라 다음 세션에서 도구가 로드될 수 있으며, 현재 채팅의 도구 재연결 여부와 별개로 `mcp-probe.mjs`가 실제 stdio MCP 연결을 검증한다.

원래 검증 실행에서는 같은 명령에 해당하는 도구·다운로드·추출 단계를 작업 폴더에 개별 실행했다. 배포용 setup 스크립트 전체를 새 Windows 사용자 환경에서 다시 실행한 것은 아니다. Maven 실행 스크립트와 앱 자체의 테스트 결과는 별도로 기록한다.

## 클라이언트 A / B

터미널 두 개에서 각각 실행하고 유지한다. 보이는 앱 창은 테스트 전용이다.

```powershell
# 터미널 A
node .\investigation\launch-joplin.mjs a

# 터미널 B
node .\investigation\launch-joplin.mjs b
```

앱 초기화가 끝나면 세 번째 터미널에서:

```powershell
node .\investigation\configure-client.mjs a
node .\investigation\configure-client.mjs b
node .\investigation\first-experiment.mjs
node .\investigation\scenarios.mjs
node .\investigation\permanent-delete.mjs
```

설정 자동화는 검증 당시의 한국어 UI 라벨과 Joplin 3.7.21 메뉴 ID를 사용한다. 언어·설치 버전이 다르면 실패할 수 있다. 실패 시 개인 프로필을 대신 사용하지 말고 테스트 앱의 옵션에서 파일 시스템 경로를 `work/runtime/sync-target`의 절대 경로로 지정한다. A/B의 Web Clipper 포트는 각각 41184/41185가 비어 있어야 한다. 기존 Clipper가 이 포트를 사용한다면 중지시키지 말고 스크립트의 테스트 포트를 실제 테스트 인스턴스 포트로 맞춘다.

`first-experiment`는 `work/runtime/fixture.json`이 있으면 생성 단계를 재개한다. `scenarios`는 기본적으로 최초 생성 실험 직후의 상태를 가정하므로 같은 프로필에 반복 실행하지 않는다. 이전 증거는 역사 기록으로 보존하고, 새로운 관찰은 별도 프로젝트 복사본에서 실행한다. `--finish-delete`는 검증 중 DELETE의 빈 응답 파싱 오류 후 이미 수행된 시나리오를 반복하지 않고 마지막 동기화만 재개하는 복구 옵션이다. 최신 스크립트는 빈 DELETE 응답을 처리한다.

파일 대상 장애 실험은 **이 프로젝트가 만든** 대상 디렉터리만 잠시 이동하고 복원한다. `sync-target-held`가 이미 있으면 중단한다. 갑작스러운 프로세스 종료로 자동 복원이 실행되지 못했을 때는 작업 폴더의 해당 경로를 확인하고, 일반 파일인 `sync-target`만 제거한 뒤 `sync-target-held`를 원래 이름으로 돌린다. 디렉터리를 재귀 삭제하지 않는다.

## REA 및 보조 추적

```powershell
node .\investigation\rea-analysis.mjs
node .\investigation\extract-static-probes.mjs
node .\investigation\rea-sync-trace.mjs
node .\investigation\runtime-coverage.mjs
```

첫 명령은 배포 ASAR의 manifest/preload/window handler만 분석한다. 전체 번들 분석의 타임아웃 증거는 원래 실행 결과에 보존돼 있으며 매번 반복하지 않는다. 두 번째 명령은 배포 소스맵과 Babel AST를 사용해 정확한 생성 선언 범위를 추출한다. 이는 코드 복구의 provenance를 보존하기 위한 보조 도구다. REA가 변조 없이 이를 분석하고 관계 후보와 미확인 범위를 기록한다. 마지막 커버리지 수집은 직접 CDP로 수행하며 REA 수동 관찰과 구분한다.

모든 테스트 노트·토큰·IPC 키는 전용 work 경로에만 둔다. work 프로필에는 토큰이 있으므로 결과 배포나 공개 저장소에 포함하지 않는다. 분석 종료 후에는 테스트 앱의 파일 → 종료로 닫고 테스트 런처도 종료한다. 별도 사용자 설정과 기존 Joplin은 건드리지 않는다.
