import type { ColDef, IRowNode, ValueParserParams } from 'ag-grid-community';

/**
 * Async value Parser function definition.
 *
 * It's the same as `valueParser` but returns a Promise
 */
export type AsyncValueParser<TData, TValue> = (params: ValueParserParams<TData, TValue>) => Promise<TValue | undefined>;

export interface RowBatchUpdateEvent<DATA> {
  add: Array<IRowNode<DATA>>;
  remove: Array<IRowNode<DATA>>;
  update: Array<IRowNode<DATA>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExtColDef<TData = any, TValue = any> = ColDef<TData, TValue> & {
  asyncValueParser?: AsyncValueParser<TData, TValue>;
};