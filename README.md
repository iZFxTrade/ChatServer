
# Trading ChatRoom with Socket.IO Chat

Chatroom with A.I and Analytic Market 
## How to use

```
$ npm i
$ npm start
```

And point your browser to `http://localhost:3000`. Optionally, specify
a port by supplying the `PORT` env variable.

## Features

- Recived Trading Signal form TradingView
- Analytics Market with A.I
- Market Data Semtiment
- ChatRoom with A.I support 
- Send Signal to Telegram Chanel/Group

# Webhook for Tradingview Notication:
```
- domain/webhook/:username/:apiKey
```
data input is json

# Webhook for Market Semtiment
- Get Data from: 
https://www.myfxbook.com/community/outlook
Auto update each 5 munite
```
domain/ms/ return All Marketdata json
domain/ms/all return all symbol with BUY/SELL %
domain/ms/[symbol] return data of symbol
```
# Webhook for Google Gemini
model is option, defaul is gemini-1.5-pro 
```
$ domain/gemini/:username/:apiKey/:model?
```
# Webhook for OpenAI
model is option, defaul is gpt-3.5-turbo 
```
$ domain/openai/:username/:apiKey/:model?
```
# Webhook for Azure
model is option, defaul is gpt-4o-mini 
```
$ domain/azure/:username/:apiKey/:model?
```
# Webhook for All A.I
run 3 A.I with defaul model
```
$ domain/allai/:username/:apiKey/:model?
```
