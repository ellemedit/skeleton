# 구현안 · Implementation

요구사항 → 설계 → 모듈 구조 → 데이터 모델 → 검증 순으로 정리한다.

## 1. 요구사항 매핑

| 요구사항 | 구현 |
| --- | --- |
| 사람 모형 마네킹 | `anatomy/rig.ts`의 데이터로 조립한 절차적 골격 (`Mannequin`) |
| 근육 부위 강조 | `Muscle`이 활성도→자발광 색(히트맵)·강도로 강조, HUD 범례에 실시간 표시 |
| 근육 움직임을 섬세하게 | 활성도→근육 메시 **팽창(bulge)**, 키프레임마다 부위별 활성도 보간 |
| 모션 렌더링 | `Animator`의 키프레임 보간(`smoothstep`, loop/pingpong/once) |
| 관절/근육 움직임 | 씬 그래프 계층(FK) + 루트 위치/회전 채널 |
| 바벨/덤벨 운동기구 | `equipment/`의 `Barbell`/`Dumbbell`/`Bench`, 손목에 동적 부착 |
| 스쿼트·벤치·데드리프트 샘플 | `exercises/`의 4종(+덤벨 컬 보너스) |

## 2. 좌표/규약

- 단위 m, **Y 업**, 정면 **+Z**, 마네킹의 **왼쪽 = +X**.
- 각 뼈(joint)는 그룹이며 원점이 근위(proximal) 관절. 사지 메시는 로컬 **-Y**로 뻗음 → 모든 회전 0 = **차렷 자세로 선** 중립 포즈.
- 포즈는 **절대 오일러 각(도)**, 미지정 관절은 `[0,0,0]`(중립).

## 3. 모듈 구조

```
src/
  core/
    Stage.ts        WebGL 렌더러·씬·조명·그림자·OrbitControls·렌더 루프
    colors.ts       클레이 톤, 히트맵(heatColor), 액센트 색
  anatomy/
    types.ts        Pose·Keyframe·MotionSample·Vec3 (three 비의존, 순수)
    rig.ts          BONES(골격)·MUSCLES(근육 부착)·MUSCLE_INFO(라벨/부위)
    Muscle.ts       근육 오버레이(활성도→색·강도·팽창)
    Mannequin.ts    골격+근육 조립, setPose/setActivations/apply
  motion/
    easing.ts       clamp01·lerp·smoothstep (순수)
    Animator.ts     키프레임 보간·루프 모드·재생 제어 (순수)
  equipment/
    materials.ts    STEEL·IRON·PAD
    Barbell.ts      바+플레이트, spanBetween(a,b)로 두 그립점에 정렬
    Dumbbell.ts     핸들+헤드, 관절에 부착(attachTo)
    Bench.ts        평벤치(패드+프레임+랙)
  exercises/
    types.ts        Exercise/ExerciseInstance 인터페이스
    squat.ts benchPress.ts deadlift.ts dumbbellCurl.ts
    index.ts        EXERCISES 배열
  index.ts          라이브러리 배럴(공개 API)
demo/
  index.html style.css main.ts   데모 앱(운동 선택·재생·근육 범례)
scripts/
  verify.ts         헤드리스 수치 검증(발 접지·바 위치·깊이 등)
  snapshot.ts       헤드리스 SVG/PNG 측면도 스냅샷
```

핵심 분리: **`anatomy/types.ts`, `motion/*`는 three.js에 의존하지 않는 순수 로직**이라 Node에서 검증·재사용 가능하고, 렌더링(`Mannequin`이 샘플을 씬에 적용)과 디커플링된다.

## 4. 데이터 모델

```ts
type EulerDeg = [x, y, z];               // 도 단위
type Pose = Record<jointName, EulerDeg>; // 희소(미지정=중립)
type MuscleActivation = Record<muscleId, number>; // 0..1, 좌우 공용 id

interface Keyframe {
  t: number;            // 0..1 정규화 시간
  label: string;        // 'bottom · depth' 등 단계 라벨
  pose: Pose;
  muscles: MuscleActivation;
  root?: Vec3;          // 전체 골반 루트 위치(스쿼트 하강/데드 힌지)
  rootRot?: Vec3;       // 전체 회전(벤치=누운 자세 -90°)
}
```

- **루트 채널(`root`/`rootRot`)**: 포즈(회전)만으로는 (a) 스쿼트/데드에서 골반이 내려가며 발이 바닥을 유지하는 것, (b) 벤치에서 몸 전체가 눕는 것을 표현 못 한다. 그래서 골반 루트의 위치/회전을 별도 보간 채널로 추가.
- **근육 id는 좌우 공용**(`quadriceps`): 저작이 간결하고, `Mannequin`이 인스턴스(`quadriceps_L/R`)에 동일 값을 적용.

## 5. 기구 부착(글루)

운동마다 `ExerciseInstance.update()`가 매 프레임 기구를 신체에 붙인다.

- **바벨**: `barbell.spanBetween(wristL_world, wristR_world)` — 두 손목 월드 좌표를 잇는 축으로 바를 정렬·중앙 배치. 포즈가 바뀌어도 바가 손을 따라간다(스쿼트=등 위 트랩, 데드=바닥, 벤치=가슴↔락아웃 모두 동일 메커니즘).
- **덤벨**: 손목 관절에 자식으로 부착(`attachTo`)되어 팔을 따라 움직임.
- **벤치**: 토르소 아래 정적 배치, 마네킹은 `rootRot=-90°`로 눕힘.

## 6. 검증 (WebGL 없이)

이 환경에서는 헤드리스 WebGL을 쓸 수 없어, three.js의 **씬 그래프 수학(렌더러 불요)**만으로 검증했다.

1. **수치 검증 — `npm run verify`** (`scripts/verify.ts`)
   - 각 운동의 키프레임을 적용하고 `updateMatrixWorld` 후 관절 월드 좌표를 읽어 불변식 확인:
     - 발바닥 접지(toe/heel y≈0), 스쿼트 깊이(hip<knee), 데드 바=플레이트 반경(0.225), 벤치 토르소 높이·바가 가슴↔머리 위 등.
   - 각도는 손으로 맞추기 어려워, 동일 엔진으로 **각도 솔버**를 돌려(예: 벤치 다리·팔, 데드 힌지) 목표(발 평평·바 높이)를 만족하는 값을 탐색해 확정했다.
2. **3D 렌더 — `npm run render`** (`scripts/render3d.ts`)
   - 이 환경엔 WebGL2(headless-gl은 WebGL1 전용)·브라우저가 없어, three.js 씬의 **실제 메시 삼각형을 CPU에서 직접 래스터라이즈**(카메라 투영 + z-buffer + 법선 음영 + 재질색/근육 자발광)해 `docs/figures/render/*.png`를 만든다. 실제 3D 지오메트리 출력.
3. **2D 도식 — `npm run snapshot`** (`scripts/snapshot.ts`)
   - 동일 데이터를 3/4 시점으로 투영한 경량 SVG(+PNG) 미리보기.

> 실제 앱(`npm run dev`)은 같은 씬을 WebGL로 렌더링한다. 브라우저에서의 최종 시각 QA는 별도 권장하나, 위 단계로 **물리 정합·근육 강조 매핑·3D 형상**을 모두 확인했다.

## 7. 확장 방법

- **새 운동**: `Exercise`를 만들어 키프레임(+근육 활성화)과 `setup()`(기구/카메라)만 정의하면 데모에 자동 등록.
- **새 근육/부위**: `rig.ts`의 `MUSCLE_DEFS`에 한 줄 추가(좌우/부착 뼈/오프셋/크기).
- **사실적 메시 교체**: `Muscle`의 메시 생성부만 외부 GLTF(예: Z-Anatomy)로 바꾸면 활성화 인터페이스는 그대로 재사용.
