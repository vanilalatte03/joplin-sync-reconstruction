# REA와 내부 동작 조사

## 실제 호출

`scripts/rea.mjs`는 기존 REA 6.7.0의 stdio MCP 서버를 SDK로 실행했다. 설치나 전역 설정 변경은 없다. 새 분석에서 기존 공식 배포 번들의 BaseItem, Synchronizer, syncDeleteStep probe를 선택했다. 이 probe는 소스맵으로 범위를 찾은 배포 JavaScript 발췌이며, 새로 작성한 모의 동기화 함수가 아니다. 전체 원본 코드는 비공개 work에 유지한다.

1. analyze_javascript_application: 세 JavaScript 파일, parse failure 0, AST 11,544개 노드.
2. trace_javascript_semantics: sync_time, force_sync, updated_time의 forward-influence.
3. trace_application_feature: syncDeleteStep 모듈 outgoing.
4. export_evidence_bundle: 로컬 원시 결과 보존.

[실제 호출 결과](../evidence/rea-analysis.json)에 evidence ID, coverage, limitations, 요약을 보존했다. semantic 쿼리는 각각 seed 4/2/9개를 찾았으나 traversed relations는 모두 **0**이었다. 삭제 모듈 trace는 traced nodes 2, edges 1을 반환했다. 초기 분석의 전체 relation 통계와 특정 쿼리의 0개 관계는 서로 다른 수치다. REA가 완전한 데이터 흐름이나 삭제 호출 그래프를 복구했다고 주장하지 않는다.

## 보완한 원인 조사

배포 BaseItem의 itemsThatNeedSync 안 SQL은 `s.sync_time < items.updated_time OR force_sync = 1`과 `sync_disabled = 0`을 사용한다. never-synced 항목은 별도로 선택한다. 원본 Synchronizer의 업로드 후보에 대한 충돌 조건은 `remoteContent.updated_time > local.sync_time`이다. 이는 PR #1의 시각 경계값 실험과 연결된다. 현재 dirty-v2의 읽기 전용 SELECT는 이 업로드 대상 선정 조건을 ordinary 합성 노트에 한정해 반영한다.

legacy 세 신호의 전체 명령 기록을 조사하니, 모두 해당 A 클라이언트가 직접 편집하지 않은 다운로드된 과거 본문이었다. pilot은 B/C의 영구 삭제가 A에 전파된 경우이고, 나머지는 새 원격 본문을 A가 내려받은 경우다. 원격에서 이미 교체·삭제된 clean 과거 본문이 사라지는 것은 dirty 변경의 유실 증거가 아니다. scale-100에서는 실제 B 수정본이 충돌 사본으로 남은 것도 확인했다.

후속 controlled 실행은 원본 renderer에서 sync_items를 SELECT하고, 실제 timestampCandidate 중단점에서 local updated_time, sync_time, remote updated_time, 비교식 값, 호출 스택을 수집한다. 함수 반환값이나 충돌 처리를 바꾸지 않는다. 구체적인 실행 결과는 [findings](findings.md)와 controlled evidence를 확인한다.

## 한계

정적 발췌는 원본 모듈 주변 전체 환경을 포함하지 않는다. REA coverage는 partial이고 unknowns가 있다. PR #1에서 얻은 번들 해시와 중단점 위치를 재사용하므로 다른 Joplin 버전에 일반화하지 않는다. 실제 Desktop 관찰과 Java 재구축 엔진의 동작은 별개이며 이 PR에서 엔진을 고치지 않았다.
