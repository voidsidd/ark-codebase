import { useState, useCallback, useRef } from 'react';

export interface DrawPoint {
  lat: number;
  lon: number;
}

interface DrawState {
  points: DrawPoint[];
  isClosed: boolean;
  hoverPoint: DrawPoint | null;
  isDragging: boolean;
  dragIndex: number | null;
}

const SNAP_DISTANCE_PX = 18; // px distance to trigger snap-to-close

export function useDrawPolygon() {
  const [state, setState] = useState<DrawState>({
    points: [],
    isClosed: false,
    hoverPoint: null,
    isDragging: false,
    dragIndex: null,
  });
  const historyRef = useRef<DrawPoint[][]>([]);

  // Add a vertex
  const addPoint = useCallback((pt: DrawPoint) => {
    setState((prev) => {
      if (prev.isClosed) return prev;
      // Save to undo history
      historyRef.current.push([...prev.points]);
      return { ...prev, points: [...prev.points, pt] };
    });
  }, []);

  // Close the polygon (snap last → first)
  const closePolygon = useCallback(() => {
    setState((prev) => {
      if (prev.points.length < 3) return prev;
      return { ...prev, isClosed: true };
    });
  }, []);

  // Set hover point (preview cursor position)
  const setHoverPoint = useCallback((pt: DrawPoint | null) => {
    setState((prev) => ({ ...prev, hoverPoint: pt }));
  }, []);

  // Move a vertex (for post-close editing)
  const moveVertex = useCallback((index: number, pt: DrawPoint) => {
    setState((prev) => {
      const next = [...prev.points];
      next[index] = pt;
      return { ...prev, points: next };
    });
  }, []);

  // Start dragging a vertex
  const startDrag = useCallback((index: number) => {
    setState((prev) => ({ ...prev, isDragging: true, dragIndex: index }));
  }, []);

  // Stop dragging
  const stopDrag = useCallback(() => {
    setState((prev) => ({ ...prev, isDragging: false, dragIndex: null }));
  }, []);

  // Delete a vertex (right-click)
  const deleteVertex = useCallback((index: number) => {
    setState((prev) => {
      if (prev.points.length <= 3 && prev.isClosed) return prev; // can't go below triangle
      const next = [...prev.points];
      next.splice(index, 1);
      return { ...prev, points: next };
    });
  }, []);

  // Insert vertex at edge midpoint
  const insertVertex = useCallback((afterIndex: number) => {
    setState((prev) => {
      const a = prev.points[afterIndex];
      const b = prev.points[(afterIndex + 1) % prev.points.length];
      const mid: DrawPoint = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
      const next = [...prev.points];
      next.splice(afterIndex + 1, 0, mid);
      return { ...prev, points: next };
    });
  }, []);

  // Undo last action
  const undo = useCallback(() => {
    setState((prev) => {
      if (historyRef.current.length === 0) return prev;
      const prevPoints = historyRef.current.pop()!;
      return {
        ...prev,
        points: prevPoints,
        isClosed: prevPoints.length >= 3 ? prev.isClosed : false,
      };
    });
  }, []);

  // Clear everything
  const clear = useCallback(() => {
    historyRef.current = [];
    setState({
      points: [],
      isClosed: false,
      hoverPoint: null,
      isDragging: false,
      dragIndex: null,
    });
  }, []);

  // Convert to GeoJSON Polygon
  const toGeoJSON = useCallback((): GeoJSON.Polygon | null => {
    if (!state.isClosed || state.points.length < 3) return null;
    const coords = state.points.map((p) => [p.lon, p.lat]);
    coords.push([state.points[0].lon, state.points[0].lat]); // close ring
    return {
      type: 'Polygon',
      coordinates: [coords],
    };
  }, [state.isClosed, state.points]);

  return {
    ...state,
    addPoint,
    closePolygon,
    setHoverPoint,
    moveVertex,
    startDrag,
    stopDrag,
    deleteVertex,
    insertVertex,
    undo,
    clear,
    toGeoJSON,
    canClose: state.points.length >= 3 && !state.isClosed,
    SNAP_DISTANCE_PX,
  };
}
