# Discord Translator between Two Channels with Dify

## What This Bot Can Do?

### Message Translation

This bot translates a message using Dify chatflow. For example, suppose the channel random-ja is connected to random-en. This bot requests Dify chatflow to translate a message comes from random-ja. After that, this bot sends a translated response from Dify chatflow to random-en.

### Slash Commands

This bot provides slash commands regarding channel connections.

- Connect two channels via `/connect ja:[channel1] en:[channel2]`
- Disconnect two channels via `/disconnect ja:[channel1] en:[channel2]`
- Show the channel corresponding to `[channel]` via `/show-target ch:[channel]`
- Show all connected channels via `/show-all`

### Translation Triggered by Emoji Reaction

This bot replies a translated message if you reacts an original message with any of the following emoji: :flag_jp:, :flag_gb:, and :flag_us:.

## How to Run Your Bot

1. Install Docker
1. Set your environment variables to `.env`
    - Set `mock` or `production` to `APP_ENV`
    - Discord token
    - Discord application id
    - Discord guild id
    - Dify base url
    - Dify API key
1. Run `make prod-up`
    - If `docker ps` includes `discord-translator`, your discord bot is running
    - Run `make prod-down` if you shutdown your bot

## Development Setup

### Requirement

- Node.js (24.18.0) 
- Optional: Docker (29.7.1)

### Develpment Build

- Set `.env.dev`
  - These enviroment variables do not include Dify API Key
  - Base URL is required to connect a local mock server
- Run `npm run dev` or `make dev-up` to start bot
  - These command require a local mock server to be running
  - These process refer to `.env.dev`
  - Press Ctrl+C or run `make dev-down` to shutdown your bot

### Start Mock Server

- Run `npm run mock`
  - This commands setup local server
  - This commands restarts a local mock server everytime compiled files for it are changed
    - Note that, because `npm run dev` compiles source files, `npm run mock` restarts a local server after rerun `npm run dev` 

### Production Build

- Set `.env`
- Run `npm run start` or `make prod-up` start bot
  - This commands requires Dify Chatflow to be running
  - Run `make prod-down` to shutdown your bot
