# 재현

## 준비된 환경 재사용

Windows PowerShell과 Node 24를 사용한다. 이 하네스는 Desktop 3.7.21의 특정 renderer 해시와 중단점에 고정돼 있다. 이미 준비된 공식 portable exe와 배포 번들에서 추출한 probe가 필요하다. 이번 조사에서는 기존 설치와 로컬 의존성만 재사용했다. REA/원본 앱의 새 설치나 설정 변경을 수행하지 않는다. 공식 배포물 취득·출처 확인·probe 추출 방법은 [기존 재현 문서](../../conflict-algorithm/docs/reproduction.md)에 있으며, 새 환경에서 전체 패키징 절차를 재검증했다는 뜻은 아니다.

아래 명령은 **저장소 루트**가 현재 디렉터리인 경우다. `$labBase`는 기존 준비 폴더로 바꾼다. 이 폴더에는 work/joplin-portable/Joplin.exe, work/tools/node_modules, work/conflict-static/{BaseItem,Synchronizer,syncDeleteStep}.probe.js가 있다. 저장소의 investigation/tooling 잠금 파일은 기존 도구 버전의 출처다. 토큰 값을 인자나 콘솔에 입력하지 않는다.

```powershell
$labBase='C:\path\to\existing-joplin-lab'
$exe=Join-Path $labBase 'work/joplin-portable/Joplin.exe'
$runBase=Join-Path (Get-Location) ('work/fuzz-replay-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $runBase | Out-Null
```

모든 실행은 빈 하위 디렉터리를 생성한다. 기존 실행 디렉터리는 거절한다. 포트가 점유되면 종료·정리 후 실행하며 다른 앱을 일괄 종료하지 않는다. 파일 시스템 fault 실험은 스크립트가 생성한 LAB_ONLY 환경에서만 실행한다.

## 랜덤 생성과 정확한 명령 재생

```powershell
# 새 seed + 개선된 dirty-v2 oracle; 실제 의미 상태 변경 1,000개 목표
node investigation/stateful-fuzzing/scripts/fuzz.mjs "$runBase/new-1000" "$exe" new-1000 2026102306 1000

# 기존 1,000개 시퀀스의 명령을 새 A/B/C에 재생(기본 dirty-v2)
node investigation/stateful-fuzzing/scripts/replay.mjs investigation/stateful-fuzzing/evidence/campaign-1000-sequence.json "$runBase/legacy-sequence-with-v2" "$exe"

# legacy false positive를 정확한 명령 순서와 명시적 legacy-v1로 재생
node investigation/stateful-fuzzing/scripts/replay.mjs investigation/stateful-fuzzing/evidence/minimal.json "$runBase/minimal-legacy" "$exe"
```

seed는 명령 생성의 난수를 고정한다. 시각·충돌 ID까지 고정하지 않는다. 보관한 sequence.json으로 재생할 때도 실제 시각의 차이로 경로가 달라질 수 있다. legacy-v1 신호가 다시 발생해도 이것만으로 원본 손실을 의미하지 않는다.

## 자동 축소와 후속 보완

```powershell
# 25개 명령 prefix에서 다시 축소하려면 pilot의 앞 25명령을 fixture로 만든다.
$pilot=Get-Content investigation/stateful-fuzzing/evidence/pilot-20-sequence.json -Encoding UTF8 -Raw | ConvertFrom-Json
$target=Get-Content investigation/stateful-fuzzing/evidence/minimal.json -Encoding UTF8 -Raw | ConvertFrom-Json
$fixture=@{sequenceId=$pilot.sequenceId;seed=$pilot.seed;commands=@($pilot.commands | Select-Object -First 25);target=$target.target;oracle='legacy-v1'}
$fixture | ConvertTo-Json -Depth 30 | Set-Content "$runBase/pilot-prefix.json" -Encoding UTF8
node investigation/stateful-fuzzing/scripts/minimize.mjs "$runBase/pilot-prefix.json" "$runBase/reduction-pilot" "$exe"

# reduction-pilot/result.json 생성 및 앱 종료 후 순차 실행한다.
# 최소 사례 dirty-v2 재생 -> clean 원격 교체/dirty 충돌/FS 오류와 retry -> 새 seed 1,000개
node investigation/stateful-fuzzing/scripts/supplement.mjs "$runBase" "$exe"

# 별도 REA stdio MCP 분석(기존 SDK/REA와 probe만 사용)
node investigation/stateful-fuzzing/scripts/rea.mjs "$labBase"
```

최초 축소는 변경 전 legacy 하네스를 이미 로드한 프로세스로 실행됐다. 현재 스크립트로 재실행하면 SELECT 계측이 추가되어 시각이 달라질 수 있다. 결과에 관찰된 최소성만 주장한다. supplement의 첫 실행은 2026102304 controlled, 2026102305 새 랜덤 seed를 사용했다. target 디렉터리를 잠시 held로 옮겨 그 자리에 일반 파일을 만들고, 원본 sync의 실제 실패 후 finally에서 원상복구한다. 그 다음 RETRY_SYNC의 성공과 B/C 전파를 검사한다. 이것은 파일 시스템 경로 장애이며 실제 네트워크 단절이 아니다.

## 기록 검증과 원시 자료

```powershell
node --test investigation/stateful-fuzzing/scripts/oracle.test.mjs
node investigation/stateful-fuzzing/scripts/verify.mjs
```

verify는 명령 원장과 상태 변경 합, sync 수, 종료 기록, 저장된 일반 노트 수렴, 축소/반복 결과, oracle 반례, REA 관계 0개 결과와 민감정보 패턴을 검사한다. 실제 Desktop을 재실행하지 않는다. CI도 이 범위만 자동화한다.

새 raw 실행은 summary.json, sequence.json, checkpoint.json, final-state.json, identity.json, cleanup.json, operations.jsonl.gz, sync-logs, 프로필을 만든다. 전체 원시 로그와 프로필은 로컬 work에만 유지한다. `collect.mjs LAB_BASE`와 `collect-followup.mjs FUZZ_ROOT`는 이 보고서 형식의 선별 증거를 재생성하는 조사자용 명령으로, 기존 evidence를 덮어쓰므로 역사 기록을 보관한 복사본에서만 사용한다. collect-followup은 supplement 완료 후 실행한다. 원시 해시는 파일 바이트의 SHA-256이며 원시 자료가 공개됐다는 뜻은 아니다.

테스트 앱은 원본 app.quit을 호출해 종료하고 자신이 생성한 PID만 확인한다. cleanup 기록의 exited를 검사하고 포트가 반환됐는지 확인한다. 실패한 실행도 삭제하지 않고 별도 보관한다.
