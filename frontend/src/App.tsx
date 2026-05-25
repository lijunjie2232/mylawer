import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  TextField,
  Button,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  CircularProgress,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  ThemeProvider,
  createTheme,
  CssBaseline
} from '@mui/material'
import {
  Gavel as LawIcon,
  Send as SendIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Refresh as RefreshIcon,
  Psychology as AssistantIcon,
  Person as UserIcon,
  AutoAwesome as ExamplesIcon,
  History as HistoryIcon,
  Login as LoginIcon,
  AccountCircle as AccountIcon
} from '@mui/icons-material'
import AuthDialog from './components/AuthDialog'
import HistorySidebar from './components/HistorySidebar'

// 型定義
interface Message {
  id: string
  content: string
  sender: 'user' | 'assistant'
  timestamp: Date
}

interface ModelInfo {
  name: string
  displayName: string
  provider: string
  description?: string
  isEnabled: boolean
  isHealthy?: boolean
  responseTime?: number
}

const App: React.FC = () => {
  // 状態管理
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [isModelsLoading, setIsModelsLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [demoWarningOpen, setDemoWarningOpen] = useState(true)
  const [inputHeight, setInputHeight] = useState<number>(80) // Default height for input area
  const [isDragging, setIsDragging] = useState<boolean>(false)

  // Auth & History states
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<any>(null)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef<boolean>(false)

  // Fetch user profile if token exists
  useEffect(() => {
    if (token) {
      axios.get('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        if (res.data.success) {
          setUser(res.data.user)
        }
      }).catch(err => {
        console.error('Failed to fetch profile', err)
        handleLogout()
      })
    }
  }, [token])

  const handleAuthSuccess = (newToken: string, newUser: any) => {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('token', newToken)
    startNewSession()
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    startNewSession()
  }

  const handleDeleteAccount = async () => {
    try {
      await axios.delete('/api/user/delete', {
        headers: { Authorization: `Bearer ${token}` }
      })
      handleLogout()
    } catch (err) {
      console.error('Failed to delete account', err)
      setError('Failed to delete account')
    }
  }

  const handleSelectSession = async (sid: string) => {
    setSessionId(sid)
    localStorage.setItem('sessionId', sid)
    setMessages([])
    setIsLoading(true)
    try {
      const response = await axios.get(`/api/chat/sessions/${sid}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        const historyMessages = response.data.messages.map((m: any) => ({
          id: m.id,
          content: m.content,
          sender: m.role,
          timestamp: new Date(m.createdAt)
        }))
        setMessages(historyMessages)
      }
    } catch (err) {
      console.error('Failed to fetch session messages', err)
      setError('Failed to load chat history')
    } finally {
      setIsLoading(false)
    }
  }

  // テーマ設定
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      return savedTheme === 'dark'
    }
    return prefersDarkMode
  })

  // Material UI テーマの作成
  const theme = createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2ff',
        light: '#42a5f5',
        dark: '#1565c0',
      },
      secondary: {
        main: '#9c27b0',
        light: '#ba68c8',
        dark: '#7b1fa2',
      },
      background: {
        default: isDarkMode ? '#121212' : '#f5f5f5',
        paper: isDarkMode ? '#1e1e1e' : '#ffffff',
      },
    },
    typography: {
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      h4: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 600,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
    },
  })

  // sessionId の初期化
  useEffect(() => {
    const initializeSession = async () => {
      const savedSessionId = localStorage.getItem('sessionId')
      if (savedSessionId) {
        setSessionId(savedSessionId)
        return
      }

      try {
        const response = await axios.post('/api/sessions/new', {}, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (response.data.success) {
          const newSessionId = response.data.sessionId
          setSessionId(newSessionId)
          localStorage.setItem('sessionId', newSessionId)
        }
      } catch (error) {
        console.error('新しいセッション ID の取得に失敗:', error)
        const fallbackSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        setSessionId(fallbackSessionId)
        localStorage.setItem('sessionId', fallbackSessionId)
      }
    }

    initializeSession()
  }, [token]) // Re-run if token changes (e.g. login/logout)

  // Setup global mouse events for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = containerRect.bottom - e.clientY;

      // Set min and max height constraints
      const minHeight = 60;
      const maxHeight = 400;

      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setInputHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // モデルリストを取得
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await axios.get('/models')
        if (response.data.success) {
          setModels(response.data.models)
          setSelectedModel(response.data.defaultModel)
        }
      } catch (error) {
        console.error('モデルリストの取得に失敗しました:', error)
        const fallbackModels: ModelInfo[] = [{
          name: 'gpt-oss:20b',
          displayName: 'Ollama - gpt-oss:20b',
          provider: 'ollama',
          description: 'デフォルトモデル',
          isEnabled: true
        }]
        setModels(fallbackModels)
        setSelectedModel('gpt-oss:20b')
      } finally {
        setIsModelsLoading(false)
      }
    }

    fetchModels()
  }, [])

  // ダークモードの切り替え
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light')
  }

  // 新しい会話を開始
  const startNewSession = async () => {
    try {
      if (sessionId) {
        try {
          await axios.delete(`/api/sessions/${sessionId}/clear`)
        } catch (error) {
          console.log('古いセッションのクリアに失敗:', error)
        }
      }

      const response = await axios.post('/api/sessions/new', {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (response.data.success) {
        const newSessionId = response.data.sessionId
        setSessionId(newSessionId)
        localStorage.setItem('sessionId', newSessionId)
        setMessages([])
        setError(null)
        console.log('新しい会話が始まりました:', newSessionId)
      }
    } catch (error) {
      console.error('新しい会話を開始できませんでした:', error)
      const fallbackSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setSessionId(fallbackSessionId)
      localStorage.setItem('sessionId', fallbackSessionId)
      setMessages([])
      setError('セッションの開始に失敗しました')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setStatus('回答を生成中...')
    setError(null)

    const assistantMessageId = (Date.now() + 1).toString()
    const tempAssistantMessage: Message = {
      id: assistantMessageId,
      content: '',
      sender: 'assistant',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, tempAssistantMessage])

    try {
      const response = await fetch('/api/legal/query/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          question: inputValue,
          model: selectedModel,
          sessionId: sessionId
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                switch (data.type) {
                  case 'start':
                    console.log('ストリーム開始')
                    break

                  case 'tool_call':
                    console.log('ツール呼び出し:', data.tool, data.args)
                    let toolQuery = ''
                    if (data.args) {
                      if (typeof data.args === 'string') {
                        toolQuery = data.args
                      } else if (typeof data.args === 'object') {
                        // よくある引数名（query, input, law_id）を優先的に表示
                        const args = data.args as any
                        toolQuery = args.query || args.input || args.law_id || JSON.stringify(args)
                      }
                    }
                    if (toolQuery.length > 100) toolQuery = toolQuery.substring(0, 100) + '...'
                    setStatus(`${data.tool} を呼び出し中${toolQuery ? `: ${toolQuery}` : ''}...`)
                    break

                  case 'tool_complete':
                    console.log('ツール呼び出し完了:', data.tool)
                    setStatus(`${data.tool} の呼び出しが完了しました`)
                    break

                  case 'content':
                    // LLM タイプのメッセージのみ表示、tool タイプをフィルタリング
                    if (data.messageType === 'llm' || !data.messageType) {
                      accumulatedContent += data.content
                      setStatus('回答を入力中...')
                      setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      ))
                    }
                    break

                  case 'complete':
                    console.log('ストリーム完了', {
                      messageType: data.messageType,
                      modelUsed: data.modelUsed
                    })
                    setStatus('')
                    // バックエンドが新しい sessionId を返した場合（例えば匿名からログイン済みに変更）、それを更新
                    if (data.sessionId && data.sessionId !== sessionId) {
                      setSessionId(data.sessionId)
                      localStorage.setItem('sessionId', data.sessionId)
                    }
                    break

                  case 'error':
                    setStatus('エラーが発生しました')
                    setMessages(prev => prev.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: `エラー：${data.error}` }
                        : msg
                    ))
                    console.error('ストリームエラー:', data.error)
                    break
                }
              } catch (parseError) {
                continue
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
        setIsLoading(false)
        setStatus('')
      }

    } catch (error) {
      console.log('ストリーミング失敗、通常 API にダウングレード:', error)
      try {
        const response = await axios.post('/api/legal/query', {
          question: inputValue,
          model: selectedModel,
          sessionId: sessionId
        }, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })

        if (response.data.sessionId && response.data.sessionId !== sessionId) {
          setSessionId(response.data.sessionId)
          localStorage.setItem('sessionId', response.data.sessionId)
        }

        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: response.data.answer }
            : msg
        ))
      } catch (apiError) {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: '申し訳ありませんが、リクエストの処理中にエラーが発生しました。後ほど再度お試しください。' }
            : msg
        ))
        setError('API リクエストに失敗しました')
        console.error('API リクエストに失敗:', apiError)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const exampleQuestions = [
    // 刑法関連
    '窃盗罪の定義を教えてください？',
    '詐欺罪と横領罪の違いは何ですか？',
    '正当防衛が認められる要件を教えてください。',
    '"マッチ売りの少女"という物語の少女には業務横領を犯しましたのか？',

    // 民法関連
    '2026年4月から新しい自転車法律は施行されるそう、それについて教えてください。',
    '横浜市では婚姻届を提出する際に必要な書類と手続きを教えてください。',
    '隣人との騒音トラブルに対する法的措置は何がありますか？',
    '借金返済が困難になった場合の法的対応を教えてください。',

  ]

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* ヘッダー */}
        <AppBar position="sticky" color="primary" elevation={1}>
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setHistorySidebarOpen(true)}
              sx={{ mr: 2 }}
              disabled={!token}
            >
              <HistoryIcon />
            </IconButton>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2 }}>
              <LawIcon />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" component="div">
                法律アシスタント
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                プロフェッショナル法律相談サービス
              </Typography>
            </Box>

            <FormControl size="small" sx={{ minWidth: 200, mr: 2}}>
              <InputLabel shrink sx={{ color: 'white' }}>AI モデル</InputLabel>
              <Select
                value={selectedModel}
                label="AI モデル"
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isLoading || isModelsLoading}
                sx={{
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.5)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.8)',
                  },
                  '& .MuiSelect-select': {
                    color: 'white',
                  },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: 'background.paper',
                      '& .MuiMenuItem-root': {
                        color: 'text.primary',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      },
                      '& .MuiSelect-icon': {
                        color: 'text.primary',
                      },
                    },
                  },
                }}
              >
                {models.map(model => (
                  <MenuItem key={model.name} value={model.name}>
                    {model.displayName}
                    {model.isHealthy === false && ' (メンテナンス中)'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Tooltip title="新しい会話">
              <IconButton
                color="inherit"
                onClick={startNewSession}
                disabled={isLoading}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title={isDarkMode ? 'ライトモード' : 'ダークモード'}>
              <IconButton
                color="inherit"
                onClick={toggleDarkMode}
              >
                {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>

            {token ? (
              <Tooltip title={user?.name || 'Profile'}>
                <IconButton color="inherit" onClick={() => setHistorySidebarOpen(true)}>
                  <AccountIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Button
                color="inherit"
                startIcon={<LoginIcon />}
                onClick={() => setAuthDialogOpen(true)}
              >
                Login
              </Button>
            )}
          </Toolbar>
        </AppBar>

        {/* Auth Dialog */}
        <AuthDialog
          open={authDialogOpen}
          onClose={() => setAuthDialogOpen(false)}
          onSuccess={handleAuthSuccess}
        />

        {/* History Sidebar */}
        <HistorySidebar
          open={historySidebarOpen}
          onClose={() => setHistorySidebarOpen(false)}
          onSelectSession={handleSelectSession}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
          token={token}
        />

        {/* メインコンテンツ */}
        <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3, display: 'flex', flexDirection: 'column', minHeight: 0 }} ref={containerRef}>
          <Paper
            elevation={3}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* メッセージエリア */}
            <Box
              sx={{
                flexGrow: 1,
                overflow: 'auto',
                p: 2,
                pt: 3,
                minHeight: 0, // Important for flex child scrolling
              }}
            >
              {messages.length === 0 ? (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100%',
                    textAlign: 'center',
                  }}
                >
                  <LawIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2, opacity: 0.3 }} />
                  <Typography variant="h4" gutterBottom color="text.primary">
                    法律アシスタントへようこそ
                  </Typography>
                  <Typography variant="body1" color="text.secondary" paragraph>
                    私はあなたのプロフェッショナルな法律顧問で、正確な法律相談サービスをいつでも提供します。
                  </Typography>

                  <Box sx={{ mt: 4, width: '100%', maxWidth: 600 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <ExamplesIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" color="text.primary">
                        サンプル質問
                      </Typography>
                    </Box>
                    <List>
                      {exampleQuestions.map((question, index) => (
                        <ListItem
                          key={index}
                          button
                          onClick={() => setInputValue(question)}
                          sx={{
                            borderRadius: 2,
                            mb: 1,
                            '&:hover': {
                              bgcolor: 'action.hover',
                            },
                          }}
                        >
                          <ListItemText
                            primary={question}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Box>
              ) : (
                <List sx={{ p: 0 }}>
                  {messages.map(message => (
                    <ListItem
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                        mb: 1,
                      }}
                    >
                      {message.sender === 'assistant' && (
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            <AssistantIcon />
                          </Avatar>
                        </ListItemAvatar>
                      )}
                      <Paper
                        elevation={2}
                        sx={{
                          p: 2,
                          maxWidth: '70%',
                          bgcolor: message.sender === 'user' ? 'primary.main' : 'background.paper',
                          color: message.sender === 'user' ? 'primary.contrastText' : 'text.primary',
                          mr: message.sender === 'user' ? 1 : 0, // Add right margin for user messages to move bubble left from avatar
                        }}
                      >
                        {message.sender === 'assistant' ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              table: ({ node, ...props }) => (
                                <Box sx={{ overflowX: 'auto', my: 2 }}>
                                  <table {...props} />
                                </Box>
                              ),
                              th: ({ node, children, ...props }) => (
                                <th {...props} style={{ padding: '8px', borderBottom: '2px solid currentColor' }}>
                                  {children}
                                </th>
                              ),
                              td: ({ node, children, ...props }) => (
                                <td {...props} style={{ padding: '8px', borderBottom: '1px solid currentColor' }}>
                                  {children}
                                </td>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        ) : (
                          <Typography variant="body1">{message.content}</Typography>
                        )}
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            mt: 1,
                            opacity: 0.7,
                            textAlign: 'right',
                          }}
                        >
                          {message.timestamp.toLocaleTimeString('ja-JP')}
                        </Typography>
                      </Paper>
                      {message.sender === 'user' && (
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'secondary.main' }}>
                            <UserIcon />
                          </Avatar>
                        </ListItemAvatar>
                      )}
                    </ListItem>
                  ))}

                  {isLoading && (
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <AssistantIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <Paper elevation={2} sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <CircularProgress size={20} />
                          <Typography variant="body2" color="text.secondary">
                            {status}
                          </Typography>
                        </Box>
                      </Paper>
                    </ListItem>
                  )}
                </List>
              )}
            </Box>

            {/* Resizable Divider */}
            <Box
              sx={{
                height: '8px',
                bgcolor: isDragging ? 'primary.main' : 'divider',
                cursor: 'ns-resize',
                '&:hover': {
                  bgcolor: 'primary.light',
                },
                position: 'relative',
                zIndex: 1,
                transition: 'background-color 0.2s',
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                isDraggingRef.current = true;
                setIsDragging(true);
                document.body.style.cursor = 'ns-resize';
                document.body.style.userSelect = 'none';
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '40px',
                  height: '4px',
                  bgcolor: 'text.secondary',
                  borderRadius: '2px',
                  opacity: 0.5,
                }}
              />
            </Box>

            {/* 入力フォーム */}
            <Box
              component="form"
              onSubmit={handleSubmit}
              className="chat-input-container"
              sx={{
                p: 2,
                bgcolor: 'background.paper',
                height: `${inputHeight}px`,
                minHeight: '60px',
                display: 'flex',
                flexDirection: 'column',
                transition: 'height 0.1s ease',
                position: 'relative',
              }}
            >
              {/* Height indicator (temporary for debugging) */}
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 8,
                  opacity: 0.5,
                  pointerEvents: 'none',
                }}
              />
                {/* {Math.round(inputHeight)}px
              </Typography> */}

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch', flexGrow: 1, minHeight: 0 }}>
                <TextField
                  fullWidth
                  multiline
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="法律相談のご質問を入力してください..."
                  disabled={isLoading}
                  variant="outlined"
                  size="medium"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                  InputProps={{
                    sx: {
                      height: '100%',
                      alignItems: 'flex-start',
                      paddingTop: '8px',
                      paddingBottom: '8px',
                    }
                  }}
                  inputProps={{
                    style: {
                      height: '100%',
                      overflowY: 'auto',
                      resize: 'none',
                    }
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={!inputValue.trim() || isLoading}
                  sx={{
                    minWidth: 64,
                    alignSelf: 'flex-end',
                    minHeight: '28px',
                    height: '100%',
                    maxHeight: '45px',
                  }}
                >
                  {isLoading ? '送信中...' : <SendIcon />}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Container>

        {/* エラー通知 */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
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
            severity="warning"
            sx={{
              width: '100%',
              maxWidth: 600,
              '& .MuiAlert-message': {
                width: '100%',
              }
            }}
          >
            <Box sx={{ width: '100%' }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                ⚠️ デモ環境についてのお知らせ
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2, mt: 1 }}>
                <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                  デモ環境のため、LLM の応答速度が遅い場合があります。
                </Typography>
                <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                  OpenRouter の無料モデルを使用しているため、遅延やエラーが発生する可能性があります。リクエストが失敗する場合は、他のモデルをお試しください。
                </Typography>
                <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                  会話履歴機能をご利用いただくには、アカウントの作成が必要です。作成したアカウントはユーザー自身で削除できます。
                </Typography>
                <Typography component="li" variant="body2">
                  定期的にアカウントを削除しておりますので、ご了承ください。
                </Typography>
                <Typography component="li" variant="body2" sx={{
                  mt: 1,
                  p: 1,
                  bgcolor: 'action.selected',
                  borderRadius: 1,
                  borderLeft: 3,
                  borderColor: 'primary.main'
                }}>
                  💡 <strong>より高速で安定した利用をご希望の方へ：</strong><br />
                  プライベートデプロイメントをおすすめします。
                  <br />
                  GitHub: <a
                    href="https://github.com/lijunjie2232/mylawer"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: theme.palette.primary.main, textDecoration: 'underline' }}
                  >
                    https://github.com/lijunjie2232/mylawer
                  </a>
                </Typography>
              </Box>
            </Box>
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  )
}

export default App
