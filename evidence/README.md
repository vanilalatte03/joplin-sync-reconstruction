# 공개 증거 인덱스

원본 실험은 2026-10-22, 공개 전 검토는 2026-10-23이다. JSON 시간은 UTC, Joplin 로그는 KST다.

| 파일 | 내용 |
|---|---|
| `environment.json` | 실제 도구 버전, 서명과 digest, 격리·MCP 연결 검증 요약 |
| `experiment-01/` | 최초 입력, 대상 전후 파일 목록·해시, 원격 표현, 결과와 보조 이미지 |
| `original-scenarios/results.json` | 두 원본 클라이언트의 여섯 시나리오 관찰 |
| `original-scenarios/*-sync.log` | 메뉴 실행 뒤 동기화 로그 |
| `original-scenarios/destination-unavailable.log` | 전체 로컬 로그에서 복구한 대상 손상 fail-safe 중단 구간 |
| `original-scenarios/permanent-delete*` | 영구 삭제 전파, 파일 부재·B의 404 |
| `probe-provenance.json` | 원본 bundle/map digest와 생성 코드 추출 범위·해시; 추출 코드는 공개하지 않음 |
| `runtime-sync-coverage.json` | 실행 커버리지의 함수 이름·범위·소스맵 위치; 소스 본문 없음 |
| `java-tests.txt` | 조사 당시 Java 테스트 8개 통과 기록 |
| `rebuild-demo.json` | 조사 당시 실제 HTTP 시나리오 8개 통과 기록 |
| `persistence.json` | 서로 다른 JVM 사이 H2 이력·cursor 일치 |
| `publication-provenance.json` | 공개 자료의 원본/치환본 digest, 추가 발췌 출처 |
| `publication-validation.json` | 공개할 코드에서 새로 실행한 검증 결과 |

원시 REA 번들, 브라우저 스냅샷, 개인 MCP 등록과 테스트 프로필은 로컬에만 보존했다. 조사 문서에 등장하는 `rea-*.json`은 이 비공개 원시 자료를 뜻하며 공개 저장소의 파일 링크가 아니다. 공개 증거는 로컬 경로를 치환한 선별본이다. 독자는 `investigation/README.md`의 절차로 원시 자료를 직접 생성할 수 있다.

스크린샷에서 최초 노트 본문은 선택되지 않아 표시되지 않는다. 본문 보존은 API 응답과 원격 파일, B의 수신 결과로 판단한다. 커버리지는 실행 사실을 보이지만 정확한 호출 순서를 입증하지 않는다.
