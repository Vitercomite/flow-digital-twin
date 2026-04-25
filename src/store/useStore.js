import { create } from 'zustand';

const useStore = create((set) => ({
  // Fluxograms
  fluxograms: [],
  currentFluxogram: null,
  setFluxograms: (fluxograms) => set({ fluxograms }),
  setCurrentFluxogram: (f) => set({ currentFluxogram: f }),
  addFluxogram: (f) => set((s) => {
    const exists = s.fluxograms.some((item) => item.id === f.id);
    return {
      fluxograms: exists
        ? s.fluxograms.map((item) => (item.id === f.id ? { ...item, ...f } : item))
        : [f, ...s.fluxograms],
    };
  }),
  updateFluxogram: (updated) => set((s) => ({
    fluxograms: s.fluxograms.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)),
    currentFluxogram: s.currentFluxogram?.id === updated.id ? { ...s.currentFluxogram, ...updated } : s.currentFluxogram,
  })),

  // Elements
  elements: [],
  setElements: (elements) => set({ elements }),
  addElement: (el) =>
    set((s) => (s.elements.find((e) => e.id === el.id) ? {} : { elements: [...s.elements, el] })),
  updateElement: (updated) =>
    set((s) => ({
      elements: s.elements.map((el) => (el.id === updated.id ? { ...el, ...updated } : el)),
      selectedElement: s.selectedElement?.id === updated.id ? { ...s.selectedElement, ...updated } : s.selectedElement,
    })),
  removeElement: (id) =>
    set((s) => ({
      elements: s.elements.filter((el) => el.id !== id),
      selectedElement: s.selectedElement?.id === id ? null : s.selectedElement,
      isModalOpen: s.selectedElement?.id === id ? false : s.isModalOpen,
    })),

  // UI state
  mode: 'view',
  setMode: (mode) => set({ mode }),
  selectedElement: null,
  isModalOpen: false,
  openModal: (element) => set({ selectedElement: element, isModalOpen: true }),
  closeModal: () => set({ selectedElement: null, isModalOpen: false }),
  newElementPosition: null,
  setNewElementPosition: (pos) => set({ newElementPosition: pos, isModalOpen: true, selectedElement: null }),
  clearNewElementPosition: () => set({ newElementPosition: null }),
  hoveredElement: null,
  hoverScreenPos: null,
  setHovered: (element, pos) => set({ hoveredElement: element, hoverScreenPos: pos }),
  clearHovered: () => set({ hoveredElement: null, hoverScreenPos: null }),

  // Lens / field assistant
  lensDraft: null,
  setLensDraft: (draft) => set({ lensDraft: draft }),
  clearLensDraft: () => set({ lensDraft: null }),
  lensFocusTag: '',
  lensFocusElementId: null,
  lensFocusMessage: '',
  setLensFocus: (payload) => set({
    lensFocusTag: payload?.tag || '',
    lensFocusElementId: payload?.elementId || null,
    lensFocusMessage: payload?.message || '',
  }),
  clearLensFocus: () => set({ lensFocusTag: '', lensFocusElementId: null, lensFocusMessage: '' }),

  // Connectivity
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (v) => set({ isOnline: v }),
  pendingCount: 0,
  setPendingCount: (n) => set({ pendingCount: n }),

  // Notifications
  notifications: [],
  addNotification: (msg, type = 'info') => {
    const id = Date.now() + Math.random();
    set((s) => ({ notifications: [...s.notifications, { id, msg, type }] }));
    setTimeout(() => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })), 3500);
  },
}));

export default useStore;
