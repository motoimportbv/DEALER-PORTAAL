import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  MessageCircle, 
  Send, 
  X,
  User,
  Clock
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ChatWidget = ({ isAdmin = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Admin: always fetch conversations on mount
    if (isAdmin) {
      fetchConversations();
    }
    fetchUnreadCount();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
      if (isAdmin) {
        fetchConversations();
      }
      if (isOpen && (selectedConversation || !isAdmin)) {
        fetchMessages(selectedConversation);
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fetch messages when conversation is selected or chat is opened
    if (isOpen) {
      if (!isAdmin) {
        fetchMessages();
      } else if (selectedConversation) {
        fetchMessages(selectedConversation);
      }
    }
  }, [isOpen, selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API}/chat/unread-count`);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/chat/conversations`);
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId = null) => {
    try {
      const conversationId = convId || selectedConversation || 'me';
      const endpoint = isAdmin && conversationId 
        ? `${API}/chat/messages/${conversationId}`
        : `${API}/chat/messages/${conversationId}`;
      
      // For dealers, use their own conversation
      const url = isAdmin 
        ? `${API}/chat/messages/${conversationId}`
        : `${API}/chat/messages/me`;
      
      const response = await axios.get(isAdmin ? `${API}/chat/messages/${conversationId}` : `${API}/chat/messages/me`);
      setMessages(response.data);
      setUnreadCount(0);
    } catch (error) {
      // If no messages yet, that's okay
      if (error.response?.status !== 404) {
        console.error('Failed to fetch messages:', error);
      }
      setMessages([]);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await axios.post(`${API}/chat/messages`, {
        message: newMessage,
        conversation_id: isAdmin ? selectedConversation : undefined
      });
      setNewMessage('');
      fetchMessages(selectedConversation);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const selectConversation = (convId) => {
    setSelectedConversation(convId);
    fetchMessages(convId);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Zojuist';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min geleden`;
    if (diff < 86400000) return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  // Dealer view - simple chat
  if (!isAdmin) {
    return (
      <>
        {/* Chat Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all"
          data-testid="chat-toggle-btn"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <>
              <MessageCircle className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </>
          )}
        </button>

        {/* Chat Window */}
        {isOpen && (
          <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden" data-testid="chat-window">
            {/* Header */}
            <div className="bg-red-600 text-white p-4">
              <h3 className="font-barlow font-bold uppercase">Chat met Moto Import</h3>
              <p className="text-red-100 text-sm">Wij reageren zo snel mogelijk</p>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-3 bg-zinc-50">
              {messages.length === 0 ? (
                <div className="text-center text-zinc-400 py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Start een gesprek</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_role === 'dealer' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.sender_role === 'dealer'
                          ? 'bg-red-600 text-white rounded-br-none'
                          : 'bg-white border border-zinc-200 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.sender_role === 'dealer' ? 'text-red-200' : 'text-zinc-400'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 bg-white border-t border-zinc-200">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Typ uw bericht..."
                  className="flex-1"
                  data-testid="chat-input"
                />
                <Button 
                  type="submit" 
                  disabled={sending || !newMessage.trim()}
                  className="bg-red-600 hover:bg-red-700"
                  data-testid="chat-send-btn"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </div>
        )}
      </>
    );
  }

  // Admin view - conversations list + chat
  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="font-barlow text-xl uppercase flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Dealer Berichten
          {unreadCount > 0 && (
            <Badge className="bg-red-600">{unreadCount} nieuw</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex gap-4 overflow-hidden p-4 pt-0">
        {/* Conversations List */}
        <div className="w-1/3 border-r pr-4 overflow-y-auto">
          <h4 className="font-semibold text-sm text-zinc-500 mb-3">GESPREKKEN</h4>
          {conversations.length === 0 ? (
            <p className="text-zinc-400 text-sm">Geen gesprekken</p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.conversation_id}
                  onClick={() => selectConversation(conv.conversation_id)}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    selectedConversation === conv.conversation_id
                      ? 'bg-red-50 border border-red-200'
                      : 'hover:bg-zinc-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{conv.dealer_name}</p>
                      <p className="text-xs text-zinc-500 truncate">{conv.last_message}</p>
                    </div>
                    {conv.unread_count > 0 && (
                      <Badge className="bg-red-600 ml-2">{conv.unread_count}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(conv.last_time)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.sender_role === 'admin'
                          ? 'bg-red-600 text-white rounded-br-none'
                          : 'bg-zinc-100 rounded-bl-none'
                      }`}
                    >
                      <p className="text-xs font-semibold mb-1 opacity-75">{msg.sender_name}</p>
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.sender_role === 'admin' ? 'text-red-200' : 'text-zinc-400'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Typ uw antwoord..."
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={sending || !newMessage.trim()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-400">
              <div className="text-center">
                <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Selecteer een gesprek</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatWidget;
