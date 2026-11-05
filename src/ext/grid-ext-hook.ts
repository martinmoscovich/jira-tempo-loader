import { GridReadyEvent } from 'ag-grid-community';
import { useEffect, useRef, useState } from 'react';
import { ClipboardManager } from './ClipboardManager';
import { RangeSelectionManager } from './RangeSelectionManager';

/**
 * Hook used to init and destroy our Grid custom extensions
 * @param container Container HTML Element required by extensions to manipulate the DOM
 * @returns the event handler for grid's ready and destroy events
 */
export function useGridExtensions(container: HTMLElement | null) {
  // Used so the hook is called after the grid was mounted
  const [mounted,setMounted] = useState(false);
  const [extReady, setExtReady] = useState(false);
  useEffect(() => setMounted(true), []);


  const selectionManager = useRef<RangeSelectionManager>();
  const clipboardManager = useRef<ClipboardManager>();

  const handleGridReady = (event: GridReadyEvent) => {
    if (container) {
      selectionManager.current = new RangeSelectionManager(event.api, container);
      clipboardManager.current = new ClipboardManager(event.api, selectionManager.current);
      setExtReady(true)
    }
  };
  const handleDestroy = () => {
    selectionManager.current?.destroy();
    clipboardManager.current?.destroy();
    setExtReady(false);
  };

  return { mounted, extReady, onGridReady: handleGridReady, onGridDestroy: handleDestroy, selectionManager };
}