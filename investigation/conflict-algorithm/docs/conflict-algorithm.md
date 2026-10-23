# Joplin 충돌 감지: 관찰과 조건식

## 조사 범위와 증거 수준

대상은 공식 Joplin Desktop 3.7.21 Windows 배포판, 파일 시스템 동기화 대상, 일반 비암호화 노트, 쓰기 가능한 대상이다. 2026-10-23에 새 A/B 프로필과 새 공유 디렉터리를 사용했다. 기존 설치·사용자 데이터와 REA 소스는 수정하지 않았다.

- **직접 관찰**: Clipper API 입력/조회, 실제 메뉴 동기화, 동기화 로그, 원본 renderer의 중단점 인자·스택, 결과 노트 및 동기화 메타데이터.
- **배포 코드 정적 분석**: 공식 ASAR의 번들 및 소스맵에서 추출한 모듈·조건식. 실행 중인 A/B 번들 SHA-256이 분석한 번들과 일치했다.
- **소스 교차검증**: 모든 실험 후 v3.7.21 태그 소스 5개를 직접 내려받아 함수·조건을 확인했다. 소스만 읽고 관찰로 간주하지 않았다.
- **미확인**: 다른 버전/대상, E2EE, 읽기 전용, 리소스 충돌, 실제 네트워크 단절, OS 시계 변경, 노트 기록 복원, 동시 파일 쓰기 경쟁. 이 문서의 순서 실험은 동기화가 하나씩 완료되는 순차 실행이다.

17개 통제 실험은 시각 경계값이나 파일 메타데이터를 조정했다. 7개 자연 시각 대조 실험에서는 노트 API만 사용하고 시각/원격 파일을 조작하지 않았다. **모든 실험은 자동 업로드 예약을 24시간 뒤로 미루고 수동 동기화**했다. 그러므로 완전히 무계측 GUI 사용과 동일하다고 주장하지 않는다. 충돌 함수는 교체하지 않았다.

## 1. 동기화 순서를 바꾸면 결과가 달라지는가?

**직접 관찰: 그렇다.** 공통 BASE에서 A_EDIT/B_EDIT를 각각 만든 뒤 A→B로 동기화하면 A_EDIT가 원본, B_EDIT가 B의 충돌 사본이었다. B→A면 반대였다. 자연 시각 대조 실험에서도 같았다.

| 사례 | 순서 | 최종 원본(A/B 일치) | 충돌 사본 |
|---|---|---|---|
| order-ab / natural-order-ab | A→B | A_EDIT | B에 B_EDIT |
| order-ba / natural-order-ba | B→A | B_EDIT | A에 A_EDIT |

충돌 사본은 `is_conflict=1`, `conflict_original_id=원래 ID`를 갖는 별도 노트다. 이 실험에서 원본처럼 상대 클라이언트로 전파되는 것으로 관찰되지 않았다. 일반적인 모든 경쟁 상황에 대한 “먼저 쓰면 무조건 승리” 규칙으로 확대하지 않는다.

증거: [order-ab](../evidence/order-ab/result.json), [order-ba](../evidence/order-ba/result.json), [natural-order-ab](../evidence/natural-order-ab/result.json), [natural-order-ba](../evidence/natural-order-ba/result.json).

## 2. 어떤 수정 시각이 영향을 주는가?

하나의 비교로 끝나지 않는다. 다음은 배포 코드에서 읽은 조건을 의미 있는 이름으로 정규화한 것이다. 실제 축약 변수·주소는 [code-witnesses.json](../evidence/code-witnesses.json)에 있다.

### 단계 A: 로컬 업로드 대상 선정

`BaseItem.itemsThatNeedSync`는 이미 동기화한 항목에 대해 다음 조건을 사용한다. 최초 동기화 항목은 별도 선택된다.

```text
sync_time < local.updated_time OR force_sync = 1
```

대상 일치, sync_disabled, 노트 is_conflict, encryption_applied 등의 필터도 있다. 모든 기준 실험의 force_sync는 0이었다. 따라서 로컬 수정 시각은 중요하지만, 원격과 직접 비교해 승자를 정하는 용도가 아니다.

### 단계 B: 원격과 충돌 후보 판정

`Synchronizer.start`는 원격 파일을 읽고 역직렬화한 뒤 다음을 비교한다.

```text
remoteContent.updated_time > local.sync_time
    ? NoteConflict
    : UpdateRemote
```

여기서 원격 시각은 파일 안에 직렬화된 `updated_time`이다. 이 분기에서 파일 시스템 mtime이나 `local.updated_time > remote.updated_time`을 사용하지 않는다. 다운로드 단계에는 `remote.updated_time > latestLocal.updated_time`이라는 별도 비교가 있으므로 서로 혼동하면 안 된다.

`sync_time`은 이 경로에서 단순한 “마지막 동기화가 끝난 실제 시계 시각”이 아니다. 업로드 후 `saveSyncTime(..., local.updated_time)`을 호출한다. 정적 분석상 다운로드 시각은 `remoteItemSyncTime(remote.updated_time)`을 거치며 미래 시각을 현재 시각으로 제한하는 경로가 있다. **미래 시각 제한 자체는 별도 동적 실험하지 않았다.**

### 경계값과 시각 역전 실험

T는 공통 BASE의 updated_time 및 sync_time이다. 정상 흐름과 구분하기 위해 경계값 실험에서 T를 약 한 시간 전으로 설정했다.

| 사례 | 통제 | 직접 관찰 |
|---|---|---|
| local-clock-ahead | B=T+30초, 원격 A=T+10초 | B가 더 최신이어도 B 충돌 사본, A 원본 |
| local-clock-behind | B=T+10초, 원격 A=T+30초 | 동일한 결과 |
| local-updated-equals-sync | B 본문 변경, B.updated_time=T | B 업로드 대상으로 잡히지 않음. A를 내려받고 사본 없음 |
| local-updated-before-sync | B.updated_time=T−1ms | 위와 같음 |
| remote-updated-equals-sync | 원격 파일의 updated_time=T | B UpdateRemote, B 원본, 사본 없음 |
| remote-updated-before-sync | 원격 updated_time=T−1ms | 위와 같음 |
| remote-updated-one-ms-after-sync | 원격 updated_time=T+1ms | B NoteConflict, B 사본, A 원본 |
| filesystem-mtime-old | 파일 mtime만 T보다 과거 | 본문 안 updated_time이 T보다 커서 여전히 충돌 |
| user-updated-time-inverted | user_updated_time의 대소 역전 | 충돌 결과는 그대로 |

로컬 메타데이터를 일부러 T 이하로 만든 결과는 정상 API 사용 중 수정 내용이 사라진다는 증거가 아니다. 정상 수정 API는 updated_time을 갱신한다. 파일 mtime도 델타 열거 등 다른 단계에서 쓰일 수 있으므로 “mtime이 전혀 무관하다”고 결론내리지 않는다.

중단점의 실제 수치(order-ab, B):

```text
sync_time             = 1792731151344
remote A.updated_time = 1792731161344
local B.updated_time  = 1792731171344
remote > sync_time    = true
local > remote        = true
action                = noteConflict
```

이 사례 하나에서도 “최신 로컬 시각이면 충돌을 피한다”는 가설이 반증된다. [실험별 기록](../evidence/results.json)에 경계값 입력과 원격 파일 스냅샷이 있다.

## 3. A 삭제와 B 오프라인 수정이 겹치면?

여기서 오프라인 수정은 B의 동기화를 실행하지 않은 채 로컬 수정한 상태다. 실제 네트워크 차단 실험은 아니다. 일반 DELETE는 휴지통 이동이며 `?permanent=1`과 구분했다.

| A의 동작 | 동기화 순서 | 최종 원본 | 별도 충돌 사본 |
|---|---|---|---|
| 휴지통 이동 | A→B | BASE가 휴지통에 있음 | B_OFFLINE_EDIT가 B의 살아 있는 충돌 노트 |
| 휴지통 이동 | B→A | B_OFFLINE_EDIT가 살아 있음 | A의 BASE 사본은 is_conflict=1이지만 **그 사본도 휴지통 상태** |
| 영구 삭제 | A→B | 양쪽 및 원격에서 원본 없음 | B_OFFLINE_EDIT가 B의 살아 있는 충돌 노트 |
| 영구 삭제 | B→A | 양쪽 및 원격에서 원본 없음 | 새 충돌 사본 없음 |

각 행은 통제 실험과 자연 시각 대조 실험에서 반복됐다. 근거는 `trash-delete-ab`, `trash-delete-ba`, `permanent-delete-ab`, `permanent-delete-ba` 및 대응하는 `natural-*` 기록이다.

휴지통 B→A에서는 `Note.createConflictNote`가 로컬 노트를 복제하며 deleted_time을 유지한다는 정적 분석과 결과가 일치했다. 원본 `Note.conflictedNotes()` getter에 그 사본이 포함되지 않는 것도 확인했다. 즉 일반 충돌 목록에 없다는 이유로 사본이 없다고 판단하면 틀린다. [선택기 관찰](../evidence/trashed-conflict-visibility.json).

영구 삭제 A→B에서는 원격 파일이 없지만 로컬 sync_time이 있으므로 `NoteConflict`로 진입했다. 원격 본문이 없어 `mustHandleConflict`는 호출하지 않았고, 로컬 편집을 사본으로 남긴 뒤 원본을 제거했다.

영구 삭제 B→A에서는 A의 `syncDeleteStep`이 먼저 업로드됐던 원격 B 수정본을 삭제했다. B의 후속 동기화 로그에 deleteLocal이 기록됐고 새 충돌 노트는 없었다. 정적 분석상 이 삭제 단계는 원격 수정 시각/버전의 stale 여부를 먼저 비교하지 않는다. **노트 기록이나 백업을 통한 복구 가능성을 조사하지 않았으므로 영구적인 복구 불가능 손실이라고 단정하지 않는다.**

## 4. 동일한 내용도 충돌하는가?

**충돌 후보와 사용자에게 남는 충돌 사본을 구분해야 한다.** `same-title-and-body` 및 `natural-identical`은 `NoteConflict` 후보로 들어갔지만 다음 단계가 false여서 사본이 0개였다. 본문만 같고 제목이 다르면 사본이 생성됐다.

`Note.mustHandleConflict(local, remote)`의 배포 코드 조건을 정규화하면 다음과 같다.

```javascript
return !!(local.encryption_cipher_text || remote.encryption_cipher_text
  || local.title !== remote.title || local.body !== remote.body);
```

이 함수는 먼저 두 노트 ID가 같은지 검사하고 다르면 예외를 던진다(정적 확인; 서로 다른 ID 입력은 실험하지 않음). 비암호화 노트에서 제목과 본문이 문자열로 동일하면 false다. 다른 메타데이터 전체의 동등성을 검사하는 함수가 아니다. E2EE 항목의 조건은 정적으로 확인했지만 암호화 상태의 실제 실행은 검증하지 않았다.

중단점에서는 실제 함수 진입과 인자를 기록하고 그 프레임에서 위 표현식의 값을 평가했다. 반환값을 가로챈 것은 아니다. 이후 원본 처리 결과에서 사본 개수와 최종 노트를 별도로 확인했다. [동일 내용 기록](../evidence/same-title-and-body/result.json), [제목 차이 기록](../evidence/same-body-different-title/result.json).

## 5. 실제 함수와 호출 흐름을 추적했는가?

확인한 주 경로는 다음과 같다. 일부 보조 단계의 연결은 정적 분석이고, 아래 두 호출 연결은 실제 중단점 스택으로도 확인했다.

```text
BaseItem.itemsThatNeedSync [정적: 로컬 변경 선택]
  → Synchronizer.start [동적: 원격 시각 비교]
  → handleConflictAction [동적 스택: start → 축약명 C1e.default]
  → Note.mustHandleConflict [동적 스택: C1e.default → mustHandleConflict]
  → Note.createConflictNote [정적 + 사본 생성 결과 관찰]
  → 원격 내용으로 원본 교체 / 원격이 없으면 원본 제거
```

`handleConflictAction` 호출 자체는 충돌의 증거가 아니다. updateRemote 등의 액션에서도 호출될 수 있으며, conflictActions가 아니면 일찍 반환한다. NoteConflict에서 최신 로컬 노트를 다시 읽고, 원격 내용이 있고 읽기 전용이 아닐 때 내용 비교를 수행한다. `ConflictNoteState`에는 base/remote 정보가 있지만, 위 충돌 판정이 세 방향 본문 병합을 하는 것은 아니다.

### REA가 확인한 범위와 실패한 범위

REA MCP의 `analyze_javascript_application`으로 배포 모듈 7개를 분석했다: 75,113 bytes, AST node 18,860개, parse 실패 0. 이어 `trace_application_feature`, `trace_javascript_semantics`를 실행하고 evidence bundle을 로컬 work 영역에 보존했다.

그러나 mustHandleConflict 자동 callers 조회는 ambiguous(2 seeds), createConflictNote는 1 seed를 찾았지만 둘 다 관계 0개였다. sync_time도 ambiguous였다. 원본 조건 함수 본문을 그대로 유지한 212-byte 비실행 slice에서도 body/title/ciphertext forward-influence가 ambiguous, 관계 0개였다. **REA 자동 호출/데이터 흐름 복구는 성공하지 못했다.** REA가 전체 알고리즘을 자동으로 밝혀냈다고 말할 수 없다.

대신 배포 소스맵과 AST로 정확한 생성 코드 위치를 찾고, CDP 조건부 중단점에서 실제 호출과 조건을 검증했다. source map에는 sourcesContent가 없었다. 보기 좋게 포맷한 파일은 읽기 보조이며 주소의 근거는 원래 번들이다. 생성 주소는 0부터 세는 UTF-16 code unit, CDP 행/열도 0부터, source-map 원본 행은 1부터다.

- [REA 분석 요약](../evidence/rea-findings.json), [작은 slice 한계](../evidence/rea-predicate-dataflow.json)
- [배포물 출처 및 해시](../evidence/artifact-provenance.json), [실행 번들 일치](../evidence/runtime-identity.json)
- [중단점 좌표](../evidence/breakpoint-locations.json), [100개 런타임 기록](../evidence/runtime-traces.json)
- [27개 검증 결과](../evidence/verification.json)

### 사후 소스 교차검증

공식 태그의 [Synchronizer.ts](https://github.com/laurent22/joplin/blob/v3.7.21/packages/lib/Synchronizer.ts), [Note.ts](https://github.com/laurent22/joplin/blob/v3.7.21/packages/lib/models/Note.ts), [handleConflictAction.ts](https://github.com/laurent22/joplin/blob/v3.7.21/packages/lib/services/synchronizer/utils/handleConflictAction.ts), BaseItem.ts, syncDeleteStep.ts를 실험 후 확인했다. 직접 받은 스냅샷의 해시·조건 위치는 [교차검증 기록](../evidence/upstream-source-crosscheck.json)에 있다. 웹 읽기 도구의 캐시 표시와 직접 다운로드의 행 번호가 달라 배포 번들 주소를 우선 근거로 삼았다. 태그 전체 빌드와 배포물의 동등성을 검증했다는 뜻은 아니다.

## 남은 가설과 조사 한계

- 실제 시계 오차/미래 시각이 동기화 기준에 미치는 전체 효과는 추가 실험이 필요하다. 여기서는 노트 메타데이터를 바꿨고 OS 시계는 바꾸지 않았다.
- 영구 삭제 후 기록을 이용해 편집 내용을 복원할 수 있는지 미확인이다.
- 파일 mtime은 업로드 충돌 조건의 직접 입력이 아니었지만 델타 탐색에 미치는 영향까지 배제하지 않았다.
- 암호문이 있을 때 비교 함수가 true가 되는 정적 조건은 확인했으나 E2EE 동기화 전후 전체 경로는 미확인이다.
- 세 번째 클라이언트, 실제 동시 동기화, 네트워크 대상의 서버 측 동시성은 이번 결과로 결론낼 수 없다.
