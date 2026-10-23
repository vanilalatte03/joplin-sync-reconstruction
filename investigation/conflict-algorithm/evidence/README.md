# 증거 색인

각 사례의 `result.json`은 입력, 공통 기준 상태, 수정 직후, 첫/두 번째 동기화 전후, 최종 A/B/원격 상태, 해당 노트 중단점 기록을 포함한다. `.log`는 각 실제 동기화 구간의 원본 출력에서 공개 시 행 끝 공백/탭만 제거한 로그다. 변환 전후 SHA-256은 `publication-provenance.json`에 있다. 노트 스냅샷과 런타임 JSON은 이 정리를 위해 변경하지 않았다. API 토큰·사용자 프로필·DB·배포 바이너리·원본 전체 소스는 포함하지 않았다.

| 파일 | 내용 |
|---|---|
| results.json | 24개 사례의 결과와 추적 요약 |
| verification.json | 저장된 실제 관찰에 대한 27개 단언, 모두 통과 |
| runtime-traces.json | 실험 구간 중단점 100개; bootstrap 관찰은 제외 |
| artifact-provenance.json | 배포 번들/맵 해시 및 추출 모듈 범위 |
| runtime-identity.json | 실행 중 A/B의 번들 해시가 분석물과 일치 |
| breakpoint-locations.json | CDP 좌표, 대응 소스맵 위치 |
| code-witnesses.json | 최소한의 실제 생성 조건식과 주소 |
| rea-findings.json | REA 분석·조회 결과 및 한계 |
| rea-predicate-dataflow.json | 축소 조건 함수의 REA 조회 한계 |
| predicate-slice-provenance.json | 비실행 slice 변환 및 해시 |
| upstream-source-crosscheck.json | 실험 후 공식 태그 소스 검증, 직접 받은 파일 해시 |
| trashed-conflict-visibility.json | 휴지통 충돌 사본이 일반 conflict 선택기에서 제외됨 |
| engine-unchanged.json | 기존 엔진 기준 커밋 및 작업 트리 확인 |

실험 이름과 해석은 [전체 분석](../docs/conflict-algorithm.md)에 있다. REA의 원시 evidence bundle에는 로컬 절대 경로와 배포 코드가 포함되므로 공개용 결과에서는 요약만 제공했다. 이 디렉터리의 테스트 본문과 노트 ID는 모두 합성 데이터다.
