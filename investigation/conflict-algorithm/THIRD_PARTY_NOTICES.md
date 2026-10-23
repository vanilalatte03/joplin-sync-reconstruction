# 출처와 배포 범위

- 분석 대상: [Joplin 공식 v3.7.21](https://github.com/laurent22/joplin/releases/tag/v3.7.21). 공식 배포 아카이브에서 얻은 조건식 일부를 연구 근거로 인용했다. 전체 번들, 추출 모듈, 원본 소스, 바이너리는 이 결과물에 재배포하지 않는다. Joplin 자체는 해당 배포물과 저장소의 라이선스 조건을 따른다.
- 분석 도구: [REA](https://github.com/morluto/rea), npm rea-agents 6.7.0. 도구 소스를 수정하지 않았다. REA 자동 분석의 미해결 항목을 성공으로 표시하지 않았다.
- `scripts/`는 이 조사를 위해 작성한 실험·검증 도구다. 원본의 충돌 알고리즘을 새 동기화 엔진으로 이식하는 코드는 포함하지 않는다. 실행하면 원본 배포물의 비실행 분석용 조각을 로컬 work 영역에 생성한다.
- 기본 동작 설명 교차확인: [공식 충돌 도움말](https://joplinapp.org/help/apps/conflict/), [공식 동기화 설계](https://joplinapp.org/help/dev/spec/sync/). 구체적인 시각 경계와 삭제 순서는 이 조사에서 관찰한 결과이며 문서 일반론으로 대체하지 않았다.
