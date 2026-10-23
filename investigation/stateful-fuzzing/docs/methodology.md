# 방법

## 대상과 격리

공식 Desktop 3.7.21, Node 24.14.0, REA 6.7.0을 재사용했다. A/B/C 각각에 빈 profile, HOME, APPDATA, Chromium user-data-dir을 생성하고 격리된 파일 시스템 대상 하나를 공유했다. 개인 노트나 원격 계정은 사용하지 않았다. CDP 9251/9253/9255, Clipper 41184/41185/41186의 점유를 먼저 검사한다. 기존 실행 디렉터리는 덮어쓰지 않는다.

renderer SHA-256을 `7123656e59c7d2585d84176a793ab1f4b06c6db4c2981bd7c14d06104aa28a20`과 비교한다. 원본 start의 중단점에서 모델 객체를 확보하고 수정 후 자동 업로드 예약을 24시간 뒤로 미룬다. 원본 충돌 함수와 비교식을 대체하지 않는다. startup 자동 sync와 계측용 sync는 캠페인 sync 수에서 제외한다. 폴더 준비 sync 3회는 각 실행 통계에 포함한다.

업데이트 자동 확인을 끄고 CDP 연결 직후 테스트 Electron session의 HTTP/HTTPS 요청을 차단한다. 하네스는 localhost Clipper만 호출하고 파일 시스템으로 동기화한다. CDP 연결 전의 startup 구간이나 전체 OS 트래픽 차단을 검증한 것은 아니다. 원본 앱/REA 설치나 사용자 전역 설정을 변경하지 않았다.

## 상태 기계와 기록

CREATE_NOTE, UPDATE_NOTE, RENAME_NOTE, MOVE_TO_TRASH, RESTORE_NOTE, DELETE_PERMANENTLY, SYNC, SYNC_ALL, MODIFY_SAME_NOTE_ON_MULTIPLE_CLIENTS, RETRY_SYNC를 사용한다. 현재 상태에서 실행할 수 있는 명령을 선택한다. 복원은 Clipper PUT의 deleted_time=0 및 실험 폴더 parent_id로 수행한다.

의미 있는 상태 변경은 id, 제목, 본문, 휴지통 여부/시각, 충돌 상태의 전후 차이다. 생성 목표는 최소 변경 수이며 MULTI가 남은 목표를 넘길 수 있다. 새 1,000개 목표 캠페인은 실제 1,002개로 끝났고 이를 그대로 보고했다. 같은 내용을 다시 저장해 수정 시각만 바뀐 경우는 세지 않는다. MULTI 한 명령이 여러 클라이언트의 실제 변경을 만들므로 명령 수와 상태 변경 수가 다르다. `precondition-unavailable`은 축소 시 없는 노트를 편집하려는 경우이며 성공한 변경으로 세지 않는다.

모든 명령의 전후 API 상태, 원격 합성 노트, sync 기록을 operations.jsonl.gz에 보존한다. API notes 조회는 100개씩 끝까지 페이지를 순회한다. 25명령마다 checkpoint를 저장한다. sync는 원본 메뉴에서 시작하고 로그의 완료 문자열과 오류를 관찰한다. 이 카운트는 메뉴로 요청한 sync 단위이며 내부 파일별 재시도 횟수가 아니다.

생성기는 seeded PRNG를 사용하지만 현재 상태와 실제 시각의 영향을 받는다. 같은 seed만으로 완전히 같은 결과를 보장하지 않는다. 정확한 명령 재생에는 sequence.json을 쓴다. ID는 seed와 노트 키로 결정되지만 새 프로필의 폴더·충돌 사본 ID와 시각은 달라진다.

## 판정기

legacy-v1은 sync 전 본문이 원격에 없고 sync 후 어느 클라이언트의 일반/휴지통/충돌 노트에도 없으면 신호를 낸다. **이미 동기화된 과거 본문인지 검사하지 않았다.** 따라서 정상 원격 교체와 영구 삭제가 false positive를 만들었다. 기존 원시 결과의 INCONCLUSIVE 표시는 보존하고, 별도 adjudication에 HARNESS ERROR를 기록한다.

dirty-v2는 원본 sync_items를 SELECT로만 읽어 해당 대상의 sync_time, force_sync, sync_disabled를 저장한다. ordinary 합성 노트에서 행이 없거나, 비활성 행이 아니면서 updated_time > sync_time 또는 force_sync=1인 경우만 보존 검사의 대상이다. clean 본문의 교체는 검사하지 않는다. legacy fixture는 oracle을 명시해 과거 신호 재현을 유지한다.

이것도 완전한 데이터 보존 명세는 아니다. 제목만의 손실, 리소스, 암호화, 노트 기록, 의도된 영구 삭제와 dirty 수정의 모든 순서를 포괄하지 않는다. 원격 본문은 비암호화 합성 직렬화 문자열에서 찾는다. 같은 본문이 다른 ID에 있으면 보존으로 간주한다. 따라서 신호는 추가 조사가 필요한 관찰이지 자동 결함 확정이 아니다.

settle은 A/B/C 세 바퀴 후 C/B/A 한 바퀴를 더 실행한다. 일반 노트의 id/제목/본문/휴지통 상태 수렴과 의미 상태의 정지를 검사한다. 충돌 사본은 로컬 전용일 수 있어 클라이언트 간 동일 집합을 요구하지 않는다. 내부 메타데이터 전체의 동일성은 주장하지 않는다.

## 축소와 분류

ddmin은 원래 25명령 prefix에서 명령 덩어리를 지우며 legacy의 특정 본문 신호가 남는지 검사한다. 각 시도는 새 A/B/C 프로필을 사용한다. 최종 후보는 새 환경에서 세 번 반복한다. 단일 명령 삭제에 대한 1-minimal을 목표로 하며 전역 최단 시나리오 증명은 아니다. 시각 민감성과 실패한 하네스 시도는 최소성 주장에 한계를 준다.

분류는 EXPECTED BEHAVIOR(원본의 설명 가능한 동작), HARNESS ERROR(계측·판정·기동 오류), INCONCLUSIVE(원인 미확정), CONFIRMED DEFECT CANDIDATE(재현과 증거로 지지되는 잠재 결함)를 사용한다. 같은 관찰에서 원본 동작과 잘못된 판정기의 분류는 함께 기록할 수 있다. 두 분류 숫자를 더해 사건 수로 해석하지 않는다.
