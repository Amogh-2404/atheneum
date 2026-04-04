import { Routes, Route } from 'react-router-dom'
import Bookshelf from '@/pages/Bookshelf'
import Reader from '@/pages/Reader'
import KnowledgeGraph from '@/pages/KnowledgeGraph'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Bookshelf />} />
      <Route path="/book/:bookId" element={<Reader />} />
      <Route path="/book/:bookId/graph" element={<KnowledgeGraph />} />
      <Route path="/book/:bookId/:chapterId" element={<Reader />} />
    </Routes>
  )
}
