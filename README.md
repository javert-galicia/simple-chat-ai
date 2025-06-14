# Simple AI Chat

A simple chat app built with React + Vite + TypeScript + Tailwind to interact with a local AI using the AnythingLLM API.

## Features

- Chat with local models via AnythingLLM (`/api/v1/openai/chat/completions`).
- Shows the loaded model (from the `llm.model` field) and workspace name.
- Modern chat bubble interface, resizable chat area.
- Dark mode toggle.
- Tool_call support (example: current time in CDMX).
- AnythingLLM token is requested only once and can be edited from the UI (no prompt dialogs).
- Token is saved in localStorage and displayed above the model info.
- Conversation is persistent (saved in localStorage).
- Clean, modular code with no unnecessary dependencies.

## Usage

1. Clone the repository and run:
   ```sh
   npm install
   npm run dev
   ```
2. Open the app in your browser (default: http://localhost:5173).
3. Enter your AnythingLLM token in the input field at the top.
4. Start chatting with your local model and try tool_call (e.g., ask for the current time).

## Requirements
- AnythingLLM running locally and accessible at `http://localhost:3001`.
- A loaded and functional model in AnythingLLM.

## Demo
You can see a demo in the `docs/simplechatai` folder or deploy to GitHub Pages in this link: [Github Demo](https://javert-galicia.github.io/simple-chat-ai/simplechatai/).

---
Developed by Javert Galicia · 2025
