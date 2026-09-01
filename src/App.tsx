import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ClassicPage from './pages/ClassicPage'
import DailyArchivePage from './pages/DailyArchivePage'
import DailyPage from './pages/DailyPage'
import Landing from './pages/Landing'
import { ThemeProvider } from './theme/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="classic" element={<ClassicPage />} />
            <Route path="daily" element={<DailyPage />} />
            <Route path="archive" element={<DailyArchivePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
