# 역공학 과정과 근거

## 범위와 증거 구분

실험일: 2026-10-22, Asia/Seoul. JSON의 `observedAt`은 UTC ISO 8601이다. 대상은 공식 Windows x64 Joplin Desktop **3.7.21**, 분석 도구는 REA **6.7.0**이다.

다음 세 구분을 모든 결론에 적용했다.

| 구분 | 인정하는 근거 | 인정하지 않는 결론 |
|---|---|---|
| 직접 관찰 | 실행 API 응답, 생성 파일, 실행 로그, 디버거 이벤트·커버리지 | 관찰하지 않은 입력·실행 순서까지의 일반화 |
| 정적 분석 및 추론 | 배포 ASAR, 소스맵 위치, REA AST·관계 후보 | 실제 호출, 동적 분기, 완전한 호출 그래프 |
| 미확인 가설 | 다음 실험으로 검증할 설명 | 구현 사실로 단정 |

## 환경 준비

[REA 공식 README](https://github.com/morluto/rea/blob/main/README.md), [설치 문서](https://github.com/morluto/rea/blob/main/docs/installation.md), 배포 패키지의 `reverse-engineer-anything` 스킬을 확인했다. JavaScript/Electron 정적 분석에는 네이티브 디컴파일러가 필요하지 않아 Ghidra·Hopper·IDA를 설치하지 않았다.

설치되어 있던 호스트 Node.js 24.14.0과 Java 21.0.9를 사용했다. 원본 Electron 런타임은 실제 `process.versions` 조회에서 Electron 42.3.0 / Node.js 24.15.0이었다. 호스트 Node 24.14.0은 REA SQLite 분석의 24.15 이상 조건에는 미달하므로 REA SQLite 도구로 DB를 조사했다고 주장하지 않는다.

공식 GitHub [v3.7.21 릴리스](https://github.com/laurent22/joplin/releases/tag/v3.7.21)의 `JoplinPortable.exe`를 받아 작업 폴더에 압축 해제했다. 설치 마법사를 실행하지 않았다.

| 항목 | 확인값 |
|---|---|
| 배포 파일 SHA-256 | `5cf5686d8a3e2c1195448d1a0324602a2ef9a0cf61a867b323571ca2f8dd7b33` |
| Windows 서명 | Valid, CN=Joplin, O=Joplin, L=Nancy, C=FR |
| app.asar SHA-256 | `9f793336c679ea3214542587ca42abc77e82184327e3f7677f22d47d8ae23506` |
| REA 연결 | MCP SDK stdio handshake 및 tools/list, 207 tools |
| Codex 등록 | 프로젝트 `.codex/config.toml`; `codex mcp get rea --json` 성공 |

`rea doctor --client codex --json`, `setup --client codex --dry-run --json`으로 전역 등록 계획도 확인했지만 적용하지 않았다. 사용자 전역 설정과 스킬 교체가 필요 없는 프로젝트 전용 등록을 선택했다. 이미 실행 중인 채팅에서는 직접 MCP SDK 클라이언트로 같은 REA 서버에 접속했다.

## 격리와 실행 문제

A: `work/runtime/profile-a`, B: `work/runtime-b/profile-b`. 각 프로세스에 별도 `USERPROFILE`, `HOME`, `APPDATA`, `LOCALAPPDATA`, Chromium user-data-dir를 지정했다. 공통 동기화 대상은 테스트 폴더 `work/runtime/sync-target`이다. 디버깅 포트는 A=9231, B=9233이다. 이는 같은 OS 계정의 경로 격리이며 VM이나 보안 샌드박스가 아니다.

직접 관찰한 초기 문제:

1. `--profile`만으로는 메인 프로세스 IPC 키 경로가 분리되지 않았다. 원래 사용자 홈의 존재하지 않는 `.config/joplin-desktop/ipc_secret_key.txt` 생성 시도가 ENOENT로 실패했다. 원래 경로를 만들거나 수정하지 않고 자식 프로세스 홈을 분리했다.
2. `--remote-debugging-address=127.0.0.1`을 전달하자 Joplin 자체 플래그 검사가 `Unknown flag`를 보고했다. 배포 번들의 허용 플래그 구문을 정적으로 확인하고 지원하는 `--remote-debugging-port`와 `--user-data-dir`만 사용했다.
3. 메인 Electron 페이지 외에 플러그인의 숨겨진 페이지가 CDP에 나타났다. 단순히 첫 페이지를 고르면 빈 플러그인 문서를 관찰하게 되므로 `/app.asar/index.html`을 정확하게 선택했다.

실험 데이터는 공개 [Joplin Data API](https://joplinapp.org/help/api/references/rest_api/)로 입력했다. 테스트 인스턴스에서만 Web Clipper를 켜고 프로필별 토큰을 로컬 `work/`에 저장했다. 토큰을 프로젝트 소스나 결과 문서에 포함하지 않는다. API는 노트 입출력에만 사용했고, 동기화는 실제 Joplin Electron 메뉴 `synchronize`를 실행했다. DB 직접 조작으로 동기화 상태를 위조하지 않았다.

## 가설과 실험

### E01 — 생성 후 동기화

가설: 로컬 노트를 생성해 동기화하면 대상 디렉터리에 해당 노트의 표현이 생긴다.

입력: 제목 `REA-EXP-001`, 본문 `First controlled payload\n한글 UTF-8 검증\nversion-one`. 대상을 파일 시스템으로 지정하고 주기적 동기화를 비활성화했다. 동기화 전 디렉터리 목록을 보존한 뒤 메뉴를 실행했다.

**직접 관찰**: 노트 ID `f94a1174d0f7496b9ccd8fa86b1a2640`과 같은 이름의 `.md`가 생성됐다. 제목·본문과 `type_: 1`, `id`, `parent_id`, 생성·수정 시각 등이 들어 있었다. `info.json`, `.sync`, `locks`, 리소스 관련 디렉터리도 생겼다. 로그는 `createRemote: 2`를 보고했다. 노트북과 노트 두 항목이 입력됐다는 설명과 일치하지만 모든 메타데이터 파일의 내부 의미까지 단정하지 않는다.

근거: `evidence/experiment-01/{created-note.json,target-before.json,target-after.json,remote-note.md,result.json}`. 스크린샷은 당시 UI 상태의 보조 자료다. API로 생성된 노트가 목록에서 선택되지 않아 본문은 화면에 표시되지 않았고, 스크린샷만으로 본문 보존을 입증하지 않는다. 이후 B가 같은 ID와 본문을 받는 것으로 전파까지 확인했다.

### E02 — 수정 후 재동기화

가설: 동일 노트의 수정은 같은 원격 항목과 상대 클라이언트에 반영된다.

**직접 관찰**: A 본문을 `edited-online-v2\n한글 수정`으로 바꾼 뒤 A→B 순서로 동기화했다. B의 같은 ID 본문이 수정됐고 원격 파일명은 같았다. 근거: `original-scenarios/results.json`과 `1-*-sync.log`.

### E03 — 동기화하지 않은 상태의 로컬 수정

가설: 대상에 쓰지 않아도 로컬 편집을 유지할 수 있다.

**직접 관찰**: B를 `B-offline-edit`으로 수정하고 동기화를 호출하지 않았다. B API는 새 본문을 반환했고 원격 파일은 이전 본문이었다. 이는 동기화를 보류한 로컬 편집 실험이다. LAN 단절이나 OS 네트워크 격리는 하지 않았다.

### E04 — 두 클라이언트의 상이한 편집

가설: 동일한 동기화 기준에서 시작한 상이한 편집은 양쪽 데이터를 잃지 않는 충돌 처리를 유발한다.

**직접 관찰**: B의 미전송 편집을 둔 채 A를 `A-concurrent-edit`으로 바꾸고 A→B 순서로 동기화했다. B의 원래 ID 노트는 A 본문을 받았다. B에는 `B-offline-edit`을 가진 새 노트가 생겼으며 `is_conflict=1`, `conflict_original_id`는 원래 ID였다. 충돌 노트 ID는 `e86b43d1b87943e4a5558399f33fa620`이었다.

**미확인 가설**: 원격 변경의 존재와 로컬의 미전송 변경을 함께 판단하는 것으로 보인다. 이 관찰은 정수 버전 비교, 모든 경우의 last-writer-wins, 시각 기반 판정 중 어느 것을 사용한다는 증거가 아니다. 반대 동기화 순서, 동일 시각, 편집/삭제 충돌은 원본에서 미검증이다.

### E05 — 대상 접근 실패 후 복구

가설: 전송 실패 뒤 노트가 로컬에 남고 나중에 재동기화할 수 있다.

테스트 전용 대상 디렉터리를 같은 부모의 `sync-target-held`로 이동하고 원래 위치에 일반 파일을 놓아 경로 오류를 만들었다. `try/finally`에서 파일을 제거하고 디렉터리를 복구했다. 실제 사용자 데이터는 포함하지 않았다.

**직접 관찰**: Joplin은 대상이 비었거나 손상됐다는 fail-safe 경고와 함께 동기화를 중단했다. 복구 뒤 재동기화하자 실패 직전 생성한 `retained-on-failure` 본문이 원격 노트 파일에 기록됐다. 초기 스크립트가 덮어쓴 실패 로그는 2026-10-23 검토에서 로컬 전체 로그의 2026-10-22 23:40:50 KST 구간으로 복구했으며 `original-scenarios/destination-unavailable.log`로 공개한다.

**한계**: 동기화 시작 전에 대상이 접근 불가능했다. 전송 중 네트워크 단절이나 자동 재시도 간격을 관찰한 실험은 아니다. 원본의 이 조건은 미검증으로 남겼다. 재구축에서는 별도 실제 HTTP 소켓 단절 실험을 했다.

### E06 — 삭제와 전파

**직접 관찰**: A에서 기본 `DELETE /notes/:id` 후 A→B 동기화 시 B의 `deleted_time`은 양수였고 원격 `.md`는 남았다. 이어 `permanent=1`로 영구 삭제하고 동기화하자 원격 파일이 사라졌으며 B의 해당 노트 API 응답은 404였다.

명시적 원격 tombstone 파일의 존재, 삭제 이력 유지 기간, 오랫동안 오프라인인 클라이언트의 동작은 확인하지 않았다. 서버의 tombstone 설계는 재구축의 독자적 선택이다.

## REA 분석과 실행 추적

`inspect_electron_fuses`는 배포 실행 파일에서 Inspector 인자 허용 fuse가 enabled임을 보고했다. 이것만으로 Inspector가 실행됐다고 결론 내리지 않았으며 실제 CDP 연결로 별도 확인했다.

ASAR의 `main.bundle.js`와 `main-html.bundle.js`를 포함한 첫 정적 요청은 120초 제한으로 `provider_timeout`을 반환했다. 부분 Evidence를 보존했고, 성공으로 처리하지 않았다. 이후 `package.json`, preload, window event handler만 선택한 분석은 성공했다. 선택하지 않은 5,377개 파일의 관계는 미확인이다. 이 성공은 전체 동기화 호출 그래프의 복구를 의미하지 않는다.

동기화 검증에는 배포된 소스맵을 사용했다. 소스맵에는 원본 `sourcesContent`가 없었다. `sources`와 생성 위치 매핑으로 Synchronizer, 로컬 드라이버, 파일 대상에 대응하는 생성 코드 선언만 AST 경계로 추출했다. 이 코드는 실행하지 않았고 구현 디렉터리에 옮기지 않았다. 원래 bundle/map digest, 문자 범위, 추출물 digest는 `probe-provenance.json`에 있다. 추출물이 원본 TypeScript 코드라고 주장하지 않는다.

REA는 추출물 3개, 26,183 UTF-8 바이트를 파싱했고 parse failure는 0이었다. `trace_application_feature`로 모듈 관계를 조회했다. `trace_javascript_semantics`는 `unserialize` 속성 seed를 찾았지만 이 질의에서 호출자 관계는 0개였고 coverage는 partial이었다. 따라서 REA가 정확한 호출자를 입증했다는 결론을 내리지 않는다. 외부 번들 바인딩과 동적 메서드 선택은 해결되지 않은 부분으로 남긴다.

REA `list_javascript_runtime_targets`와 `observe_javascript_runtime`으로 실제 Electron 렌더러와 로드된 스크립트 이벤트도 관찰했다. 이 도구는 수동적 Inspector 관찰이며 메서드 호출 그래프를 제공하지 않는다.

추가로 직접 CDP precise coverage를 시작한 뒤 테스트 노트 생성·동기화를 실행했다. 배포 소스맵 위치와 매칭된 실행 함수에는 다음이 포함됐다.

| 배포 소스맵의 파일 | 관찰된 함수 예 |
|---|---|
| `lib/Synchronizer.ts` | `start`, `apiCall` |
| `lib/models/BaseItem.ts` | `serialize`, `serializeForSync`, `unserialize` |
| `lib/services/synchronizer/ItemUploader.ts` | `serializeAndUploadItem` |
| `lib/file-api-driver-local.ts` | `delta`, `get`, `put` |
| `lib/SyncTargetFilesystem.ts` | `syncPath_`, `isAuthenticated` |

이는 **그 관찰 구간에 실행됐다는 증거**다. 커버리지의 카운트는 async 재개와 내부 범위 계수의 영향을 받으므로 노트 개수나 사용자 동기화 횟수로 해석하지 않는다. 커버리지 수집은 최적화·타이밍에 영향을 줄 수 있으며 수동적 관찰이 아니다. 정확한 호출 순서나 인자 전달을 입증하지 않는다.

**정적 추론**: Synchronizer가 항목 업로더와 직렬화 계층을 사용하고, 파일 대상이 로컬 파일 API를 연결한다는 계층 구성이 정적 후보와 실행 목록에 부합한다. 전체 순서와 모든 분기는 미확인이다. 근거는 `rea-sync-*`, `rea-unserialize-callers.json`, `rea-runtime-observation.json`, `runtime-sync-coverage.json`이다.

## 재구축에 전달한 동작 계약

원본의 파일 포맷, 함수 구현, 복잡한 동기화 메타데이터를 옮기지 않았다. 다음 동작 계약만 재구축의 요구사항으로 삼았다.

1. 로컬 편집은 동기화 전에 보존한다.
2. 동기화 후 상대 클라이언트가 같은 논리 노트를 받는다.
3. 상이한 편집의 충돌에서 두 본문을 보존한다.
4. 삭제를 상대에게 전파한다.
5. 실패 후 재시도해도 데이터를 잃거나 중복 변경을 만들지 않는다.

명시적 정수 버전, 서버 충돌 테이블, 영구 tombstone, 작업 UUID는 독자적인 설계이며 원본 내부 구조의 재현이라는 주장은 하지 않는다.
