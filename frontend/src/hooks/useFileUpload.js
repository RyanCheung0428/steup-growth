import { useState, useCallback, useRef } from 'react'

const FILE_EXTENSION_MIME_MAP = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mpeg: 'video/mpeg', mov: 'video/quicktime',
  avi: 'video/x-msvideo', flv: 'video/x-flv', webm: 'video/webm',
}

const MAX_FILE_SIZE = 500 * 1024 * 1024

const ANALYZABLE_MIMES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/x-flv', 'video/webm',
])

function getEffectiveMimeType(file) {
  if (file.type && file.type !== 'application/octet-stream') return file.type
  const ext = file.name.split('.').pop().toLowerCase()
  return FILE_EXTENSION_MIME_MAP[ext] || file.type
}

export function useFileUpload() {
  const [selectedFiles, setSelectedFiles] = useState([])
  const objectUrlsRef = useRef(new Map())

  const addFiles = useCallback((fileList) => {
    const newFiles = []
    for (const file of fileList) {
      const mimeType = getEffectiveMimeType(file)
      if (file.size > MAX_FILE_SIZE) continue
      newFiles.push({
        file,
        name: file.name,
        size: file.size,
        mimeType,
        analyzable: ANALYZABLE_MIMES.has(mimeType),
        objectUrl: null,
      })
    }
    setSelectedFiles(prev => {
      const updated = [...prev, ...newFiles]
      for (const f of newFiles) {
        const url = URL.createObjectURL(f.file)
        objectUrlsRef.current.set(f, url)
        f.objectUrl = url
      }
      return updated
    })
    return newFiles
  }, [])

  const removeFile = useCallback((index) => {
    setSelectedFiles(prev => {
      const removed = prev[index]
      if (removed?.objectUrl) {
        URL.revokeObjectURL(removed.objectUrl)
        objectUrlsRef.current.delete(removed)
      }
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const clearFiles = useCallback(() => {
    setSelectedFiles(prev => {
      for (const f of prev) {
        if (f?.objectUrl) URL.revokeObjectURL(f.objectUrl)
      }
      objectUrlsRef.current.clear()
      return []
    })
  }, [])

  const revokeAllUrls = useCallback(() => {
    for (const f of selectedFiles) {
      if (f?.objectUrl) URL.revokeObjectURL(f.objectUrl)
    }
    objectUrlsRef.current.clear()
  }, [selectedFiles])

  return {
    selectedFiles,
    setSelectedFiles,
    addFiles,
    removeFile,
    clearFiles,
    revokeAllUrls,
  }
}