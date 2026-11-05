import '../styles/ext.css';

/* eslint-disable @typescript-eslint/unbound-method */
import type {
  CellEvent,
  CellKeyDownEvent,
  CellMouseDownEvent,
  CellMouseOverEvent,
  FullWidthCellKeyDownEvent,
  GridApi
} from 'ag-grid-community';

interface Cell {
  rowIndex: number;
  colId: string;
}

interface Selection {
  maxRow: number;
  minRow: number;
  minCol: number;
  maxCol: number;
  isRange: boolean;
}

const SELECTED_CLASS = 'grid-range-selected';
// const ACTIVE_CLASS = 'grid-range-active';

/**
 * Class responsible of managing cell range selection in the grid.
 *
 * It listens to the grid events, call some grid api methods and style the cell DOM elements to provide visual feedback
 */
export class RangeSelectionManager extends EventTarget {
  startCell: Cell | null;
  endCell: Cell | null;
  activeCell: Cell | null;
  lastSelectedCells: Set<HTMLElement>;
  selecting: boolean;

  constructor(
    private api: GridApi,
    private container: HTMLElement
  ) {
    super();
    this.startCell = null;
    this.endCell = null;
    this.activeCell = null;
    this.lastSelectedCells = new Set();
    this.selecting = false;

    this.#setupListeners();
  }

  #setupListeners() {
    this.onCellMouseDown = this.onCellMouseDown.bind(this);
    this.onCellMouseOver = this.onCellMouseOver.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onCellKeyDown = this.onCellKeyDown.bind(this);
    this.clear = this.clear.bind(this);

    // Mouse up is applied to the window to stop selecting even if the user stops clicking when outside the grid
    window.addEventListener('mouseup', this.onMouseUp);

    // this.api.addEventListener('cellEditingStarted', this.clear);
    this.api.addEventListener('cellMouseDown', this.onCellMouseDown);
    this.api.addEventListener('cellMouseOver', this.onCellMouseOver);
    this.api.addEventListener('cellKeyDown', this.onCellKeyDown);
  }

  destroy() {
    window.removeEventListener('mouseup', this.onMouseUp);

    // this.api.removeEventListener('cellEditingStarted', this.clear);
    this.api.removeEventListener('cellMouseDown', this.onCellMouseDown);
    this.api.removeEventListener('cellMouseOver', this.onCellMouseOver);
    this.api.removeEventListener('cellKeyDown', this.onCellKeyDown);
  }

  getSelection(): Selection | undefined {
    const start = this.startCell;
    const end = this.endCell;
    if (!start || !end) return undefined;

    // Get min and max row indices
    const minRow = Math.min(start.rowIndex, end.rowIndex);
    const maxRow = Math.max(start.rowIndex, end.rowIndex);

    // Get min and max col indices
    const colIds = this.#getColIds();
    const startCol = colIds.indexOf(start.colId);
    const endCol = colIds.indexOf(end.colId);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    // If the row or col are not the same, it is a range
    const isRange = minRow !== maxRow || minCol !== maxCol;

    return { minRow, maxRow, minCol, maxCol, isRange };
  }

  get hasSelection(): boolean {
    return this.startCell !== null && this.endCell !== null;
  }

  /**
   * Selects the specified range, removing any previous selection
   * @param start Cell where the range starts
   * @param end Cell where the range ends. It's optional, default to using the start cell (thus creating a single cell selection)
   */
  select(start: Cell, end: Cell = start) {
    this.clear();
    this.startCell = start;
    this.endCell = end;
    this.activeCell = end;
    this.#updateHighlight();
  }

  /** Selects all the cells in the grid */
  selectAll() {
    const rowCount = this.api.getDisplayedRowCount();
    const colIds = this.#getColIds();
    const colStart = colIds[0];
    const colEnd = colIds[colIds.length - 1];
    if (colStart && colEnd) {
      this.select({ rowIndex: 0, colId: colStart }, { rowIndex: rowCount - 1, colId: colEnd });
    }
  }

  /** Clears the current selection */
  clear() {
    this.startCell = null;
    this.endCell = null;
    this.activeCell = null;

    // Update UI
    requestAnimationFrame(() => {
      this.lastSelectedCells.forEach((cell) => cell.classList.remove(SELECTED_CLASS));
      this.lastSelectedCells.clear();
    });
    // this.container.querySelectorAll('.' + ACTIVE_CLASS).forEach((el) => el.classList.remove(ACTIVE_CLASS));

    // Dispatch selection change event
    this.#dispatchSelectionChange();
  }

  /** Dispatches a custom selectionChange event */
  #dispatchSelectionChange() {
    const event = new CustomEvent('selectionChange', {
      detail: { selection: this.getSelection() },
    });
    this.dispatchEvent(event);
  }

  /** Get the cells HTML container, including regular and pinned columns */
  #getCellContainers() {
    return this.container.querySelectorAll(
      '.ag-center-cols-container, .ag-pinned-left-cols-container, .ag-pinned-right-cols-container'
    );
  }

  /** Handles cell click */
  private onCellMouseDown(e: CellMouseDownEvent) {
    const pos = getCellFromEvent(e);
    if (!pos) return;

    // If shift is clicked and there's a range start, assign the range end
    if (withShiftKey(e.event) && this.startCell) {
      // Set the range end and active cell to the clicked cell and update the highlight
      this.#updateRangeEnd(pos);
    } else {
      // If shift is NOT clicked or there's no start, a new range selection must be started
      this.select(pos);

      // Set the selecting flag
      this.selecting = true;
    }
  }

  /** When mouse moves over a cell */
  private onCellMouseOver(e: CellMouseOverEvent) {
    // Only track the selection if the flag is set
    if (this.selecting) {
      const pos = getCellFromEvent(e);
      if (!pos) return;

      // Update the end of the range
      this.#updateRangeEnd(pos);
    }
  }

  /** When the user stops clicking the mouse (on the whole window, not just the grid) */
  private onMouseUp() {
    // Unset the selecting flag
    this.selecting = false;
  }

  /** Handles keyboard events */
  private onCellKeyDown(e: FullWidthCellKeyDownEvent | CellKeyDownEvent) {
    // If the grid is in "edit mode", don't do anything
    if (this.api.getEditingCells().length > 0) return;

    const event = e.event as KeyboardEvent;
    const key = event.key.toLowerCase();

    // Get the focused cell
    const focusedCell = this.#getFocusedCell();

    // If the arrows are pressed, the selection must change
    if (this.activeCell && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
      const rowCount = this.api.getDisplayedRowCount();
      const colIds = this.#getColIds();
      const colCount = colIds.length;
      const dir = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] }[key]!;
      const newRow = Math.max(0, Math.min(rowCount - 1, this.activeCell.rowIndex + dir[0]!));
      const newCol = Math.max(0, Math.min(colCount - 1, colIds.indexOf(this.activeCell.colId) + dir[1]!));
      const newCell = { rowIndex: newRow, colId: colIds[newCol]! };

      if (withShiftKey(event) && this.startCell) {
        // This makes that if a range was selected with the mouse, when expanding that range, the focused item should remain the first one
        if (focusedCell?.rowIndex !== this.endCell?.rowIndex || focusedCell?.colId !== this.endCell?.colId) {
          this.api.setFocusedCell(this.startCell.rowIndex, this.startCell.colId);
        }
        // If the user if pressing shift and there's a range start, update the range end
        this.#updateRangeEnd(newCell);
      } else {
        // If the user is not pressing shift, create a new range from the focused cell, not the end of the range
        this.select(focusedCell ?? newCell);
      }
    }

    // Select All
    if (event.ctrlKey && key === 'a') {
      event.preventDefault();
      this.selectAll();
    }

    // If tab was clicked and no range is selected, select the new focused cell
    if (['tab'].includes(key)) {
      const focusedCell = this.#getFocusedCell();
      if (focusedCell && !this.getSelection()?.isRange) this.select(focusedCell);
    }

    // Allows to bulk delete a range when "delete" key is pressed
    const currentSelection = this.getSelection();
    if (currentSelection?.isRange && ['delete'].includes(key)) {
      const colIds = this.#getColIds();
      try {
        // Stops grid refresh
        this.api.setGridOption('suppressChangeDetection', true);
        for (let rowIndex = currentSelection.minRow; rowIndex <= currentSelection.maxRow; rowIndex++) {
          const row = this.api.getDisplayedRowAtIndex(rowIndex);
          if (row) {
            for (let colIndex = currentSelection.minCol; colIndex <= currentSelection.maxCol; colIndex++) {
              const colId = colIds[colIndex];
              if (colId) row.setDataValue(colId, null);
            }
          }
        }
      } finally {
        // Refresh the grid and restore change detection
        this.api.refreshCells();
        this.api.setGridOption('suppressChangeDetection', false);
      }
    }
  }

  /** Sets the new selection range end and updates the UI */
  #updateRangeEnd(cell: Cell) {
    this.endCell = cell;
    this.activeCell = cell;
    this.#updateHighlight();
    this.#dispatchSelectionChange();
  }

  /** Updates the UI with the new selection */
  #updateHighlight() {
    const selection = this.getSelection();
    if (!selection) return;

    const { minRow, maxRow, minCol, maxCol } = selection;

    const selectedCells = new Set<HTMLElement>();
    const containers = this.#getCellContainers();
    const colIds = this.#getColIds();

    for (let r = minRow; r <= maxRow; r++) {
      for (const container of containers) {
        const row = container.querySelector<HTMLElement>(`[row-index='${r}']`);
        if (!row) continue;
        for (let c = minCol; c <= maxCol; c++) {
          const cell = row.querySelector<HTMLElement>(`[col-id='${colIds[c]}']`);
          if (cell) selectedCells.add(cell);
        }
      }
    }

    requestAnimationFrame(() => {
      selectedCells.forEach((cell) => cell.classList.add(SELECTED_CLASS));
      this.lastSelectedCells.forEach((cell) => {
        if (!selectedCells.has(cell)) cell.classList.remove(SELECTED_CLASS);
      });
      this.lastSelectedCells = selectedCells;
    });

    // Highlight active cell
    // for (const container of containers) {
    //   const activeRow = container.querySelector(`[row-index='${end.rowIndex}']`);
    //   if (activeRow) {
    //     const active = activeRow.querySelector(`[col-id='${end.colId}']`);
    //     if (active) active.classList.add(ACTIVE_CLASS);
    //   }
    // }
  }

  #getColIds() {
    return this.api.getAllDisplayedColumns().map((c) => c.getColId());
  }

  /** Gets the currently focused cell */
  #getFocusedCell(): Cell | undefined {
    const focusedCell = this.api.getFocusedCell();
    const rowIndex = focusedCell?.rowIndex;
    const colId = focusedCell?.column.getColId();
    return rowIndex !== undefined && colId ? { rowIndex, colId } : undefined;
  }
}

function withShiftKey(e: Event | null | undefined) {
  return (e as MouseEvent)?.shiftKey;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCellFromEvent(e: CellEvent<any, any>): Cell | undefined {
  if (e.rowIndex === null || !e.column) return undefined;
  return { colId: e.column.getColId(), rowIndex: e.rowIndex };
}