import { Routes, Route } from 'react-router-dom'
import Bookshelf from '@/pages/Bookshelf'
import Reader from '@/pages/Reader'
import KnowledgeGraph from '@/pages/KnowledgeGraph'
import StudyDashboard from '@/pages/StudyDashboard'
import AnnotationNotebook from '@/pages/AnnotationNotebook'
import OnboardingOverlay from '@/components/shared/OnboardingOverlay'
import ToastContainer from '@/components/shared/Toast'

export default function App() {
  return (
    <>
      <OnboardingOverlay />
      <Routes>
        <Route path="/" element={<Bookshelf />} />
        <Route path="/book/:bookId" element={<Reader />} />
        <Route path="/book/:bookId/graph" element={<KnowledgeGraph />} />
        <Route path="/book/:bookId/study" element={<StudyDashboard />} />
        <Route path="/book/:bookId/notebook" element={<AnnotationNotebook />} />
        <Route path="/book/:bookId/:chapterId" element={<Reader />} />
      </Routes>
      <ToastContainer />
    </>
  )
}
