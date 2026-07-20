import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UploadCloud, CheckCircle2, AlertTriangle, File as FileIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { Button } from '@/components/ui/button'

export default function PortalCliente() {
  const { token } = useParams<{ token: string }>()
  const [files, setFiles] = useState<File[]>([])
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ['portalInfo', token],
    queryFn: () => api.portal.getInfo(token!),
    enabled: !!token,
    retry: false
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)])
      setSuccess(false)
      setError('')
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
      setSuccess(false)
      setError('')
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0 || !token) return
    try {
      setUploading(true)
      setError('')
      
      // Format YYYY-MM to MM/YYYY
      const [year, month] = competencia.split('-')
      const formattedCompetencia = `${month}/${year}`

      // Upload all files in parallel
      await Promise.all(files.map(f => api.portal.upload(token, f, formattedCompetencia)))
      
      setSuccess(true)
      setFiles([])
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer upload dos arquivos. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner label="Validando acesso..." />
      </div>
    )
  }

  if (isError || !info) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <AlertTriangle className="mb-4 h-16 w-16 text-[#ef4444]" />
        <h1 className="mb-2 text-2xl font-bold text-white">Acesso Expirado ou Inválido</h1>
        <p className="text-text-secondary">O link que você tentou acessar não é mais válido. Por favor, solicite um novo link à Mendonça Galvão.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl rounded-2xl border border-border bg-sidebar p-8 shadow-2xl"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
            <UploadCloud className="h-8 w-8 text-gold" />
          </div>
          <h1 className="text-2xl font-bold text-white">Portal do Cliente</h1>
          <p className="mt-2 text-text-secondary">
            Olá, <strong className="text-text-primary">{info.nomeFantasia || info.razaoSocial}</strong>! <br />
            Envie seus documentos pendentes de forma segura.
          </p>
        </div>

        {success && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 flex flex-col items-center justify-center rounded-lg border border-[#22c55e]/50 bg-[#22c55e]/10 p-6 text-center text-[#22c55e]"
          >
            <CheckCircle2 className="mb-2 h-10 w-10" />
            <p className="font-medium">Arquivo enviado com sucesso!</p>
            <p className="text-sm opacity-80">Você pode enviar mais arquivos se necessário.</p>
          </motion.div>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-[#ef4444]/10 p-4 text-center text-sm text-[#ef4444]">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-text-secondary">Competência (Mês/Ano)</label>
          <input 
            type="month" 
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-primary outline-none focus:border-[#d4a843] focus:ring-1 focus:ring-[#d4a843]/30"
          />
          <p className="mt-1 text-xs text-text-muted">Selecione o mês de referência destes arquivos.</p>
        </div>

        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`relative mb-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            files.length > 0 ? 'border-[#d4a843] bg-gold/5' : 'border-border hover:border-[#4a4a4a] hover:bg-card'
          }`}
        >
          <input 
            type="file" 
            multiple
            className="absolute inset-0 z-50 h-full w-full cursor-pointer opacity-0" 
            onChange={handleFileChange}
          />
          
          {files.length > 0 ? (
            <div className="w-full relative z-50">
              <UploadCloud className="mx-auto mb-3 h-8 w-8 text-gold" />
              <p className="font-medium text-text-primary mb-4">{files.length} arquivo(s) selecionado(s)</p>
              <div className="max-h-40 overflow-y-auto space-y-2 text-left bg-card p-3 rounded-lg border border-border">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileIcon className="h-4 w-4 shrink-0 text-text-secondary" />
                      <span className="truncate text-[#d4d4d4]">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-text-muted">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                      <button 
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFile(i); }}
                        className="text-[#ef4444] hover:text-[#ff6b6b] px-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-text-secondary">Clique ou arraste mais arquivos para adicionar</p>
            </div>
          ) : (
            <>
              <UploadCloud className="mb-3 h-12 w-12 text-text-muted" />
              <p className="font-medium text-text-primary">Clique ou arraste os arquivos aqui</p>
              <p className="mt-1 text-sm text-text-muted">PDF, XML, ZIP, Imagens (Máx: 50MB)</p>
            </>
          )}
        </div>

        <Button 
          className="w-full bg-gold py-6 text-lg font-bold text-black hover:bg-[#e5bc55]"
          disabled={files.length === 0 || uploading}
          onClick={handleUpload}
        >
          {uploading ? (
            <>Enviando {files.length} arquivo(s)...</>
          ) : (
            <>Enviar Arquivo{files.length > 1 ? 's' : ''}</>
          )}
        </Button>
        
        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-text-muted">
          <p>Plataforma Segura • Mendonça Galvão CRM Contábil</p>
        </div>
      </motion.div>
    </div>
  )
}
