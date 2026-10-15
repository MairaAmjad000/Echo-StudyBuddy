import { useEffect } from 'react'

export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Echo` : 'Echo: study from your own notes'
  }, [title])
}
