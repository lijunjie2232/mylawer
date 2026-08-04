import React, { useEffect, useState } from 'react'
import axios from 'axios'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  Add as AddIcon,
  ChatBubbleOutline as ChatIcon,
  DarkModeOutlined as DarkModeIcon,
  DeleteOutline as DeleteIcon,
  Gavel as LawIcon,
  LightModeOutlined as LightModeIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  MenuOpen as CollapseIcon,
  PersonRemoveOutlined as RemoveAccountIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'

export interface SessionSummary {
  id: string
  title: string
  createdAt: string
}

interface SidebarPanelProps {
  open: boolean
  onClose: () => void
  onToggleCollapse: () => void
  activeSessionId: string
  onSelectSession: (sessionId: string, title?: string) => void
  onNewSession: () => void
  onOpenAuth: () => void
  onLogout: () => void
  onDeleteAccount: () => void
  token: string | null
  user: any
  isDarkMode: boolean
  onToggleDarkMode: () => void
  isLoading: boolean
  refreshKey: number
}

/**
 * deepseek-harness の AppFrame 左サイドバー（ui-sidebar）に倣った常設サイドバー。
 * デスクトップでは折りたたみ可能な左カラム、モバイルではスライドオーバー Drawer として動作する。
 */
const SidebarPanel: React.FC<SidebarPanelProps> = ({
  open,
  onClose,
  onToggleCollapse,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onOpenAuth,
  onLogout,
  onDeleteAccount,
  token,
  user,
  isDarkMode,
  onToggleDarkMode,
  isLoading,
  refreshKey,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const fetchSessions = async () => {
    if (!token) {
      setSessions([])
      return
    }
    setLoadingSessions(true)
    try {
      const response = await axios.get('/api/chat/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.data.success) {
        setSessions(response.data.sessions ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err)
    } finally {
      setLoadingSessions(false)
    }
  }

  useEffect(() => {
    void fetchSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshKey])

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    try {
      await axios.delete(`/api/chat/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (err) {
      console.error('Failed to delete session', err)
    }
  }

  const content = (
    <Box
      sx={{
        width: 264,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.mode === 'dark' ? '#181a1e' : '#f2f3f6',
        borderRight: isMobile ? 'none' : '1px solid',
        borderColor: 'divider',
        userSelect: 'none',
      }}
    >
      {/* サイドバーヘッダー */}
      <Box
        sx={{
          height: 50,
          px: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flex: 'none',
        }}
      >
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'primary.main',
            color: '#ffffff',
            flex: 'none',
          }}
        >
          <LawIcon sx={{ fontSize: 16 }} />
        </Box>
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600, fontSize: '0.9rem', flexGrow: 1 }}>
          法律アシスタント
        </Typography>
        <Tooltip title="サイドバーを閉じる">
          <IconButton
            size="small"
            onClick={isMobile ? onClose : onToggleCollapse}
            aria-label="サイドバーを閉じる"
            sx={{ color: 'text.secondary' }}
          >
            <CollapseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 新しい会話ボタン */}
      <Box sx={{ px: 1.5, pb: 1.25, flex: 'none' }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon sx={{ fontSize: 17 }} />}
          onClick={() => {
            onNewSession()
            if (isMobile) onClose()
          }}
          disabled={isLoading}
          sx={{
            justifyContent: 'flex-start',
            px: 1.5,
            py: 0.75,
            borderRadius: '10px',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            color: 'text.primary',
            fontSize: '0.84rem',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'background.paper',
            },
          }}
        >
          新しい会話
        </Button>
      </Box>

      {/* セッション履歴リスト */}
      <Box sx={{ px: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 500, fontSize: '0.72rem' }}>
          会話履歴
        </Typography>
        {token && (
          <Tooltip title="履歴を更新">
            <IconButton size="small" onClick={() => void fetchSessions()} sx={{ p: 0.25, color: 'text.disabled' }}>
              <RefreshIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ flex: '1 1 auto', overflowY: 'auto', px: 1, pb: 1 }}>
        {!token ? (
          <Box
            sx={{
              mx: 0.5,
              mt: 0.5,
              p: 1.5,
              borderRadius: '12px',
              border: '1px dashed',
              borderColor: 'divider',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, lineHeight: 1.55 }}>
              ログインすると会話履歴と思考・ツール実行ログを保存・復元できます。
            </Typography>
            <Button
              size="small"
              variant="contained"
              startIcon={<LoginIcon sx={{ fontSize: 15 }} />}
              onClick={onOpenAuth}
              sx={{ fontSize: '0.78rem', py: 0.4, px: 1.5 }}
            >
              ログイン / 登録
            </Button>
          </Box>
        ) : loadingSessions ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={18} />
          </Box>
        ) : sessions.length === 0 ? (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: 'block', textAlign: 'center', py: 3 }}
          >
            まだ会話履歴がありません
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {sessions.map(session => {
              const active = session.id === activeSessionId
              return (
                <Box
                  key={session.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectSession(session.id, session.title)
                    if (isMobile) onClose()
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectSession(session.id, session.title)
                      if (isMobile) onClose()
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.25,
                    py: 0.75,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    bgcolor: active
                      ? theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(15,23,42,0.07)'
                      : 'transparent',
                    color: active ? 'text.primary' : 'text.secondary',
                    transition: 'background-color 100ms ease',
                    '&:hover': {
                      bgcolor: active
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(15,23,42,0.09)'
                        : 'action.hover',
                      color: 'text.primary',
                      '& .session-delete-btn': { opacity: 1 },
                    },
                  }}
                >
                  <ChatIcon sx={{ fontSize: 14, flex: 'none', opacity: 0.7 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontSize: '0.82rem', fontWeight: active ? 500 : 400 }}
                    >
                      {session.title || '無題の相談'}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                      {new Date(session.createdAt).toLocaleDateString('ja-JP')}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    className="session-delete-btn"
                    aria-label="履歴を削除"
                    onClick={e => void handleDeleteSession(e, session.id)}
                    sx={{
                      p: 0.35,
                      opacity: { xs: 0.7, md: 0 },
                      color: 'text.disabled',
                      '&:hover': { color: 'error.main' },
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>

      {/* フッター: テーマ切替・アカウント */}
      <Box
        sx={{
          p: 1.25,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          flex: 'none',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5 }}>
          <Typography variant="caption" noWrap sx={{ color: 'text.secondary', fontSize: '0.78rem', maxWidth: 160 }}>
            {token ? user?.name || user?.email || 'ログイン中' : 'ゲストモード'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <Tooltip title={isDarkMode ? 'ライトモード' : 'ダークモード'}>
              <IconButton size="small" onClick={onToggleDarkMode} sx={{ color: 'text.secondary' }}>
                {isDarkMode ? <LightModeIcon sx={{ fontSize: 17 }} /> : <DarkModeIcon sx={{ fontSize: 17 }} />}
              </IconButton>
            </Tooltip>
            {token && (
              <>
                <Tooltip title="ログアウト">
                  <IconButton size="small" onClick={onLogout} sx={{ color: 'text.secondary' }}>
                    <LogoutIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="アカウント削除">
                  <IconButton
                    size="small"
                    onClick={() => setDeleteConfirmOpen(true)}
                    sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                  >
                    <RemoveAccountIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>
      </Box>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>アカウントを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            アカウントとすべての会話履歴が完全に削除されます。この操作は元に戻せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>キャンセル</Button>
          <Button
            color="error"
            onClick={() => {
              onDeleteAccount()
              setDeleteConfirmOpen(false)
            }}
            autoFocus
          >
            削除する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )

  if (isMobile) {
    return (
      <Drawer anchor="left" open={open} onClose={onClose}>
        {content}
      </Drawer>
    )
  }

  return (
    <Box
      sx={{
        width: open ? 264 : 0,
        flex: 'none',
        overflow: 'hidden',
        transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {content}
    </Box>
  )
}

export default SidebarPanel
