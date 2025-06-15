import React, { useEffect, useState, useRef } from 'react';
import userImg from '../../assets/user.svg';
import Input from '../../components/Input';
import io from 'socket.io-client';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Initialize socket connection
const socket = io('http://localhost:8000', {
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

const Dashboard = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user:detail')));
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [message, setMessage] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);

  // Mock data for right sidebar - replace with actual data from your API
  const [conversationLinks, setConversationLinks] = useState([]);
  const [conversationFiles, setConversationFiles] = useState([]);

  // File attachment states
  const [attachedFiles, setAttachedFiles] = useState([]);
  const fileInputRef = useRef(null);

  // Ref for auto-scrolling to latest message
  const messagesEndRef = useRef(null);

  // Menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll when messages change or when a new conversation is selected
  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedConversation]);

  useEffect(() => {
    const loggedInUser = JSON.parse(localStorage.getItem('user:detail'));
    const fetchConversations = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/conversations/${loggedInUser?.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        const resData = await res.json();
        const validConversations = resData.filter(conv => conv && conv.user && conv.conversationId);
        console.log('Valid conversations:', validConversations);
        setConversations(validConversations);
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }
    };
    fetchConversations();

    // Socket.IO event listeners
    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });

    socket.on('receive_message', (data) => {
      console.log('Received message:', data);
      if (data.conversationId === selectedConversation?.conversationId) {
        setMessages(prevMessages => [...prevMessages, data]);
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
    });

    return () => {
      socket.off('connect');
      socket.off('receive_message');
      socket.off('disconnect');
    };
  }, [selectedConversation]);

  // Add useEffect to fetch available users
  useEffect(() => {
    const fetchAvailableUsers = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/users?userId=${user?.id}`);
        const data = await response.json();
        setAvailableUsers(data);
      } catch (error) {
        console.error('Error fetching available users:', error);
      }
    };

    if (user?.id) {
      fetchAvailableUsers();
    }
  }, [user?.id]);

  console.log('user :>> ' , user);
  console.log('conversations :>> ', conversations);

  const fetchMessages = async (conversationId) => {
    if (!conversationId) return;
    
    try {
      const response = await axios.get(`http://localhost:8000/api/message/${conversationId}`);
      console.log('Raw messages from API:', response.data);
      const formattedMessages = response.data.map(msg => ({
        ...msg,
        createdAt: msg.created_at || new Date().toISOString()
      }));
      setMessages(formattedMessages);
      
      // Extract media, links, and files from messages
      extractConversationContent(formattedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const extractConversationContent = (messages) => {
  const links = [];
  const files = [];

  messages.forEach(msg => {
    // Extract URLs (links)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlMatches = msg.message.match(urlRegex);
    if (urlMatches) {
      urlMatches.forEach(url => {
        links.push({
          id: Date.now() + Math.random(),
          url: url,
          title: url.length > 50 ? url.substring(0, 50) + '...' : url,
          timestamp: msg.createdAt
        });
      });
    }

    // Extract files if they exist in the message
    if (msg.files && Array.isArray(msg.files)) {
      msg.files.forEach(file => {
        files.push({
          id: file.id || Date.now() + Math.random(),
          name: file.name || 'Unknown file',
          size: file.size || '0 KB',
          timestamp: file.timestamp || msg.createdAt,
          type: file.type || 'unknown'
        });
      });
    }
  });

  setConversationLinks(links);
  setConversationFiles(files);
};

  const handleConversationClick = async (conversation) => {
    try {
      if (!conversation.conversationId) {
        // This is a new conversation with an available user
        const response = await fetch('http://localhost:8000/api/conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            senderId: user.id,
            receiverId: conversation.user.userId
          })
        });
        
        const data = await response.json();
        if (data.conversationId) {
          // Update the conversation object with the new conversationId
          conversation.conversationId = data.conversationId;
          // Add the new conversation to the list
          setConversations(prev => [...prev, conversation]);
        }
      }
      
      setSelectedConversation(conversation);
      fetchMessages(conversation.conversationId);
      
      // Join the conversation room
      socket.emit('join_room', conversation.conversationId);
    } catch (error) {
      console.error('Error handling conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!selectedConversation || (!message.trim() && attachedFiles.length === 0)) {
      console.log('Message not sent: No conversation selected or message/files are empty.');
      return;
    }

    try {
      const messageData = {
        conversationId: selectedConversation.conversationId,
        senderId: user?.id,
        message: message.trim(),
        receiverId: selectedConversation?.user?.id,
        files: attachedFiles // Include attached files
      };

      // Emit the message through Socket.IO
      socket.emit('send_message', messageData);
      console.log('Sending message:', messageData);
      
      // Clear input and attachments after sending
      setMessage('');
      setAttachedFiles([]);
      
      // Don't update local state here - wait for the receive_message event
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Handle file attachment
  const handleFileAttach = (event) => {
    const files = Array.from(event.target.files);
    const newAttachedFiles = files.map(file => ({
      id: Date.now() + Math.random(),
      file: file,
      name: file.name,
      size: file.size,
      type: getFileTypeFromMime(file.type),
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));
    
    setAttachedFiles(prev => [...prev, ...newAttachedFiles]);
    // Reset input value to allow selecting the same file again
    event.target.value = '';
  };

  // Get file type from MIME type
  const getFileTypeFromMime = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('document') || mimeType.includes('text')) return 'document';
    return 'file';
  };

  // Remove attached file
  const removeAttachedFile = (fileId) => {
    setAttachedFiles(prev => {
      const updatedFiles = prev.filter(file => file.id !== fileId);
      // Clean up object URLs for images
      const fileToRemove = prev.find(file => file.id === fileId);
      if (fileToRemove && fileToRemove.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return updatedFiles;
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'pdf':
        return (
          <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
      case 'image':
        return (
          <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        );
      case 'video':
        return (
          <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
        );
      case 'audio':
        return (
          <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
          </svg>
        );
      case 'document':
        return (
          <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user:token');
    localStorage.removeItem('user:detail');
    navigate('/users/sign_in');
  };

  const handleDeleteConversation = async (conversationId) => {
    try {
      const token = localStorage.getItem('user:token');
      const response = await fetch(`http://localhost:8000/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.ok) {
        setConversations(prevConversations => 
          prevConversations.filter(conv => conv.conversationId !== conversationId)
        );
        
        if (selectedConversation?.conversationId === conversationId) {
          setSelectedConversation(null);
          setMessages([]);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to delete conversation:', errorData);
        alert(errorData.message || 'Failed to delete conversation. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('An error occurred while deleting the conversation. Please try again.');
    }
  };

  // Add click outside handler to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen && !event.target.closest('.menu-container')) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Add this new component at the top of your file, after the imports
  const DeleteConfirmationDialog = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-[#1a1836]/80 flex items-center justify-center z-50">
        <div className="bg-[#23214a]/95 border border-[#3a336a] rounded-2xl p-8 max-w-md w-full mx-4 transform transition-all">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-red-900/30 p-3 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-bold text-white text-center mb-2">Delete Conversation</h3>
          <p className="text-[#a59ecb] text-center mb-8">
            Are you sure you want to delete this conversation? This action cannot be undone.
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-white bg-[#3a336a] hover:bg-[#a259ff]/30 rounded-xl transition-colors duration-200 font-medium border border-[#3a336a]"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors duration-200 font-medium border border-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Add new function to handle starting a new conversation
  const handleStartNewChat = async (userData) => {
    try {
      const response = await fetch('http://localhost:8000/api/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId: user.id,
          receiverId: userData.userId
        })
      });
      
      const data = await response.json();
      if (data.conversationId) {
        const newConversation = {
          user: userData.user,
          conversationId: data.conversationId
        };
        setConversations(prev => [...prev, newConversation]);
        handleConversationClick(newConversation);
      }
    } catch (error) {
      console.error('Error starting new chat:', error);
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col lg:flex-row overflow-hidden chat-container bg-gradient-to-br from-[#1a1836] via-[#23214a] to-[#2d295e] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(#a259ff_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1836]/80 via-transparent to-[#2d295e]/80 pointer-events-none"></div>
      
      {/* Content Container */}
      <div className="relative w-full h-full flex flex-col lg:flex-row">
        {/* Left Sidebar */}
        <div className="w-full lg:w-[25%] border-r border-[#3a336a] h-full flex flex-col bg-[#23214a]/80 backdrop-blur-md">

          {/* User Info */}
          <div className="flex items-center justify-between px-4 py-6 bg-gradient-to-r from-[#23214a] to-[#2d295e] border-b border-[#3a336a]">
            <div className="flex items-center">
              <div className="border-2 border-[#a259ff] p-[2px] rounded-full">
                <img src={userImg} alt="User Avatar" width={75} height={75} />
              </div>
              <div className="ml-6">
                <h3 className="text-xl font-semibold text-white">{user?.fullName}</h3>
                <p className="text-base font-light text-[#c3b8e6]">My Account</p>
              </div>
            </div>
            <div className="relative group">
              <button className="p-2 rounded-full hover:bg-[#a259ff]/20 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>
              <div className={`absolute right-0 mt-2 w-56 bg-[#23214a]/95 rounded-xl shadow-lg py-2 hidden group-hover:block z-10 border border-[#3a336a]`}>
                <div className="px-4 py-2 border-b border-[#3a336a]">
                  <p className="text-sm text-[#a59ecb]">Signed in as</p>
                  <p className="text-sm font-medium text-white">{user?.email}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-[#a259ff] hover:bg-[#a259ff]/10 hover:text-white transition-colors flex items-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2 text-[#a259ff]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>

          <hr className="mb-2 border-[#3a336a]" />

          {/* Available Users Section */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Available Users</h3>
            <div className="overflow-y-auto hide-scrollbar" style={{ maxHeight: '160px' }}>
              {availableUsers.map((userData) => (
                <div
                  key={userData.userId}
                  className="p-4 cursor-pointer transition-colors duration-200 hover:bg-[#2d295e]/60"
                  onClick={() => handleStartNewChat(userData)}
                >
                  <div className="flex items-center space-x-3">
                    <img src={userImg} alt={userData.user.fullName} className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="font-medium">{userData.user.fullName}</p>
                      <p className="text-sm text-gray-500">{userData.user.email}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto px-4 hide-scrollbar">
            <style>{`
              .hide-scrollbar::-webkit-scrollbar {
                display: none;
              }
              .hide-scrollbar {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>

            <h2 className="text-lg font-semibold mb-3 text-[#a259ff]">Messages</h2>
             
            {conversations.length > 0 ? (
              conversations.map((conversation, index) => (
                <div
                  key={conversation.conversationId || index}
                  onClick={() => handleConversationClick(conversation)}
                  className={`flex items-center my-3 px-2 py-2 rounded-lg transition cursor-pointer ${
                    selectedConversation?.conversationId === conversation.conversationId ? 'bg-[#2d295e] border-l-4 border-[#a259ff]' : 'hover:bg-[#2d295e]/60'
                  }`}
                >
                  <div className="border border-[#a259ff]/40 p-[2px] rounded-full">
                    <img src={userImg} alt={`${conversation?.user?.fullName || 'User'} avatar`} width={40} height={40} />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-base font-medium text-white">{conversation?.user?.fullName || 'Unknown User'}</h3>
                    <p className="text-sm text-[#a59ecb]">{conversation?.user?.email || 'No email'}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className='text-center text-lg font-semibold mt-12 text-[#a259ff]'>No Conversations</div>
            )}
          </div>
        </div>

        {/* Middle Content Area */}
        <div className="w-full lg:w-1/2 h-full flex flex-col items-center justify-between py-4 bg-[#23214a]/80 backdrop-blur-md">
          {selectedConversation && (
            <div className="w-11/12 max-w-[800px] h-20 rounded-full flex items-center px-6 shadow-sm mb-4 bg-gradient-to-r from-[#23214a] to-[#2d295e] border border-[#3a336a]">
              <div className="cursor-pointer shrink-0">
                <img src={userImg} alt="User" className="rounded-full border border-[#a259ff]/60" width={55} height={55} />
              </div>

              <div className="ml-4 flex flex-col justify-center mr-auto">
                <h3 className="text-lg font-semibold text-white leading-none">
                  {selectedConversation?.user?.fullName}
                </h3>
                <p className="text-sm font-light text-[#a259ff] mt-1">Chat Member</p>
              </div>

              <div className="relative menu-container">
                <div 
                  className="cursor-pointer p-2 rounded-full hover:bg-[#a259ff]/20 transition"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-600"
                  >
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </div>
                <div className={`absolute right-0 mt-2 w-48 bg-[#23214a]/95 rounded-md shadow-lg py-1 z-10 ${isMenuOpen ? 'block' : 'hidden'} border border-[#3a336a]`}>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/30 flex items-center"
                    onClick={() => {
                      setShowDeleteDialog(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2 text-red-400"
                    >
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                    Delete Conversation
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Chat Body */}
          <div className="flex-1 w-full overflow-y-scroll px-6 space-y-6 mb-4 hide-scrollbar">
            <div className="space-y-6 flex flex-col h-full">
              {selectedConversation?.conversationId ? (
                <>
                  {messages.map((message, index) => {
                    const isCurrentUser = message.senderId === user?.id;
                    const messageTime = message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '';
                    
                    return (
                      <div key={index} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[60%] w-fit rounded-lg p-4 ${
                            isCurrentUser 
                              ? 'bg-gradient-to-r from-[#a259ff] to-[#6c47c7] text-white rounded-br-none shadow-lg'
                              : 'bg-[#2d295e]/80 text-[#e0e0f0] rounded-bl-none border border-[#3a336a]'
                          }`}
                        >
                          <div>{message.message}</div>
                          <div className="text-xs opacity-70 mt-1 text-right text-[#a59ecb]">
                            {messageTime}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Invisible div to scroll to */}
                  <div ref={messagesEndRef} />
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#a259ff] mb-3">
                      Welcome to Pingora
                    </div>
                    <div className="text-xl text-[#a59ecb]">
                      Select a conversation to view it's details
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Input */}
          {selectedConversation?.conversationId && (
            <div className="w-11/12 max-w-[800px] mb-4">
              {/* File Attachments Preview */}
              {attachedFiles.length > 0 && (
                <div className="mb-3 p-3 bg-[#2d295e]/80 rounded-lg border border-[#3a336a]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#a259ff]">
                      {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''} attached
                    </span>
                    <button
                      onClick={() => setAttachedFiles([])}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {attachedFiles.map((file) => (
                      <div key={file.id} className="relative bg-[#23214a] p-2 rounded border border-[#3a336a]">
                        <button
                          onClick={() => removeAttachedFile(file.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                        
                        {file.type === 'image' && file.preview ? (
                          <div className="w-full h-16 bg-gray-100 rounded mb-2 overflow-hidden">
                            <img 
                              src={file.preview} 
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-16 bg-gray-100 rounded mb-2 flex items-center justify-center">
                            {getFileIcon(file.type)}
                          </div>
                        )}
                        
                        <p className="text-xs text-gray-600 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center bg-[#23214a] rounded-full px-4 py-2 shadow-md border border-[#3a336a]">
                <Input
                  placeholder="Type a message"
                  className="w-full"
                  inputClassName="w-full bg-transparent text-white placeholder-[#a59ecb] border-none outline-none focus:ring-0 focus:outline-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (message.trim() || attachedFiles.length > 0) {
                        sendMessage();
                      }
                    }
                  }}
                />
                <div className="flex items-center">
                  <button 
                    className="p-2 rounded-full hover:bg-[#a259ff]/20 transition text-[#a259ff]"
                    onClick={sendMessage}
                    disabled={!message.trim() && attachedFiles.length === 0}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M10 14l11 -11" />
                      <path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" />
                    </svg>
                  </button>
                  
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileAttach}
                    multiple
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
                  />
                  
                  <button 
                    className="ml-3 p-2 rounded-full hover:bg-[#a259ff]/20 transition text-[#a259ff]"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                      <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
                      <path d="M12 11v6" />
                      <path d="M9 14h6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-[25%] h-full bg-[#23214a]/80 border-l border-[#3a336a] p-6 overflow-y-auto text-white">
          {selectedConversation ? (
            <div className="space-y-6">
              {/* User Profile Section */}
              <div className="bg-gradient-to-r from-[#23214a] to-[#2d295e] rounded-xl p-6 border border-[#3a336a]">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-2 border-[#a259ff] p-1">
                      <img src={userImg} alt="User" className="w-full h-full rounded-full" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{selectedConversation?.user?.fullName}</h3>
                    <p className="text-sm text-[#a259ff]">Chat Member</p>
                  </div>
                </div>
              </div>

              {/* About Section */}
              <div className="bg-[#23214a] rounded-xl p-6 border border-[#3a336a] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-white">About</h4>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 text-[#a59ecb]">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">{selectedConversation?.user?.email || 'No email available'}</span>
                  </div>
                </div>
              </div>

              {/* Conversation Info Section */}
              <div className="bg-[#23214a] rounded-xl p-6 border border-[#3a336a] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-white">Conversation Info</h4>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Started</p>
                      <p className="text-xs text-[#a59ffb]">This conversation began {new Date(selectedConversation?.createdAt || Date.now()).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Last Active</p>
                      <p className="text-xs text-[#a59ffb]">Active now</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Messages</p>
                      <p className="text-xs text-[#a59ffb]">{messages.length} messages exchanged</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-[#a259ff]/60">
                <div className="mb-4">
                  <svg className="w-16 h-16 mx-auto text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm">Select a conversation to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add the dialog component at the end of your return statement, before the closing div */}
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => {
          handleDeleteConversation(selectedConversation.conversationId);
          setShowDeleteDialog(false);
        }}
      />
    </div>
  );
};

export default Dashboard;