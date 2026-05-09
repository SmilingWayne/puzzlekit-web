import { Navigate, Route, Routes } from 'react-router-dom'
import { EditorPage } from './app/EditorPage'
import { WorkspacePage } from './app/WorkspacePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<WorkspacePage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

export default App
