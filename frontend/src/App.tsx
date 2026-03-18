import React, { useState, useEffect } from 'react'
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
  Divider,
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
  AutoAwesome as ExamplesIcon
} from '@mui/icons-material'

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
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [isModelsLoading, setIsModelsLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [demoWarningOpen, setDemoWarningOpen] = useState(true)
  
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
        main: '#1976d2',
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
        const response = await axios.post('/api/sessions/new')
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
  }, [])

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
      
      const response = await axios.post('/api/sessions/new')
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
                    
                  case 'content':
                    // LLM タイプのメッセージのみ表示、tool タイプをフィルタリング
                    if (data.messageType === 'llm' || !data.messageType) {
                      accumulatedContent += data.content
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
                    break
                    
                  case 'error':
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
      }

    } catch (error) {
      console.log('ストリーミング失敗、通常 API にダウングレード:', error)
      try {
        const response = await axios.post('/api/legal/query', {
          question: inputValue,
          model: selectedModel,
          sessionId: sessionId
        })

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
    
    // 民法関連
    '婚姻届を提出する際に必要な書類と手続きを教えてください。',
    '隣人との騒音トラブルに対する法的措置は何がありますか？',
    '借金返済が困難になった場合の法的対応を教えてください。',
  ]

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* ヘッダー */}
        <AppBar position="sticky" color="primary" elevation={1}>
          <Toolbar>
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
            
            <FormControl size="small" sx={{ minWidth: 200, mr: 2 }}>
              <InputLabel shrink>AI モデル</InputLabel>
              <Select
                value={selectedModel}
                label="AI モデル"
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isLoading || isModelsLoading}
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.5)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.8)',
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
          </Toolbar>
        </AppBar>

        {/* メインコンテンツ */}
        <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3 }}>
          <Paper
            elevation={3}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 140px)',
              overflow: 'hidden',
            }}
          >
            {/* メッセージエリア */}
            <Box
              sx={{
                flexGrow: 1,
                overflow: 'auto',
                p: 2,
              }}
            >
              {messages.length === 0 ? (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
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
                        }}
                      >
                        {message.sender === 'assistant' ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              table: ({node, ...props}) => (
                                <Box sx={{ overflowX: 'auto', my: 2 }}>
                                  <table {...props} />
                                </Box>
                              ),
                              th: ({node, children, ...props}) => (
                                <th {...props} style={{ padding: '8px', borderBottom: '2px solid currentColor' }}>
                                  {children}
                                </th>
                              ),
                              td: ({node, children, ...props}) => (
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
                            回答を生成中...
                          </Typography>
                        </Box>
                      </Paper>
                    </ListItem>
                  )}
                </List>
              )}
            </Box>

            <Divider />

            {/* 入力フォーム */}
            <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
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
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={!inputValue.trim() || isLoading}
                  sx={{ minWidth: 100, height: 56 }}
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
          autoHideDuration={15000}
          onClose={() => setDemoWarningOpen(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setDemoWarningOpen(false)} 
            severity="warning"
            sx={{ width: '100%' }}
          >
            <Typography variant="body2">
              <strong>デモ環境についてのお知らせ：</strong>
            </Typography>
            <Typography variant="body2">
              これはデモ環境のため、LLM の実行速度が遅い場合があります。
            </Typography>
            <Typography variant="body2">
              おすすめの LLM モデルは <strong>gpt-oss:20b</strong> です。
            </Typography>
            <Typography variant="body2">
              モデルの初回ロード時は、GPU が使用されている場合、遅くなったり失敗したりする可能性があります。
            </Typography>
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  )
}

export default App
