import { createSlice } from '@reduxjs/toolkit';

const diagnosticsSlice = createSlice({
  name: 'diagnostics',
  initialState: { completedChecks: 0 },
  reducers: {
    checkCompleted(state) {
      state.completedChecks += 1;
    },
  },
});

export const { checkCompleted } = diagnosticsSlice.actions;
export const diagnosticsReducer = diagnosticsSlice.reducer;
