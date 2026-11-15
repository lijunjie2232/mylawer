import React, { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  BuildOutlined as BuildIcon,
  Check as CheckIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  GavelOutlined as LawSearchIcon,
  LanguageOutlined as WebParseIcon,
  PlayArrow as PlayArrowIcon,
  PsychologyOutlined as PsychologyIcon,
  Refresh as RefreshIcon,
  SearchOutlined as SearchIcon,
  StorageOutlined as UsageIcon,
  UnfoldLess as CollapseAllIcon,
  UnfoldMore as ExpandAllIcon,
} from '@mui/icons-material'
import {
  extractAssistantText,
  type TraceItem,
  type TraceReasoning,
  type TraceTool,
  type TurnMeta,
} from '../utils/agentTrace'

const MONO = "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

export interface ExpandSignal {
  mode: 'expand' | 'collapse'
  seq: number
}

function useCopyText(text: string): { copied: boolean; copy: () => void } {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    if (!text) return
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  return { copied, copy }
}

const CodeBlock: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => {
  const text = String(children ?? '').replace(/\n$/, '')
  const language = className?.replace(/^language-/, '') ?? ''
  const { copied, copy } = useCopyText(text)

  return (
    <Box
      sx={{
        my: 1.5,
        maxWidth: '100%',
        minWidth: 0,
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)',
        }}
      >
        <Typography variant="caption" sx={{ fontFamily: MONO, color: 'text.secondary', fontSize: '0.72rem' }}>
          {language || 'text'}
        </Typography>
        <Tooltip title={copied ? 'コピーしました' : 'コードをコピー'}>
          <IconButton size="small" onClick={copy} sx={{ p: 0.4, color: 'text.secondary' }}>
            {copied ? <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} /> : <CopyIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          overflowX: 'auto',
          fontFamily: MONO,
          fontSize: '0.8rem',
          lineHeight: 1.6,
        }}
      >
        <code>{text}</code>
      </Box>
    </Box>
  )
}

const Markdown: React.FC<{ children: string }> = ({ children }) => (
  <Box className="dsh-markdown">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        pre: ({ children }) => <>{children}</>,
        code: ({ className, children, ...props }) => {
          const isBlock = Boolean(className) || String(children ?? '').includes('\n')
          if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>
          return (
            <code className="dsh-inline-code" {...props}>
              {children}
            </code>
          )
        },
        table: ({ ...props }) => (
          <Box sx={{ overflowX: 'auto', my: 1.5 }}>
            <table {...props} />
          </Box>
        ),
        a: ({ ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" />
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  </Box>
)

const Chevron: React.FC<{ open: boolean; hidden?: boolean }> = ({ open, hidden }) => (
  <ExpandMoreIcon
    sx={{
      fontSize: 15,
      visibility: hidden ? 'hidden' : 'visible',
      transform: open ? 'rotate(180deg)' : 'none',
      transition: 'transform 120ms cubic-bezier(0.4, 0, 0.2, 1)',
      color: 'inherit',
    }}
  />
)

const rowSx = (clickable: boolean) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
  minHeight: 30,
  px: 0.75,
  mx: -0.75,
  borderRadius: '8px',
  color: 'text.secondary',
  cursor: clickable ? 'pointer' : 'default',
  transition: 'background-color 100ms ease, color 100ms ease',
  ...(clickable ? { '&:hover': { bgcolor: 'action.hover', color: 'text.primary' } } : {}),
})

const Separator: React.FC = () => (
  <Box
    component="span"
    sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'text.disabled', mx: 0.25, flex: 'none' }}
  />
)

function firstLine(text: string): string {
  const newline = text.indexOf('\n')
  return (newline === -1 ? text : text.slice(0, newline)).replace(/\*\*/g, '').trim()
}

function latestCompletedParagraphFirstLine(text: string): string {
  let summary = ''
  let paragraphStart = 0
  const separator = /\r?\n(?:[\t ]*\r?\n)+/g
  while (true) {
    const nextParagraph = separator.exec(text)
    const paragraphEnd =
      nextParagraph === null
        ? text.length
        : nextParagraph.index + nextParagraph[0].indexOf('\n')
    const newline = text.indexOf('\n', paragraphStart)
    if (newline !== -1 && newline <= paragraphEnd) {
      const candidate = text.slice(paragraphStart, newline).trim()
      if (candidate !== '') summary = candidate
    }
    if (nextParagraph === null) return (summary || firstLine(text)).replace(/\*\*/g, '')
    paragraphStart = nextParagraph.index + nextParagraph[0].length
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}秒`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.round((ms % 60_000) / 1000)
  return `${mins}分${secs}秒`
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function argsSummary(args: unknown): string {
  if (!args || typeof args !== 'object') return ''
  const first = Object.values(args as Record<string, unknown>).find(
    value => typeof value === 'string' && value.trim() !== ''
  )
  if (typeof first === 'string') return first.replace(/\s+/g, ' ').slice(0, 90)
  try {
    return JSON.stringify(args).slice(0, 90)
  } catch {
    return ''
  }
}

function formatArgs(args: unknown): string {
  if (args === undefined) return ''
  try {
    return JSON.stringify(args, null, 2)
  } catch {
    return String(args)
  }
}

/** ツール名からアイコンと日本語カテゴリ名を解決する（deepseek-harness GenericToolCard 準拠） */
function classifyTool(name: string): { label: string; icon: React.ReactNode } {
  const lower = name.toLowerCase()
  if (lower.includes('legal') || lower.includes('law')) {
    return { label: '法令検索', icon: <LawSearchIcon sx={{ fontSize: 14, flex: 'none' }} /> }
  }
  if (lower.includes('parse_url') || lower.includes('fetch')) {
    return { label: 'ページ読込', icon: <WebParseIcon sx={{ fontSize: 14, flex: 'none' }} /> }
  }
  if (lower.includes('search')) {
    return { label: 'ウェブ検索', icon: <SearchIcon sx={{ fontSize: 14, flex: 'none' }} /> }
  }
  return { label: 'ツール実行', icon: <BuildIcon sx={{ fontSize: 14, flex: 'none' }} /> }
}

/** 思考過程: 1 行サマリー + 展開で全文・コピー（deepseek-harness ReasoningRow 準拠） */
const ReasoningRow: React.FC<{
  item: TraceReasoning
  running: boolean
  defaultOpen: boolean
  expandSignal?: ExpandSignal
}> = ({ item, running, defaultOpen, expandSignal }) => {
  const [open, setOpen] = useState(defaultOpen || running)
  const { copied, copy } = useCopyText(item.text)
  const summary = running ? latestCompletedParagraphFirstLine(item.text) : firstLine(item.text)

  useEffect(() => {
    if (!expandSignal) return
    setOpen(expandSignal.mode === 'expand')
  }, [expandSignal])

  return (
    <Box sx={{ mb: 0.75 }}>
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen(value => !value)
          }
        }}
        sx={rowSx(true)}
      >
        <PsychologyIcon sx={{ fontSize: 15, flex: 'none', color: running ? 'primary.main' : 'inherit' }} />
        <Typography
          variant="caption"
          className={running ? 'dsh-shimmer-text' : undefined}
          sx={{ fontWeight: 500, fontSize: '0.8rem', flex: 'none' }}
        >
          思考
        </Typography>
        {item.step > 0 && (
          <Typography
            variant="caption"
            sx={{
              fontFamily: MONO,
              fontSize: '0.68rem',
              px: 0.6,
              py: 0.1,
              borderRadius: '5px',
              bgcolor: 'action.hover',
              color: 'text.disabled',
              flex: 'none',
            }}
          >
            Step {item.step}
          </Typography>
        )}
        {summary && !open && (
          <>
            <Separator />
            <Typography
              variant="caption"
              noWrap
              sx={{ flex: 1, minWidth: 0, color: 'text.disabled', fontSize: '0.78rem' }}
            >
              {summary}
            </Typography>
          </>
        )}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.75, flex: 'none' }}>
          <Typography
            variant="caption"
            sx={{ fontSize: '0.7rem', color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}
          >
            {item.text.length.toLocaleString()}文字
          </Typography>
          {running && <CircularProgress size={10} color="inherit" />}
          <Chevron open={open} />
        </Box>
      </Box>
      <Collapse in={open}>
        <Box
          sx={{
            position: 'relative',
            minWidth: 0,
            maxWidth: '100%',
            ml: 0.75,
            pl: 2,
            pr: 1,
            py: 0.75,
            borderLeft: '1.5px solid',
            borderColor: 'divider',
            color: 'text.secondary',
            fontSize: '0.82rem',
            '& > :last-child': { mb: 0 },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.25 }}>
            <Tooltip title={copied ? 'コピーしました' : '思考内容をコピー'}>
              <IconButton size="small" onClick={copy} sx={{ p: 0.3, color: 'text.disabled' }}>
                {copied ? <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} /> : <CopyIcon sx={{ fontSize: 13 }} />}
              </IconButton>
            </Tooltip>
          </Box>
          <Markdown>{item.text}</Markdown>
        </Box>
      </Collapse>
    </Box>
  )
}

/** ツール呼び出し詳細カード（deepseek-harness GenericToolCard / ToolRow 準拠） */
const ToolRow: React.FC<{
  item: TraceTool
  defaultOpen: boolean
  expandSignal?: ExpandSignal
}> = ({ item, defaultOpen, expandSignal }) => {
  const [open, setOpen] = useState(defaultOpen || item.status === 'running' || item.status === 'error')
  const summary = argsSummary(item.args)
  const argsText = formatArgs(item.args)
  const hasDetail = Boolean(argsText || item.result)
  const { label, icon } = classifyTool(item.name || '')
  const argsCopy = useCopyText(argsText)
  const resultCopy = useCopyText(item.result ?? '')

  useEffect(() => {
    if (!expandSignal) return
    setOpen(expandSignal.mode === 'expand')
  }, [expandSignal])

  const statusLabel =
    item.status === 'running' ? '実行中' : item.status === 'error' ? 'エラー' : '完了'

  return (
    <Box sx={{ mb: 0.75 }}>
      <Box
        role={hasDetail ? 'button' : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        aria-expanded={hasDetail ? open : undefined}
        onClick={hasDetail ? () => setOpen(value => !value) : undefined}
        onKeyDown={
          hasDetail
            ? event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setOpen(value => !value)
                }
              }
            : undefined
        }
        sx={rowSx(hasDetail)}
      >
        <Box sx={{ color: item.status === 'error' ? 'error.main' : item.status === 'running' ? 'primary.main' : 'inherit', display: 'inline-flex' }}>
          {icon}
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.8rem', flex: 'none' }}>
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontFamily: MONO,
            fontSize: '0.72rem',
            px: 0.65,
            py: 0.1,
            borderRadius: '5px',
            bgcolor: 'action.hover',
            color: 'text.secondary',
            flex: 'none',
            maxWidth: '38%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.name || 'tool'}
        </Typography>
        {summary && (
          <>
            <Separator />
            <Typography variant="caption" noWrap sx={{ flex: 1, minWidth: 0, color: 'text.disabled', fontSize: '0.78rem' }}>
              {summary}
            </Typography>
          </>
        )}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.75, flex: 'none' }}>
          {typeof item.durationMs === 'number' && (
            <Typography
              variant="caption"
              sx={{ color: 'text.disabled', fontFamily: MONO, fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums' }}
            >
              {formatDuration(item.durationMs)}
            </Typography>
          )}
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            {item.status === 'running' ? (
              <CircularProgress size={10} color="primary" />
            ) : (
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: item.status === 'error' ? 'error.main' : 'success.main',
                  opacity: 0.85,
                }}
              />
            )}
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.7rem',
                color: item.status === 'error' ? 'error.main' : 'text.disabled',
                display: { xs: 'none', sm: 'inline' },
              }}
            >
              {statusLabel}
            </Typography>
          </Box>
          <Chevron open={open} hidden={!hasDetail} />
        </Box>
      </Box>

      <Collapse in={open && hasDetail}>
        <Box
          sx={{
            minWidth: 0,
            maxWidth: '100%',
            ml: 0.75,
            pl: 2,
            pr: 0.5,
            py: 0.75,
            borderLeft: '1.5px solid',
            borderColor: item.status === 'error' ? 'error.main' : 'divider',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {argsText && (
            <Box
              sx={{
                minWidth: 0,
                maxWidth: '100%',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1.25,
                  py: 0.35,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 500, color: 'text.secondary' }}>
                  入力パラメータ (Arguments)
                </Typography>
                <Tooltip title={argsCopy.copied ? 'コピーしました' : '引数をコピー'}>
                  <IconButton size="small" onClick={argsCopy.copy} sx={{ p: 0.25, color: 'text.disabled' }}>
                    {argsCopy.copied ? <CheckIcon sx={{ fontSize: 12, color: 'success.main' }} /> : <CopyIcon sx={{ fontSize: 12 }} />}
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1,
                  maxHeight: 160,
                  overflow: 'auto',
                  fontFamily: MONO,
                  fontSize: '0.73rem',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  color: 'text.primary',
                }}
              >
                {argsText}
              </Box>
            </Box>
          )}

          {item.result && (
            <Box
              sx={{
                minWidth: 0,
                maxWidth: '100%',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: item.status === 'error' ? 'error.main' : 'divider',
                overflow: 'hidden',
                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1.25,
                  py: 0.35,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    color: item.status === 'error' ? 'error.main' : 'text.secondary',
                  }}
                >
                  実行結果 (Result · {item.result.length.toLocaleString()}文字)
                </Typography>
                <Tooltip title={resultCopy.copied ? 'コピーしました' : '結果をコピー'}>
                  <IconButton size="small" onClick={resultCopy.copy} sx={{ p: 0.25, color: 'text.disabled' }}>
                    {resultCopy.copied ? <CheckIcon sx={{ fontSize: 12, color: 'success.main' }} /> : <CopyIcon sx={{ fontSize: 12 }} />}
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1,
                  maxHeight: 260,
                  overflow: 'auto',
                  fontFamily: MONO,
                  fontSize: '0.73rem',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  color: item.status === 'error' ? 'error.main' : 'text.secondary',
                }}
              >
                {item.result}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

/** ターン使用量詳細ポップオーバー（deepseek-harness TurnUsagePanel 準拠） */
const TurnUsagePopover: React.FC<{
  turnMeta?: TurnMeta
  modelName?: string
  toolCount: number
  stepCount: number
}> = ({ turnMeta, modelName, toolCount, stepCount }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const open = Boolean(anchorEl)
  const usage = turnMeta?.usage

  if (!usage && turnMeta?.durationMs === undefined && toolCount === 0) return null

  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={e => setAnchorEl(e.currentTarget)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 0.85,
          py: 0.2,
          borderRadius: '7px',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'transparent',
          color: 'text.secondary',
          cursor: 'pointer',
          font: 'inherit',
          fontSize: '0.72rem',
          fontFamily: MONO,
          fontVariantNumeric: 'tabular-nums',
          transition: 'background-color 100ms ease, color 100ms ease',
          '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
        }}
      >
        <UsageIcon sx={{ fontSize: 13 }} />
        <span>
          {usage
            ? `${formatTokens(usage.totalTokens)} tok`
            : typeof turnMeta?.durationMs === 'number'
              ? formatDuration(turnMeta.durationMs)
              : `${toolCount} tools`}
        </span>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{
          sx: {
            p: 1.75,
            minWidth: 240,
            borderRadius: '14px',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <UsageIcon sx={{ fontSize: 15, color: 'primary.main' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
              ターン詳細メトリクス
            </Typography>
          </Box>
          {usage && (
            <Typography variant="caption" sx={{ fontFamily: MONO, fontWeight: 600, fontSize: '0.78rem' }}>
              {usage.totalTokens.toLocaleString()} tok
            </Typography>
          )}
        </Box>
        <Divider sx={{ mb: 1 }} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '6px 16px',
            fontSize: '0.76rem',
          }}
        >
          {modelName && (
            <>
              <Typography variant="caption" color="text.secondary">モデル</Typography>
              <Typography variant="caption" sx={{ fontFamily: MONO, textAlign: 'right' }}>{modelName}</Typography>
            </>
          )}
          {typeof turnMeta?.durationMs === 'number' && (
            <>
              <Typography variant="caption" color="text.secondary">所要時間</Typography>
              <Typography variant="caption" sx={{ fontFamily: MONO, textAlign: 'right' }}>
                {formatDuration(turnMeta.durationMs)}
              </Typography>
            </>
          )}
          <Typography variant="caption" color="text.secondary">ステップ数</Typography>
          <Typography variant="caption" sx={{ fontFamily: MONO, textAlign: 'right' }}>
            {turnMeta?.stepCount ?? stepCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">ツール呼び出し</Typography>
          <Typography variant="caption" sx={{ fontFamily: MONO, textAlign: 'right' }}>
            {turnMeta?.toolCallCount ?? toolCount} 回
          </Typography>
          {usage && (
            <>
              <Typography variant="caption" color="text.secondary">入力トークン</Typography>
              <Typography variant="caption" sx={{ fontFamily: MONO, textAlign: 'right' }}>
                {usage.inputTokens.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">出力トークン</Typography>
              <Typography variant="caption" sx={{ fontFamily: MONO, textAlign: 'right' }}>
                {usage.outputTokens.toLocaleString()}
              </Typography>
            </>
          )}
        </Box>
      </Popover>
    </>
  )
}

/** 完了/実行中ターンのプロセスヘッダー（deepseek-harness TurnProcessNodeView 準拠） */
const TurnProcessHeader: React.FC<{
  open: boolean
  onToggle: () => void
  isStreaming?: boolean
  seconds: number | null
  stepCount: number
  toolCount: number
  reasoningCount: number
  runningToolName?: string
  turnMeta?: TurnMeta
  interrupted?: boolean
}> = ({
  open,
  onToggle,
  isStreaming,
  seconds,
  stepCount,
  toolCount,
  reasoningCount,
  runningToolName,
  turnMeta,
  interrupted,
}) => {
  const status = turnMeta?.status ?? (interrupted ? 'aborted' : 'completed')

  const primaryLabel = isStreaming
    ? runningToolName
      ? `ツール実行中: ${runningToolName}`
      : '思考・調査中'
    : status === 'aborted'
      ? '停止しました'
      : status === 'error'
        ? 'エラーで終了'
        : typeof turnMeta?.durationMs === 'number'
          ? `処理完了 · ${formatDuration(turnMeta.durationMs)}`
          : '処理完了'

  const badges: string[] = []
  if (isStreaming && seconds !== null) badges.push(`${seconds}秒`)
  if (stepCount > 0) badges.push(`${stepCount} ステップ`)
  if (toolCount > 0) badges.push(`ツール ${toolCount}件`)
  if (reasoningCount > 0) badges.push(`思考 ${reasoningCount}件`)

  return (
    <Box
      component="button"
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.75,
        width: '100%',
        p: '0 0 8px 0',
        mb: open ? 1 : 1.25,
        border: 'none',
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'transparent',
        color: isStreaming
          ? 'primary.main'
          : status === 'error'
            ? 'error.main'
            : status === 'aborted'
              ? 'warning.main'
              : 'text.secondary',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        transition: 'color 100ms ease',
        '&:hover': { color: status === 'error' ? 'error.main' : 'text.primary' },
      }}
    >
      {isStreaming && <CircularProgress size={11} color="inherit" />}
      <Typography
        variant="caption"
        className={isStreaming ? 'dsh-shimmer-text' : undefined}
        sx={{
          fontSize: '0.8rem',
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          color: 'inherit',
        }}
      >
        {primaryLabel}
      </Typography>
      {badges.map((badge, idx) => (
        <Typography
          key={idx}
          variant="caption"
          sx={{
            fontSize: '0.7rem',
            fontFamily: MONO,
            px: 0.65,
            py: 0.1,
            borderRadius: '6px',
            bgcolor: 'action.hover',
            color: 'text.secondary',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {badge}
        </Typography>
      ))}
      <Box sx={{ ml: 'auto', display: 'inline-flex', alignItems: 'center' }}>
        <Chevron open={open} />
      </Box>
    </Box>
  )
}

function useElapsed(startedAt: number | undefined, active: boolean): number | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active || startedAt === undefined) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active, startedAt])

  if (!active || startedAt === undefined) return null
  return Math.max(1, Math.round((now - startedAt) / 1000))
}

interface AgentTraceProps {
  items: TraceItem[]
  fallback?: string
  isStreaming?: boolean
  interrupted?: boolean
  startedAt?: number
  timestamp?: Date
  turnMeta?: TurnMeta
  modelName?: string
  detailedMode?: boolean
  expandSignal?: ExpandSignal
  isLatestTurn?: boolean
  onRetry?: () => void
  onContinue?: () => void
}

/**
 * アシスタント 1 ターンの出力。
 * deepseek-harness の TurnProcess + ReasoningRow + ToolCallCard + AssistantMarkdown + TurnTailActions 構成。
 */
const AgentTrace: React.FC<AgentTraceProps> = ({
  items,
  fallback,
  isStreaming,
  interrupted,
  startedAt,
  timestamp,
  turnMeta,
  modelName,
  detailedMode = true,
  expandSignal,
  isLatestTurn,
  onRetry,
  onContinue,
}) => {
  const seconds = useElapsed(startedAt, Boolean(isStreaming))
  const [processOpen, setProcessOpen] = useState(detailedMode)
  const [localSignal, setLocalSignal] = useState<ExpandSignal | undefined>(undefined)

  useEffect(() => {
    setProcessOpen(detailedMode)
  }, [detailedMode])

  useEffect(() => {
    if (!expandSignal) return
    setProcessOpen(expandSignal.mode === 'expand')
    setLocalSignal(expandSignal)
  }, [expandSignal])

  const { processItems, finalItems, toolCount, reasoningCount, stepCount, runningToolName } = useMemo(() => {
    let lastTextIdx = -1
    for (let i = items.length - 1; i >= 0; i--) {
      const candidate = items[i]
      if (candidate.kind === 'text' && candidate.text.trim().length > 0) {
        lastTextIdx = i
        break
      }
    }

    const tCount = items.filter(i => i.kind === 'tool').length
    const rCount = items.filter(i => i.kind === 'reasoning').length
    const maxStep = items.reduce((max, i) => Math.max(max, i.step || 0), 0)
    const activeTool = [...items]
      .reverse()
      .find((i): i is TraceTool => i.kind === 'tool' && i.status === 'running')

    const hasProcess = tCount > 0 || rCount > 0
    if (hasProcess && lastTextIdx >= 0 && !isStreaming) {
      return {
        processItems: items.slice(0, lastTextIdx),
        finalItems: items.slice(lastTextIdx),
        toolCount: tCount,
        reasoningCount: rCount,
        stepCount: Math.max(maxStep, 1),
        runningToolName: activeTool?.name,
      }
    }

    return {
      processItems: [] as TraceItem[],
      finalItems: items,
      toolCount: tCount,
      reasoningCount: rCount,
      stepCount: Math.max(maxStep, items.length > 0 ? 1 : 0),
      runningToolName: activeTool?.name,
    }
  }, [items, isStreaming])

  const copyableText = useMemo(() => extractAssistantText(items, fallback), [items, fallback])
  const { copied, copy } = useCopyText(copyableText)

  const hasContent = items.length > 0
  const hasErrorItem = items.some(item => item.kind === 'error')
  const hasAnyProcess = toolCount > 0 || reasoningCount > 0

  const renderItem = (item: TraceItem, index: number, isTail: boolean) => {
    if (item.kind === 'reasoning') {
      return (
        <ReasoningRow
          key={index}
          item={item}
          running={Boolean(isStreaming) && isTail}
          defaultOpen={detailedMode}
          expandSignal={localSignal}
        />
      )
    }
    if (item.kind === 'tool') {
      return (
        <ToolRow
          key={index}
          item={item}
          defaultOpen={detailedMode}
          expandSignal={localSignal}
        />
      )
    }
    if (item.kind === 'error') {
      return (
        <Alert
          key={index}
          severity="error"
          variant="outlined"
          sx={{
            my: 1,
            py: 0.25,
            px: 1.5,
            borderRadius: '10px',
            '& .MuiAlert-message': {
              fontSize: '0.84rem',
              minWidth: 0,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            },
          }}
        >
          {item.message}
        </Alert>
      )
    }
    return (
      <Box key={index} sx={{ minWidth: 0, maxWidth: '100%', '& > :last-child': { mb: 0 }, my: 0.75 }}>
        <Markdown>{item.text}</Markdown>
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      {/* ストリーミング中またはプロセス要素がある場合は常にプロセスヘッダーを表示 */}
      {(isStreaming || processItems.length > 0 || (hasAnyProcess && !isStreaming)) && (
        <TurnProcessHeader
          open={isStreaming ? true : processOpen}
          onToggle={() => setProcessOpen(v => !v)}
          isStreaming={isStreaming}
          seconds={seconds}
          stepCount={turnMeta?.stepCount ?? stepCount}
          toolCount={turnMeta?.toolCallCount ?? toolCount}
          reasoningCount={reasoningCount}
          runningToolName={runningToolName}
          turnMeta={turnMeta}
          interrupted={interrupted}
        />
      )}

      {!hasContent ? (
        isStreaming ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, color: 'text.secondary' }}>
            <CircularProgress size={14} color="inherit" />
            <Typography variant="body2" className="dsh-shimmer-text" sx={{ fontSize: '0.85rem' }}>
              法令・情報を確認しています{seconds !== null ? ` · ${seconds}秒` : '...'}
            </Typography>
          </Box>
        ) : fallback ? (
          <Markdown>{fallback}</Markdown>
        ) : null
      ) : (
        <>
          {processItems.length > 0 && (
            <Collapse in={processOpen}>
              <Box
                sx={{
                  minWidth: 0,
                  maxWidth: '100%',
                  mb: 1.5,
                  p: 1.25,
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: theme =>
                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.018)',
                }}
              >
                {processItems.map((item, idx) => renderItem(item, idx, false))}
              </Box>
            </Collapse>
          )}

          {finalItems.map((item, idx) =>
            renderItem(item, processItems.length + idx, idx === finalItems.length - 1)
          )}

          {isStreaming && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, color: 'text.secondary' }}>
              <CircularProgress size={12} color="inherit" />
              <Typography variant="caption" className="dsh-shimmer-text" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {runningToolName ? `${runningToolName} を実行中` : '回答を生成中'}
                {seconds !== null ? ` · ${seconds}秒` : '...'}
              </Typography>
            </Box>
          )}

          {!isStreaming && interrupted && !hasErrorItem && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'warning.main', fontWeight: 500 }}>
              応答を停止しました（下のボタンから「再試行」または「続きを生成」できます）
            </Typography>
          )}
        </>
      )}

      {/* TurnTail: アクション行（コピー・再試行・続きを生成・展開トグル・使用量ポップオーバー・時刻） */}
      {!isStreaming && (hasContent || fallback) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 0.75,
            mt: 1.25,
            pt: 0.5,
            color: 'text.secondary',
          }}
        >
          {copyableText && (
            <Tooltip title={copied ? 'コピーしました' : '回答をコピー'}>
              <IconButton
                size="small"
                onClick={copy}
                aria-label="回答をコピー"
                sx={{
                  p: 0.5,
                  ml: -0.5,
                  color: copied ? 'success.main' : 'text.secondary',
                  '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
                }}
              >
                {copied ? <CheckIcon sx={{ fontSize: 15 }} /> : <CopyIcon sx={{ fontSize: 15 }} />}
              </IconButton>
            </Tooltip>
          )}

          {onRetry && (
            interrupted && isLatestTurn ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
                onClick={onRetry}
                sx={{ py: 0.25, px: 1.25, fontSize: '0.76rem', borderRadius: '8px', minHeight: 26 }}
              >
                再試行
              </Button>
            ) : (
              <Tooltip title="この回答を再生成">
                <IconButton
                  size="small"
                  onClick={onRetry}
                  aria-label="再試行"
                  sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } }}
                >
                  <RefreshIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            )
          )}

          {isLatestTurn && onContinue && (
            interrupted ? (
              <Button
                size="small"
                variant="contained"
                disableElevation
                startIcon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
                onClick={onContinue}
                sx={{ py: 0.25, px: 1.25, fontSize: '0.76rem', borderRadius: '8px', minHeight: 26 }}
              >
                続きを生成
              </Button>
            ) : (
              <Tooltip title="続きを生成">
                <IconButton
                  size="small"
                  onClick={onContinue}
                  aria-label="続きを生成"
                  sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } }}
                >
                  <PlayArrowIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )
          )}

          {hasAnyProcess && (
            <Tooltip title={processOpen ? '思考・ツール詳細を折りたたむ' : '思考・ツール詳細を展開'}>
              <IconButton
                size="small"
                onClick={() => {
                  const nextOpen = !processOpen
                  setProcessOpen(nextOpen)
                  setLocalSignal({ mode: nextOpen ? 'expand' : 'collapse', seq: Date.now() })
                }}
                aria-label="詳細の表示切替"
                sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } }}
              >
                {processOpen ? <CollapseAllIcon sx={{ fontSize: 15 }} /> : <ExpandAllIcon sx={{ fontSize: 15 }} />}
              </IconButton>
            </Tooltip>
          )}

          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            <TurnUsagePopover
              turnMeta={turnMeta}
              modelName={modelName}
              toolCount={toolCount}
              stepCount={stepCount}
            />
            {timestamp && (
              <Typography
                variant="caption"
                sx={{ fontSize: '0.72rem', color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}
              >
                {timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}

export default AgentTrace
