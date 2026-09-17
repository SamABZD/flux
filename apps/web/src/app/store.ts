import { configureStore } from '@reduxjs/toolkit';
import { diagnosticsReducer } from '@/features/diagnostics/diagnostics-slice';
import { financeApi } from '@/features/finance/finance-api';

export const createAppStore = () =>
  configureStore({
    reducer: { diagnostics: diagnosticsReducer, [financeApi.reducerPath]: financeApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(financeApi.middleware),
  });

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
