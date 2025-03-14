import { configureStore } from '@reduxjs/toolkit'
import { agentReducer } from './reducer'

export const store = configureStore({
  reducer: {
    agentReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
