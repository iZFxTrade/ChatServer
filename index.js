
// Setup basic express server
const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 3000;

const bodyParser = require('body-parser');
app.use(bodyParser.json()); // parse application/json
app.use(bodyParser.text()); // parse text/plain
app.use(bodyParser.urlencoded({ extended: true })); // parse application/x-www-form-urlencoded


server.listen(port, () => {
  console.log('Server listening at port %d', port);

});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

let numUsers = 0;

io.on('connection', (socket) => {
  let addedUser = false;
  
  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    //console.log('Received message %s: %s', username , data);
    const userId = data.to;
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data,
      
    });
    
  });
// Lắng nghe sự kiện khi một client kết nối đến server
io.on('connection', (socket) => {
  console.log('A user connected.');

  // Lắng nghe sự kiện chat message từ client
  socket.on('chat message', (msg) => {
    console.log('Received message:', msg);

    // Gửi tin nhắn cho một user duy nhất với socketId tương ứng
    const userId = msg.to;
    const socketId = getUserSocketId(userId); // Lấy socketId của user từ id
    if (socketId) {
      socket.to(socketId).emit('chat message', msg);
      console.log('Sent message to user', userId);
    } else {
      console.log('User not found:', userId);
    }
  });

  // ...
});


  // when the client emits 'add user', this listens and executes
  socket.on('add user', (username) => {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', () => {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});

// Add webhook endpoint
app.post('/webhook/:username', (req, res) => {
  const { username } = req.params;
  let data = req.body;
  let text = '';
  try {
    if (typeof data === 'string') {
      text = data;
    } else if (typeof data === 'object' && data !== null) {
      console.log('data is an object');
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          var k = key;
          if (key === 'symbol' || key === "type") {
            k = "";
          }
          text += `${k}: ${data[key]}\n`;
        } else
          console.log('data is an object but not key: %s', key);
      }
    } else {
      console.log('data is not valid');
      return res.status(400).send('Invalid data format');
    }
  } catch (err) {
    console.error(err);
    return res.status(400).send('Invalid data format');
  }

  console.log('Webhook data: %s', text);
  io.emit('new message', {
    username,
    message: text
  });

  return res.status(200).send(`Webhook received for ${username}  : ${text}`);
});


