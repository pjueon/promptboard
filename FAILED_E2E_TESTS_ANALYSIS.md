# 실패한 E2E 테스트 분석

## 개요
날짜: 2025-12-21
커밋: 356216a "fix: Restore event handlers, auto-save, and improve selection/history management"

총 실패한 테스트: 15개
- Undo/Redo 테스트: 10개 실패
- Save/Load 테스트: 5개 실패

---

## 1. Undo/Redo 테스트 (10개 실패)

### 근본 원인
마지막 커밋(356216a)이 selection과 history 관리 방식을 근본적으로 변경했습니다:

1. **초기화 시 이중 스냅샷**: 초기화 중 두 개의 스냅샷이 저장됨
   - 스냅샷 1: 빈 캔버스
   - 스냅샷 2: 자동 저장된 상태 로드 후 (존재하는 경우)

2. **Selection:cleared 이벤트**: 이제 객체가 선택 해제될 때 스냅샷을 저장함
   - 이전: 선택 해제 시 스냅샷 없음
   - 현재: undo로 선택된 상태를 복원할 수 있도록 스냅샷 저장

3. **Non-selectable 객체**: 선택 해제된 객체가 `selectable: false`로 변경됨
   - 이전: 선택 해제 후에도 객체가 선택 가능한 상태로 유지
   - 현재: 객체가 "평탄화"되어 상호작용 불가능하게 됨

### 실패한 테스트 상세

#### 테스트 1: `should undo a single drawing action`
**파일**: `tests/e2e/undo-redo.spec.ts:83`

**기대 동작 (이전)**:
1. 사각형 그리기 → 스냅샷 1 (사각형 존재)
2. Undo → 스냅샷 0으로 복귀 (빈 캔버스)

**현재 동작 (새로운)**:
1. 초기화 → 스냅샷 0 (빈 캔버스)
2. 초기화 → 스냅샷 1 (자동 저장 로드 후 빈 캔버스)
3. 사각형 그리기 → 스냅샷 2 (사각형 그려짐)
4. 사각형 자동 선택 → 여전히 스냅샷 2
5. 클릭해서 선택 해제 (selection:cleared) → 스냅샷 3 (사각형 선택 해제, 이제 non-selectable)
6. Undo → 스냅샷 2로 복귀 (사각형 선택됨)
7. 빈 캔버스에 도달하려면 한 번 더 undo 필요

**문제점**: 추가 스냅샷 발생 원인:
- 이중 초기화 스냅샷
- Selection:cleared 스냅샷

**canUndo/canRedo 상태 문제**: 테스트가 확인하기 전에 undoRedoState가 제대로 초기화되지 않을 수 있음

---

#### 테스트 2: `should redo a previously undone action`
**파일**: `tests/e2e/undo-redo.spec.ts:115`

**문제점**: 테스트 1과 동일, 추가로:
- Undo 후 테스트는 `canRedo = true`를 기대함
- 하지만 undoRedoState가 제대로 업데이트되지 않으면 `canRedo`가 `undefined`일 수 있음

---

#### 테스트 3: `should undo multiple actions in sequence`
**파일**: `tests/e2e/undo-redo.spec.ts:159`

**기대 동작 (이전)**:
```
스냅샷 0: 빈 캔버스
스냅샷 1: 사각형 1
스냅샷 2: + 선
스냅샷 3: + 사각형 2
```

**현재 동작 (새로운)**:
```
스냅샷 0: 빈 캔버스 (초기화)
스냅샷 1: 빈 캔버스 (자동 저장 로드 후)
스냅샷 2: 사각형 1 (그려짐)
스냅샷 3: 사각형 1 (selection:cleared로 선택 해제)
스냅샷 4: 선 (그려짐)
스냅샷 5: 선 (선택 해제)
스냅샷 6: 사각형 2 (그려짐)
스냅샷 7: 사각형 2 (선택 해제)
```

**문제점**: selection:cleared 이벤트로 인해 예상보다 두 배의 스냅샷 생성

---

#### 테스트 4: `should handle undo-redo sequence correctly`
**파일**: `tests/e2e/undo-redo.spec.ts:199`

**문제점**: 테스트 3과 유사 - 스냅샷 개수 불일치

---

#### 테스트 5: `should clear redo history when new action is performed after undo`
**파일**: `tests/e2e/undo-redo.spec.ts:228`

**기대 동작**:
1. 그리기 → Undo → 새 객체 그리기
2. Redo 히스토리가 지워져야 함

**현재 동작**: 원칙적으로는 올바르게 작동하지만, 추가 스냅샷으로 인해 인덱싱이 어긋남

---

#### 테스트 6: `should not undo beyond the first state`
**파일**: `tests/e2e/undo-redo.spec.ts:258`

**기대**: 초기 빈 캔버스 이전으로 undo 불가능
**현재**: 작동은 하지만, "초기 상태"가 이제 스냅샷 1 (자동 저장 로드 후)이지 스냅샷 0이 아님

---

#### 테스트 7: `should support Ctrl+Y as alternative redo shortcut`
**파일**: `tests/e2e/undo-redo.spec.ts:290`

**문제점**: 이전 테스트들과 동일한 스냅샷 인덱싱 문제

---

#### 테스트 8: `should undo object modifications (resize/rotate)`
**파일**: `tests/e2e/undo-redo.spec.ts:317`

**기대 동작 (이전)**:
1. 사각형 그리기 → 스냅샷 1
2. 크기 조정 → 스냅샷 2
3. Undo → 스냅샷 1로 복귀 (원래 크기)

**현재 동작 (새로운)**:
1. 사각형 그리기 → 스냅샷 2 (또는 초기화에 따라 3)
2. 사각형 자동 선택 → 새 스냅샷 없음
3. Selection:cleared → 스냅샷 3/4 (선택 해제 상태)
4. 크기 조정을 위해 재선택 → 새 스냅샷 없음 (객체가 이제 non-selectable!)
5. **크기 조정 불가능** 객체가 `selectable: false`이기 때문

**치명적 문제**: 선택 해제 후 객체를 다시 선택할 수 없음 (`selectable: false` 때문)

---

#### 테스트 9: `should undo flatten and restore object`
**파일**: `tests/e2e/undo-redo.spec.ts:388`

**문제점**: 테스트 8과 유사 - 선택 해제된 객체와 상호작용 불가능

---

#### 테스트 10: `should preserve auto-saved state when undoing after app restart`
**파일**: `tests/e2e/undo-redo.spec.ts:416`

**문제점**: 복잡한 상호작용:
- 자동 저장 로딩이 스냅샷 1 생성
- Undo 작업 횟수가 어긋남
- `canRedo` 상태가 제대로 동기화되지 않음

---

## 2. Save/Load 테스트 (5개 실패)

### 근본 원인
캔버스 상태가 관리되고 저장되는 방식의 변경으로 인해 실패하고 있습니다.

### 실패한 테스트 상세

#### 테스트 1: `should save canvas when save button is clicked`
**파일**: `tests/e2e/save-load.spec.ts:118`

**문제점**: 파일이 생성되지 않음
**가능한 원인**:
1. Save 핸들러가 제대로 연결되지 않음
2. 캔버스 이미지 내보내기 메서드가 변경됨 (getCanvasImage가 WhiteboardCanvas에 더 이상 존재하지 않음)
3. Save 버튼의 이벤트 리스너가 작동하지 않음

---

#### 테스트 2: `should save canvas with keyboard shortcut Ctrl+S`
**파일**: `tests/e2e/save-load.spec.ts:150`

**문제점**: 테스트 1과 동일, 단 키보드 단축키로 트리거됨

---

#### 테스트 3: `should save empty canvas`
**파일**: `tests/e2e/save-load.spec.ts:191`

**문제점**: 테스트 1과 동일

---

#### 테스트 4: `should handle multiple saves correctly`
**파일**: `tests/e2e/save-load.spec.ts:274`

**문제점**: 저장이 전혀 되지 않음 (동일한 근본 원인)

---

#### 테스트 5: `should preserve canvas after clear and restore`
**파일**: `tests/e2e/save-load.spec.ts:313`

**문제점**: 저장 실패 + clear 동작 변경의 조합

**새로운 Clear 동작**:
```typescript
// 이전: historyManager.clear()
// 현재: historyManager.saveSnapshot()
```
이제 clear는 히스토리를 지우는 대신 빈 캔버스의 스냅샷을 저장합니다.

---

## 권장 사항

### Undo/Redo 테스트

#### 옵션 A: 테스트 기대값 업데이트 (권장)
다음 사항을 반영하도록 테스트 수정:
1. **추가 초기화 스냅샷**: 초기 canUndo/canRedo 기대값 조정
2. **Selection:cleared 스냅샷**: 각 그리기 작업 후 스냅샷 예상
3. **Non-selectable 객체**: 선택 해제된 객체를 수정하려 하지 않음

테스트 1 수정 예시:
```typescript
// 이전:
await drawRectangle(page);
expect(canUndo).toBe(true);
await page.keyboard.press('Control+z');
// 캔버스가 비어있어야 함

// 새로운:
await drawRectangle(page);
await page.waitForTimeout(500); // selection:cleared 대기
expect(canUndo).toBe(true);
await page.keyboard.press('Control+z'); // 선택 해제 undo
await page.keyboard.press('Control+z'); // 그리기 undo
// 캔버스가 비어있어야 함
```

#### 옵션 B: Selection 관리 변경사항 되돌리기
커밋 356216a에서 다음 변경사항 제거:
1. selection:cleared 스냅샷 저장 제거
2. 선택 해제 후에도 객체를 선택 가능하게 유지
3. 초기화를 단일 스냅샷으로 단순화

**영향**: 선택 해제된 객체가 비상호작용적으로 되는 "평탄화" 동작을 잃게 됨

---

### Save/Load 테스트

#### 옵션 A: Save 핸들러 수정
Save 기능을 다시 연결해야 함:

1. **Save 핸들러 찾기**: `AppTitlebar.vue` 또는 save 버튼이 처리되는 위치 확인
2. **WhiteboardCanvas 메서드 사용하도록 업데이트**:
   ```typescript
   // 이전 (더 이상 존재하지 않음):
   const image = canvasRef.value?.getCanvasImage()

   // 새로운:
   const canvas = canvasRef.value?.getCanvas()
   const dataURL = canvas?.toDataURL('image/png')
   const base64 = dataURL?.split(',')[1]
   ```

3. **키보드 단축키 핸들러** 여전히 등록되어 있는지 확인

#### 옵션 B: getCanvasImage 메서드 복원
WhiteboardCanvas에 편의 메서드로 `getCanvasImage` 추가:
```typescript
// WhiteboardCanvas.vue에서
function getCanvasImage(): string | null {
  const canvas = getCanvas();
  if (!canvas) return null;
  const dataURL = canvas.toDataURL('image/png');
  return dataURL.split(',')[1]; // prefix 없이 base64 반환
}

defineExpose({
  // ... 기존 메서드들
  getCanvasImage, // 이것 추가
});
```

---

## 요약

**빠른 해결책**:
1. Save 핸들러를 업데이트하여 save/load 수정 (2-3개 메서드 업데이트)
2. 추가 스냅샷을 고려하도록 undo/redo 테스트 기대값 업데이트

**더 큰 결정**:
- 새로운 "선택 해제 시 평탄화" 동작 유지 → 모든 테스트 업데이트
- 또는 이전 동작으로 복원 → 대부분의 테스트 그대로 유지

**권장사항**: 새로운 동작을 유지하고 테스트를 업데이트하세요 (더 나은 UX입니다). selection:cleared 스냅샷은 undo/redo 경험에 가치가 있습니다.
