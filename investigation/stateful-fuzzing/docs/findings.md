# 결과와 판정

## 정확한 통계

| sequence | seed | 상태 변경 | 명령 | sync 성공 | UTC 시작 → 종료 | elapsed ms |
| --- | --- | --- | --- | --- | --- | --- |
| pilot-20 | 2026102301 | 20 | 28 | 21 | 2026-10-23T08:09:11.138Z → 2026-10-23T08:09:17.987Z | 6849 |
| scale-100 | 2026102302 | 100 | 110 | 44 | 2026-10-23T08:27:58.548Z → 2026-10-23T08:28:18.506Z | 19958 |
| campaign-1000 | 2026102303 | 1000 | 1018 | 289 | 2026-10-23T09:18:02.369Z → 2026-10-23T09:20:48.216Z | 165847 |
| campaign-v2-1000 | 2026102305 | 1002 | 1029 | 291 | 2026-10-23T12:59:55.831Z → 2026-10-23T13:03:29.617Z | 213787 |

elapsedMs는 프로필 시작 전 대기와 앱 startup을 제외하고 open 후 명령 기록 시작부터 종료 정리까지 포함한다. UTC 원시 시각을 그대로 표시했다. 기존 3개 랜덤은 상태 변경 **1,120 / 명령 1,156 / sync 354 성공·0 실패**다. 새 seed 2026102305의 dirty-v2 실행은 상태 변경 **1002 / 명령 1029 / sync 291 성공·0 실패**다. 서로 독립된 랜덤 시퀀스는 총 4개이며 상태 변경 합은 **2122**다.

| 그룹 | 시퀀스 | 상태 변경 | 명령 | sync 성공 | 실패 | timeout/exception | 준비 sync(포함) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 기존 랜덤 20/100/1000 | 3 | 1120 | 1156 | 354 | 0 | 0/0 | 9 |
| 축소 baseline + 삭제 탐색 | 70 | 367 | 801 | 733 | 0 | 0/0 | 210 |
| 최소 후보 새 환경 반복 | 3 | 9 | 21 | 33 | 0 | 0/0 | 9 |
| 최소 후보 dirty-v2 재생 | 1 | 3 | 7 | 11 | 0 | 0/0 | 3 |
| clean/충돌/실패 retry 통제 | 1 | 5 | 15 | 26 | 1 | 0/0 | 3 |
| 개선 oracle 새 랜덤 | 1 | 1002 | 1029 | 291 | 0 | 0/0 | 3 |

전체 완료 실행 합은 **79시퀀스 / 2506상태 변경 / 3029명령 / sync 1448성공·1실패·0timeout·0exception**이다. 축소 baseline/삭제 탐색과 새 환경 3회 반복을 랜덤 시퀀스 수에 넣지 않았다. 초기 기동 실패 폴더 7개는 완료 실행 합에서 제외했다. 그중 fatal.json이 없는 첫 시도도 있어, 없는 기록을 성공·완료로 추정하지 않는다.

폴더 준비 sync는 실행당 3회로 위 sync 수에 포함되며 전체 237회다. 앱 startup 자동 sync와 객체 확보용 sync는 계측 카운트에서 제외한다. 파일 시스템 장애 주입 sync 1회는 명령 원장 밖에서 호출해 controlled summary와 전체 sync 수에 포함했다. 각 그룹의 정확한 원장·시각·종료 기록은 [execution-totals](../evidence/execution-totals.json), [campaigns](../evidence/campaigns.json), [followup](../evidence/followup.json), [reduction](../evidence/reduction.json)에서 확인한다.

| 명령 | 기존 랜덤 3개 | 개선 랜덤 1개 | 전체 완료 실행 |
| --- | --- | --- | --- |
| CREATE_NOTE | 156 | 144 | 463 |
| RENAME_NOTE | 153 | 140 | 375 |
| UPDATE_NOTE | 276 | 252 | 689 |
| SYNC | 77 | 73 | 304 |
| DELETE_PERMANENTLY | 73 | 65 | 279 |
| SYNC_ALL | 64 | 50 | 255 |
| MOVE_TO_TRASH | 109 | 89 | 198 |
| RESTORE_NOTE | 78 | 68 | 146 |
| MODIFY_SAME_NOTE_ON_MULTIPLE_CLIENTS | 94 | 83 | 178 |
| RETRY_SYNC | 76 | 65 | 142 |

MULTI는 여러 실제 변경을 만들 수 있고 존재하지 않는 노트에 대한 축소 명령은 precondition-unavailable일 수 있다. 원장은 이를 상태 변경으로 세지 않는다. 기존 RETRY_SYNC 76회는 실패 없이 반복 sync한 것이므로 실패 복구 검증으로 해석하지 않았다.

## 발견 분류

| 분류 | 관찰과 개수 |
| --- | --- |
| EXPECTED BEHAVIOR | 기존 대표 신호 3개의 실제 원본 동작: clean 과거 본문 삭제/교체. 별도 controlled에서 clean 다운로드, dirty 충돌 보존, 경로 복구 후 sync 확인. |
| HARNESS ERROR | 기존 대표 신호 3개는 dirty 여부를 무시한 legacy 판정기 false positive. 초기 기동 실패 7개 폴더는 별도 집계. |
| INCONCLUSIVE | 검사한 대표 신호의 원인 미확정 0개. 아래 미검증 가설은 발견 건수에 포함하지 않음. |
| CONFIRMED DEFECT CANDIDATE | 0개. 신호가 재현됐다는 이유만으로 원본 버그로 보고하지 않음. |

같은 3개 신호에 원본 동작 분류와 판정기 오류 분류가 함께 붙는다. 두 열을 더해 6개 사건으로 세지 않는다. 기존 신호는 reason별 한 개로 중복 제거했으므로 전체 발생 횟수도 아니다. 개선 oracle 새 랜덤의 자동 신호 수는 0개, 최소 후보 dirty-v2 재생은 0개다. 이 수치는 이 seed와 검사 범위의 관찰이며 결함 부재의 증명은 아니다.

## TOP3

1. **기존 본문 손실 신호는 판정기 false positive였다.** pilot step 25에서 A의 과거 본문은 B/C 영구 삭제 뒤 제거됐다. scale-100 step 77과 campaign-1000 step 58에서 A는 이미 편집된 원격 본문을 내려받았다. 세 노트 모두 신호 전 A의 직접 편집은 없었다. 기존 snapshot에는 sync_items가 없으므로 최초 실행의 clean 판정은 전체 명령·전후 상태에 근거한다. 이후 runtime SELECT로 업로드 조건을 직접 검증했다. [pilot](../evidence/pilot-20.json), [scale](../evidence/scale-100.json), [campaign](../evidence/campaign-1000.json).
2. **dirty 수정본은 실제 충돌 경로에서 보존됐다.** scale-100의 B 수정본은 충돌 사본으로 남았다. controlled에서도 서로 다른 A/B 본문을 만들고 원본 timestampCandidate 중단점에서 비교식 true와 실제 스택을 관찰했으며 B의 dirty 본문이 충돌 사본에 남았다. REA의 특정 전방 관계 쿼리는 0개였고 이 런타임 증거를 대체하지 못했다. [REA 분석](rea-analysis.md).
3. **성공 뒤 재호출과 실패 복구를 구분했다.** controlled에서 격리된 target 디렉터리를 일반 파일로 대체해 경로가 비어 있거나 손상됐다는 원본 fail-safe로 실제 failed sync 1회를 만들고 finally에서 복구했다. 이후 RETRY_SYNC와 다른 클라이언트 전파가 성공했다. 실제 네트워크 전송 중 단절은 이번에도 검증하지 않았다.

## 최소 재현과 반복

원래 25개 명령 prefix를 7개로 줄였다. baseline/삭제 탐색 70회, 새 환경 반복 3회, 최종 legacy 신호 반복 결과 **3/3 성공, 0/3 실패**다. 총 trial 73회. 이것은 legacy 특정 본문 신호의 관찰된 명령 삭제 기준 1-minimal이며 전역 최단이나 원본 손실의 증명이 아니다. trial 오류는 0개다. 시각 차이와 전제조건이 재현성에 영향을 줄 수 있다.

| 순서 | 명령 | 클라이언트/순서 | 노트 키 |
| --- | --- | --- | --- |
| 1 | CREATE_NOTE | b | n3 |
| 2 | UPDATE_NOTE | b | n3 |
| 3 | SYNC | b |  |
| 4 | SYNC | c |  |
| 5 | DELETE_PERMANENTLY | c | n3 |
| 6 | SYNC_ALL | a→b→c |  |
| 7 | SYNC_ALL | a→b→c |  |

정확한 본문·대상 predicate는 [minimal.json](../evidence/minimal.json)에 있다. 이 fixture는 legacy-v1을 명시한다. 같은 후보를 dirty-v2로 새 환경 재생하면 신호는 0개다. 실행 명령은 [reproduction](reproduction.md)에 있다.

## PR #1과 차이 및 남은 범위

PR #1은 두 클라이언트의 고정 시나리오와 시각 경계값을 조사했다. 이번에는 세 클라이언트 상태 기계, seeded 생성기, 전체 페이지 조회, 압축 원시 기록, 명령별 체크포인트, 자동 축소와 새 환경 반복, 판정기 반례 검증, 새 seed, 파일 시스템 장애 후 retry를 추가했다. Java 동기화 엔진과 CLI 구현은 변경하지 않았다.

암호화·첨부/리소스·노트 기록·공유/읽기 전용·원격 서버 동시성·앱 강제 종료·전송 중 네트워크 단절·대용량 본문·동일 밀리초의 병렬 편집은 별도 검증하지 않았다. dirty-v2는 일반 비암호화 합성 노트에 대한 보존 신호 검사이며 완전한 보존 명세가 아니다. 충돌 사본은 로컬 전용일 수 있으므로 일반 노트의 canonical 수렴과 구분했다. 새 캠페인까지 일반 노트의 수렴·의미 상태 정지 신호는 없었다.

기동 오류의 직접 증거는 [startup-failures](../evidence/startup-failures.json)에 있다. Unknown flag는 p20v5의 runtime 사건에서 직접 확인했고 다른 실패의 이유를 일괄 추정하지 않았다. 원본 전체 설치·원시 프로필·API 토큰·전체 로그·REA 원시 번들은 공개하지 않았다.
