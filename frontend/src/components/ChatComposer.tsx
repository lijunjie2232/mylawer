import React from 'react'
import {
  Box,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  ArrowUpward as SendIcon,
  AutoAwesome as ModelIcon,
  BoltOutlined as SendNowIcon,
  Close as CloseIcon,
  EditOutlined as EditIcon,
  Stop as StopIcon,
} from '@mui/icons-material'

export interface ModelOption {
  name: string
  displayName: string
  provider: string
  description?: string
  isEnabled: boolean
  isHealthy?: boolean
}

export interface QueuedItem {
  id: string
  text: string
}

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
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
}

/**
 * deepseek-harness の会話コンポーザー + QueueDock に倣った入力カード。
 * 実行中は QueueDock から「今すぐ送信（中断して切替）」「入力欄に戻す」「削除」が可能。
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
  inputRef,
}) => {
  const canSend = value.trim().length > 0

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
                  {item.text}
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
        sx={{
          position: 'relative',
          borderRadius: '20px',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          boxShadow: theme =>
            theme.palette.mode === 'dark'
              ? '0 2px 12px rgba(0,0,0,0.32)'
              : '0 2px 14px rgba(15,23,42,0.06)',
          transition: 'border-color 140ms ease, box-shadow 140ms ease',
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
        <InputBase
          fullWidth
          multiline
          minRows={1}
          maxRows={8}
          inputRef={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={
            isLoading
              ? '次の質問を入力すると送信待ちキューに追加されます...'
              : '法律相談のご質問を入力してください...'
          }
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              onSubmit(e)
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
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
                maxWidth: { xs: 190, sm: 260 },
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
              <Tooltip title="送信 (Enter)">
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
