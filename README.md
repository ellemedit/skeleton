# Myo · 근육 모션 마네킹 렌더러

리깅된 **인체 3D 모델**이 스쿼트·벤치프레스·데드리프트를 수행하며, 동작하는 **근육을 피부 위 히트맵으로 강조**하는 렌더러. 운동기구(바벨·덤벨·벤치)도 함께 렌더링한다.

| 백 스쿼트 | 벤치프레스 | 데드리프트 | 덤벨 컬 |
| --- | --- | --- | --- |
| ![squat](docs/figures/render/squat.png) | ![bench](docs/figures/render/bench.png) | ![deadlift](docs/figures/render/deadlift.png) | ![curl](docs/figures/render/curl.png) |

<sub>실제 리깅 인체 메시 위에 EMG 근거 활성도를 히트맵(빨강=고활성)으로 입힌 결과. 이 환경엔 WebGL/브라우저가 없어 `npm run render`가 three.js 씬을 **CPU 소프트웨어 래스터라이저**로 렌더링했고, 브라우저 데모(`npm run dev`)는 동일 모델·포즈·근육 강조를 WebGL로 렌더링한다.</sub>

## 구조

근육 강조를 정밀히 제어하기 위해 **절차적 리그(pose engine)**와 **사실적 인체 메시(skin)**를 분리했다.

```
 EMG 기반 키프레임 (exercises/)         ← 운동 동작 저작
        │  Animator (motion/)           ← 보간
        ▼
 절차적 리그 Mannequin (anatomy/)        ← 검증된 관절 포즈의 "소스"
        │  Retargeter (human/)          ← 월드-델타 리타게팅
        ▼
 리깅 인체 GLB + 스키닝                  ← 사람다운 형상
        │  muscleGroups (human/)        ← 정점→근육군, 활성도→히트맵 발광
        ▼
 WebGL(데모) / CPU 래스터(헤드리스)      ← 렌더링
```

- **포즈 소스**: 프리미티브 리그(`Mannequin`)에 3대 운동을 키프레임으로 저작하고, `scripts/verify.ts`로 발 접지·스쿼트 깊이·바 높이 등 물리 정합을 수치 검증한다.
- **리타게팅**: 검증된 리그 포즈를 인체 GLB(Mixamo) 스켈레톤으로 옮긴다(다리·몸통은 월드-델타, 팔은 운동별 지정, 발 기준 접지).
- **근육 강조**: 인체 메시의 각 정점을 근육군으로 분류하고, 활성도를 피부 위 히트맵 발광으로 표시한다.

## 빠른 시작

```bash
npm install
npm run dev       # 브라우저 데모(WebGL). 인체 모델을 three.js 예제에서 런타임 로드
```

```bash
npm run render    # 헤드리스 3D 렌더(CPU) → docs/figures/render/*.png
npm run build     # 타입체크 + 번들
npm run verify    # 포즈 물리 정합 수치 검증(절차적 리그)
npm run snapshot  # 절차적 리그 2D 도식(SVG) → docs/figures/*.svg
```

데모는 운동 선택, 재생/일시정지/스크럽/속도, 근육 활성도 강조 토글, 실시간 활성도 범례를 제공한다.

## 모델 / 라이선스

- 인체 모델은 three.js 예제의 **Xbot**(Mixamo) GLB를 **런타임에 로드**한다(저장소에 바이너리를 재배포하지 않음). 출처: [three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf).
- 코드는 MIT. 모델 에셋의 라이선스는 원본(three.js / Mixamo)을 따른다.
- 근육 활성화 값은 EMG 문헌 **근거 기반 근사치**(교육/시각화용). 출처는 [docs/RESEARCH.md](docs/RESEARCH.md).

## 문서

- [리서치 · RESEARCH.md](docs/RESEARCH.md) — 렌더링 스택, 인체/해부 리소스 조사, 3대 운동 EMG 근거.
- [구현안 · IMPLEMENTATION.md](docs/IMPLEMENTATION.md) — 아키텍처, 리타게팅, 근육 매핑, 검증 방법.

## 한계 / 다음 단계

- 근육은 별도 메시가 아니라 피부 표면 히트맵(활성도 발광)으로 표현된다. 실제 개별 근육 메시(écorché)로 교체하려면 `muscleGroups`/`HumanFigure`의 강조 레이어만 바꾸면 된다.
- 팔 포즈는 운동별로 직접 저작했고(리그 바인드 차이), 벤치(누운 자세)는 근사치다. 다리·몸통은 리타게팅으로 정합.
- 데모는 모델을 런타임에 네트워크로 로드한다(오프라인 시 실패 메시지 표시).
