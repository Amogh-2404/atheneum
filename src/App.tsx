import { Routes, Route } from 'react-router-dom'
import Bookshelf from '@/pages/Bookshelf'
import Reader from '@/pages/Reader'
import KnowledgeGraph from '@/pages/KnowledgeGraph'
import StudyDashboard from '@/pages/StudyDashboard'
import AnnotationNotebook from '@/pages/AnnotationNotebook'
import BookLayout from '@/components/shared/BookLayout'
import OnboardingOverlay from '@/components/shared/OnboardingOverlay'
import ToastContainer from '@/components/shared/Toast'

export default function App() {
  return (
    <>
      <OnboardingOverlay />
      <Routes>
        <Route path="/" element={<Bookshelf />} />
        {/* Persistent book shell — the four surfaces share one frame + facet switcher.
            Static segments (graph/study/notebook) outrank the dynamic :chapterId,
            so every existing URL still resolves to the same surface. */}
        <Route path="/book/:bookId" element={<BookLayout />}>
          <Route index element={<Reader />} />
          <Route path="graph" element={<KnowledgeGraph />} />
          <Route path="study" element={<StudyDashboard />} />
          <Route path="notebook" element={<AnnotationNotebook />} />
          <Route path=":chapterId" element={<Reader />} />
        </Route>
      </Routes>
      <ToastContainer />
    </>
  )
}
