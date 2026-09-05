import { useState, useRef } from 'react'
import { UploadCloud, Image as ImageIcon, X, Loader2, AlertCircle, Link as LinkIcon } from 'lucide-react'

// Función para aplicar transformaciones de optimización en Cloudinary
function applyCloudinaryTransformation(url) {
  if (!url) return url
  if (url.includes('/image/upload/') && !url.includes('/f_auto,q_auto,w_600,c_limit/')) {
    return url.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_600,c_limit/')
  }
  return url
}

// Cálculo de firma SHA-1 nativo usando Web Crypto API para subidas firmadas
async function generateSha1Signature(timestamp, apiSecret) {
  const str = `timestamp=${timestamp}${apiSecret}`
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function ImageUploader({ value, onChange, label = 'Imagen' }) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [useUrlInput, setUseUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState(value || '')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = async (file) => {
    if (!file) return
    setError('')

    // Validación de tipo de archivo (PNG, JPG, WEBP)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type.toLowerCase())) {
      setError('Formato no permitido. Solo se aceptan imágenes PNG, JPG o WEBP.')
      return
    }

    // Validación de tamaño (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen supera el límite de 2 MB permitido.')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const cloudName =
        import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME ||
        (typeof process !== 'undefined' ? process.env.VITE_CLOUDINARY_CLOUD_NAME : '') ||
        'ndaarqff'

      const apiKey =
        import.meta.env?.VITE_CLOUDINARY_API_KEY ||
        (typeof process !== 'undefined' ? process.env.CLOUDINARY_API_KEY : '') ||
        ''

      const apiSecret =
        import.meta.env?.VITE_CLOUDINARY_API_SECRET ||
        (typeof process !== 'undefined' ? process.env.CLOUDINARY_API_SECRET : '') ||
        ''

      const uploadPreset =
        import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET ||
        (typeof window !== 'undefined' ? localStorage.getItem('CLOUDINARY_UPLOAD_PRESET') : '') ||
        'deposito-bombal'

      const formData = new FormData()
      formData.append('file', file)

      if (apiKey && apiSecret) {
        const timestamp = Math.floor(Date.now() / 1000)
        const signature = await generateSha1Signature(timestamp, apiSecret)
        formData.append('api_key', apiKey)
        formData.append('timestamp', timestamp)
        formData.append('signature', signature)
      } else if (uploadPreset) {
        formData.append('upload_preset', uploadPreset)
      }

      // XMLHttpRequest para medir y mostrar el porcentaje de progreso en tiempo real
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(percent)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            const rawUrl = response.secure_url || response.url
            if (!rawUrl) {
              throw new Error('No se recibió la URL de la imagen')
            }

            // Aplicar transformación requerida: f_auto,q_auto,w_600,c_limit
            const transformedUrl = applyCloudinaryTransformation(rawUrl)
            onChange(transformedUrl)
            setUrlInput(transformedUrl)
            setError('')
          } catch (e) {
            console.error('[Cloudinary] Error parseando respuesta:', e)
            setError('Error procesando la respuesta de la imagen. Podés reintentar.')
          }
        } else {
          let msg = 'Error al subir la imagen a Cloudinary.'
          try {
            const resErr = JSON.parse(xhr.responseText)
            if (resErr.error?.message) {
              if (resErr.error.message.includes('Upload preset must be whitelisted')) {
                msg = `El preset de carga '${uploadPreset}' requiere ser de tipo 'Unsigned' en Cloudinary. Por favor indicá el valor de VITE_CLOUDINARY_UPLOAD_PRESET.`
              } else {
                msg = `Error de Cloudinary: ${resErr.error.message}`
              }
            }
          } catch (e) {}
          console.error('[Cloudinary] Error en respuesta HTTP:', xhr.status, xhr.responseText)
          setError(msg)
        }
        setIsUploading(false)
      }

      xhr.onerror = () => {
        console.error('[Cloudinary] Error de red')
        setError('Error de conexión al subir la imagen. Por favor reintentá.')
        setIsUploading(false)
      }

      xhr.send(formData)
    } catch (err) {
      console.error('[ImageUploader] Error al preparar la subida:', err)
      setError('Ocurrió un error al procesar el archivo. Podés reintentar.')
      setIsUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleRemove = () => {
    onChange('')
    setUrlInput('')
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleApplyUrl = () => {
    onChange(urlInput.trim())
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-gray-700">{label}</label>
        <button
          type="button"
          onClick={() => setUseUrlInput(!useUrlInput)}
          className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <LinkIcon className="w-3 h-3" />
          <span>{useUrlInput ? 'Subir archivo' : 'Ingresar URL directa'}</span>
        </button>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Vista previa de la imagen seleccionada */}
      {value ? (
        <div className="relative group border border-gray-200 rounded-lg p-2 bg-gray-50 flex items-center gap-4">
          <div className="w-16 h-16 rounded-md bg-white border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
            <img
              src={value}
              alt="Vista previa"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.target.onerror = null
                e.target.src = 'https://placehold.co/100x100?text=Error'
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">
              {value.startsWith('data:') ? 'Imagen cargada localmente' : value}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">Imagen vinculada correctamente</p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1.5 rounded-md text-red-600 hover:bg-red-50 transition-colors"
            title="Quitar imagen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : useUrlInput ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://ejemplo.com/imagen.jpg"
            className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)]"
          />
          <button
            type="button"
            onClick={handleApplyUrl}
            className="px-3 py-2 text-xs font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-lg transition-colors cursor-pointer"
          >
            Aplicar
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-[var(--primary)] bg-red-50/50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            className="hidden"
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
              <span className="text-xs font-medium text-gray-600">
                Subiendo imagen al servidor... ({uploadProgress}%)
              </span>
              <div className="w-full max-w-xs bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[var(--primary)] h-1.5 rounded-full transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-1">
              <UploadCloud className="w-6 h-6 text-gray-400" />
              <p className="text-xs font-medium text-gray-700">
                Arrastrá una imagen o <span className="text-[var(--primary)] underline">explorá</span>
              </p>
              <p className="text-[10px] text-gray-400">PNG, JPG o WEBP hasta 2MB</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
