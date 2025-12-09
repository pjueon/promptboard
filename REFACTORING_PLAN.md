# PromptBoard 리펙토링 계획

## 목표
- 긴 파일들을 작고 관리하기 쉬운 모듈로 분할
- 코드 중복 제거
- `packages/core-whiteboard`로 화이트보드 기능을 분리하여 재사용 가능한 모듈 구축
- VS Code 확장 등 다른 앱에서도 재활용 가능한 구조 확립

---

## 현재 상태 분석

### 1. 파일 크기 문제

| 파일 | 줄 수 | 주요 문제점 |
|------|-------|------------|
| `WhiteboardCanvas.vue` | 1852 | 모든 화이트보드 로직이 하나의 파일에 집중 |
| `AppSidebar.vue` | 546 | 설정, UI 관련 로직이 혼재 |
| `AppToolbar.vue` | 307 | 툴바 UI와 상태 관리가 혼재 |
| `autoSaveStore.ts` | 209 | 자동 저장 로직 |
| `EditableLine.ts` | 133 | Fabric.js 확장 |

### 2. 코드 중복 문제

#### WhiteboardCanvas.vue 내 그리기 툴들
7개의 `setup*Tool()` 함수들이 모두 유사한 패턴을 따름:

```
- setupLineTool()        (175:275)
- setupArrowTool()       (318:494)
- setupRectangleTool()   (499:597)
- setupCircleTool()      (602:705)
- setupTextTool()        (710:746)
- setupEraserTool()      (751:769)
- setupRegionSelectTool()(774:862)
```

**공통 패턴:**
- 각 툴은 `mouseDownHandler`, `mouseMoveHandler`, `mouseUpHandler` 정의
- `startX`, `startY`, `isDrawing` 상태 관리 중복
- Shift 키 제약 로직 중복 (line, arrow, rectangle, circle)
- 객체 선택 및 스냅샷 저장 로직 중복
- `cleanupShapeEvents()` 호출 중복

#### 중복되는 로직들
1. **마우스 이벤트 핸들링**: 모든 그리기 툴에서 반복
2. **Shift 키 제약**: 4개 툴에서 유사한 각도/비율 제약 로직
3. **객체 후처리**: 선택, 좌표 업데이트, 스냅샷 저장이 반복
4. **Arrow 특수 처리**: 화살표와 삼각형 연결 로직이 복잡하고 분산됨

### 3. 아키텍처 문제

**현재 구조:**
```
apps/gui/
  src/
    renderer/
      components/     # Vue 컴포넌트 + 모든 비즈니스 로직
      stores/         # Pinia 스토어
      fabric-ext/     # Fabric.js 확장
```

**문제점:**
- Vue와 화이트보드 로직이 강하게 결합
- 다른 프레임워크/앱에서 재사용 불가능
- 테스트하기 어려운 구조

---

## 리펙토링 계획

### Phase 1: 그리기 툴 추상화 및 중복 제거 (진행중)

**목표**: WhiteboardCanvas.vue에서 그리기 툴 로직 분리

#### 1.1 베이스 Tool 클래스 생성 (완료)
```
packages/core-whiteboard/
  src/
    tools/
      base/
        Tool.ts                    # 추상 베이스 클래스
        ShapeTool.ts               # 도형 그리기용 베이스 클래스
        ConstrainedShapeTool.ts    # Shift 제약 지원 도형용
```

**구현 내용:**
- `Tool`: 모든 툴의 베이스 (mouseDown, mouseMove, mouseUp 추상 메서드)
- `ShapeTool`: 도형 그리기 공통 로직 (startX, startY, isDrawing 관리)
- `ConstrainedShapeTool`: Shift 키 제약 로직 공통화

#### 1.2 개별 툴 클래스 구현 (진행중)
```
packages/core-whiteboard/
  src/
    tools/
      LineTool.ts          ✅
      ArrowTool.ts         ✅
      RectangleTool.ts     ✅
      EllipseTool.ts       ✅
      PenTool.ts           ✅
      EraserTool.ts        ✅
      SelectTool.ts        ✅
      TextTool.ts          ⏳
```

**효과:**
- WhiteboardCanvas.vue 크기 674줄 감소 (1990줄 → 1316줄, 33.9% 감소) ✅
- 각 툴을 독립적으로 테스트 가능 ✅
- 새로운 툴 추가가 용이 ✅

### Phase 2: Canvas 관리자 분리 (진행중)

**목표**: Fabric.js Canvas 관리 로직을 프레임워크 독립적으로 분리

```
packages/core-whiteboard/
  src/
    core/
      CanvasManager.ts      # Canvas 생성, 초기화, 관리
      ToolManager.ts        # 툴 전환, 이벤트 바인딩
      HistoryManager.ts     # Undo/Redo 로직
      StateManager.ts       # Canvas 상태 저장/복원
```

**구현 내용:**
- `CanvasManager`: Fabric.js 캔버스 초기화, 리사이징, 기본 설정
- `ToolManager`: 툴 등록, 활성화, 이벤트 연결
- `HistoryManager`: 스냅샷 관리 (현재 historyStore 로직)
- `StateManager`: 직렬화/역직렬화 (JSON 변환, 자동 저장)

**효과:**
- WhiteboardCanvas.vue는 Vue 컴포넌트로만 남음 (200-300줄 목표)
- 핵심 로직은 프레임워크 독립적

### Phase 3: Fabric.js 확장 모듈화 (진행중)

**목표**: 커스텀 Fabric 객체들을 체계적으로 관리

```
packages/core-whiteboard/
  src/
    fabric-objects/
      EditableLine.ts
      ArrowObject.ts         # Arrow와 Triangle을 하나의 그룹으로
      index.ts               # 모든 커스텀 객체 등록
```

**구현 내용:**
- `ArrowObject`: 현재 Line + Triangle 조합을 하나의 복합 객체로
- 화살표 업데이트 로직을 ArrowObject 내부로 캡슐화
- 모든 커스텀 객체의 직렬화/역직렬화 로직 통합

**효과:**
- 화살표 관리 로직 단순화 (현재 200줄 이상 → 50줄 이하)
- 새로운 복합 객체 추가 용이

### Phase 4: 이벤트 핸들러 모듈화

**목표**: 키보드 단축키, 클립보드, 드래그앤드롭 로직 분리

```
packages/core-whiteboard/
  src/
    handlers/
      KeyboardHandler.ts     # 키보드 단축키
      ClipboardHandler.ts    # 복사/붙여넣기
      DragDropHandler.ts     # 드래그 앤 드롭
      index.ts
```

**효과:**
- WhiteboardCanvas.vue에서 약 300줄 감소
- 각 핸들러를 독립적으로 테스트 가능

### Phase 5: packages 구조 설계

**최종 구조:**
```
packages/
  core-whiteboard/          # 핵심 화이트보드 엔진 (프레임워크 독립적)
    src/
      core/                 # 핵심 관리자들
        CanvasManager.ts
        ToolManager.ts
        HistoryManager.ts
        StateManager.ts
      tools/                # 그리기 툴들
        base/
        LineTool.ts
        ArrowTool.ts
        ...
      fabric-objects/       # Fabric.js 확장 객체들
      handlers/             # 이벤트 핸들러들
      types/                # TypeScript 타입 정의
      index.ts              # Public API
    package.json
    tsconfig.json

  vue-whiteboard/           # Vue 전용 래퍼 (선택적)
    src/
      composables/
        useWhiteboard.ts    # Vue Composition API
      components/
        WhiteboardCanvas.vue  # 얇은 Vue 컴포넌트 래퍼
      stores/               # Pinia 스토어 (UI 상태만)
    package.json

  vscode-whiteboard/        # (미래) VS Code 확장용
    ...
```

**의존성:**
- `core-whiteboard`: fabric.js만 의존 (프레임워크 무관)
- `vue-whiteboard`: core-whiteboard + vue + pinia
- `apps/gui`: vue-whiteboard 사용

### Phase 6: Store 리펙토링

**목표**: Pinia store를 UI 상태 관리로 한정

**현재 stores:**
- `toolbarStore`: 툴 선택, 색상, 두께 → **유지** (UI 상태)
- `historyStore`: Undo/Redo → **core-whiteboard로 이동** (HistoryManager)
- `autoSaveStore`: 자동 저장 → **core-whiteboard로 이동** (StateManager)
- `themeStore`: 테마 → **유지** (UI 상태)
- `localeStore`: 언어 → **유지** (UI 상태)
- `toastStore`: 알림 → **유지** (UI 상태)

**리펙토링 후:**
```
apps/gui/src/renderer/stores/
  uiStore.ts         # toolbarStore + themeStore 통합
  localeStore.ts     # 유지
  toastStore.ts      # 유지
```

---

## 구현 순서 (단계별 PR)

### PR 1: 기반 준비 (완료)
- [x] `packages/core-whiteboard` 패키지 생성
- [x] TypeScript, Fabric.js 설정
- [x] 타입 정의 작성 (`types/`)

### PR 2: 툴 시스템 구축 (완료)
- [x] `Tool`, `ShapeTool` 베이스 클래스
- [x] `ConstrainedShapeTool` 베이스 클래스
- [x] `LineTool` 구현 및 단위 테스트
- [x] `ToolManager` 기본 구현

### PR 3: 나머지 툴 이식 (진행중)
- [x] `RectangleTool`, `EllipseTool` 구현 및 단위 테스트
- [x] LineTool, RectangleTool, EllipseTool을 WhiteboardCanvas.vue에 통합
- [x] 기존 setupLineTool, setupRectangleTool, setupCircleTool 함수 제거
- [x] 버그 수정 (fill 투명, 선택 해제, canvas.selection, ellipse positioning)
- [x] `ArrowTool` 구현 및 단위 테스트 (6 tests)
- [x] ArrowTool을 WhiteboardCanvas.vue에 통합
- [x] 기존 setupArrowTool, updateArrowHead 함수 제거 (210줄 감소)
- [x] `EraserTool` 구현 및 단위 테스트 (13 tests)
- [x] EraserTool을 WhiteboardCanvas.vue에 통합
- [x] 기존 setupEraserTool, getEraserCursor 함수 제거 (33줄 감소)
- [x] `SelectTool` 구현 및 단위 테스트 (14 tests)
- [x] SelectTool을 WhiteboardCanvas.vue에 통합
- [x] 기존 setupRegionSelectTool 함수 제거 (88줄 감소)
- [x] `PenTool` 구현 및 단위 테스트 (12 tests)
- [x] PenTool을 WhiteboardCanvas.vue에 통합
- [x] 기존 inline pen tool 코드를 PenTool로 대체
- [ ] `TextTool` 구현
- [ ] 통합 테스트

**WhiteboardCanvas.vue 크기: 1990줄 → 1316줄 (674줄 감소, 33.9% 감소)**

### PR 4: Canvas 관리자 구축 (진행중)
- [x] `CanvasManager` 구현
- [ ] `HistoryManager` 구현 (historyStore 로직 이식)
- [ ] `StateManager` 구현 (autoSaveStore 로직 이식)

### PR 5: 이벤트 핸들러 분리
- [ ] `KeyboardHandler` 구현
- [ ] `ClipboardHandler` 구현
- [ ] `DragDropHandler` 구현

### PR 6: Fabric 확장 개선 (진행중)
- [ ] `ArrowObject` 통합 객체 구현
- [x] `EditableLine` 이식 및 등록
- [ ] 커스텀 객체 직렬화 개선

### PR 7: Vue 래퍼 구축
- [ ] `packages/vue-whiteboard` 생성
- [ ] `useWhiteboard` composable
- [ ] 새로운 `WhiteboardCanvas.vue` (얇은 래퍼)

### PR 8: GUI 앱 마이그레이션
- [ ] `apps/gui`에서 `vue-whiteboard` 사용하도록 전환
- [ ] Store 리펙토링
- [ ] 기존 코드 제거
- [ ] E2E 테스트 업데이트

### PR 9: 최종 정리
- [ ] 문서 작성 (`packages/core-whiteboard/README.md`)
- [ ] API 문서 생성
- [ ] 사용 예제 작성
- [ ] 성능 최적화

---

## 예상 효과

### 코드 품질
- **WhiteboardCanvas.vue**: 1990줄 → 1316줄 (현재 33.9% 감소, 최종 목표 85% 감소)
- **중복 코드**: 약 40% 감소 (진행중)
- **테스트 커버리지**:
  - core-whiteboard: 65 tests (LineTool, ArrowTool, RectangleTool, EllipseTool, PenTool, EraserTool, SelectTool)
  - 최종 목표: 80%+

### 재사용성
- 화이트보드 엔진을 다른 프레임워크에서 사용 가능
- VS Code 확장, React 앱 등으로 쉽게 이식
- 각 툴을 독립적으로 활성화/비활성화 가능

### 유지보수성
- 새로운 툴 추가 시간: 4-6시간 → 1-2시간
- 버그 수정 시간: 평균 50% 감소 예상
- 코드 리뷰 시간: 평균 60% 감소 예상

### 성능
- 초기 번들 크기: 약간 증가 (모듈화 오버헤드)
- 런타임 성능: 유사 (최적화 여지 있음)
- 트리 쉐이킹: 사용하지 않는 툴 제거 가능

---

## 설계 원칙 및 이슈

### 1. 객체 선택 상태 관리 정책

**설계 방침**: "선택 상태가 될 수 있는 객체는 마지막에 수정한 객체 1개 뿐이다"

**배경**:
- 캔버스 위에 selectable한 객체가 여러 개 있으면 그리기 등을 할 때 서로 간섭되는 경우가 발생
- 이를 방지하기 위해 단일 선택 상태 강제

**현재 구현 상태**:
| 툴 | 툴 선택 시 deselect | 사용 시 deselect | 비고 |
|---|---|---|---|
| 직선 | ✅ | - | 통일됨 (refactored) |
| 화살표 | ✅ | - | 통일됨 (refactored) |
| 사각형 | ✅ | - | 통일됨 (refactored) |
| 타원 | ✅ | - | 통일됨 (refactored) |
| 연필 | ❌ | ✅ (클릭/드래그 시) | 설계 철학은 위배 안됨 (refactored) |
| 지우개 | ❌ | ✅ (클릭/드래그 시) | 설계 철학은 위배 안됨 (refactored) |
| 텍스트 | ❌ | ? (불명확) | 검토 필요 |
| 선택 툴 | ❌ | - | 기능상 deselect 하면 안됨 (refactored) |

**이슈**:
- 도형 툴들과 연필/지우개/텍스트 툴 간 동작 불일치로 인한 통일성 부족
- 사용자 경험 관점에서 예측 가능성 저하 우려

**검토 필요 사항**:
1. 모든 툴 선택 시 즉시 deselect하여 통일성 확보할지
2. 현재 방식 유지 (툴마다 특성이 다르므로 동작도 다를 수 있다는 관점)
3. 도형 툴도 실제 사용 시점으로 deselect 시점을 변경할지

---

## 주요 고려사항

### 1. 마이그레이션 전략
- 점진적 마이그레이션 (한 번에 하나의 툴씩)
- 기존 기능 유지하면서 새 구조로 전환
- 각 PR마다 모든 테스트 통과 보장

### 2. 하위 호환성
- 저장된 캔버스 상태 포맷 유지
- 사용자 설정 마이그레이션 스크립트 제공

### 3. 테스트 전략
- 단위 테스트: 각 툴, 관리자 클래스
- 통합 테스트: ToolManager + CanvasManager
- E2E 테스트: 기존 테스트 유지 및 확장

### 4. 문서화
- 각 패키지에 README.md
- API 문서 자동 생성 (TypeDoc)
- 아키텍처 다이어그램 추가

---

## 추가 개선 아이디어 (리펙토링 이후)

### 단기 (1-2개월)
- [ ] 플러그인 시스템 (서드파티 툴 추가)
- [ ] 협업 기능 기반 구축 (OT/CRDT 준비)
- [ ] 더 많은 Fabric 객체 지원 (Polygon, Path 등)

### 중기 (3-6개월)
- [ ] VS Code 확장 개발
- [ ] React 래퍼 개발
- [ ] 성능 프로파일링 및 최적화

### 장기 (6개월+)
- [ ] 실시간 협업 기능
- [ ] 클라우드 동기화
- [ ] 모바일 지원 (터치 이벤트)

---

## 참고 자료

### 유사 프로젝트 분석
- [Excalidraw](https://github.com/excalidraw/excalidraw): Canvas 추상화 참고
- [tldraw](https://github.com/tldraw/tldraw): 툴 시스템 아키텍처 참고
- [Fabric.js Examples](http://fabricjs.com/demos/): 베스트 프랙티스

### 기술 스택
- TypeScript 5.x
- Fabric.js 5.x
- Vite (빌드 도구)
- Vitest (테스트)
- Playwright (E2E)

---

## 최근 업데이트 (2025-12-12)

### 완료된 작업
1. ✅ LineTool, RectangleTool, EllipseTool 구현 및 통합
2. ✅ **ArrowTool 구현 및 통합 (가장 복잡한 툴)**
3. ✅ **PenTool 구현 및 통합** (12 tests, 자유 그리기)
4. ✅ **EraserTool 구현 및 통합** (13 tests, 동적 커서 관리)
5. ✅ **SelectTool 구현 및 통합** (14 tests, 영역 선택 기능)
6. ✅ WhiteboardCanvas.vue에서 기존 setup 함수 제거 (총 674줄 감소)
7. ✅ 자동 빌드 설정 (predev, prebuild hooks)
8. ✅ 버그 수정 (fill, selection, positioning)
9. ✅ 단위 테스트 65개 작성 및 통과 (100% passing)

### 최근 커밋
- `4157f2f` refactor: Implement PenTool and integrate with ToolManager
- `7b94994` refactor: Implement SelectTool and integrate with ToolManager
- `ae4a699` refactor: Implement EraserTool and integrate with ToolManager
- `641b8a0` refactor: Implement ArrowTool and integrate with ToolManager
- `1b241af` refactor: Integrate LineTool, RectangleTool, EllipseTool with ToolManager

### 다음 작업
- **TextTool 구현 (마지막 툴!)**
- HistoryManager 구현 (Undo/Redo 로직 분리)
- 통합 테스트 작성
- 설계 이슈: 객체 선택 상태 관리 정책 검토 (deselect 동작 통일성)

---

**작성일**: 2025-12-09
**최종 업데이트**: 2025-12-12
**작성자**: Claude Code Analysis
**상태**: 진행중 (45% 완료)
