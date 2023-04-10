
// Setup basic express server
const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 3000;

const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
  const data = req.body;
  const msg = JSON.stringify(data, null, 2);
  let text = ''; // Khởi tạo chuỗi văn bản trống để lưu trữ các cặp giá trị JSON

  for (const key in data) {
    if (data.hasOwnProperty(key)) { // Kiểm tra xem thuộc tính có phải là của đối tượng hay không
      var k = key;
      if (key === 'symbol' || key === "type") {
        k = "";
      }
      text += `${k}: ${data[key]}\n`; // Thêm cặp giá trị vào chuỗi văn bản, với mỗi giá trị nằm trên một dòng mới
    }
  }
 
  
  console.log('Noi dung Webhook: %s', data);
  io.emit('new message', {
    username,
    //message: data.message
    message: text
  });

  res.status(200).send(`Webhook received for ${username}  : ${JSON.stringify(data)}`);
});

