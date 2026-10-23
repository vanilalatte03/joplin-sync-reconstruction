# 서드파티 출처와 라이선스

## Joplin

- 공식 저장소: https://github.com/laurent22/joplin
- 분석 배포판: https://github.com/laurent22/joplin/releases/tag/v3.7.21
- 배포 manifest의 라이선스: AGPL-3.0-or-later
- 해당 태그의 라이선스 파일: https://github.com/laurent22/joplin/blob/v3.7.21/LICENSE
- 같은 태그의 전체 소스: https://github.com/laurent22/joplin/tree/v3.7.21
- 저작권과 라이선스 본문: `investigation/JOPLIN-LICENSE.txt`

Joplin 바이너리는 수정하지 않았으며 다운로드·전용 프로필 실행·디버깅·정적 분석만 수행했다. 배포 ASAR에서 추출한 전체 생성 모듈과 REA Evidence의 원본 표현은 로컬에만 보존한다. 후속 [충돌 조사 고지](investigation/conflict-algorithm/THIRD_PARTY_NOTICES.md)에 설명한 최소 조건식과 코드 주소만 근거로 인용했다. 이들은 독립 Java/Node 엔진의 소스 파일로 옮기지 않았다. Joplin 바이너리와 테스트 프로필도 포함하지 않으며 공식 URL에서 받는다.

## REA

- 공식 저장소: https://github.com/morluto/rea
- 분석 패키지: npm `rea-agents@6.7.0`
- 프로젝트 라이선스: MIT. 본문: `investigation/REA-LICENSE.txt`
- 의존 도구·자료는 각자 라이선스를 유지한다. 패키지의 `THIRD_PARTY_NOTICES.md`와 `licenses/`를 참조한다.

REA 소스코드는 수정하지 않았다. 패키지를 프로젝트 전용 도구 경로에 설치하고 공개 MCP 인터페이스를 사용했다. 조사 시점의 README 스냅샷과 원시 Evidence bundle은 로컬에 보존하며 공개 저장소에는 포함하지 않는다.

## 자체 구현의 라이선스 상태

자체 작성한 재구축 코드와 문서에 대한 별도 오픈소스 라이선스는 아직 선택하지 않았다. 공개 저장소라는 이유만으로 MIT 또는 AGPL을 전체 자체 코드에 부여한 것으로 해석하지 않는다. 위에 동봉한 서드파티 라이선스는 각 해당 자료에 적용된다.

## 실행 의존성

Spring Boot / Spring Framework / Apache Maven: Apache-2.0. H2: MPL-2.0 또는 EPL-1.0. Node.js와 npm 분석 도구는 각 배포 패키지의 라이선스 파일을 따른다. 고정 버전과 npm integrity는 `investigation/tooling/package-lock.json`, JVM 의존 버전은 `pom.xml` 및 Maven 해석 결과로 확인한다. 이 문서는 서드파티 코드의 라이선스를 변경하지 않는다.
