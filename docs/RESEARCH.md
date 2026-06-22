# 리서치 · Research

> 목표: 사람 모형(마네킹)으로 **근육 움직임을 섬세하게 표현·강조**하고, **관절/근육 모션**과 **운동기구(바벨/덤벨)**를 렌더링하는 렌더러. 실사 사실성은 요구하지 않음.

이 문서는 구현에 앞서 조사한 (1) 렌더링 기술 스택, (2) 근육·해부 표현 방식과 가용 리소스, (3) 3대 운동의 근육 활성화 근거(EMG), (4) 기술 선택 근거를 정리한다.

---

## 1. 렌더링 기술 스택

| 후보 | 장점 | 단점 | 판단 |
| --- | --- | --- | --- |
| **Three.js** (WebGL) | 웹 표준, 씬 그래프(부모-자식 변환)가 골격 계층에 그대로 대응, `MeshStandardMaterial`의 `emissive`로 근육 강조 용이, 풍부한 생태계 | 번들 크기 | **채택** |
| Babylon.js | 강력한 기능, 내장 물리 | Three 대비 무거움, 목적 대비 과함 | 보류 |
| Unity/Unreal (WebGL export) | 고품질 | 빌드/배포 무겁고 "렌더러 라이브러리" 성격과 안 맞음 | 제외 |
| 순수 Canvas 2D | 단순 | 3D 관절/근육 볼륨 표현 한계 | 제외 |

Three.js의 `Object3D` 계층은 **관절(joint)을 그룹으로 중첩**하면 부모 회전이 자식에 자연히 전파되어 전방 운동학(FK)을 별도 수학 없이 구현할 수 있다. 근육 강조는 `emissive`(자발광) 색/강도로, 근수축은 메시 스케일로 표현 가능해 요구사항과 잘 맞는다.

- 버전: `three@0.184`, addons의 `OrbitControls`는 `three/addons/controls/OrbitControls.js`로 import. ([Three.js OrbitControls 문서](https://threejs.org/docs/pages/OrbitControls.html))
- 빌드/개발: Vite, 언어: TypeScript.

## 2. 근육·해부 표현 방식

### 2.1 외부 3D 해부 에셋 (참고)

사실적 근육 메시를 쓰려면 공개 데이터가 있다.

- **BodyParts3D** — 일본 Database Center for Life Science, 382개 부위 STL, **CC BY-SA**. ([미러 저장소](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D))
- **Z-Anatomy** — BodyParts3D 기반으로 정리한 오픈 3D 아틀라스(Blender 파일 제공), **CC BY-SA**. ([SimTK 프로젝트](https://simtk.org/projects/z-anatomy))
- **MakeHuman** — 파라메트릭 인체 생성(리깅 포함), CC0 에셋.

### 2.2 채택: 절차적(procedural) 마네킹

위 에셋은 사실적이지만 (a) 라이선스(CC BY-SA) 전파, (b) 대용량 바이너리, (c) 근육별 활성화 제어를 위한 리깅/세그멘테이션 작업이 필요하다. 본 과제는 **실사 불요 + 근육 부위 강조/모션이 핵심**이므로, 외부 의존 없이 완전히 제어 가능한 **프리미티브 기반 절차적 마네킹**을 채택한다.

- 사지: 캡슐(capsule), 몸통/골반/발/손: 박스, 머리: 구.
- 근육: 각 뼈에 부착된 타원체(ellipsoid) 오버레이. **활성도(0..1)** 가
  - 색(히트맵: teal→green→yellow→red) + 자발광 강도,
  - 짧은 축 방향 팽창(수축 bulge)
  으로 매핑되어 "섬세한 근육 움직임/강조"를 표현.

업그레이드 경로: 동일한 골격/활성화 인터페이스를 유지한 채, 추후 Z-Anatomy 메시를 근육 슬롯에 끼워 넣어 사실적 렌더링으로 교체 가능(설계상 분리됨).

## 3. 3대 운동의 근육 활성화 (EMG 근거)

근육 강조의 **정확도**를 위해 EMG 문헌의 주동근/협력근을 키프레임 활성화 값에 반영했다.

### 스쿼트 (Back Squat)
- 주동: **대퇴사두근**(슬관절 신전, 하강 깊을수록 증가), **대둔근**(고관절 신전, 깊이·발 위치 의존).
- 협력/안정: **척추기립근**(체간 안정, 전방 기울기 클수록 활성↑), **햄스트링/내전근**(고관절 안정).
([Squat EMG guide](https://inara.technology/blog/squat-emg-guide), [Muscle activation patterns during different squat techniques](https://www.researchgate.net/publication/291817154_Muscle_Activation_Patterns_During_Different_Squat_Techniques), [Barbell placement & activation (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7739732/))

### 벤치프레스 (Bench Press)
- 주동: **대흉근**(평벤치에서 중·하부 활성 최대), **전면 삼각근**, **삼두근**(경사·그립에 비교적 무관, 좁은 그립·락아웃에서↑).
([Five bench inclinations EMG (MDPI)](https://www.mdpi.com/1660-4601/17/19/7339), [동 논문 PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7579505/))

### 데드리프트 (Conventional Deadlift)
- 주동: **척추기립근**, **대둔근**, **햄스트링**(비교적 높은 활성), **대퇴사두근**(초기 구간).
- 안정/파지: **승모근·광배근**(상부 등 안정), **전완근**(그립).
([Electromyographic activity in deadlift and its variants — systematic review (PLOS One)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0229507), [Deadlift muscle activation — EMG](https://inara.technology/exercises/deadlift-muscle-activation))

> 본 렌더러의 활성화 값은 **교육·시각화용 근사치**이며 특정 피험자의 정량 EMG가 아니다.

## 4. 모션 표현 방식

- **전방 운동학(FK) + 키프레임 보간**: 각 운동을 "정점(top)–바닥(bottom)" 2~N개의 키프레임(관절 각도 + 근육 활성화 + 루트 위치/회전)으로 저작하고, `smoothstep` 이징으로 보간.
- **핑퐁(pingpong) 루프**로 하강(eccentric)–상승(concentric) 1렙을 자연스럽게 반복.
- 역운동학(IK)은 저작된 운동에는 불필요(결정적이고 튜닝 용이)하여 제외. 대신 **수치 검증 + 각도 솔버**(Node, WebGL 불요)로 발 접지/바 위치 등 물리 정합을 맞춤(§ IMPLEMENTATION 참고).

## 5. 결론

Three.js의 씬 그래프로 절차적 마네킹을 만들고, 뼈에 부착한 근육 타원체의 자발광·팽창으로 활성화를 표현하며, EMG 기반 키프레임으로 3대 운동을 구동한다. 외부 해부 에셋 없이도 요구사항(근육 강조·관절/근육 모션·기구 렌더링)을 충족하고, 추후 사실적 메시로 교체할 수 있는 분리된 구조를 택했다.
