// Load environment variables from .env file
require('dotenv').config();
const retry = require('async-retry');
const axios = require('axios');
const cheerio = require('cheerio');

// List of accepted API keys
const acceptedKeys = [process.env.API_KEY_1, process.env.API_KEY_2, process.env.API_KEY_3];

// Setup up Chatbot// Setup basic express server
const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 3000;

// Cache response neu prompt da ton tai truoc do
const NodeCache = require("node-cache");
const responseCache = new NodeCache({ stdTTL: 300 }); // TTL 5 phút

// OpenAI
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OpenAi_API, // This is the default and can be omitted
});

// Gemini
const { GoogleGenerativeAI } = require("@google/generative-ai");
// Kiểm tra API key
if (!process.env.Gemini_API) {
  throw new Error("Gemini_API is not defined in your .env file");
}

const genAI = new GoogleGenerativeAI(process.env.Gemini_API);
(async () => {
  try {
    // Lấy model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt
    const prompt = "Hello Gemini?";
    const result = await model.generateContent([prompt]);
    
    // Kiểm tra phản hồi
    if (result.response) {
      console.log(getCurrentTimeGTM7() +"Gemini.AI: "+result.response.text());
      const telegramSuccess = await sendTelegramMessage("iZFx.Trade", "Gemini.AI: " + result.response.text()); // Gui thong bao vao Telegram
      if (telegramSuccess) {
        console.log("Telegram System was successful: ", getCurrentTimeGTM7());
      }
      else {
        console.log("Failed to send Telegram message:", getCurrentTimeGTM7() + result.response.text());
      }
    } else {
      console.log("No response or invalid response format");
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
  console.log("Fetching data from Myfxbook...");
  fetchData();
})();

// Validate API key
function validateApiKey(req, res, next) {
  const { apiKey } = req.params;
  if (!acceptedKeys.includes(apiKey)) {
    return res.status(401).send("Invalid API key");
  }
  next();
}

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

function getCurrentTimeGTM7() {
  const now = new Date();
  const GTM7 = new Date(now.valueOf() + now.getTimezoneOffset() * 60000 + 7 * 3600000);
  const minutes = GTM7.getMinutes().toString().padStart(2, '0');
  const hours = GTM7.getHours().toString().padStart(2, '0');
  const day = GTM7.getDate().toString().padStart(2, '0');
  const month = (GTM7.getMonth() + 1).toString().padStart(2, '0');                   // Năm
  return `(⏱ ${hours}:${minutes} ${day}/${month}): `;
}

// Add Telegram Bot
const TelegramBot = require('node-telegram-bot-api');
// Hàm gửi tin nhắn Telegram
const sendTelegramMessage = async (apiKey, message) => {
  const telegramInfo = {
    [process.env.API_KEY_1]: {
      token: process.env.TELEGRAM_TOKEN_1,
      chatId: process.env.TELEGRAM_CHAT_ID_1
    },
    [process.env.API_KEY_2]: {
      token: process.env.TELEGRAM_TOKEN_2,
      chatId: process.env.TELEGRAM_CHAT_ID_2
    },
    [process.env.API_KEY_3]: {
      token: process.env.TELEGRAM_TOKEN_3,
      chatId: process.env.TELEGRAM_CHAT_ID_3
    },
    // ... (Các API key và thông tin Telegram khác)
  };

  const info = telegramInfo[apiKey];
  if (!info) {
    console.error('Invalid API key for Telegram:', apiKey);
    return false; // Hoặc throw error nếu bạn muốn dừng thực thi
  }

  const { token, chatId } = info;

  try {
    const bot = new TelegramBot(token);
    await bot.sendMessage(chatId, message); // Dùng await để đợi kết quả
    //console.log('Telegram message sent successfully:', message);
    return true;
  } catch (error) {
    console.error('Telegram error:', error.response?.body || error); // Xử lý lỗi tốt hơn
    return false;
  }
};



// Add webhook endpoint
app.post('/webhook/:username/:apiKey', (req, res) => {
  const { username, apiKey } = req.params;

  // Check if API key is valid
  if (!acceptedKeys.includes(apiKey)) {
    return res.status(401).send('Invalid API key');
  }

  // Extract the data from the request body
  const data = req.body;

  // Extract the text message from the data
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
    message: text,
  });

  // Add telegram bot
  const TelegramBot = require('node-telegram-bot-api');

  // Define objects to store telegram information for each API key
  const telegramInfo = {
    [process.env.API_KEY_1]: {
      token: process.env.TELEGRAM_TOKEN_1,
      chatId: process.env.TELEGRAM_CHAT_ID_1
    },
    [process.env.API_KEY_2]: {
      token: process.env.TELEGRAM_TOKEN_2,
      chatId: process.env.TELEGRAM_CHAT_ID_2
    },
    [process.env.API_KEY_3]: {
      token: process.env.TELEGRAM_TOKEN_3,
      chatId: process.env.TELEGRAM_CHAT_ID_3
    }
  };

  // Function to get telegram information based on API key
  function getTelegramInfo(apiKey) {
    return telegramInfo[apiKey];
  }

  if (!getTelegramInfo(apiKey)) {
    return res.status(401).send('Invalid API key');
  }

  const { token, chatId } = getTelegramInfo(apiKey);
  const bot = new TelegramBot(token);
  bot.sendMessage(chatId, text)
    .then(() => {
      return res.status(200).send(`Webhook received for ${username}  : ${text}`);
    })
    .catch((error) => {
      console.error('Telegram error:', error.response.body);
      return res.status(500).send('Error sending message to Telegram');
    });
});

// Ham request Gemini
async function callGeminiAPI(prompt, moden= "gemini-1.5-pro") {
  const cacheKey = `gemini_${prompt+moden}`;
  const cachedResponse = responseCache.get(cacheKey);
  if (cachedResponse) {
    console.log(getCurrentTimeGTM7()+"Gemini.Ai (Cache): " + cachedResponse);
    const UserAI = "Gemini.AI ("+moden+"): ";
    io.emit('new message', {
      username: UserAI,
      message: cachedResponse 
    });
    const telegramSuccess = await sendTelegramMessage("KDFund", UserAI + cachedResponse); 
    return cachedResponse;
  }
  try {
    // Lấy model
    const model = genAI.getGenerativeModel({ model: moden });
    const result = await model.generateContent([prompt]);

    // Kiểm tra phản hồi
    if (result.response) {
      const response = result.response.text();
      responseCache.set(cacheKey, response); // Lưu vào cache
      console.log(getCurrentTimeGTM7()+"Gemini.AI: " + response);
      const UserAI = "Gemini.AI ("+moden+"): ";
      io.emit('new message', {
        username: UserAI,
        message: response 
      });
      const telegramSuccess = await sendTelegramMessage("KDFund", UserAI + result.response.text()); 
      return response;
    } else {
      console.log("No response or invalid response format");
      return "No response or invalid response format";
    }
  } catch (error) {
    console.error("Error:", error.message);
    return "Error processing request";
  }
}



// Endpoint request Gemini
app.post('/gemini/:username/:apiKey/:moden?',validateApiKey, async (req, res) => {
  const { username, apiKey, moden } = req.params;
  let prompt;

  // Kiểm tra nếu req.body là JSON và có cấu trúc đúng
  if (req.is('application/json') && req.body.messages) {
    // Tìm prompt trong mảng messages
    const userMessage = req.body.messages.find(message => message.role === 'user');
    prompt = userMessage ? userMessage.content : null;
  } else if (typeof req.body === 'string') {
    // Nếu body là text
    prompt = req.body;
  }

  if (!prompt) {
    return res.status(400).send('Invalid request format or missing prompt');
  }
  
  io.emit('new message', {
    username,
    message: getCurrentTimeGTM7() +prompt
  });
 // Check if API key is valid
 if (!acceptedKeys.includes(apiKey)) {
  return res.status(401).send('Invalid API key');
}
  try {
    const response = await callGeminiAPI(prompt, moden);
    return res.status(200).send(response);

  } catch (error) {
    console.error(error);
    return res.status(500).send('Error processing request');
  }
});

// Ham request OpenAI
async function callOpenAI(prompt, model = "gpt-3.5-turbo") {
  const cacheKey = `openai_${prompt+model}`;
  const cachedResponse = responseCache.get(cacheKey);
  if (cachedResponse) {
    console.log(getCurrentTimeGTM7()+"Open.AI (Cache): " + cachedResponse);
    const UserAI = "Open.AI ("+model+"): ";
    io.emit('new message', {
      username: UserAI,
      message: cachedResponse
    });
    const telegramSuccess = await sendTelegramMessage("KDFund", UserAI + cachedResponse); 
    return cachedResponse;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000
  });
    const response = completion.choices[0].message.content;
    responseCache.set(cacheKey, response); // Lưu vào cache
    console.log(getCurrentTimeGTM7()+"Open.AI: " + response);
    const UserAI = "Open.AI ("+model+"): ";
    io.emit('new message', {
      username: UserAI,
      message: response
    });
    const telegramSuccess = await sendTelegramMessage("KDFund", UserAI + response); 
    return response;
  } catch (error) {
    console.log(error);
  }
} 


// Add Endpoint request OpenAI
app.post('/openai/:username/:apiKey/:model?', validateApiKey, async (req, res) => {
  const { username, apiKey, model } = req.params;
  let prompt;

  // Kiểm tra nếu req.body là JSON và có cấu trúc đúng
  if (req.is('application/json') && req.body.messages) {
    // Tìm prompt trong mảng messages
    const userMessage = req.body.messages.find(message => message.role === 'user');
    prompt = userMessage ? userMessage.content : null;
  } else if (typeof req.body === 'string') {
    // Nếu body là text
    prompt = req.body;
  }

  if (!prompt) {
    return res.status(400).send('Invalid request format or missing prompt');
  }
  
  io.emit('new message', {
    username,
    message:  getCurrentTimeGTM7() +prompt
  });
 // Check if API key is valid
 if (!acceptedKeys.includes(apiKey)) {
  return res.status(401).send('Invalid API key');
}

  
  try {
    const response = await callOpenAI(prompt,model);
    return res.status(200).send(response);

  } catch (error) {
    console.error(error);
    return res.status(500).send('Error processing request');
  }   
}
);

// Ham request Azure OpenAI

async function callAzureOpenAI(prompt, model = 'gpt-4o-mini') {
  const cacheKey = `azure_openai_${prompt+model}`;
  const cachedResponse = responseCache.get(cacheKey);
  if (cachedResponse) {
    console.log(getCurrentTimeGTM7()+"AzureOpen.AI (Cache): " + cachedResponse);
    const UserAI = "Azure.AI ("+model+"): ";
    io.emit('new message', {
      username: UserAI,
      message: cachedResponse
    });
    const telegramSuccess = await sendTelegramMessage("KDFund", UserAI + cachedResponse); 
    return cachedResponse;
  }
  const azure = new OpenAI({ baseURL: "https://models.inference.ai.azure.com", apiKey: process.env.GitHub_API });
  try {
    const kq = await azure.chat.completions.create({
      model: model,
      messages: [
        { role:"user", content: prompt }
      ],
      //temperature: 1.0,
      //top_p: 1.0,
      //max_tokens: 1000,
      //model: model
  });
    const response = kq.choices[0].message.content;
    responseCache.set(cacheKey, response); // Lưu vào cache
    console.log(getCurrentTimeGTM7()+"AzureOpen.AI: " + response);
    const UserAI = "Azure.AI ("+model+"): ";
    io.emit('new message', {
      username: UserAI,
      message: response
    });
    const telegramSuccess = await sendTelegramMessage("KDFund", UserAI + response); 
    return response;
  } catch (error) {
    console.log(error);
  }
}
  // Add endpoint request Azure OpenAI
  app.post('/azure/:username/:apiKey/:model?', validateApiKey, async (req, res) => {
    const { username, apiKey, model } = req.params; // Lấy model từ params
    let prompt;

    // Kiểm tra nếu req.body là JSON và có cấu trúc đúng
    if (req.is('application/json') && req.body.messages) {
      // Tìm prompt trong mảng messages
      const userMessage = req.body.messages.find(message => message.role === 'user');
      prompt = userMessage ? userMessage.content : null;
    } else if (typeof req.body === 'string') {
      // Nếu body là text
      prompt = req.body;
    }

    if (!prompt) {
      return res.status(400).send('Invalid request format or missing prompt');
    }
    
    io.emit('new message', {
      username,
      message:  getCurrentTimeGTM7() +prompt 
    });
  // Check if API key is valid
  if (!acceptedKeys.includes(apiKey)) {
    return res.status(401).send('Invalid API key');
  }
    
    try {
      const response = await callAzureOpenAI(prompt,model);
      return res.status(200).send(response);

    } catch (error) {
      console.error(error);
      return res.status(500).send('Error processing request');
    }   
  } );

// Add endpoint request All AI
app.post('/allai/:username/:apiKey', validateApiKey, async (req, res) => {
  const { username, apiKey } = req.params;
  let prompt;

  // Kiểm tra nếu req.body là JSON và có cấu trúc đúng
  if (req.is('application/json') && req.body.messages) {
    // Tìm prompt trong mảng messages
    const userMessage = req.body.messages.find(message => message.role === 'user');
    prompt = userMessage ? userMessage.content : null;
  } else if (typeof req.body === 'string') {
    // Nếu body là text
    prompt = req.body;
  }

  if (!prompt) {
    return res.status(400).send('Invalid request format or missing prompt');
  }
  
  io.emit('new message', {
    username,
    message: getCurrentTimeGTM7() +prompt
  });
 // Check if API key is valid
 if (!acceptedKeys.includes(apiKey)) {
  return res.status(401).send('Invalid API key');
}
  try {
    const response = await callAllAI(prompt);
    return res.status(200).send(response);

  } catch (error) {
    console.error(error);
    return res.status(500).send('Error processing request');
  }   
} );
// Call All AI, Google AI, Azure OpenAI, Open AI, ChatGPT
async function callAllAI(prompt) {
  const cacheKey = `allai_${prompt}`;
  const cachedResponse = responseCache.get(cacheKey);
  if (cachedResponse) {
    console.log(getCurrentTimeGTM7()+"All AI: Returning cached response");
    return cachedResponse;
  }
  const azure = await callAzureOpenAI(prompt);
  const azure4 = await callAzureOpenAI(prompt, 'gpt-4o');
  //const openai = await callOpenAI(prompt);
  const gemini = await callGeminiAPI(prompt);
  const response = `"Azure.AI": ${azure}\n\n"GPT4": ${azure4}\n\n"Gemini.AI": ${gemini}`;
  responseCache.set(cacheKey, response); // Lưu vào cache
  return response;
}


// Encode URL https://www.myfxbook.com/community/outlook
// Mảng lưu trữ dữ liệu symbol và long/short % (sẽ được cập nhật định kỳ)
let marketData = [];

// Cập nhật dữ liệu từ Myfxbook mỗi 5 phút
const fetchData = async () => {
  return retry(async (bail, attempt) => {
    try {
      //console.log(`Attempt ${attempt}: Fetching data from Myfxbook...`);
      const response = await axios.get('https://api.allorigins.win/get?url=https://www.myfxbook.com/community/outlook', { timeout: 360000 }); // Đặt timeout cho axios (ví dụ: 60 giây)
      //console.log(response.data.contents);
      const html = response.data.contents; 
      const symbols = parseMarketData(html);  // Truyền chuỗi HTML vào parseMarketData
      marketData = symbols;
      //console.log(marketData.length + ' Symbol in marketData updated');
      //in danh sach marketData
      //console.log('Market data updated:', marketData);
      return symbols; // Trả về dữ liệu khi thành công
    } catch (error) {
      if (error.response && error.response.status >= 500) {
        // Chỉ retry nếu lỗi server (5xx)
        console.error(`Attempt ${attempt}: Error fetching data from Myfxbook:`, error.message);
        throw error; // Re-throw để async-retry thực hiện retry
      } else {
        // Lỗi khác (ví dụ: network error, timeout), không retry
        console.error('Unrecoverable error fetching data:', error);
        bail(error);  // Ngăn retry
      }
    }
  }, {
    retries: 10, // Số lần retry tối đa
    factor: 2,  // Hệ số nhân thời gian giữa các lần retry
    minTimeout: 1000, // Thời gian chờ tối thiểu giữa các lần retry (milliseconds)
    maxTimeout: 120000 // Thời gian chờ tối đa giữa các lần retry (milliseconds)
  });
};

// Hàm phân tích dữ liệu lấy từ Myfxbook
const parseMarketData = (html) => {
  const marketData = [];
  const $ = cheerio.load(html);

  // Lấy tất cả các hàng dữ liệu trong bảng, bỏ qua hàng tiêu đề
  $('#outlookSymbolsTableContent tr').each((index, element) => {
    const row = $(element);
    // Lấy symbol
    const symbol = row.find('td:nth-child(1) a').text().trim();

    // Lấy % short và % long từ popover
    const popoverId = row.find('td:last-child div').attr('id');
    if (popoverId) {
      const shortPercentage = $(`#${popoverId} table tbody tr:nth-child(1) td:nth-child(3)`).text().replace('%', '').trim();
      const shortVolume = $(`#${popoverId} table tbody tr:nth-child(1) td:nth-child(4)`).text().replace('%', '').trim();
      const shortPosition= $(`#${popoverId} table tbody tr:nth-child(1) td:nth-child(5)`).text().replace('%', '').trim(); 
      const avgShortPrice = parseFloat(row.find(`#shortPriceCell${symbol}`).text().trim());
      const shortDistance = row.find(`#shortDisCell${symbol} span`).text().trim();
      const longPercentage = $(`#${popoverId} table tbody tr:nth-child(2) td:nth-child(2)`).text().replace('%', '').trim();
      const longVolume = $(`#${popoverId} table tbody tr:nth-child(2) td:nth-child(3)`).text().replace('%', '').trim();
      const longPositions = $(`#${popoverId} table tbody tr:nth-child(2) td:nth-child(4)`).text().replace('%', '').trim();
      const avgLongPrice = parseFloat(row.find(`#longPriceCell${symbol}`).text().trim());
      const longDistance = row.find(`#longDisCell${symbol} span`).text().trim();
      const totalPositions = parseInt(longPositions) + parseInt(shortPosition);
      marketData.push({
        symbol,
        shortPercentage: shortPercentage,
        longPercentage: longPercentage,
        shortVolume: shortVolume,
        longVolume: longVolume,
        longPositions: longPositions,
        shortPositions: shortPosition,
        totalPositions: totalPositions,
        avgShortPrice: avgShortPrice,
        avgLongPrice: avgLongPrice,
        shortDistance: shortDistance,
        longDistance: longDistance
      });
    }
  });

  return marketData;
};


// Gọi fetchData mỗi 5 phút
setInterval(async () => {
  await fetchData();
}, 5 * 60 * 1000);

// Endpoint lấy dữ liệu symbol theo API key

app.get('/ms/:symbol?', async (req, res) => { // Thêm dấu ? để symbol là optional
  const { symbol } = req.params;

  console.log(getCurrentTimeGTM7() +'Client Request Market Data for symbol:', symbol);

  if (!symbol) {
    // Không có symbol, trả về toàn bộ marketData
    return res.json(marketData);
  } else if (symbol.toLowerCase() === 'all') {
    // symbol là 'all', trả về symbol, long, short
    const allSymbolsData = marketData.map(item => ({
      symbol: item.symbol,
      longPercentage: item.longPercentage,
      shortPercentage: item.shortPercentage
    }));
    return res.json(allSymbolsData);
  
  } else {
    // Tìm kiếm dữ liệu cho symbol cụ thể
    const data = marketData.find(item => item.symbol.toLowerCase() === symbol.toLowerCase());
    console.log('Search result:', data);

    if (!data) {
      console.error('Symbol not found');
      return res.status(404).send('Symbol not found in data');
    }

    return res.json({
      symbol: data.symbol,
      longPercentage: data.longPercentage,
      shortPercentage: data.shortPercentage,
      shortVolume: data.shortVolume,
      longVolume: data.longVolume,
      longPositions: data.longPositions,
      shortPositions: data.shortPosition,
      totalPositions: data.totalPositions,
      avgShortPrice: data.avgShortPrice,
      avgLongPrice: data.avgLongPrice,
      shortDistance: data.shortDistance,
      longDistance: data.longDistance
    });
  }
});

// Handle invalid endpoint
app.use((_req, res) => {
  return res.status(404).send('Invalid endpoint');
});


/* // dành cho client webhook
const username = 'johndoe';
const apiKey = '0938247116';
const url = `http://example.com/webhook/${encodeURIComponent(username)}/${encodeURIComponent(apiKey)}`; */
