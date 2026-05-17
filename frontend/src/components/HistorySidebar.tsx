import React, { useEffect, useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Typography,
  Divider,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Delete as DeleteIcon,
  Logout as LogoutIcon,
  PersonRemove as RemoveAccountIcon,
} from '@mui/icons-material';
import axios from 'axios';

interface Session {
  id: string;
  title: string;
  createdAt: string;
}

interface HistorySidebarProps {
  open: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  token: string | null;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({
  open,
  onClose,
  onSelectSession,
  onLogout,
  onDeleteAccount,
  token,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (open && token) {
      fetchSessions();
    }
  }, [open, token]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/chat/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setSessions(response.data.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await axios.delete(`/api/chat/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(sessions.filter((s) => s.id !== sessionId));
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  };

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: 280, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">Chat History</Typography>
        </Box>
        <Divider />
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <List>
              {sessions.map((session) => (
                <ListItem
                  key={session.id}
                  button
                  onClick={() => {
                    onSelectSession(session.id);
                    onClose();
                  }}
                >
                  <ListItemIcon>
                    <ChatIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={session.title}
                    secondary={new Date(session.createdAt).toLocaleDateString()}
                    primaryTypographyProps={{ noWrap: true }}
                  />
                  <IconButton edge="end" onClick={(e) => handleDeleteSession(e, session.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItem>
              ))}
              {sessions.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No history found
                  </Typography>
                </Box>
              )}
            </List>
          )}
        </Box>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<RemoveAccountIcon />}
            onClick={() => setDeleteConfirmOpen(true)}
            fullWidth
          >
            Remove Account
          </Button>
          <Button
            variant="text"
            startIcon={<LogoutIcon />}
            onClick={onLogout}
            fullWidth
          >
            Logout
          </Button>
        </Box>
      </Box>

      {/* Delete Account Confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Remove Account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete your account and all chat history. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onDeleteAccount();
              setDeleteConfirmOpen(false);
            }}
            color="error"
            autoFocus
          >
            Delete Everything
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
};

export default HistorySidebar;
