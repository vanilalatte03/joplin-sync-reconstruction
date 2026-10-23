# Joplin Stateful Fuzzing 조사

공식 Windows Joplin Desktop **3.7.21**을 새 A/B/C 프로필로 실행해, 실제 노트 상태 변경과 동기화를 무작위로 조합했다. Java 재구축 엔진은 수정하지 않았다. PR #1의 고정된 두 클라이언트 충돌 실험을 세 클라이언트의 상태 의존 시퀀스, 자동 축소, 판정기 검증으로 확장한 탐색적 역공학 조사다.

기존 세 seed에서 **1,120개 상태 변경 / 1,156개 명령 / 기록된 sync 354 성공·0 실패**를 확인했다. 발견한 대표 신호 3개는 정상적인 과거 본문 교체·삭제를 손실로 판단한 **HARNESS ERROR**로 분류했다. 이 수치는 전체 신호 발생 횟수가 아니라 reason별로 중복 제거한 신호 수다. 후속 새 seed에서 1,002개 상태 변경·291회 sync를 추가했고 새 신호는 없었다. 랜덤 상태 변경은 합계 **2,122개**다. 첫 신호는 **7개 명령으로 축소해 새 환경 3회 모두 재현**했으며 개선 판정기는 이를 정상 삭제 전파로 구분했다. 확인된 원본 결함 후보는 0개다. 축소와 후속 실행 통계는 [findings](docs/findings.md)와 [증거](evidence/)에 별도로 기록한다.

- [방법과 oracle 범위](docs/methodology.md)
- [결과, TOP3, 분류와 한계](docs/findings.md)
- [재현 명령과 환경](docs/reproduction.md)
- [실제 REA 호출과 원인 조사](docs/rea-analysis.md)

저장된 증거만 검증하는 명령은 저장소 루트에서 실행한다. 이 검사는 Desktop을 새로 실행하지 않는다.

```powershell
node --test investigation/stateful-fuzzing/scripts/oracle.test.mjs
node investigation/stateful-fuzzing/scripts/verify.mjs
```

원시 프로필·API 토큰·원본 배포 코드·전체 로그는 Git에 포함하지 않는다. 이 폴더의 scripts는 조사용이며 제품 기능이 아니다. 상세 버전·해시·시각·통계는 2026-10-23 조사 당시의 역사 기록이다.
