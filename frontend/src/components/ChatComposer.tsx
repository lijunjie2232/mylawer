import React, { useRef, useState } from 'react'
import {
  Box,
  CircularProgress,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  ArrowUpward as SendIcon,
  AttachFile as AttachIcon,
  AutoAwesome as ModelIcon,
  BoltOutlined as SendNowIcon,
  Close as CloseIcon,
  DescriptionOutlined as FileTextIcon,
  EditOutlined as EditIcon,
  ErrorOutline as ErrorIcon,
  PictureAsPdfOutlined as PdfIcon,
  Stop as StopIcon,
} from '@mui/icons-material'
import { formatFileSize, type FileAttachmentRef } from '../utils/agentTrace'

export interface ModelOption {
  name: string
  displayName: string
  provider: string
  description?: string
  isEnabled: boolean
  isHealthy?: boolean
}

export interface StagedAttachmentRef {
  receiptId: string
  file: FileAttachmentRef
}

export interface DraftAttachment {
  id: string
  name: string
  bytes: number
  status: 'uploading' | 'ready' | 'error'
  receiptId?: string
  file?: FileAttachmentRef
  error?: string
}

export interface QueuedItem {
  id: string
  text: string
  attachments?: StagedAttachmentRef[]
}

const ACCEPTED_FILE_TYPES =
  '.txt,.text,.md,.markdown,.csv,.tsv,.json,.jsonl,.xml,.html,.htm,.yaml,.yml,.log,.ini,.conf,.cfg,.tex,.rtf,.pdf,text/plain,text/markdown,text/csv,application/json,application/pdf'

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (e?: React.FormEvent) => void
  onStop: () => void
  isLoading: boolean
  models: ModelOption[]
  selectedModel: string
  isModelsLoading: boolean
  onSelectModel: (model: string) => void
  pendingQueue: QueuedItem[]
  onRemoveQueued: (id: string) => void
  onEditQueued: (item: QueuedItem) => void
  onSendQueuedNow: (item: QueuedItem) => void
  attachments: DraftAttachment[]
  onAddFiles: (files: FileList | File[]) => void
  onRemoveAttachment: (id: string) => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
}

/**
 * deepseek-harness の会話コンポーザー + QueueDock + 添付ファイルチップに倣った入力カード。
 * テキスト系ファイルおよび埋め込みテキスト PDF のドラッグ＆ドロップ / ファイル選択に対応。
 */
const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  models,
  selectedModel,
  isModelsLoading,
  onSelectModel,
  pendingQueue,
  onRemoveQueued,
  onEditQueued,
  onSendQueuedNow,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  inputRef,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const hasUploading = attachments.some(a => a.status === 'uploading')
  const hasReadyAttachment = attachments.some(a => a.status === 'ready')
  const canSend = !hasUploading && (value.trim().length > 0 || hasReadyAttachment)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files)
    }
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files)
    }
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 784,
        mx: 'auto',
        px: { xs: 1.5, sm: 2 },
        pb: { xs: 1.5, sm: 2.25 },
        pt: 0.5,
      }}
    >
      {/* QueueDock: 実行中に積まれた次の質問 */}
      {pendingQueue.length > 0 && (
        <Box
          sx={{
            mx: 1.5,
            mb: -0.75,
            pb: 1.5,
            pt: 1,
            px: 1.5,
            borderRadius: '14px 14px 0 0',
            border: '1px solid',
            borderBottom: 'none',
            borderColor: 'divider',
            bgcolor: theme =>
              theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
          }}
        >
          <Typography
            variant="caption"
            sx={{ display: 'block', mb: 0.5, color: 'text.secondary', fontWeight: 500, fontSize: '0.73rem' }}
          >
            送信待ち {pendingQueue.length} 件（完了後に自動送信）
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35, maxHeight: 108, overflowY: 'auto' }}>
            {pendingQueue.map(item => (
              <Box
                key={item.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.3,
                  borderRadius: '8px',
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" noWrap sx={{ flexGrow: 1, minWidth: 0, fontSize: '0.82rem' }}>
                  {item.attachments && item.attachments.length > 0
                    ? `[添付 ${item.attachments.length}件] ${item.text || item.attachments[0].file.name}`
                    : item.text}
                </Typography>
                <Tooltip title="現在の生成を停止して今すぐ送信">
                  <IconButton
                    size="small"
                    aria-label="今すぐ送信"
                    onClick={() => onSendQueuedNow(item)}
                    sx={{ p: 0.3, color: 'primary.main' }}
                  >
                    <SendNowIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="入力欄に戻して編集">
                  <IconButton
                    size="small"
                    aria-label="編集"
                    onClick={() => onEditQueued(item)}
                    sx={{ p: 0.3, color: 'text.secondary' }}
                  >
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="キューから削除">
                  <IconButton
                    size="small"
                    aria-label="キューから削除"
                    onClick={() => onRemoveQueued(item.id)}
                    sx={{ p: 0.3, color: 'text.secondary' }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* メイン入力カード */}
      <Box
        component="form"
        onSubmit={onSubmit}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          position: 'relative',
          borderRadius: '20px',
          border: '1px solid',
          borderColor: isDragging ? 'primary.main' : 'divider',
          bgcolor: isDragging
            ? theme => (theme.palette.mode === 'dark' ? 'rgba(96,143,255,0.08)' : 'rgba(59,108,245,0.04)')
            : 'background.paper',
          boxShadow: theme =>
            theme.palette.mode === 'dark'
              ? '0 2px 12px rgba(0,0,0,0.32)'
              : '0 2px 14px rgba(15,23,42,0.06)',
          transition: 'border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease',
          '&:focus-within': {
            borderColor: 'primary.main',
            boxShadow: theme =>
              theme.palette.mode === 'dark'
                ? '0 0 0 1px rgba(96,143,255,0.35), 0 4px 16px rgba(0,0,0,0.4)'
                : '0 0 0 2px rgba(59,108,245,0.14), 0 4px 16px rgba(15,23,42,0.08)',
          },
          px: 2,
          pt: 1.5,
          pb: 1.25,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-label="ファイルを添付"
        />

        {/* 添付ファイルチップ一覧 */}
        {attachments.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {attachments.map(att => {
              const isPdf = att.name.toLowerCase().endsWith('.pdf') || att.file?.mediaType === 'application/pdf'
              const isError = att.status === 'error'
              const isUploading = att.status === 'uploading'
              const metaParts = [
                formatFileSize(att.file?.bytes ?? att.bytes),
                ...(att.file?.pageCount ? [`${att.file.pageCount}P`] : []),
              ].join(' · ')

              return (
                <Tooltip
                  key={att.id}
                  title={isError ? att.error || 'アップロードに失敗しました' : `${att.name} (${metaParts})`}
                >
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.65,
                      pl: 1,
                      pr: 0.5,
                      py: 0.45,
                      maxWidth: 250,
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: isError ? 'error.main' : 'divider',
                      bgcolor: theme =>
                        isError
                          ? theme.palette.mode === 'dark'
                            ? 'rgba(244,67,54,0.12)'
                            : 'rgba(244,67,54,0.06)'
                          : theme.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.04)'
                            : 'rgba(15,23,42,0.03)',
                    }}
                  >
                    {isUploading ? (
                      <CircularProgress size={14} sx={{ flex: 'none' }} />
                    ) : isError ? (
                      <ErrorIcon sx={{ fontSize: 15, color: 'error.main', flex: 'none' }} />
                    ) : isPdf ? (
                      <PdfIcon sx={{ fontSize: 16, color: 'error.main', flex: 'none' }} />
                    ) : (
                      <FileTextIcon sx={{ fontSize: 16, color: 'primary.main', flex: 'none' }} />
                    )}

                    <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{
                          fontSize: '0.76rem',
                          fontWeight: 500,
                          lineHeight: 1.25,
                          color: isError ? 'error.main' : 'text.primary',
                        }}
                      >
                        {att.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{
                          fontSize: '0.68rem',
                          lineHeight: 1.2,
                          color: isError ? 'error.main' : 'text.secondary',
                        }}
                      >
                        {isUploading ? '解析・アップロード中...' : isError ? att.error || 'エラー' : metaParts}
                      </Typography>
                    </Box>

                    <IconButton
                      size="small"
                      aria-label={`${att.name} を削除`}
                      onClick={() => onRemoveAttachment(att.id)}
                      sx={{ p: 0.25, ml: 0.25, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                    >
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                </Tooltip>
              )
            })}
          </Box>
        )}

        <InputBase
          fullWidth
          multiline
          minRows={1}
          maxRows={8}
          inputRef={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={
            isDragging
              ? 'ここにファイルをドロップして添付...'
              : isLoading
                ? '次の質問を入力すると送信待ちキューに追加されます...'
                : '法律相談のご質問を入力、または契約書・PDF ファイルを添付してください...'
          }
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (canSend) onSubmit(e)
            }
          }}
          sx={{
            fontSize: '0.95rem',
            lineHeight: 1.55,
            '& textarea': {
              resize: 'none',
            },
          }}
        />

        {/* 下段ツールバー */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            <Tooltip title="ファイルを添付（テキスト系ファイル・埋め込みテキストPDF）">
              <IconButton
                type="button"
                size="small"
                aria-label="ファイルを添付"
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: 'divider',
                  color: 'text.secondary',
                  bgcolor: theme =>
                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  '&:hover': {
                    color: 'primary.main',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <AttachIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>

            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.25,
                borderRadius: '10px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: theme =>
                  theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                maxWidth: { xs: 170, sm: 250 },
              }}
            >
              <ModelIcon sx={{ fontSize: 14, color: 'text.secondary', flex: 'none' }} />
              <Select
                variant="standard"
                disableUnderline
                value={selectedModel}
                onChange={e => onSelectModel(e.target.value)}
                disabled={isLoading || isModelsLoading}
                displayEmpty
                sx={{
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  color: 'text.secondary',
                  minWidth: 0,
                  '& .MuiSelect-select': {
                    py: 0.25,
                    pr: '22px !important',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
              >
                {models.map(model => (
                  <MenuItem key={model.name} value={model.name} sx={{ fontSize: '0.82rem' }}>
                    {model.displayName}
                    {model.isHealthy === false && ' (メンテナンス中)'}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Typography
              variant="caption"
              sx={{
                display: { xs: 'none', md: 'inline' },
                color: 'text.disabled',
                fontSize: '0.72rem',
                whiteSpace: 'nowrap',
              }}
            >
              {isLoading ? 'Esc 停止 · Enter 予約' : 'Enter 送信 · Shift+Enter 改行'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 'none' }}>
            {isLoading && canSend && (
              <Tooltip title="送信待ちキューに追加">
                <IconButton
                  type="submit"
                  size="small"
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: '1px solid',
                    borderColor: 'divider',
                    color: 'text.primary',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <SendIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            )}

            {isLoading ? (
              <Tooltip title="生成を停止 (Esc)">
                <IconButton
                  type="button"
                  onClick={onStop}
                  aria-label="生成を停止"
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    bgcolor: 'text.primary',
                    color: 'background.paper',
                    '&:hover': { opacity: 0.85, bgcolor: 'text.primary' },
                  }}
                >
                  <StopIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title={hasUploading ? 'アップロード完了を待っています...' : '送信 (Enter)'}>
                <span>
                  <IconButton
                    type="submit"
                    disabled={!canSend}
                    aria-label="送信"
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      bgcolor: canSend ? 'primary.main' : 'action.disabledBackground',
                      color: canSend ? '#ffffff' : 'action.disabled',
                      transition: 'background-color 120ms ease',
                      '&:hover': canSend ? { bgcolor: 'primary.dark' } : {},
                    }}
                  >
                    <SendIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default ChatComposer
