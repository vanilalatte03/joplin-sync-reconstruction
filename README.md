# Joplin 동기화 관찰 및 최소 재구축

Joplin 공식 프로젝트와 관계없는 연구용 저장소다. 공개본의 자료 범위·경로 치환·라이선스 상태는 [공개 범위](docs/publication.md)에 기록했다. 원시 분석 자료와 테스트 프로필은 포함하지 않는다.

2026-10-22 Windows에서 공식 Joplin Desktop 3.7.21 두 개를 별도 프로필로 실행하고, REA 6.7.0과 로컬 파일 동기화 대상으로 실험했다. 관찰 뒤 Java 21 / Spring Boot 4.1.2 / H2로 독립적인 동기화 엔진을 작성했다. Joplin 프로토콜과 호환되는 구현은 아니다.

## 확인한 결과

- 원본: 노트 생성·수정 전파, 동기화하지 않은 로컬 편집 보존, 두 클라이언트의 충돌 보존, 파일 대상 오류 후 재시도, 일반 삭제와 영구 삭제 전파를 확인했다.
- 원본에서 B의 미전송 편집과 A의 원격 편집이 충돌하면, B에 별도 충돌 노트가 생겼고 원래 노트는 A의 본문을 받았다. 이 한 실행 순서의 관찰이며 모든 충돌 규칙을 규명한 것은 아니다.
- 일반 삭제는 `deleted_time`을 전파하며 원격 `.md`를 남겼다. 영구 삭제 후에는 원격 파일이 사라지고 B의 API가 404를 반환했다.
- 재구축: Java 통합 테스트 **8개**, 실제 HTTP/두 클라이언트 시나리오 **8개** 통과. 서버 커밋 후 응답 소켓을 끊어도 같은 작업 ID로 재시도해 변경을 한 번만 반영했다. 새 JVM으로 다시 실행한 뒤 H2의 변경 이력도 일치했다.
- 원본의 **전송 도중 실제 네트워크 단절은 미검증**이다. 파일 시스템 접근 실패 실험과 재구축의 HTTP 응답 유실 실험을 동일한 검증으로 취급하지 않는다.

## 재구축 실행

필수: Java **21**, Node.js **24**, PowerShell. 아래 명령은 이 README가 있는 폴더에서 실행한다. Maven이 없으면 스크립트가 공식 Maven Central에서 3.9.12를 작업 폴더에 내려받고 SHA-512를 검사한다. 관리자 설치와 전역 PATH 변경은 하지 않는다.

```powershell
# JAVA_HOME이 없는 경우 실제 JDK 21 경로를 이 프로세스에만 지정한다.
$env:JAVA_HOME='C:\Program Files\Java\jdk-21'
.\scripts\mvn.ps1 test package
node --test .\clients\client.test.mjs
java -jar .\target\sync-lab-0.1.0.jar
```

다른 터미널에서:

```powershell
Invoke-RestMethod http://127.0.0.1:8087/health
node .\scripts\demo.mjs
```

데모는 실행마다 고유 ID를 생성하므로 기존 노트를 지우지 않는다. `evidence/rebuild-demo.json`은 최신 데모 결과로 갱신된다. 서버는 로컬 호스트에만 바인딩하며 실험용으로 인증을 생략했다.

## 두 CLI 클라이언트 사용

```powershell
node .\clients\client.mjs a put note-1 '첫 노트' '본문 1'
node .\clients\client.mjs a sync
node .\clients\client.mjs b sync

# 같은 버전에서 서로 다르게 편집한다.
node .\clients\client.mjs a put note-1 '첫 노트' 'A 수정'
node .\clients\client.mjs b put note-1 '첫 노트' 'B 오프라인 수정'
node .\clients\client.mjs a sync
node .\clients\client.mjs b sync
node .\clients\client.mjs b show

node .\clients\client.mjs a delete note-1
node .\clients\client.mjs a sync
node .\clients\client.mjs b sync
```

`work/clients/a.json`, `b.json`에 노트·대기 작업·충돌을 각각 보관한다. 같은 클라이언트 파일을 두 프로세스에서 동시에 열지 않는다. 동기화하지 않아도 `put`은 로컬에 저장된다. 전송을 시도한 작업은 결과를 확정할 때까지 수정할 수 없으며, `sync`로 먼저 재시도해야 한다. 서버 주소는 `SYNC_URL` 환경변수로 지정할 수 있다.

서버 데이터는 `work/server/sync.mv.db`에 남는다. 삭제 상태와 충돌도 보존되며 자동 정리하지 않는다. 서버는 Ctrl+C로 종료한다.

## 원본 실험 재현

별도 절차와 주의사항은 [investigation/README.md](investigation/README.md)에 있다. REA는 프로젝트 내부 npm 도구로 설치하고, Codex의 **프로젝트 전용** `.codex/config.toml`을 사용한다. 기존 전역 Codex 설정은 수정하지 않는다. 현재 작업 폴더의 등록은 `codex mcp get rea --json`으로 확인했고, 별도 MCP SDK 연결에서 207개 도구와 실제 분석 호출을 검증했다. 이미 열린 채팅에 REA 도구가 동적으로 추가됐다는 뜻은 아니다.

## 문서와 증거

- [역공학 과정과 근거](docs/investigation.md)
- [재구축 설계와 API](docs/architecture.md)
- [원본과 재구축 비교](docs/comparison.md)
- [증거 목록](evidence/README.md)
- [서드파티 출처와 라이선스](THIRD_PARTY_NOTICES.md)

원본 전체 소스 저장소를 복제하거나 코드를 Java로 옮기지 않았다. 정적 검증에는 공식 배포 ASAR와 그 소스맵에서 추출한 생성 코드를 사용했다. 같은 분석자가 구현했으므로 엄격한 인적·환경적 clean-room 분리를 주장하지 않는다.

공개 전 검토에서 로컬 노트 사전의 특수 ID 저장 문제를 수정하고 회귀 테스트 3개를 추가했다. 조사 당시 기록과 공개할 코드의 새 검증 결과는 증거 디렉터리에서 구분한다.
