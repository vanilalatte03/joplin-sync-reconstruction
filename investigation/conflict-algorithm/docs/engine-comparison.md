# 기존 재구축 엔진과 Joplin의 차이

재구축 저장소의 기준은 `vanilalatte03/joplin-sync-reconstruction`, 커밋 `910f83d87ec67f44708d98fe9f555ec503dc2a20`이다. 이번 조사에서는 엔진을 수정하거나 새 기능을 추가하지 않았다. 원본 Joplin은 24개 실험으로 확인했고, 아래 재구축 비교는 기존 `src/main/java/lab/SyncEngine.java`의 apply 메서드 정적 검토다. 새 시나리오를 재구축 엔진에 다시 실행했다고 주장하지 않는다.

| 항목 | 원본 Joplin에서 확인 | 기존 엔진의 코드상 동작 |
|---|---|---|
| 충돌 기준 | 로컬 dirty 선정 후 원격 updated_time과 sync_time 비교, 이어 제목/본문 비교 | 서버 current.version과 요청 baseVersion이 다르면 409 |
| 수정 시각 | 로컬 대상 선정과 원격 변경 판정에 관여 | 충돌 판정에 시각 사용 안 함 |
| 동기화 순서 | 이번 순차 실험에서 먼저 업로드된 본문이 원본 | 같은 baseVersion 요청이면 먼저 적용된 요청이 버전을 올리고 후속 요청은 충돌 |
| 동일 제목·본문 | 후보가 noteConflict여도 사본 억제 | baseVersion이 오래됐으면 같은 내용이어도 충돌 |
| 데이터 보존 | 로컬 충돌 노트 복제 후 원격을 원본에 반영. 일부 삭제 순서에는 새 충돌 노트 없음 | conflicts에 incoming_payload와 canonical_payload 저장 |
| 삭제 | 휴지통(deleted_time)과 영구 삭제의 별도 경로 | deleted boolean tombstone을 일반 Mutation으로 처리 |
| 수정 후 stale 삭제 | 영구 삭제 B→A에서 업로드된 B 편집 제거, 새 사본 없음 | 삭제 Mutation도 버전이 다르면 충돌 저장, 현재 노트는 유지 |
| 충돌 표시 | 별도 로컬 노트, 휴지통 상태도 보존될 수 있음 | 서버 conflicts 조회, Joplin식 휴지통/충돌 폴더 없음 |
| 기준 상태 | sync_items 및 원격 항목, ConflictNoteState | 서버 정수 version과 순차 changes cursor |
| 재시도 | 이번 심층 조사에서는 네트워크 실패를 재검증하지 않음 | 기존 opId 저장으로 같은 요청 재실행 결과 반환 |

기존 엔진은 Joplin과 동일한 프로토콜/정책 구현이 아니다. 버전 기반 비교를 선택해 시각과 무관하게 충돌을 잡는 작은 학습용 시스템이다. 특히 같은 내용의 stale 요청 억제와 휴지통/영구 삭제 구분이 없으므로, 일반 수정 시나리오의 겉보기 결과가 비슷해도 이번 경계 조건에서는 다르다.

원본과 정책을 맞추는 수정은 하지 않았다. 이번 목적은 차이를 감추거나 기능을 추가하는 것이 아니라 그 차이가 어느 조건에서 드러나는지 확인하는 것이다. [엔진 불변 확인](../evidence/engine-unchanged.json).
