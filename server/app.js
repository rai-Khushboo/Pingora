const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(express.json());
app.use(cors());

// Connect to the database
require('./db/conn');

// Import models
const Users = require('./models/Users');
const Conversations = require('./models/Conversations');
const Message = require('./models/Messages'); 

const port = process.env.PORT || 8000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/' , (req , res) => {
    res.send('Welcome to the server!');
})

app.post('/api/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Please fill all the fields' });
    }

    const isAlreadyExist = await Users.findOne({ email });
    if (isAlreadyExist) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const newUser = new Users({
      fullName,
      email,
      password: hashedPassword
    });

    await newUser.save();
    return res.status(201).json({ message: 'User registered successfully' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please fill all the fields' });
    }

    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'User does not exist' });
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const payload = {
      userId: user._id,
      email: user.email,
    };

    const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_SECRET_KEY';

    jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: 86400 }, async (err, token) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Token generation failed' });
      }

      await Users.updateOne({ _id: user._id }, { $set: { token } });

      console.log('User token' , token);
      res.status(200).json({ user : {id: user._id , email : user.email, fullName: user.fullName}, token : token});
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/conversation' , async (req , res)=>{
  try{
    const { senderId, receiverId } = req.body;
    
    // Check if conversation already exists
    const existingConversation = await Conversations.findOne({
      members: { $all: [senderId, receiverId] }
    });

    if (existingConversation) {
      return res.status(200).json({ 
        message: 'Conversation already exists',
        conversationId: existingConversation._id 
      });
    }

    const newConversation = new Conversations({ members : [senderId , receiverId] });
    await newConversation.save();
    res.status(201).json({ 
      message : 'Conversation created successfully',
      conversationId: newConversation._id 
    });
  }catch(error){
    console.log('error' , error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const conversations = await Conversations.find({
      members: { $in: [userId] }
    });

    const conversationUserData = await Promise.all(
      conversations.map(async (conversation) => {
        const receiverId = conversation.members.find(member => member !== userId);

        if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
          // Return a structured object with null user if receiverId is invalid
          return { user: null, conversationId: conversation._id };
        }

        const user = await Users.findById(receiverId);

        if (!user) {
          // Return a structured object with null user if user is not found
          return { user: null, conversationId: conversation._id };
        }

        return {user : {
          email : user.email, 
          fullName : user.fullName, 
        } , conversationId : conversation._id}
      })
    );
    res.status(200).json(conversationUserData);
  }
  catch(error){
    console.log('error' , error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/api/message', async (req, res) => {
  try {
    const { conversationId, senderId, message, receiverId = '' } = req.body;

    if (!senderId || !message) {
      return res.status(400).send("Please fill all required fields");
    }

    if (!conversationId && receiverId) {
      // Check if conversation already exists
      const existingConversation = await Conversations.findOne({
        members: { $all: [senderId, receiverId] }
      });

      let conversationToUse;
      if (existingConversation) {
        conversationToUse = existingConversation;
      } else {
      const newConversation = new Conversations({ members: [senderId, receiverId] });
      await newConversation.save();
        conversationToUse = newConversation;
      }

      const newMessage = new Message({
        conversationId: conversationToUse._id,
        senderId,
        message
      });
      await newMessage.save();

      return res.status(200).json({
        message: "Message sent successfully",
        conversationId: conversationToUse._id
      });
    } else if(!conversationId && !receiverId) {
      return res.status(400).send("Conversation ID or Receiver ID is required");
    }

    const newMessage = new Message({ conversationId, senderId, message });
    await newMessage.save();

    return res.status(200).json("Message sent successfully");
  } catch (error) {
    console.log('error', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/api/message/:conversationId' , async (req , res) => {
  try{
    const conversationId = req.params.conversationId;
    if(conversationId === 'new') return res.status(200).json([]);
    const messages = await Message.find({ conversationId });
    const messageUserData = Promise.all(messages.map (async(message) => {
      const user = await Users.findById(message.senderId);
      return { user : { email : user.email , fullName : user.fullName} , message : message.message, senderId: message.senderId}
    }))

    res.status(200).json(await messageUserData);
  }
  catch(error){
    console.log('error' , error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

app.get('/api/users' , async(req , res)=>{
  try{
    const users = await Users.find({ });
    const usersData = Promise.all(users.map(async (user)=>{
      return { user : { email : user.email , fullName : user.fullName} , userId : user._id}
    }))
    res.status(200).json(await usersData);
  }catch(error){
    console.log('error' , error)
  }
})  

app.delete('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Delete all messages associated with this conversation
    await Message.deleteMany({ conversationId });
    
    // Delete the conversation
    const deletedConversation = await Conversations.findByIdAndDelete(conversationId);
    
    if (!deletedConversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    res.status(200).json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ message: 'Error deleting conversation' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_room', (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.id} joined room: ${conversationId}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { conversationId, senderId, message, receiverId } = data;
      
      // Save message to database
      const newMessage = new Message({
        conversationId,
        senderId,
        message,
        createdAt: new Date()
      });
      await newMessage.save();

      // Get sender's information
      const sender = await Users.findById(senderId);
      
      // Create message object with all necessary data
      const messageData = {
        conversationId,
        senderId,
        message,
        receiverId,
        createdAt: newMessage.createdAt,
        user: {
          email: sender.email,
          fullName: sender.fullName
        }
      };

      // Emit the message to all users in the conversation room
      io.to(conversationId).emit('receive_message', messageData);
      
      console.log('Message sent:', messageData);
    } catch (error) {
      console.error('Error in send_message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start the server
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});