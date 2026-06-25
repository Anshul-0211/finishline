import { create } from "zustand";

interface UIState {
  modals: Record<string, boolean>;
  banners: Record<string, boolean>;
  loadingStates: Record<string, boolean>;
  setModalOpen: (modalName: string, isOpen: boolean) => void;
  setBannerVisible: (bannerName: string, isVisible: boolean) => void;
  setLoadingState: (key: string, isLoading: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  modals: {},
  banners: {},
  loadingStates: {},
  setModalOpen: (modalName, isOpen) =>
    set((state) => ({
      modals: { ...state.modals, [modalName]: isOpen },
    })),
  setBannerVisible: (bannerName, isVisible) =>
    set((state) => ({
      banners: { ...state.banners, [bannerName]: isVisible },
    })),
  setLoadingState: (key, isLoading) =>
    set((state) => ({
      loadingStates: { ...state.loadingStates, [key]: isLoading },
    })),
}));
