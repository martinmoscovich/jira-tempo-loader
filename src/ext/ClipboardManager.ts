/* eslint-disable @typescript-eslint/unbound-method */
import type {
    CellKeyDownEvent,
    Column,
    FullWidthCellKeyDownEvent,
    GridApi,
    IRowNode,
    ValueGetterParams,
    ValueSetterParams
} from 'ag-grid-community';
import { parseTSV, serializeTSV } from '../services/clipboard/tsv';
import { RangeSelectionManager } from './RangeSelectionManager';
import { ExtColDef } from './grid-ext-helpers';

/**
 * Class responsible of managing copy/paste in the grid.
 *
 * It listens to the grid events, parses/serialize data and call some grid api methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ClipboardManager<TData = any, TValue = any> {
  /** Stores the cells that are being loaded async from a paste */
  loadingCells = new Set<`${number}-${string}`>();
  constructor(
    private api: GridApi,
    private selectionManager: RangeSelectionManager
  ) {
    this.handleCopy = debounce(this.handleCopy.bind(this));
    this.handlePaste = debounce(this.handlePaste.bind(this));

    this.onCellKeyDown = this.onCellKeyDown.bind(this);
    this.api.addEventListener('cellKeyDown', this.onCellKeyDown);
  }

  /**
   * Indicates whether the requested cell data is being loaded
   */
  isLoading(rowIndex: number, colId: string) {
    return this.loadingCells.has(`${rowIndex}-${colId}`);
  }

  destroy() {
    this.api.removeEventListener('cellKeyDown', this.onCellKeyDown);
  }

  /**
   * Sets/Unsets the loading state for a cell
   */
  #setLoading(rowIndex: number, colId: string, loading: boolean) {
    const k = `${rowIndex}-${colId}` as const;
    if (loading) {
      this.loadingCells.add(k);
    } else {
      this.loadingCells.delete(k);
    }
    // refresh narrow cell
    const node = this.api.getDisplayedRowAtIndex(rowIndex);
    const column = this.api.getColumn(colId);
    if (node && column) this.api.refreshCells({ rowNodes: [node], columns: [column], force: true });
  }

  /** Handles keyboard events (for ctrl+c, ctrl+x and ctrl+v) */
  private onCellKeyDown(e: FullWidthCellKeyDownEvent | CellKeyDownEvent) {
    // If the grid is in "edit mode", don't do anything
    if (this.api.getEditingCells().length > 0) return;

    const event = e.event as KeyboardEvent;
    const key = event.key.toLowerCase();

    if ((event.ctrlKey || event.metaKey) && key === 'c') {
      event.preventDefault();
      void this.handleCopy(false);
    }
    if ((event.ctrlKey || event.metaKey) && key === 'x') {
      event.preventDefault();
      void this.handleCopy(true);
    }
    if ((event.ctrlKey || event.metaKey) && key === 'v') {
      event.preventDefault();
      void this.handlePaste();
    }
  }

  /**
   * Handles the copy or cut actions
   */
  private async handleCopy(isCut = false) {
    // Get the selected range
    const sel = this.selectionManager.getSelection();
    if (!sel) return;
    const { minRow, maxRow, minCol, maxCol } = sel;
    const colIds = this.#getColIds();

    const content: string[][] = [];
    // Iterate the range's cells
    for (let r = minRow; r <= maxRow; r++) {
      const node = this.api.getDisplayedRowAtIndex(r);
      if (!node) continue;
      const values = [];
      for (let c = minCol; c <= maxCol; c++) {
        const colId = colIds[c];
        const column = colId ? this.api.getColumn(colId) : null;
        if (!colId || !column) continue;

        // Retrieve the serialized (string) cell content
        const value = this.#getCellValueToCopy({ node, column });
        values.push(value ?? '');
        if (isCut) node.setDataValue(colId, '');
      }
      content.push(values);
    }

    try {
      // Turn content matrix into a Tab-separated values (TSV) format string (same as Google Sheets)
      const clipboardText = serializeTSV(content);
      // Copy to Clipboard
      await navigator.clipboard.writeText(clipboardText);
      if (isCut) this.api.refreshCells();
    } catch (e) {
      console.warn('Error while copying %o', e);
      return;
    }
  }

  /**
   * Handles pasting a single cell or a range value
   */
  async handlePaste() {
    // Get the target selected range
    const sel = this.selectionManager.getSelection();
    if (!sel) return;

    let text: string;
    try {
      // Get content from the clipboard
      text = await navigator.clipboard.readText();
    } catch (e) {
      console.warn('Error while pasting %o', e);
      return;
    }

    // Parse it as Tab-separated values (TSV)
    const copiedRows = parseTSV(text);
    if (copiedRows.length === 0) return;

    const copiedRowCount = copiedRows.length;
    const copiedColCount = copiedRows[0]!.length;

    // Determine target top-left
    const startRow = sel.minRow;
    const startCol = sel.minCol;

    // Determine target size
    const endRow = sel.maxRow ?? startRow;
    const maxCol = sel.maxCol ?? startCol;

    // Get target count is the max between the copied count and the target count (fill handle like Excel)
    const targetRowCount = Math.max(copiedRowCount, endRow - startRow + 1);
    const targetColCount = Math.max(copiedColCount, maxCol - startCol + 1);

    // Auto-expand rows if needed (fill handle like Excel)
    const neededRows = startRow + targetRowCount;
    const currentRows = this.api.getDisplayedRowCount();
    const colIds = this.#getColIds();
    if (neededRows > currentRows) {
      const newRows = [];
      for (let i = currentRows; i < neededRows; i++) {
        const emptyRow: Record<string, string> = {};
        colIds.forEach((col) => (emptyRow[col] = ''));
        // TODO Remove the new Part method
        newRows.push({});
      }
      this.api.applyTransaction({ add: newRows });
    }

    // List of async loading jobs
    const jobs: Array<
      Promise<{ rowNode: IRowNode<TData>; column: Column; value: TValue | string | undefined | null }>
    > = [];

    // Iterate the target range to paste
    for (let r = 0; r < targetRowCount; r++) {
      const rowIndex = startRow + r;
      const rowNode = this.api.getDisplayedRowAtIndex(rowIndex);
      if (!rowNode) continue;

      for (let c = 0; c < targetColCount; c++) {
        const colId = colIds[startCol + c];
        if (!colId) continue;

        const column = this.api.getColumn(colId);
        if (!column) continue;

        // Get the clipboard string value (with Excel-style fill: repeat copied values row-wise and column-wise to fill target)
        const sourceValue = copiedRows[r % copiedRowCount]?.[c % copiedColCount] ?? '';

        // Mark the cell as "loading"
        this.#setLoading(rowIndex, colId, true);

        jobs.push(
          // Parse the clipboard string value to the format used by the cell renderer
          this.#parseValue({ node: rowNode, column }, sourceValue)
            // Store the cell coords and new value
            .then((value) => ({ rowNode, column, value }))
            // Remove the loading state
            .finally(() => {
              this.#setLoading(rowIndex, colId, false);
            })
        );
      }
    }

    try {
      // Wait until all cells are loaded
      const result = await Promise.all(jobs);

      // Group changes by row, as many changes can belong to the same row and calling them directly would
      // make the latter ones overwrite the former ones
      const updatesByRow = new Map<IRowNode<TData>, TData>();
      result.forEach(({ rowNode, column, value }) => {
        // Get the original data and let each change modify it
        const data = updatesByRow.get(rowNode) ?? rowNode.data;
        if (data) {
          updatesByRow.set(rowNode, this.#getUpdatedRow({ node: rowNode, column }, data, value ?? ''));
        }
      });

      // Make all the changes in a single transaction
      this.api.applyTransactionAsync({ update: Array.from(updatesByRow.values()) });
    } catch {
      console.warn('Failed to paste "%s" into range', text);
    }

    this.api.refreshCells({ force: true });
  }

  #getColIds() {
    return this.api.getAllDisplayedColumns().map((c) => c.getColId());
  }

  /**
   * Uses the column definition to get the correct and formatted string value for the Cell.
   * Used when copying a cell content
   */
  #getCellValueToCopy({ node, column }: Pick<ValueGetterParams, 'node' | 'column'>): string {
    const colDef = column.getColDef();

    // If there's a valueGetter use it. Otherwise just get the property from the data object
    const value =
      typeof colDef.valueGetter === 'function'
        ? colDef.valueGetter({
            node,
            data: node?.data,
            column,
            colDef,
            api: this.api,
            context: this.api.getGridOption('context'),
            getValue: (field) => node?.data[field]
          })
        : node?.data?.[colDef.field ?? column.getId()];

    // If there's a valueFormatter, call it to get the formatted string
    if (typeof colDef.valueFormatter === 'function') {
      return colDef.valueFormatter({
        node,
        data: node?.data,
        column,
        colDef,
        api: this.api,
        context: this.api.getGridOption('context'),
        value
      });
    }

    // If not, just return the value directly
    return value ?? '';
  }

  /**
   * Uses the column definition to parse the clipboard text value into the right cell content.
   * Used when pasting.
   *
   * Supports AG Grid sync `valueParser()` and a custom `asyncValueParser()` if required
   */
  async #parseValue(
    { node, column }: Pick<ValueSetterParams<TData>, 'node' | 'column'>,
    newValue: string
  ): Promise<TValue | string | undefined | null> {
    let oldValue;

    const colDef = column.getColDef() as ExtColDef;
    const context = this.api.getGridOption('context');

    // Get the oldValue using the valueGetter if it exists or the property from the data object
    if (typeof colDef.valueGetter === 'function') {
      oldValue = colDef.valueGetter({
        node,
        data: node?.data,
        column,
        colDef,
        api: this.api,
        context,
        getValue: (field) => node?.data?.[field as keyof TData]
      });
    } else {
      oldValue = node?.data?.[(colDef.field ?? column.getId()) as keyof TData];
    }

    // If there's an custom asyncValueParser defined, call it
    if (colDef.asyncValueParser) {
      return await colDef.asyncValueParser({
        oldValue,
        newValue,
        node,
        data: node?.data as TData,
        column,
        colDef,
        api: this.api,
        context
      });
    } else if (typeof colDef.valueParser === 'function') {
      // If there's a AG Grid sync valueParser defined, use that one
      return colDef.valueParser({
        oldValue,
        newValue,
        node,
        data: node?.data as TData,
        column,
        colDef,
        api: this.api,
        context
      });
    } else {
      // If no parser exists, just return the string value
      return newValue;
    }
  }

  /**
   * Uses the column definition to modify the row Data object with a new value.
   *
   * This method is called after the string value has been parsed (maybe async).
   *
   * @returns a new cloned data object with the changes applied
   */
  #getUpdatedRow(
    { node, column }: Pick<ValueSetterParams<TData>, 'node' | 'column'>,
    data: TData,
    value: TValue | string
  ): TData {
    const colDef = column.getColDef();
    const context = this.api.getGridOption('context');

    let oldValue;

    // Get the old value using valueGetter or just getting the property from the data object
    if (typeof colDef.valueGetter === 'function') {
      oldValue = colDef.valueGetter({
        node,
        data: node?.data,
        column,
        colDef,
        api: this.api,
        context,
        getValue: (field) => node?.data?.[field as keyof TData]
      });
    } else {
      oldValue = node?.data?.[(colDef.field ?? column.getId()) as keyof TData];
    }

    // Clones the data to modify it
    const newData = structuredClone ? structuredClone(data) : JSON.parse(JSON.stringify(data));

    // If a valueSetter is defined, it's called to modify the cloned data object
    // If not, the property is modified directly
    if (typeof colDef.valueSetter === 'function') {
      const changed = colDef.valueSetter({
        newValue: value,
        oldValue,
        node,
        data: newData,
        column,
        colDef,
        api: this.api,
        context
      });
      // If value setter return false, the data is not changed
      if (changed === false) return data;
    } else {
      newData[colDef.field ?? column.getId()] = value;
    }

    // Return the new data
    return newData;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => any>(fn: T, delay = 150): any {
  let timer: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (...args: any[]) => {
    clearTimeout(timer);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    timer = setTimeout(() => fn(...args), delay);
  };
}