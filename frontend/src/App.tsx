import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import axios from 'axios'
import {
  Box,
  Typography,
  IconButton,
  Button,
  Alert,
  Snackbar,
  Tooltip,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Fade,
} from '@mui/material'
import {
  Add as NewChatIcon,
  Balance as ScaleIcon,
  Check as CheckIcon,
  ContentCopy as CopyIcon,
  DescriptionOutlined as FileTextIcon,
  EditOutlined as EditIcon,
  Gavel as LawIcon,
  KeyboardArrowDown as ScrollDownIcon,
  Menu as MenuIcon,
  PictureAsPdfOutlined as PdfIcon,
  UnfoldLess as CollapseAllIcon,
  UnfoldMore as ExpandAllIcon,
  VisibilityOutlined as DetailIcon,
} from '@mui/icons-material'
import AuthDialog from './components/AuthDialog'
import SidebarPanel from './components/SidebarPanel'
import AgentTrace, { type ExpandSignal } from './components/AgentTrace'
import ChatComposer, {
  type DraftAttachment,
  type ModelOption,
  type QueuedItem,
  type StagedAttachmentRef,
} from './components/ChatComposer'
import {
  applyAgentEvent,
  buildMessages,
  extractTurnMeta,
  formatFileSize,
} from './utils/agentTrace'
import type { ChatMessage, HistoryMessage } from './utils/agentTrace'

const MAX_FILES_PER_MESSAGE = 5
const DEFAULT_ATTACHMENT_PROMPT = '添付ファイルの内容を法的な観点から分析してください。'

const EXAMPLE_GROUPS: { category: string; question: string }[] = [
  { category: '刑法', question: '窃盗罪の定義と成立要件を教えてください。' },
  { category: '刑法', question: '詐欺罪と横領罪の違いは何ですか？' },
  { category: '刑法', question: '正当防衛が認められる要件を教えてください。' },
  { category: '最新法改正', question: '2026年4月から施行される新しい自転車関連の法改正について教えてください。' },
  { category: '手続き', question: '横浜市で婚姻届を提出する際に必要な書類と手続きを教えてください。' },
  { category: '生活トラブル', question: '隣人との騒音トラブルに対する法的措置には何がありますか？' },
]

/** ユーザー発話（右寄せバブル + コピー / 編集して再送信アクション） */
const UserMessageRow: React.FC<{
  message: ChatMessage
  onEditResend: (text: string) => void
}> = ({ message, onEditResend }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard?.writeText(message.content).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  return (
    <Box
      id={`turn-${message.id}`}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        mb: 3,
        '&:hover .user-msg-actions': { opacity: 1 },
      }}
    >
      {message.attachments && message.attachments.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: 0.65,
            mb: 0.75,
            maxWidth: { xs: '88%', sm: '76%' },
          }}
        >
          {message.attachments.map(att => {
            const isPdf = att.mediaType === 'application/pdf' || att.name.toLowerCase().endsWith('.pdf')
            const meta = [
              formatFileSize(att.bytes),
              ...(att.pageCount ? [`${att.pageCount}P`] : []),
            ].join(' · ')
            return (
              <Box
                key={att.attachmentId + att.name}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.6,
                  px: 1.1,
                  py: 0.45,
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  maxWidth: 260,
                }}
              >
                {isPdf ? (
                  <PdfIcon sx={{ fontSize: 15, color: 'error.main', flex: 'none' }} />
                ) : (
                  <FileTextIcon sx={{ fontSize: 15, color: 'primary.main', flex: 'none' }} />
                )}
                <Typography variant="caption" noWrap sx={{ fontWeight: 500, fontSize: '0.76rem' }}>
                  {att.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', flex: 'none' }}>
                  {meta}
                </Typography>
              </Box>
            )
          })}
        </Box>
      )}
      <Box
        sx={{
          maxWidth: { xs: '88%', sm: '76%' },
          px: 2,
          py: 1.25,
          borderRadius: '18px',
          bgcolor: theme =>
            theme.palette.mode === 'dark' ? 'rgba(96, 143, 255, 0.16)' : '#eef3fe',
          color: 'text.primary',
          border: '1px solid',
          borderColor: theme =>
            theme.palette.mode === 'dark' ? 'rgba(96, 143, 255, 0.24)' : 'rgba(59, 108, 245, 0.14)',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          minWidth: 0,
          fontSize: '0.94rem',
          lineHeight: 1.6,
        }}
      >
        {message.content}
      </Box>
      <Box
        className="user-msg-actions"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          mt: 0.4,
          px: 0.5,
          opacity: { xs: 0.8, sm: 0 },
          transition: 'opacity 140ms ease',
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontSize: '0.72rem', color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}
        >
          {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </Typography>
        <Tooltip title={copied ? 'コピーしました' : 'コピー'}>
          <IconButton
            size="small"
            onClick={handleCopy}
            aria-label="メッセージをコピー"
            sx={{ p: 0.35, color: copied ? 'success.main' : 'text.secondary' }}
          >
            {copied ? <CheckIcon sx={{ fontSize: 13 }} /> : <CopyIcon sx={{ fontSize: 13 }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="編集して再送信">
          <IconButton
            size="small"
            onClick={() => onEditResend(message.content)}
            aria-label="編集して再送信"
            sx={{ p: 0.35, color: 'text.secondary' }}
          >
            <EditIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}

/** 右端のターンジャンプ・ナビゲーター（deepseek-harness TurnNavigator 準拠） */
const TurnNavigatorRail: React.FC<{
  turns: { id: string; index: number; label: string }[]
  onJump: (id: string) => void
}> = ({ turns, onJump }) => {
  if (turns.length < 2) return null

  return (
    <Box
      aria-label="ターンナビゲーター"
      sx={{
        display: { xs: 'none', lg: 'flex' },
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 0.75,
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 4,
        py: 1,
        px: 0.5,
      }}
    >
      {turns.map(turn => (
        <Tooltip
          key={turn.id}
          placement="left"
          title={`#${turn.index} ${turn.label.slice(0, 48)}${turn.label.length > 48 ? '…' : ''}`}
        >
          <Box
            component="button"
            type="button"
            onClick={() => onJump(turn.id)}
            aria-label={`ターン ${turn.index} へ移動`}
            sx={{
              width: 14,
              height: 4,
              p: 0,
              border: 'none',
              borderRadius: '999px',
              bgcolor: 'text.disabled',
              opacity: 0.45,
              cursor: 'pointer',
              transition: 'width 120ms ease, opacity 120ms ease, background-color 120ms ease',
              '&:hover': {
                width: 22,
                opacity: 1,
                bgcolor: 'primary.main',
              },
            }}
          />
        </Tooltip>
      ))}
    </Box>
  )
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [isModelsLoading, setIsModelsLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string>('')
  const [sessionTitle, setSessionTitle] = useState<string>('新しい相談')
  const [error, setError] = useState<string | null>(null)
  const [demoWarningOpen, setDemoWarningOpen] = useState(true)
  const [pendingQueue, setPendingQueue] = useState<QueuedItem[]>([])
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([])
  const [showScrollButton, setShowScrollButton] = useState(false)

  // DeepSeek Harness UI コントロール状態
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => window.innerWidth >= 900)
  const [detailedMode, setDetailedMode] = useState<boolean>(true)
  const [expandSignal, setExpandSignal] = useState<ExpandSignal | undefined>(undefined)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)

  // Auth states
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<any>(null)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const pinnedToBottomRef = useRef<boolean>(true)
  const abortRef = useRef<AbortController | null>(null)
  const uploadControllersRef = useRef<Map<string, AbortController>>(new Map())

  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) return savedTheme === 'dark'
    return prefersDarkMode
  })

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDarkMode ? 'dark' : 'light',
          primary: {
            main: isDarkMode ? '#608fff' : '#3b6cf5',
            light: '#7da5ff',
            dark: '#2854d6',
          },
          background: {
            default: isDarkMode ? '#141518' : '#ffffff',
            paper: isDarkMode ? '#1c1e22' : '#ffffff',
          },
          divider: isDarkMode ? 'rgba(255, 255, 255, 0.09)' : 'rgba(15, 23, 42, 0.09)',
          text: {
            primary: isDarkMode ? '#eceff4' : '#111827',
            secondary: isDarkMode ? '#9ba3b0' : '#4b5563',
            disabled: isDarkMode ? '#636b78' : '#9ca3af',
          },
        },
        typography: {
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Inter', sans-serif",
          h5: { fontWeight: 600 },
          h6: { fontWeight: 600 },
        },
        shape: { borderRadius: 12 },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 10,
                textTransform: 'none',
                fontWeight: 500,
              },
            },
          },
          MuiCollapse: {
            styleOverrides: {
              wrapperInner: {
                minWidth: 0,
                maxWidth: '100%',
              },
            },
          },
        },
      }),
    [isDarkMode]
  )

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    if (!el) return
    pinnedToBottomRef.current = true
    setShowScrollButton(false)
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const nearBottom = distance < 72
    pinnedToBottomRef.current = nearBottom
    setShowScrollButton(!nearBottom)
  }

  useEffect(() => {
    if (pinnedToBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!isLoading) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !authDialogOpen) {
        abortRef.current?.abort()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isLoading, authDialogOpen])

  useEffect(() => {
    if (token) {
      axios
        .get('/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then(res => {
          if (res.data.success) setUser(res.data.user)
        })
        .catch(() => handleLogout())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleAuthSuccess = (newToken: string, newUser: any) => {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('token', newToken)
    void startNewSession()
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    void startNewSession()
  }

  const handleDeleteAccount = async () => {
    try {
      await axios.delete('/api/user/delete', {
        headers: { Authorization: `Bearer ${token}` },
      })
      handleLogout()
    } catch {
      setError('アカウントの削除に失敗しました')
    }
  }

  const clearDraftAttachments = useCallback(() => {
    for (const ctrl of uploadControllersRef.current.values()) {
      ctrl.abort()
    }
    uploadControllersRef.current.clear()
    setDraftAttachments([])
  }, [])

  const handleSelectSession = async (sid: string, title?: string) => {
    abortRef.current?.abort()
    clearDraftAttachments()
    setSessionId(sid)
    setSessionTitle(title || '保存済みの相談')
    localStorage.setItem('sessionId', sid)
    setMessages([])
    setIsLoading(true)
    try {
      const [messagesResponse, eventsResponse] = await Promise.all([
        axios.get(`/api/chat/sessions/${sid}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios
          .get(`/api/chat/sessions/${sid}/events`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch(() => null),
      ])

      if (messagesResponse.data.success) {
        const history: HistoryMessage[] = messagesResponse.data.messages ?? []
        const events = eventsResponse?.data?.success ? eventsResponse.data.events : []
        pinnedToBottomRef.current = true
        setMessages(buildMessages(history, events))
      }
    } catch {
      setError('会話履歴の読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const initializeSession = async () => {
      const savedSessionId = localStorage.getItem('sessionId')
      if (savedSessionId) {
        setSessionId(savedSessionId)
        return
      }

      try {
        const response = await axios.post(
          '/api/sessions/new',
          {},
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        )
        if (response.data.success) {
          setSessionId(response.data.sessionId)
          localStorage.setItem('sessionId', response.data.sessionId)
        }
      } catch {
        const fallback = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
        setSessionId(fallback)
        localStorage.setItem('sessionId', fallback)
      }
    }

    void initializeSession()
  }, [token])

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await axios.get('/models')
        if (response.data.success) {
          setModels(response.data.models)
          setSelectedModel(response.data.defaultModel)
        }
      } catch {
        setModels([
          {
            name: 'gpt-oss:20b',
            displayName: 'Ollama - gpt-oss:20b',
            provider: 'ollama',
            description: 'デフォルトモデル',
            isEnabled: true,
          },
        ])
        setSelectedModel('gpt-oss:20b')
      } finally {
        setIsModelsLoading(false)
      }
    }

    void fetchModels()
  }, [])

  const toggleDarkMode = () => {
    const next = !isDarkMode
    setIsDarkMode(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const startNewSession = async () => {
    abortRef.current?.abort()
    clearDraftAttachments()
    setPendingQueue([])
    setSessionTitle('新しい相談')
    try {
      if (sessionId) {
        try {
          await axios.delete(`/api/sessions/${sessionId}/clear`)
        } catch {
          // ignore
        }
      }

      const response = await axios.post(
        '/api/sessions/new',
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      if (response.data.success) {
        setSessionId(response.data.sessionId)
        localStorage.setItem('sessionId', response.data.sessionId)
        setMessages([])
        setError(null)
      }
    } catch {
      const fallback = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      setSessionId(fallback)
      localStorage.setItem('sessionId', fallback)
      setMessages([])
      setError('セッションの開始に失敗しました')
    }
  }

  const handleAddFiles = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList)
    if (incoming.length === 0) return

    let activeSessionId = sessionId
    if (!activeSessionId) {
      activeSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      setSessionId(activeSessionId)
      localStorage.setItem('sessionId', activeSessionId)
    }

    const currentValidCount = draftAttachments.filter(a => a.status !== 'error').length
    const availableSlots = Math.max(0, MAX_FILES_PER_MESSAGE - currentValidCount)
    if (availableSlots === 0) {
      setError(`1回のメッセージで添付できるファイルは最大 ${MAX_FILES_PER_MESSAGE} 件までです。`)
      return
    }

    const selected = incoming.slice(0, availableSlots)
    if (incoming.length > availableSlots) {
      setError(`最大 ${MAX_FILES_PER_MESSAGE} 件までのため、先頭 ${availableSlots} 件のみ添付しました。`)
    }

    for (const file of selected) {
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const controller = new AbortController()
      uploadControllersRef.current.set(id, controller)

      setDraftAttachments(prev => [
        ...prev,
        { id, name: file.name, bytes: file.size, status: 'uploading' },
      ])

      void (async () => {
        try {
          const params = new URLSearchParams({
            sessionId: activeSessionId,
            name: file.name,
          })
          const response = await fetch(`/api/attachments/upload?${params.toString()}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: file,
            signal: controller.signal,
          })

          const data = await response.json().catch(() => null)
          if (!response.ok || !data?.success) {
            const msg = data?.error || `アップロードに失敗しました (HTTP ${response.status})`
            setDraftAttachments(prev =>
              prev.map(item => (item.id === id ? { ...item, status: 'error', error: msg } : item))
            )
            setError(msg)
            return
          }

          setDraftAttachments(prev =>
            prev.map(item =>
              item.id === id
                ? {
                    ...item,
                    status: 'ready',
                    receiptId: data.receiptId,
                    file: data.file,
                  }
                : item
            )
          )
        } catch (err) {
          if ((err as any)?.name === 'AbortError') return
          const msg = 'ファイルのアップロード中に通信エラーが発生しました。'
          setDraftAttachments(prev =>
            prev.map(item => (item.id === id ? { ...item, status: 'error', error: msg } : item))
          )
          setError(msg)
        } finally {
          uploadControllersRef.current.delete(id)
        }
      })()
    }
  }

  const handleRemoveAttachment = (id: string) => {
    const ctrl = uploadControllersRef.current.get(id)
    if (ctrl) {
      ctrl.abort()
      uploadControllersRef.current.delete(id)
    }
    setDraftAttachments(prev => prev.filter(item => item.id !== id))
  }

  interface SendOptions {
    retry?: boolean
    continue?: boolean
    targetId?: string
    attachments?: StagedAttachmentRef[]
  }

  const sendQuestion = async (question: string | null, options: SendOptions = {}) => {
    const { retry = false, continue: isContinue = false, targetId, attachments = [] } = options
    const trimmed = question?.trim() ?? ''
    if (!isContinue && !trimmed && attachments.length === 0) return

    const effectiveQuestion = trimmed || (attachments.length > 0 ? DEFAULT_ATTACHMENT_PROMPT : '')
    const attachmentReceiptIds = attachments.map(a => a.receiptId)
    const attachmentRefs = attachments.map(a => a.file)

    setError(null)
    setIsLoading(true)
    pinnedToBottomRef.current = true
    setShowScrollButton(false)

    if (!isContinue && !retry) {
      if (messages.length === 0) {
        const titleSource = trimmed || (attachmentRefs[0] ? `📎 ${attachmentRefs[0].name}` : effectiveQuestion)
        setSessionTitle(titleSource.slice(0, 28) + (titleSource.length > 28 ? '…' : ''))
      }
      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        content: effectiveQuestion,
        sender: 'user',
        timestamp: new Date(),
        trace: [],
        ...(attachmentRefs.length > 0 ? { attachments: attachmentRefs } : {}),
      }
      setMessages(prev => [...prev, userMessage])
    }

    const assistantMessageId = targetId ?? `a-${Date.now()}`

    if (targetId) {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === targetId ? { ...msg, streaming: true, interrupted: false } : msg
        )
      )
    } else {
      const tempAssistantMessage: ChatMessage = {
        id: assistantMessageId,
        content: '',
        sender: 'assistant',
        timestamp: new Date(),
        trace: [],
        streaming: true,
      }
      setMessages(prev => [...prev, tempAssistantMessage])
    }

    const patchAssistant = (updater: (msg: ChatMessage) => ChatMessage) => {
      setMessages(prev => prev.map(msg => (msg.id === assistantMessageId ? updater(msg) : msg)))
    }

    const handleStreamEvent = (data: any) => {
      const { type, timestamp: _ts, ...payload } = data

      if (type === 'session') {
        if (payload.sessionId && payload.sessionId !== sessionId) {
          setSessionId(payload.sessionId)
          localStorage.setItem('sessionId', payload.sessionId)
        }
        return
      }

      if (type === 'complete') {
        if (payload.sessionId && payload.sessionId !== sessionId) {
          setSessionId(payload.sessionId)
          localStorage.setItem('sessionId', payload.sessionId)
        }
        patchAssistant(msg => ({ ...msg, streaming: false, interrupted: false }))
        setSidebarRefreshKey(k => k + 1)
        return
      }

      if (type === 'error') {
        patchAssistant(msg => ({
          ...msg,
          streaming: false,
          interrupted: true,
          trace: applyAgentEvent(msg.trace, 'error', payload, true),
        }))
        return
      }

      patchAssistant(msg => {
        const nextTrace = applyAgentEvent(msg.trace, type, payload, true)
        if (type === 'turn/end') {
          const meta = extractTurnMeta(payload)
          return {
            ...msg,
            trace: nextTrace,
            streaming: false,
            interrupted: meta.status === 'error' || meta.status === 'aborted',
            turnMeta: meta,
          }
        }
        return { ...msg, trace: nextTrace }
      })
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/legal/query/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...(isContinue ? { continue: true } : { question: effectiveQuestion }),
          ...(attachmentReceiptIds.length > 0 ? { attachmentReceiptIds } : {}),
          retry,
          model: selectedModel,
          sessionId,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      if (!response.body) throw new Error('ReadableStream not supported')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          let boundary = buffer.indexOf('\n\n')

          while (boundary >= 0) {
            const block = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)

            for (const line of block.split('\n')) {
              if (!line.startsWith('data:')) continue
              const raw = line.slice(5).trim()
              if (!raw) continue
              try {
                handleStreamEvent(JSON.parse(raw))
              } catch {
                // ignore malformed chunk
              }
            }

            boundary = buffer.indexOf('\n\n')
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        patchAssistant(msg => ({
          ...msg,
          streaming: false,
          interrupted: true,
          turnMeta: msg.turnMeta ?? { status: 'aborted' },
        }))
        return
      }

      if (retry || isContinue || (!effectiveQuestion && attachmentReceiptIds.length === 0)) {
        patchAssistant(msg => ({ ...msg, streaming: false, interrupted: true }))
        setError('通信に失敗しました。再試行してください。')
        return
      }

      try {
        const response = await axios.post(
          '/api/legal/query',
          {
            question: effectiveQuestion,
            model: selectedModel,
            sessionId,
            ...(attachmentReceiptIds.length > 0 ? { attachmentReceiptIds } : {}),
          },
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        )

        if (response.data.sessionId && response.data.sessionId !== sessionId) {
          setSessionId(response.data.sessionId)
          localStorage.setItem('sessionId', response.data.sessionId)
        }

        patchAssistant(msg => ({
          ...msg,
          content: response.data.answer,
          streaming: false,
        }))
        setSidebarRefreshKey(k => k + 1)
      } catch {
        patchAssistant(msg => ({
          ...msg,
          content: '申し訳ありませんが、リクエストの処理中にエラーが発生しました。後ほど再度お試しください。',
          streaming: false,
          interrupted: true,
        }))
        setError('API リクエストに失敗しました')
      }
    } finally {
      abortRef.current = null
      patchAssistant(msg => ({ ...msg, streaming: false }))
      setIsLoading(false)
    }
  }

  /** 実行中はキューに積み、空いたら自動送信する（deepseek-harness next-turn queue） */
  useEffect(() => {
    if (isLoading || pendingQueue.length === 0) return
    const [next, ...rest] = pendingQueue
    setPendingQueue(rest)
    void sendQuestion(next.text, { attachments: next.attachments })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, pendingQueue])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (draftAttachments.some(a => a.status === 'uploading')) return

    const text = inputValue.trim()
    const readyAttachments: StagedAttachmentRef[] = draftAttachments
      .filter((a): a is DraftAttachment & { receiptId: string; file: NonNullable<DraftAttachment['file']> } =>
        a.status === 'ready' && Boolean(a.receiptId) && Boolean(a.file)
      )
      .map(a => ({ receiptId: a.receiptId, file: a.file }))

    if (!text && readyAttachments.length === 0) return

    if (isLoading) {
      setPendingQueue(prev => [
        ...prev,
        {
          id: `q-${Date.now()}-${prev.length}`,
          text,
          ...(readyAttachments.length > 0 ? { attachments: readyAttachments } : {}),
        },
      ])
      setInputValue('')
      setDraftAttachments([])
      return
    }

    setInputValue('')
    setDraftAttachments([])
    void sendQuestion(text, { attachments: readyAttachments })
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  /** 任意のターンの再試行（最新ターンは retry: true、過去ターンは該当質問を再送信） */
  const handleRetryForAssistant = (assistantId: string) => {
    if (isLoading) return
    const idx = messages.findIndex(m => m.id === assistantId)
    if (idx < 0) return

    let question: string | null = null
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') {
        question = messages[i].content
        break
      }
    }
    if (!question) return

    const isLatest = assistantId === lastAssistantId
    if (isLatest) {
      setMessages(prev => prev.filter(msg => msg.id !== assistantId))
      void sendQuestion(question, { retry: true })
    } else {
      void sendQuestion(question)
    }
  }

  const handleContinue = (assistantId: string) => {
    if (isLoading) return
    void sendQuestion(null, { continue: true, targetId: assistantId })
  }

  const handleEditResend = (text: string) => {
    setInputValue(text)
    inputRef.current?.focus()
  }

  const handleEditQueued = (item: QueuedItem) => {
    setPendingQueue(prev => prev.filter(q => q.id !== item.id))
    setInputValue(item.text)
    if (item.attachments && item.attachments.length > 0) {
      setDraftAttachments(
        item.attachments.map((att, idx) => ({
          id: `restored-${Date.now()}-${idx}`,
          name: att.file.name,
          bytes: att.file.bytes,
          status: 'ready',
          receiptId: att.receiptId,
          file: att.file,
        }))
      )
    }
    inputRef.current?.focus()
  }

  const handleSendQueuedNow = (item: QueuedItem) => {
    // 選んだアイテムを先頭に移動し、現在の生成を中断して即座に次ターンとして発火させる
    setPendingQueue(prev => [item, ...prev.filter(q => q.id !== item.id)])
    abortRef.current?.abort()
  }

  const lastAssistantId = messages.filter(m => m.sender === 'assistant').slice(-1)[0]?.id

  const turnNavItems = useMemo(() => {
    const out: { id: string; index: number; label: string }[] = []
    let count = 0
    for (const msg of messages) {
      if (msg.sender === 'user') {
        count += 1
        out.push({ id: msg.id, index: count, label: msg.content })
      }
    }
    return out
  }, [messages])

  const jumpToTurn = (userMessageId: string) => {
    const el = document.getElementById(`turn-${userMessageId}`)
    if (el) {
      pinnedToBottomRef.current = false
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          bgcolor: 'background.default',
        }}
      >
        {/* 左カラム: deepseek-harness 風常設サイドバー */}
        <SidebarPanel
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarOpen(v => !v)}
          activeSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onNewSession={() => void startNewSession()}
          onOpenAuth={() => setAuthDialogOpen(true)}
          onLogout={handleLogout}
          onDeleteAccount={() => void handleDeleteAccount()}
          token={token}
          user={user}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          isLoading={isLoading}
          refreshKey={sidebarRefreshKey}
        />

        {/* 中央カラム: 会話ヘッダー + スクロール可能トランスクリプト + コンポーザー */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* スリム会話ヘッダー */}
          <Box
            component="header"
            sx={{
              flex: 'none',
              height: 50,
              px: { xs: 1.25, sm: 2 },
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            {!sidebarOpen && (
              <Tooltip title="サイドバーを開く">
                <IconButton
                  size="small"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="サイドバーを開く"
                  sx={{ color: 'text.secondary' }}
                >
                  <MenuIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            <Typography
              variant="subtitle2"
              noWrap
              sx={{ fontWeight: 500, fontSize: '0.88rem', color: 'text.primary', maxWidth: { xs: 150, sm: 340 } }}
            >
              {sessionTitle}
            </Typography>

            {turnNavItems.length > 0 && (
              <Typography
                variant="caption"
                sx={{
                  px: 0.75,
                  py: 0.15,
                  borderRadius: '6px',
                  bgcolor: 'action.hover',
                  color: 'text.secondary',
                  fontSize: '0.7rem',
                  fontVariantNumeric: 'tabular-nums',
                  flex: 'none',
                }}
              >
                {turnNavItems.length} ターン
              </Typography>
            )}

            <Box sx={{ flexGrow: 1 }} />

            {/* チャット詳細コントロール群 */}
            <Tooltip title={detailedMode ? '思考・ツール実行の詳細を自動展開中' : '思考・ツール実行をコンパクト表示中'}>
              <Button
                size="small"
                startIcon={<DetailIcon sx={{ fontSize: 15 }} />}
                onClick={() => setDetailedMode(v => !v)}
                sx={{
                  px: 1,
                  py: 0.25,
                  fontSize: '0.75rem',
                  minHeight: 28,
                  color: detailedMode ? 'primary.main' : 'text.secondary',
                  bgcolor: detailedMode
                    ? theme => theme.palette.mode === 'dark' ? 'rgba(96,143,255,0.12)' : 'rgba(59,108,245,0.08)'
                    : 'transparent',
                  border: '1px solid',
                  borderColor: detailedMode ? 'primary.main' : 'divider',
                }}
              >
                詳細表示
              </Button>
            </Tooltip>

            {messages.length > 0 && (
              <>
                <Tooltip title="すべての思考・ツール詳細を展開">
                  <IconButton
                    size="small"
                    onClick={() => setExpandSignal({ mode: 'expand', seq: Date.now() })}
                    aria-label="すべて展開"
                    sx={{ color: 'text.secondary' }}
                  >
                    <ExpandAllIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="すべての思考・ツール詳細を折りたたむ">
                  <IconButton
                    size="small"
                    onClick={() => setExpandSignal({ mode: 'collapse', seq: Date.now() })}
                    aria-label="すべて折りたたむ"
                    sx={{ color: 'text.secondary' }}
                  >
                    <CollapseAllIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              </>
            )}

            {!sidebarOpen && (
              <Tooltip title="新しい会話">
                <IconButton
                  size="small"
                  onClick={() => void startNewSession()}
                  disabled={isLoading}
                  aria-label="新しい会話"
                  sx={{ color: 'text.secondary' }}
                >
                  <NewChatIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* メイン会話エリア */}
          <Box sx={{ position: 'relative', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Box
              ref={scrollRef}
              onScroll={handleScroll}
              sx={{
                flex: '1 1 auto',
                overflowY: 'auto',
                overflowX: 'hidden',
                px: { xs: 2, sm: 3.5 },
                py: { xs: 2.5, sm: 3.5 },
              }}
            >
              <Box sx={{ width: '100%', maxWidth: 768, mx: 'auto' }}>
                {messages.length === 0 ? (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      pt: { xs: 4, sm: 7 },
                      pb: 4,
                      textAlign: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: theme =>
                          theme.palette.mode === 'dark' ? 'rgba(96,143,255,0.14)' : 'rgba(59,108,245,0.1)',
                        color: 'primary.main',
                        mb: 2,
                      }}
                    >
                      <ScaleIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Typography
                      variant="h5"
                      sx={{ mb: 1, fontWeight: 600, letterSpacing: '-0.02em', fontSize: { xs: '1.35rem', sm: '1.55rem' } }}
                    >
                      どのような法律のご相談ですか？
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ maxWidth: 540, mb: 4, lineHeight: 1.65 }}
                    >
                      法令検索・ウェブ検索ツールで一次情報を確認し、思考過程と根拠を添えて回答します。
                    </Typography>

                    <Box
                      sx={{
                        width: '100%',
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 1.25,
                        textAlign: 'left',
                      }}
                    >
                      {EXAMPLE_GROUPS.map((item, index) => (
                        <Box
                          key={index}
                          component="button"
                          type="button"
                          onClick={() => void sendQuestion(item.question)}
                          sx={{
                            p: 1.75,
                            borderRadius: '14px',
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: theme =>
                              theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fafbfc',
                            cursor: 'pointer',
                            textAlign: 'left',
                            font: 'inherit',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            transition: 'border-color 140ms ease, background-color 140ms ease',
                            '&:hover': {
                              borderColor: 'primary.main',
                              bgcolor: theme =>
                                theme.palette.mode === 'dark'
                                  ? 'rgba(96,143,255,0.06)'
                                  : 'rgba(59,108,245,0.03)',
                            },
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ color: 'primary.main', fontWeight: 500, fontSize: '0.72rem' }}
                          >
                            {item.category}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: 'text.primary', fontSize: '0.86rem', lineHeight: 1.5 }}
                          >
                            {item.question}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ pb: 2 }}>
                    {messages.map(message =>
                      message.sender === 'user' ? (
                        <UserMessageRow
                          key={message.id}
                          message={message}
                          onEditResend={handleEditResend}
                        />
                      ) : (
                        <Box
                          key={message.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1.75,
                            mb: 4,
                          }}
                        >
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              mt: 0.25,
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid',
                              borderColor: 'divider',
                              bgcolor: 'background.paper',
                              color: 'primary.main',
                              flex: 'none',
                            }}
                          >
                            <LawIcon sx={{ fontSize: 15 }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <AgentTrace
                              items={message.trace}
                              fallback={message.content}
                              isStreaming={message.streaming}
                              interrupted={message.interrupted}
                              startedAt={message.timestamp.getTime()}
                              timestamp={message.timestamp}
                              turnMeta={message.turnMeta}
                              modelName={selectedModel}
                              detailedMode={detailedMode}
                              expandSignal={expandSignal}
                              isLatestTurn={message.id === lastAssistantId}
                              onRetry={() => handleRetryForAssistant(message.id)}
                              onContinue={() => handleContinue(message.id)}
                            />
                          </Box>
                        </Box>
                      )
                    )}
                  </Box>
                )}
              </Box>
            </Box>

            {/* 右端ターンナビゲーター */}
            <TurnNavigatorRail turns={turnNavItems} onJump={jumpToTurn} />

            {/* フローティング「最新へスクロール」ボタン */}
            <Fade in={showScrollButton}>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 5,
                }}
              >
                <Tooltip title="最新のメッセージへ">
                  <IconButton
                    size="small"
                    onClick={() => scrollToBottom('smooth')}
                    aria-label="最新のメッセージへスクロール"
                    sx={{
                      width: 34,
                      height: 34,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                      color: 'text.primary',
                      '&:hover': { bgcolor: 'background.paper' },
                    }}
                  >
                    <ScrollDownIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Fade>
          </Box>

          {/* フローティング会話コンポーザー */}
          <ChatComposer
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            onStop={handleStop}
            isLoading={isLoading}
            models={models}
            selectedModel={selectedModel}
            isModelsLoading={isModelsLoading}
            onSelectModel={setSelectedModel}
            pendingQueue={pendingQueue}
            onRemoveQueued={id => setPendingQueue(prev => prev.filter(q => q.id !== id))}
            onEditQueued={handleEditQueued}
            onSendQueuedNow={handleSendQueuedNow}
            attachments={draftAttachments}
            onAddFiles={handleAddFiles}
            onRemoveAttachment={handleRemoveAttachment}
            inputRef={inputRef}
          />
        </Box>

        {/* Auth Dialog */}
        <AuthDialog
          open={authDialogOpen}
          onClose={() => setAuthDialogOpen(false)}
          onSuccess={handleAuthSuccess}
        />

        {/* エラー通知 */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%', borderRadius: '12px' }}>
            {error}
          </Alert>
        </Snackbar>

        {/* デモ警告通知 */}
        <Snackbar
          open={demoWarningOpen}
          autoHideDuration={30000}
          onClose={() => setDemoWarningOpen(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setDemoWarningOpen(false)}
            severity="info"
            variant="outlined"
            sx={{
              width: '100%',
              maxWidth: 560,
              bgcolor: 'background.paper',
              borderRadius: '14px',
              boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
              '& .MuiAlert-message': { width: '100%' },
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.25 }}>
              デモ環境についてのお知らせ
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.6 }}>
              無料モデル利用のため応答に時間がかかる場合があります。会話履歴の保存にはログインが必要です（プライベート構築:{' '}
              <a
                href="https://github.com/lijunjie2232/mylawer"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: theme.palette.primary.main }}
              >
                GitHub
              </a>
              ）。
              demoのため、最初から起動するので時間が30秒ぐらいかかります。
            </Typography>
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  )
}

export default App
