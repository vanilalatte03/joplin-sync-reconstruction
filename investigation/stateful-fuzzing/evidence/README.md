# 선별 증거

모든 노트 내용은 이번 실험에서 만든 합성 데이터다. 실제 사용자 프로필·API 토큰·개인 경로·원본 전체 코드는 포함하지 않는다. JSON의 명령/관찰 배열은 diff를 읽기 쉽게 한 레코드씩 한 줄에 저장한다.

| 파일 | 내용 |
| --- | --- |
| campaigns.json | 기존 랜덤 3개 실행의 summary, 버전/renderer 해시, 준비 sync 수, 종료 기록, 원시 파일 바이트 SHA-256 |
| pilot-20.json, scale-100.json, campaign-1000.json | 명령별 상태 변경/sync 원장, 신호 노트의 선별 전후 이력, 최종 일반 노트 상태, 원시 INCONCLUSIVE 신호와 별도 원인 판정 |
| *-sequence.json | 랜덤 실행의 정확한 명령 목록·seed. 시각과 충돌 사본 ID까지 고정하는 fixture는 아님 |
| minimal.json | 특정 legacy 본문 신호의 축소 후보와 명시적 legacy-v1 oracle |
| reduction.json | baseline, 삭제 탐색, 새 환경 3회 반복의 결과와 실행별 명령 원장/종료 기록 |
| followup.json | 최소 후보 dirty-v2 재생, clean 교체/dirty 충돌/실제 파일 시스템 오류 후 retry, 개선 oracle 새 랜덤 실행 |
| execution-totals.json | 랜덤·축소·반복·통제 그룹별 통계와 전체 합계 |
| rea-analysis.json | 이번에 실제 수행한 REA MCP 호출의 evidence ID, partial coverage, 관계 0개 결과 및 한계 |
| startup-failures.json | 완료 통계에서 제외한 초기 기동 시도 7개의 남아 있는 오류/기록 유무 |
| verification.json | 최종 조사 하네스와 저장 기록의 검증 범위 및 결과 |

전체 operations.jsonl.gz, sync-logs, 프로필, REA 원시 번들, 배포물과 추출 probe는 로컬 work에만 보존했다. 원시 파일의 해시는 공개된 파일을 검증하는 해시가 아니라, 조사자의 보관 자료와 대응하기 위한 식별자다. 디렉터리 이름이나 원시 파일 전체를 재구성하는 정보는 공개하지 않는다.

`node investigation/stateful-fuzzing/scripts/verify.mjs`는 이 저장 기록을 검사한다. CI에서 실제 Desktop 퍼징을 다시 실행하는 것은 아니다. 최초 실행과 현재 하네스의 차이, legacy 판정기의 문제, 재현 한계는 [방법](../docs/methodology.md)과 [재현](../docs/reproduction.md)에 있다.
